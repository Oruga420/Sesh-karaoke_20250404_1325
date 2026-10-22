const path = require('node:path');
const axios = require('axios');
const { createResolver } = require('../lib/lyricsResolver');
const { createJsonStore } = require('../lib/lyricsStore');
const { createApp } = require('../server/server');

let providerCalls = 0;
const httpClient = { async get(url, config) {
  providerCalls++;
  if (process.env.LYRICS_TEST_OFFLINE === '1') throw new Error('Upstream providers disabled for fresh-process cache verification');
  return axios.get(url, config);
} };
const directory = process.env.LYRICS_TEST_DIRECTORY;
const resolver = createResolver({ httpClient, ...(directory ? { store: createJsonStore({ directory }) } : {}) });
const app = createApp({ resolver, buildDir: path.join(__dirname, '..', 'build'), serveFrontend: process.env.LYRICS_TEST_FRONTEND === '1' });
const server = app.listen(0, '127.0.0.1', () => process.send?.({ pid: process.pid, url: `http://127.0.0.1:${server.address().port}` }));
process.on('message', message => {
  if (message?.stats) process.send?.({ id: message.id, pid: process.pid, providerCalls, providersDisabled: process.env.LYRICS_TEST_OFFLINE === '1' });
  if (message?.close) {
    server.close(() => process.exit(0));
    server.closeAllConnections();
    setTimeout(() => process.exit(0), 500).unref();
  }
});
