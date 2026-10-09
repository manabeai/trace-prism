import { readFileSync } from 'node:fs';
import console from 'node:console';
import process from 'node:process';
import { URL } from 'node:url';

const [manifestPath, expectedVersion, releaseTag] = process.argv.slice(2);
if (!manifestPath || !expectedVersion || !releaseTag) {
  throw new Error('usage: validate-updater-manifest.mjs MANIFEST VERSION TAG');
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
if (manifest.version !== expectedVersion) {
  throw new Error(`updater version ${manifest.version} does not match ${expectedVersion}`);
}

const targets = {
  'linux-x86_64': '.AppImage',
  'darwin-aarch64': '.app.tar.gz',
  'darwin-x86_64': '.app.tar.gz',
  'windows-x86_64': '.exe',
};

for (const [target, extension] of Object.entries(targets)) {
  const entry = manifest.platforms?.[target];
  if (!entry || typeof entry.signature !== 'string' || !entry.signature.trim()) {
    throw new Error(`${target}: updater signature is missing`);
  }
  const url = new URL(entry.url);
  const releasePath = `/manabeai/trace-prism/releases/download/${releaseTag}/`;
  if (
    url.protocol !== 'https:' ||
    url.hostname !== 'github.com' ||
    !decodeURIComponent(url.pathname).startsWith(releasePath) ||
    !url.pathname.endsWith(extension)
  ) {
    throw new Error(`${target}: unexpected update bundle URL ${entry.url}`);
  }
}

console.log(`Updater manifest verified for ${expectedVersion}: ${Object.keys(targets).join(', ')}`);
