const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const www = path.join(root, 'www');

const SKIP = new Set([
  '.git',
  'node_modules',
  'android',
  'www',
  '.bin',
  'server',
  'scripts',
  '.github'
]);

const SKIP_FILES = new Set([
  'package.json',
  'package-lock.json',
  'capacitor.config.json',
  'start-mobile.sh',
  '.tunnel.log',
  '.server.log',
  '.lt.log'
]);

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    if (SKIP.has(name) || name.endsWith('.log')) continue;
    const srcPath = path.join(src, name);
    const destPath = path.join(dest, name);
    const stat = fs.statSync(srcPath);
    if (stat.isDirectory()) {
      copyDir(srcPath, destPath);
    } else if (!SKIP_FILES.has(name)) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

if (fs.existsSync(www)) fs.rmSync(www, { recursive: true, force: true });
copyDir(root, www);
console.log('www/ sincronizado para Android.');
