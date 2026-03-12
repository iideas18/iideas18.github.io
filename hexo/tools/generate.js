'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const Hexo = require('hexo');

const EXCLUDED_SOURCE_NAMES = new Set(['.vscode', '_posts']);
const SYNC_ROOT_EXCLUDES = [
  '.git/',
  '.github/',
  'hexo/',
  'node_modules/',
  'README.md',
  '.gitignore',
  '.impulse',
  'scripts/'
];

function copyRecursive(sourcePath, targetPath) {
  const stat = fs.statSync(sourcePath);

  if (stat.isDirectory()) {
    fs.mkdirSync(targetPath, { recursive: true });
    for (const entry of fs.readdirSync(sourcePath)) {
      if (EXCLUDED_SOURCE_NAMES.has(entry)) continue;
      copyRecursive(path.join(sourcePath, entry), path.join(targetPath, entry));
    }
    return;
  }

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.copyFileSync(sourcePath, targetPath);
}

function copySourceIntoPublic(hexoRoot) {
  const sourceDir = path.join(hexoRoot, 'source');
  const publicDir = path.join(hexoRoot, 'public');

  for (const entry of fs.readdirSync(sourceDir)) {
    if (EXCLUDED_SOURCE_NAMES.has(entry)) continue;
    copyRecursive(path.join(sourceDir, entry), path.join(publicDir, entry));
  }
}

function syncPublicToRoot(hexoRoot) {
  const repoRoot = path.dirname(hexoRoot);
  const publicDir = path.join(hexoRoot, 'public') + '/';
  const args = ['-a', '--delete'];

  for (const pattern of SYNC_ROOT_EXCLUDES) {
    args.push(`--exclude=${pattern}`);
  }

  args.push(publicDir, repoRoot + '/');
  execFileSync('rsync', args, { stdio: 'inherit' });
}

async function main() {
  const hexoRoot = path.resolve(__dirname, '..');
  const shouldSyncRoot = process.argv.includes('--sync-root');
  const hexo = new Hexo(hexoRoot, {});

  await hexo.init();
  await hexo.call('clean', {});
  await hexo.call('generate', {});
  copySourceIntoPublic(hexoRoot);

  if (shouldSyncRoot) {
    syncPublicToRoot(hexoRoot);
  }

  await hexo.exit();
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
