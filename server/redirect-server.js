// Retired: the active client receives and validates PKCE state at /callback.
// Do not run an intermediate callback listener that can lose state or log codes.
if (require.main === module) {
  console.error('The legacy redirect helper is retired. Use the application callback at http://127.0.0.1:3000/callback.');
  process.exitCode = 1;
}
