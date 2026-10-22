const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function collect(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const filename = path.join(directory, entry.name);
    return entry.isDirectory() ? collect(filename) : /\.test\.(c?js)$/.test(entry.name) ? [filename] : [];
  });
}
const files = collect(path.join(__dirname, '..', 'tests'));
if (!files.length) throw new Error('No API/integration test files found');
const result = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit', cwd: path.join(__dirname, '..') });
process.exit(result.status ?? 1);
