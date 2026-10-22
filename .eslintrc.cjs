module.exports = {
  root: true,
  extends: ['react-app', 'react-app/jest'],
  ignorePatterns: ['build/', 'artifacts/', 'node_modules/', 'spotify-lyrics-viewer-master/'],
  overrides: [{
    files: ['**/*.cjs', 'api/**/*.js', 'lib/**/*.js', 'server/**/*.js', 'src/setupProxy.js'],
    env: { node: true, browser: false, jest: false },
    parserOptions: { ecmaVersion: 2022, sourceType: 'script' },
    extends: ['eslint:recommended'],
  }, {
    // These suites use ReactDOM's createRoot, not Testing Library's wrapped render.
    // Explicit act() is necessary for React effects and concurrent updates.
    files: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    rules: { 'testing-library/no-unnecessary-act': 'off' },
  }, {
    files: ['scripts/e2e.cjs'],
    env: { node: true, browser: true },
  }],
};
