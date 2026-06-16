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
// Collect ALL --url args (repeatable for whole-site coverage); fall back to the
// saved urls[] (or the legacy single url string). A freshly-passed set is saved.
const urlArgs = [];
for (let i = 0; i < argv.length; i++) if (argv[i] === '--url' && argv[i + 1] && !argv[i + 1].startsWith('--')) urlArgs.push(argv[++i]);
const savedUrls = Array.isArray(cfg.urls) ? cfg.urls : (cfg.url ? [cfg.url] : []); // guard a hand-edited string
const urls = [...new Set(urlArgs.length ? urlArgs : savedUrls)];
if (urlArgs.length) {
  const { url: _legacy, ...rest } = cfg; // migrate fully to urls[]; drop the stale legacy scalar
  try { writeFileSync(cfgPath, JSON.stringify({ ...rest, urls }, null, 2) + '\n'); console.log(`(saved ${urls.length} url(s) to wixanything.config.json — future runs need no --url)`); } catch {}
}

const run = (label, file, args) => {
  console.log(`\n▶ ${label}`);
  return (spawnSync(process.execPath, [file, ...args], { stdio: 'inherit' }).status ?? 0);
};

// 1) element types (auth + sync-types + generate)
run('1/3  element map  (wix sync-types + generate)', join(__dirname, 'wix-doctor.mjs'), ['--repo', REPO, '--out', OUT, '--soft']);

if (urls.length) {
  const scan = join(ROOT, 'visual', 'scan.mjs');
  const visualOut = join(ROOT, 'visual', 'wix-visual.json');
  if (!existsSync(join(ROOT, 'visual', 'node_modules'))) {
    console.log('\n…  first run: installing the visual scanner (one-time, ~1–2 min)');
    spawnSync('npm', ['install', '--no-audit', '--no-fund'], { cwd: join(ROOT, 'visual'), stdio: 'inherit', shell: true });
  }
  if (existsSync(join(ROOT, 'visual', 'node_modules'))) {
    run(`2/3  visual scan  (layout + styles, all steps · ${urls.length} page${urls.length > 1 ? 's' : ''})`, scan, [...urls, '--out', visualOut, '--elements', join(OUT, 'wix-elements.json'), '--full']);
    run('3/3  merge layout into the element map', join(__dirname, 'wix-elements-gen.mjs'), ['--repo', REPO, '--out', OUT, '--visual', visualOut]);
  } else {
    console.log('⚠  visual deps did not install — run manually: cd visual && npm install');
  }
} else {
  console.log('\n(no --url and none saved → element map only; pass --url "<published page>" — repeat --url for more pages — once and it is remembered)');
}

// 4) media map (non-fatal): cloud Media Manager images → committed map.
// Always does the zero-auth code scan; lists the full Media Manager only if a
// Wix API key is configured (env or .env). Never fails the run.
run('media map  (cloud Media Manager → wix-media.md)', join(__dirname, 'wix-media.mjs'), ['--repo', REPO, '--out', OUT, '--soft']);

// 5) CMS schema (non-fatal): Data Collections + fields → committed map.
// Needs a Wix API key; without one it writes a setup stub and exits cleanly.
run('CMS schema  (Data Collections → wix-cms.md)', join(__dirname, 'wix-cms.mjs'), ['--repo', REPO, '--out', OUT, '--soft']);

console.log(`\n✓ done → ${join(OUT, 'wix-elements.md')}  +  ${join(OUT, 'wix-media.md')}  +  ${join(OUT, 'wix-cms.md')}`);
