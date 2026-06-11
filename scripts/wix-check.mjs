#!/usr/bin/env node
/**
 * wix-check.mjs — staleness guard.
 * Is wix-elements.json older than the .wix/types it derives from? If so the map is
 * stale ("did you re-run wix:elements?") — exit non-zero so a hook/CI can flag it.
 *
 *   node scripts/wix-check.mjs [--repo <path>]
 */
import { statSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i !== -1 && argv[i + 1] ? argv[i + 1] : d; };
const REPO = arg('--repo', process.cwd());
const map = join(REPO, 'wix-elements.json');
const types = join(REPO, '.wix', 'types');

if (!existsSync(types)) process.exit(0); // nothing local to compare against (e.g. fresh clone)
if (!existsSync(map)) { console.error('⚠ wix-elements.json is missing — run `npm run wix:elements`'); process.exit(1); }

function newestMtime(dir) {
  let t = 0;
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    let s; try { s = statSync(p); } catch { continue; }
    t = Math.max(t, s.isDirectory() ? newestMtime(p) : s.mtimeMs);
  }
  return t;
}

const mapMtime = statSync(map).mtimeMs;
if (newestMtime(types) > mapMtime + 1000) { // 1s grace
  console.error('⚠ element map looks STALE (.wix/types is newer than wix-elements.json) — run `npm run wix:elements`');
  process.exit(1);
}
console.log('✓ element map is fresh');
