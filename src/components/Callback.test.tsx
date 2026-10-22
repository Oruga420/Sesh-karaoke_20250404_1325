import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import Callback from './Callback';
import { clearSpotifySession } from '../spotify';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }));

let container: HTMLDivElement;
let root: Root;
let fetchMock: jest.Mock;
let consoleError: jest.SpyInstance;

function seedCallback() {
  sessionStorage.setItem('spotify_pkce_verifier', 'test-verifier');
  sessionStorage.setItem('spotify_oauth_state', 'test-state');
  sessionStorage.setItem('spotify_redirect_uri', 'http://127.0.0.1:3000/callback');
  window.history.replaceState({}, '', '/callback?code=test-code&state=test-state&keep=1');
}

function response(status: number, data: unknown): Response {
  return {
    ok: status >= 200 && status < 300, status,
    json: jest.fn().mockResolvedValue(data), text: jest.fn().mockResolvedValue(JSON.stringify(data)),
    headers: { get: () => null },
  } as unknown as Response;
}

beforeAll(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

beforeEach(() => {
  jest.useFakeTimers();
  localStorage.clear();
  sessionStorage.clear();
  clearSpotifySession();
  mockNavigate.mockReset();
  fetchMock = jest.fn();
  global.fetch = fetchMock;
  process.env.REACT_APP_SPOTIFY_CLIENT_ID = 'test-public-client';
  window.history.replaceState({}, '', '/callback');
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  jest.clearAllTimers();
  jest.useRealTimers();
  consoleError.mockRestore();
});

it('completes under StrictMode with one exchange, one store and one navigation', async () => {
  seedCallback();
  let resolve!: (value: Response) => void;
  fetchMock.mockReturnValue(new Promise<Response>((res) => { resolve = res; }));
  await act(async () => root.render(<React.StrictMode><Callback /></React.StrictMode>));
  expect(fetchMock).toHaveBeenCalledTimes(1);
  await act(async () => resolve(response(200, { access_token: 'test-access', expires_in: 3600, refresh_token: 'test-refresh' })));
  expect(mockNavigate).toHaveBeenCalledTimes(1);
  expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
  expect(localStorage.getItem('spotify_token')).toBe('test-access');
  expect(window.location.search).toBe('?keep=1');
  expect(sessionStorage.getItem('spotify_pkce_verifier')).toBeNull();
});

it('does not save tokens or navigate when unmounted during exchange', async () => {
  seedCallback();
  let resolve!: (value: Response) => void;
  fetchMock.mockReturnValue(new Promise<Response>((res) => { resolve = res; }));
  await act(async () => root.render(<Callback />));
  act(() => root.unmount());
  root = createRoot(container);
  await act(async () => resolve(response(200, { access_token: 'stale-access', expires_in: 3600 })));
  expect(mockNavigate).not.toHaveBeenCalled();
  expect(localStorage.getItem('spotify_token')).toBeNull();
});

it('cleans the actual error redirect timer when unmounted', async () => {
  seedCallback();
  fetchMock.mockResolvedValueOnce(response(400, { error: 'invalid_grant' }));
  await act(async () => root.render(<Callback />));
  expect(container.textContent).toMatch(/autenticaci[oó]n|error|token/i);
  act(() => root.unmount());
  root = createRoot(container);
  act(() => jest.runAllTimers());
  expect(mockNavigate).not.toHaveBeenCalled();
  expect(window.location.search).toBe('?keep=1');
});

it('removes OAuth error parameters and cleans pending PKCE on a denied callback', async () => {
  seedCallback();
  window.history.replaceState({}, '', '/callback?error=access_denied&state=test-state&keep=1');
  await act(async () => root.render(<React.StrictMode><Callback /></React.StrictMode>));
  expect(container.textContent).toContain('access_denied');
  expect(fetchMock).not.toHaveBeenCalled();
  expect(window.location.search).toBe('?keep=1');
  expect(sessionStorage.getItem('spotify_pkce_verifier')).toBeNull();
  act(() => jest.runAllTimers());
  expect(mockNavigate).toHaveBeenCalledTimes(1);
});

it('shows missing-code status and cancels navigation on unmount', async () => {
  await act(async () => root.render(<Callback />));
  expect(container.textContent).toMatch(/c[oó]digo/i);
  act(() => root.unmount());
  root = createRoot(container);
  act(() => jest.runAllTimers());
  expect(mockNavigate).not.toHaveBeenCalled();
  expect(fetchMock).not.toHaveBeenCalled();
});
