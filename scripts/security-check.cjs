const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const placeholders = /^(?:your[_-]|example|placeholder|dummy|fixture|synthetic|test[_-]|<|\$\{|process\.|not[_ -]?set|undefined|null)/i;
const patterns = [
  { id: 'provider-token-prefix', regex: /\b(?:sk-[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|AIza[A-Za-z0-9_-]{30,}|AKIA[A-Z0-9]{16}|xox[baprs]-[A-Za-z0-9-]{20,})\b/g },
  { id: 'credential-assignment', regex: /\b(?:[A-Z_]*(?:API_KEY|CLIENT_SECRET|ACCESS_TOKEN|REFRESH_TOKEN|PASSWORD)|apiKey|clientSecret|happiKey)\s*[:=]\s*["']([^"'\r\n]{8,})["']/g },
  { id: 'dotenv-secret', regex: /^\s*[A-Z_]*(?:API_KEY|CLIENT_SECRET|ACCESS_TOKEN|REFRESH_TOKEN|PASSWORD)\s*=\s*["']?([^\s"'#][^\r\n]*)/gm },
  { id: 'private-key', regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
  { id: 'frontend-secret-variable', regex: /^\s*REACT_APP_[A-Z_]*(?:SECRET|API_KEY)\s*=\s*([^\s#][^\r\n]*)/gm },
];
const textExtension = /\.(?:[cm]?js|jsx|ts|tsx|json|map|css|ya?ml|html|md|txt|bat|ps1|py|env|example)$/i;
// Compare known removed credential literals in local HEAD against emitted code,
// without displaying, persisting or invoking any value. No remote history is read.
const previousValues = new Set();
for (const relative of ['.env.production', 'src/App.tsx', 'src/services/lyricsService.ts', 'test-happi-api.js']) {
  let previous;
  try { previous = execFileSync('git', ['show', `HEAD:${relative}`], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch { continue; }
  for (const pattern of patterns.filter(item => ['credential-assignment', 'dotenv-secret', 'frontend-secret-variable'].includes(item.id))) {
    pattern.regex.lastIndex = 0;
    for (const match of previous.matchAll(pattern.regex)) {
      const value = match[1]?.replace(/\s+#.*$/, '').replace(/["']$/, '').trim();
      if (value && value.length >= 8 && !placeholders.test(value)) previousValues.add(value);
    }
  }
}
function inspect(relative) {
  const filename = path.join(root, relative);
  if (!fs.existsSync(filename) || !fs.statSync(filename).isFile()) return [];
  if (!(textExtension.test(relative) || /(?:^|\/)\.env(?:\.|$)/.test(relative))) return [];
  const content = fs.readFileSync(filename, 'utf8');
  const findings = [];
  for (const pattern of patterns) {
    pattern.regex.lastIndex = 0;
    for (const match of content.matchAll(pattern.regex)) {
      const value = (match[1] || match[0]).trim();
      if (placeholders.test(value)) continue;
      findings.push({ file: relative.replaceAll('\\', '/'), line: content.slice(0, match.index).split('\n').length, pattern: pattern.id });
    }
  }
  for (const value of previousValues) {
    const index = content.indexOf(value);
    if (index >= 0) findings.push({ file: relative.replaceAll('\\', '/'), line: content.slice(0, index).split('\n').length, pattern: 'previous-credential-literal' });
  }
  return findings;
}
function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const filename = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(filename) : [path.relative(root, filename)];
  });
}
const tracked = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
const build = fs.existsSync(path.join(root, 'build')) ? walk(path.join(root, 'build')) : [];
const files = [...new Set([...tracked, ...build])];
const findings = files.flatMap(inspect);
const report = {
  ok: findings.length === 0 && build.length > 0,
  findings,
  scannedFiles: files.length,
  builtBundlePresent: build.length > 0,
  scope: 'Tracked and unignored new text files plus current build output; removed files skipped. Known removed literals from four local HEAD paths are checked without disclosure. Remote Git history and provider dashboards are outside this scan.',
  patterns: [...patterns.map(pattern => pattern.id), 'previous-credential-literal'],
  previousCredentialValuesChecked: previousValues.size,
  skippedPlaceholders: placeholders.source,
};
fs.mkdirSync(path.join(root, 'artifacts'), { recursive: true });
fs.writeFileSync(path.join(root, 'artifacts/security-check.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report));
process.exitCode = report.ok ? 0 : 1;
