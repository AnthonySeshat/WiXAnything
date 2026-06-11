#!/usr/bin/env node
/**
 * wix-check.mjs — staleness guard.
 * Prefers a CONTENT-HASH comparison (works on a fresh clone, where git discards
 * mtimes); falls back to mtime for older maps that predate inputsHash.
 * Exits non-zero when the map is stale so a hook/CI can flag it.
 *
 *   node scripts/wix-check.mjs [--repo <path>]
 */
import { statSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i !== -1 && argv[i + 1] ? argv[i + 1] : d; };
const REPO = arg('--repo', process.cwd());
const map = join(REPO, 'wix-elements.json');
const types = join(REPO, '.wix', 'types');

if (!existsSync(types)) process.exit(0); // nothing local to compare (e.g. fresh clone before `wix sync-types`)
if (!existsSync(map)) { console.error('⚠ wix-elements.json is missing — run `npm run wix:elements`'); process.exit(1); }

// MUST stay identical to hashTypes() in wix-elements-gen.mjs
function hashTypes(typesDir) {
  const parts = [];
  for (const entry of readdirSync(typesDir)) {
    if (['wix-code-types', 'backend', 'public'].includes(entry)) continue;
    const f = entry === 'masterPage' ? join(typesDir, 'masterPage', 'masterPage.d.ts') : join(typesDir, entry, entry + '.d.ts');
    let c = null; try { c = readFileSync(f, 'utf8'); } catch {}
    if (c != null) parts.push([entry, c]);
  }
  parts.sort((a, b) => a[0].localeCompare(b[0]));
  const h = createHash('sha256');
  for (const [k, v] of parts) { h.update(k); h.update(v); }
  return h.digest('hex').slice(0, 16);
}

let stored = null;
try { stored = JSON.parse(readFileSync(map, 'utf8')).inputsHash || null; } catch {}
const current = hashTypes(types);

if (stored && current) {
  if (stored !== current) { console.error('⚠ element map is STALE (.wix/types content changed since generation) — run `npm run wix:elements`'); process.exit(1); }
  console.log('✓ element map is fresh (content hash matches)');
  process.exit(0);
}

// fallback: mtime, for older maps without an inputsHash
function newestMtime(dir) {
  let t = 0;
  for (const n of readdirSync(dir)) { const p = join(dir, n); let s; try { s = statSync(p); } catch { continue; } t = Math.max(t, s.isDirectory() ? newestMtime(p) : s.mtimeMs); }
  return t;
}
if (newestMtime(types) > statSync(map).mtimeMs + 1000) { console.error('⚠ element map looks STALE (.wix/types newer than wix-elements.json) — run `npm run wix:elements`'); process.exit(1); }
console.log('✓ element map is fresh');
