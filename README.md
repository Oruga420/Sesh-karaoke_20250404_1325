# Oruga Karaoke

React/TypeScript karaoke client with a shared Express/Vercel lyrics resolver. Manual title/artist lookup works without Spotify login. Spotify playback uses PKCE and a public application client ID; no client secret belongs in this frontend.

## Run locally

Use the existing lockfile and installed dependencies. For a fresh personal checkout, `npm ci` restores the locked root dependencies; this change adds none. Copy `.env.example` to ignored `.env.local`, configure your own public Spotify client ID, and register `http://127.0.0.1:3000/callback` in your personal Spotify application if playback is needed. The existing public client ID is retained only in this machine's ignored local configuration. Redirects must use HTTPS or an explicit loopback IP; `localhost` is not a supported Spotify redirect.

Run `npm run start-api` and `npm start` in separate terminals, or use `npm run start-all`, then open `http://127.0.0.1:3000`. The CRA proxy sends same-origin `/api` requests to `http://127.0.0.1:3001`. An empty `REACT_APP_API_URL` uses that same-origin path.

`npm run build` creates the production frontend. `npm run start-api` can serve that build and `/api/lyrics` from the same Express process. Vercel routes `/lyrics` and legacy lyric URLs to the real shared handler.

## Lyrics and saved JSON

The resolver tries LRCLIB signature and conservative catalog matching, then an ordinary title/artist-only lyrics.ovh fallback. Provider results can be synced by line, plain, instrumental, missing, or temporarily unavailable. Real line timestamps drive highlighting; the application does not generate lyrics or word timings. Live/remix/version-sensitive requests skip the identity-unverified fallback. Attribution and matched/requested recording metadata accompany every successful result. Title/artist-only fallback text is explicitly unverified as a recording match.

There are three separate cache scopes:

- Express uses bounded memory and atomic JSON files under ignored `.cache/lyrics` on this writable local machine. A different process can recover those files.
- Vercel uses bounded, ephemeral memory. It does not provide shared durable JSON storage across instances or deployments.
- The browser saves validated, bounded, expiring JSON on the current device. This is independent of the server's cache, can be evicted by the browser, and can fail when storage is disabled or full. Download/import transfers the versioned JSON wrapper with provenance; no remote publication occurs.

Missing results are separate from provider errors. Retry remains available for the same song and honors a server cooldown. Production builds cache the same-origin app shell for a full offline reload, which can then reuse device JSON. The CRA development server saves device JSON but does not register that service worker. Uncached lookups require a connection. Imported JSON is data and is rendered as text.

## Verification

Use these commands with the existing dependencies:

```text
npm run test:api
npm test -- --watchAll=false --runInBand   # CI=true
npm run typecheck
npm run lint
npm run build
npm run smoke
node scripts/browser-preflight.cjs
npm run test:e2e
npm run security:check
git diff --check
node scripts/benchmark.cjs
```

`smoke` uses real local HTTP and a live public lyric provider, checks a warm hit, then starts a different PID with providers disabled and requires a persistent disk hit. Its temporary local cache is removed after verification. `test:e2e` requires an existing browser/runtime preflight, performs an unintercepted manual live lookup, and separately exercises deterministic browser fixtures. No browser or npm dependency is downloaded by those commands. Evidence, screenshots and local export files stay under ignored `artifacts/`.

Set `KARAOKE_BROWSER_PATH` to one existing Chrome/Edge executable to select it explicitly; no other browser is tried when that variable is set. `KARAOKE_BROWSER_LAUNCH_TIMEOUT_MS` accepts a bounded launch timeout up to 30000 ms. Preflight verifies real DOM rendering and records the owned browser PID and its termination; the browser harness does not terminate unrelated applications.
The equivalent command arguments are `--browser-path="C:/path/to/msedge.exe" --launch-timeout-ms=30000` (append them directly to the Node script command, or after `npm run test:e2e --`).
For shells that cannot preserve a quoted executable path, ignored `artifacts/browser-options.json` can contain `{"browserPath":"C:/path/to/msedge.exe","launchTimeoutMs":30000}`; `--options=path/to/options.json` selects another local options file.

The benchmark uses this run's ignored `artifacts/baseline/` files to compare three synthetic baseline defects and eight frozen catalog-selected diagnostic requests. It fails clearly if those local baseline files are absent. It records expected and returned metadata, status, source, timing, latency and wrong/unverifiable classifications without full lyric text. These counts do not establish repertoire-wide coverage. Live network failure blocks live acceptance; mocked fixtures cannot replace it.

`security:check` scans tracked text files (including the retained upstream snapshot) plus the current built bundle for documented credential-literal patterns. Placeholder fixture strings are skipped by documented prefixes. Its JSON reports filenames/lines and pattern names, never matched secret values. It does not inspect remote Git history or provider dashboards. Diagnostics are disabled unless server-only `DEBUG_ACCESS_TOKEN` is configured; authorized output contains only service metadata. The old probe endpoints no longer echo tokens, headers or credentials, and no paid provider key is required.

## Personal release steps

Local verification is separate from release. Before an owner-approved publication, review the diff and A1–A9 evidence, rotate any previously exposed credentials in the owner's provider dashboard, configure only personal accounts/environment values, verify the destination repository and deployment, and run a separate production acceptance check. Confirm real Spotify authorization and playback using the owner's account.

The existing personal hosting project is `oruga420s-projects/sesh-karaoke`. Link it explicitly with `vercel link --yes --project sesh-karaoke --scope oruga420s-projects`. Use `vercel deploy --prod --skip-domain --scope oruga420s-projects` to build an unaliased production candidate, verify its UI and `/api/lyrics`, then promote that exact deployment with `vercel promote <deployment-url> --scope oruga420s-projects`. Keep `REACT_APP_API_URL` empty for same-origin requests and use the stable HTTPS callback URL already allowed in the owner's Spotify app. Only the public client ID belongs in frontend configuration.

`.vercelignore` excludes local credentials, lyric caches, evidence, generated reports and planning state from upload. Parser helpers live in `lib/` so Vercel only treats actual HTTP handlers in `api/` as functions. Publishing and deploying do not rotate keys, provision shared cloud JSON storage, or verify the owner's Spotify consent/playback.
