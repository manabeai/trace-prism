import { readFileSync, writeFileSync } from 'node:fs';
import process from 'node:process';
import { URL } from 'node:url';

const [manifestPath, assetsPath, releaseTag] = process.argv.slice(2);
if (!manifestPath || !assetsPath || !releaseTag) {
  throw new Error('usage: normalize-updater-manifest.mjs MANIFEST ASSETS TAG');
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const assets = JSON.parse(readFileSync(assetsPath, 'utf8')).assets;
const assetsByApiUrl = new Map(assets.map((asset) => [asset.apiUrl, asset]));
const assetNames = new Set(assets.map((asset) => asset.name));

for (const [platform, entry] of Object.entries(manifest.platforms ?? {})) {
  const asset = assetsByApiUrl.get(entry.url);
  if (!asset) {
    throw new Error(`${platform}: update bundle is absent from the release`);
  }
  if (!assetNames.has(`${asset.name}.sig`)) {
    throw new Error(`${platform}: update signature is absent from the release`);
  }
  entry.url = new URL(
    `/manabeai/trace-prism/releases/download/${encodeURIComponent(releaseTag)}/${encodeURIComponent(asset.name)}`,
    'https://github.com',
  ).href;
}

writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
