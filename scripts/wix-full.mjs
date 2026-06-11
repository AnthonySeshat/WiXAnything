#!/usr/bin/env node
/**
 * wix-full.mjs — one command for the whole picture:
 *   1) sync element types from the live site + generate the map
 *   2) scan the PUBLISHED page for layout + styles (all steps, ToS-safe)
 *   3) merge layout into the element map
 *
 *   npm run wix:full -- --url "<published-page-url>"        (from an installed site)
 *   node scripts/wix-full.mjs --repo <site> --out <dir> --url <published-url>
 *
 * Without --url it just does the element map (types). With --url it adds the visual
 * layer (needs the visual deps: `cd visual && npm install` once).
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');           // repo root (scripts/ lives under it)
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i !== -1 && argv[i + 1] ? argv[i + 1] : d; };
const REPO = arg('--repo', process.cwd());
const OUT = arg('--out', REPO);
// URL precedence: --url flag > saved wixanything.config.json > none. A freshly-passed
// url is remembered so future `npm run wix:full` runs need no args.
const cfgPath = join(REPO, 'wixanything.config.json');
let cfg = {};
try { cfg = JSON.parse(readFileSync(cfgPath, 'utf8')); } catch {}
const urlArg = arg('--url', null);
const URL = urlArg || cfg.url || null;
if (urlArg && urlArg !== cfg.url) {
  try { writeFileSync(cfgPath, JSON.stringify({ ...cfg, url: URL }, null, 2) + '\n'); console.log('(saved url to wixanything.config.json — future runs need no --url)'); } catch {}
}

const run = (label, file, args) => {
  console.log(`\n▶ ${label}`);
  return (spawnSync(process.execPath, [file, ...args], { stdio: 'inherit' }).status ?? 0);
};

// 1) element types (auth + sync-types + generate)
run('1/3  element map  (wix sync-types + generate)', join(__dirname, 'wix-doctor.mjs'), ['--repo', REPO, '--out', OUT, '--soft']);

if (URL) {
  const scan = join(ROOT, 'visual', 'scan.mjs');
  const visualOut = join(ROOT, 'visual', 'wix-visual.json');
  if (!existsSync(join(ROOT, 'visual', 'node_modules'))) {
    console.log('\n…  first run: installing the visual scanner (one-time, ~1–2 min)');
    spawnSync('npm', ['install', '--no-audit', '--no-fund'], { cwd: join(ROOT, 'visual'), stdio: 'inherit', shell: true });
  }
  if (existsSync(join(ROOT, 'visual', 'node_modules'))) {
    run('2/3  visual scan  (layout + styles, all steps)', scan, [URL, '--out', visualOut, '--elements', join(OUT, 'wix-elements.json'), '--full']);
    run('3/3  merge layout into the element map', join(__dirname, 'wix-elements-gen.mjs'), ['--repo', REPO, '--out', OUT, '--visual', visualOut]);
  } else {
    console.log('⚠  visual deps did not install — run manually: cd visual && npm install');
  }
} else {
  console.log('\n(no --url and none saved → element map only; pass --url "<published page>" once and it is remembered)');
}
console.log(`\n✓ done → ${join(OUT, 'wix-elements.md')}`);
