const { test } = require('node:test');
const assert = require('node:assert/strict');
const diagnosticHandler = require('../../api/debug');
const callback = require('../../api/callback');
const { createHandler } = require('../../api/refresh-token');

function response() {
  return { statusCode: 200, headers: {}, setHeader(name, value) { this.headers[name] = value; }, status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; return this; }, redirect(status, location) { this.statusCode = status; this.location = location; return this; } };
}
test('diagnostics stay hidden by default and never echo credentials or request data', () => {
  const original = process.env.DEBUG_ACCESS_TOKEN;
  try {
    delete process.env.DEBUG_ACCESS_TOKEN;
    const hidden = response();
    diagnosticHandler({ method: 'GET', headers: { authorization: 'Bearer fixture-private' }, query: { testHappi: 'true' } }, hidden);
    assert.equal(hidden.statusCode, 404);
    process.env.DEBUG_ACCESS_TOKEN = 'fixture-diagnostic-token';
    const allowed = response();
    diagnosticHandler({ method: 'GET', headers: { authorization: `Bearer ${process.env.DEBUG_ACCESS_TOKEN}`, cookie: 'fixture-private' }, query: { testHappi: 'true' } }, allowed);
    assert.equal(allowed.statusCode, 200);
    assert.equal(allowed.headers['Cache-Control'], 'no-store');
    assert.doesNotMatch(JSON.stringify(allowed.body), /fixture|cookie|happi|authorization|preview|headers/i);
    const wrong = response();
    diagnosticHandler({ method: 'GET', headers: { authorization: 'Bearer incorrect' } }, wrong);
    assert.equal(wrong.statusCode, 404);
  } finally { original === undefined ? delete process.env.DEBUG_ACCESS_TOKEN : process.env.DEBUG_ACCESS_TOKEN = original; }
});
test('legacy callback only redirects expected code/state/error fields to the SPA', () => {
  const res = response();
  callback({ method: 'GET', query: { code: 'fixture-code', state: 'fixture-state', redirect: 'https://other.example', access_token: 'fixture-private' } }, res);
  assert.equal(res.statusCode, 302);
  assert.equal(res.location, '/callback?code=fixture-code&state=fixture-state');
});
test('refresh accepts a POST body, uses PKCE public client and redacts upstream failures', async () => {
  const calls = [];
  const handler = createHandler({ clientId: 'fixture-public-id', httpClient: { async post(...args) { calls.push(args); return { data: { access_token: 'fixture-access', expires_in: 3600 } }; } } });
  const get = response();
  await handler({ method: 'GET', query: { refresh_token: 'fixture-refresh' } }, get);
  assert.equal(get.statusCode, 405);
  assert.equal(calls.length, 0);
  const post = response();
  await handler({ method: 'POST', body: { refreshToken: 'fixture-refresh' } }, post);
  assert.equal(post.statusCode, 200);
  assert.equal(calls[0][0], 'https://accounts.spotify.com/api/token');
  assert.equal(new URLSearchParams(calls[0][1]).get('client_id'), 'fixture-public-id');
  assert.equal(calls[0][2].headers.Authorization, undefined);
  const failed = createHandler({ clientId: 'fixture-public-id', httpClient: { async post() { throw Object.assign(new Error('fixture-private-error'), { response: { status: 400, data: { token: 'fixture-private-token' } } }); } } });
  const error = response();
  await failed({ method: 'POST', body: { refreshToken: 'fixture-refresh' } }, error);
  assert.equal(error.statusCode, 401);
  assert.doesNotMatch(JSON.stringify(error.body), /fixture/);
});
