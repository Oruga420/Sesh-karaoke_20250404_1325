const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { ESLint } = require('eslint');

const root = path.join(__dirname, '..');
function collect(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (entry.name === 'node_modules') return [];
    const filename = path.join(directory, entry.name);
    return entry.isDirectory() ? collect(filename) : /\.(c?js)$/.test(filename) ? [filename] : [];
  });
}
(async () => {
  const eslint = new ESLint({ cwd: root, errorOnUnmatchedPattern: false });
  const results = await eslint.lintFiles(['src/**/*.{ts,tsx,js}', 'public/sw.js', 'api/**/*.js', 'lib/**/*.js', 'server/**/*.js', 'scripts/**/*.cjs', 'tests/**/*.cjs', '.eslintrc.cjs']);
  const errors = results.reduce((sum, result) => sum + result.errorCount, 0);
  const warnings = results.reduce((sum, result) => sum + result.warningCount, 0);
  const formatter = await eslint.loadFormatter('stylish');
  const details = formatter.format(results);
  if (details) process.stdout.write(details);
  const files = ['api', 'lib', 'server', 'scripts', 'tests'].flatMap(directory => collect(path.join(root, directory)))
    .concat(path.join(root, 'src/setupProxy.js'), path.join(root, 'public/sw.js'));
  let syntaxFailures = 0;
  for (const filename of files) {
    try {
      // Parse classic Node/CommonJS and service-worker scripts without execution.
      new vm.Script(fs.readFileSync(filename, 'utf8'), { filename });
    } catch (error) {
      syntaxFailures++; console.error(`${filename}: ${error.message}`);
    }
  }
  console.log(JSON.stringify({ ok: errors === 0 && warnings === 0 && syntaxFailures === 0, errors, warnings, syntaxFailures, syntaxFiles: files.length, syntaxEngine: 'Node V8 Script (no execution)' }));
  process.exitCode = errors || warnings || syntaxFailures ? 1 : 0;
})().catch(error => { console.error(error.message); process.exitCode = 1; });
