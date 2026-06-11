#!/usr/bin/env node
/**
 * wix-init.mjs  —  Wix + Claude Addon installer
 *
 * Drops the addon into any Wix CLI (Git Integration) repo so Claude can see and
 * work with the site's elements. Idempotent and non-destructive (merges, never
 * clobbers your CLAUDE.md / .claude / package.json).
 *
 *   node /path/to/addon/scripts/wix-init.mjs --repo <target-wix-repo> [--dry-run] [--force]
 *
 * What it does:
 *   - copies scripts/ (gen, doctor, scaffold) + templates into <repo>/scripts
 *   - copies docs/ into <repo>/docs/wix-addon
 *   - installs/merges CLAUDE.md and .claude/settings.json
 *   - adds npm scripts: wix:elements, wix:elements:fast, wix:doctor, wix:scaffold
 *   - sets a non-fatal postinstall that refreshes the element map
 *   - runs the doctor once to generate the first map
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync, copyFileSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ADDON = join(__dirname, '..');               // addon root
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i !== -1 && argv[i + 1] ? argv[i + 1] : d; };
const REPO = arg('--repo', process.cwd());
const DRY = argv.includes('--dry-run');
const FORCE = argv.includes('--force');

const say = (...a) => console.log(...a);
const tag = DRY ? '[dry-run] would ' : '';

function ensureDir(p) { if (!DRY) mkdirSync(p, { recursive: true }); }
function copy(src, destRel) {
  const dest = join(REPO, destRel);
  say(`  ${tag}copy  ${destRel}`);
  if (DRY) return;
  ensureDir(dirname(dest));
  copyFileSync(src, dest);
}
function copyTree(srcDir, destRelDir) {
  for (const name of readdirSync(srcDir)) {
    const s = join(srcDir, name);
    if (statSync(s).isDirectory()) copyTree(s, join(destRelDir, name));
    else copy(s, join(destRelDir, name));
  }
}
function writeFile(destRel, content, label) {
  say(`  ${tag}write ${destRel}${label ? '  (' + label + ')' : ''}`);
  if (DRY) return;
  ensureDir(dirname(join(REPO, destRel)));
  writeFileSync(join(REPO, destRel), content);
}

// ---- validate target -------------------------------------------------------
say(`\n📦 Wix + Claude Addon → ${REPO}\n`);
const looksWix = existsSync(join(REPO, 'wix.config.json')) || existsSync(join(REPO, '.wix')) || existsSync(join(REPO, 'src', 'pages'));
if (!looksWix && !FORCE) {
  console.error('✗ This does not look like a Wix CLI repo (no wix.config.json / .wix / src/pages).');
  console.error('  Re-run with --force to install anyway, or point --repo at the right folder.');
  process.exit(2);
}

// ---- 1. scripts + templates ------------------------------------------------
say('1) scripts + templates');
for (const f of ['wix-elements-gen.mjs', 'wix-doctor.mjs', 'wix-scaffold.mjs', 'wix-app-scaffold.mjs', 'wix-build-element.mjs', 'wix-full.mjs'])
  copy(join(ADDON, 'scripts', f), join('scripts', f));
copyTree(join(ADDON, 'templates'), join('scripts', 'wix-addon-templates'));

// ---- 2. docs ---------------------------------------------------------------
say('2) docs');
copyTree(join(ADDON, 'docs'), join('docs', 'wix-addon'));

// ---- 2b. visual scanner (optional power-up) --------------------------------
say('2b) visual scanner');
for (const f of ['scan.mjs', 'package.json', 'README.md'])
  copy(join(ADDON, 'visual', f), join('visual', f));

// ---- 3. CLAUDE.md (merge) --------------------------------------------------
say('3) CLAUDE.md');
const addonClaude = readFileSync(join(ADDON, 'assets', 'CLAUDE.md'), 'utf8');
const claudePath = join(REPO, 'CLAUDE.md');
if (!existsSync(claudePath)) {
  writeFile('CLAUDE.md', addonClaude, 'new');
} else {
  const cur = readFileSync(claudePath, 'utf8');
  if (cur.includes('WIX-ELEMENTS:START')) {
    say('  · CLAUDE.md already has the Wix addon section — leaving as is');
  } else {
    writeFile('CLAUDE.md', cur.trimEnd() + '\n\n---\n\n' + addonClaude, 'appended addon section');
  }
}

// ---- 4. .claude/settings.json (merge permissions) --------------------------
say('4) .claude/settings.json');
const addonSettings = JSON.parse(readFileSync(join(ADDON, 'assets', 'claude-settings.json'), 'utf8'));
const settingsPath = join(REPO, '.claude', 'settings.json');
let settings = {};
if (existsSync(settingsPath)) { try { settings = JSON.parse(readFileSync(settingsPath, 'utf8')); } catch {} }
settings.permissions ??= {};
const have = new Set(settings.permissions.allow ?? []);
for (const a of addonSettings.permissions.allow) have.add(a);
settings.permissions.allow = [...have];
writeFile(join('.claude', 'settings.json'), JSON.stringify(settings, null, 2) + '\n', 'merged allowlist');

// ---- 5. package.json (scripts + postinstall) -------------------------------
say('5) package.json');
const pkgPath = join(REPO, 'package.json');
if (!existsSync(pkgPath)) {
  say('  ! no package.json found — skipping script wiring (run scripts via node directly)');
} else {
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  pkg.scripts ??= {};
  const set = (k, v) => { if (pkg.scripts[k] !== v) { say(`  · scripts.${k} = ${v}`); pkg.scripts[k] = v; } };
  set('wix:full', 'node scripts/wix-full.mjs');                  // map + layout/styles in one go (pass -- --url "...")
  set('wix:elements', 'node scripts/wix-doctor.mjs');            // sync + regenerate (everyday)
  set('wix:elements:fast', 'node scripts/wix-elements-gen.mjs'); // regenerate from cache, no sync
  set('wix:diff', 'node scripts/wix-elements-gen.mjs --diff');   // regenerate + show added/removed/retyped ids
  set('wix:doctor', 'node scripts/wix-doctor.mjs');
  set('wix:scaffold', 'node scripts/wix-scaffold.mjs');          // Tier 2: code-owned region
  set('wix:build-element', 'node scripts/wix-build-element.mjs'); // bundle a custom element to one file
  set('wix:app', 'node scripts/wix-app-scaffold.mjs');           // L2: companion app (widget + editor panel)
  const prev = pkg.scripts.postinstall;
  const want = 'node scripts/wix-doctor.mjs --soft';
  if (prev && !prev.includes('wix-doctor')) {
    say(`  · preserving existing postinstall, chaining ours (was: ${prev})`);
    pkg.scripts.postinstall = `${prev} && ${want}`;
  } else if (!prev) {
    say(`  · postinstall = ${want}`);
    pkg.scripts.postinstall = want;
  }
  if (!DRY) writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
}

// ---- 6. first run ----------------------------------------------------------
say('\n6) generating the first element map …');
if (DRY) { say('  [dry-run] would run: node scripts/wix-doctor.mjs'); }
else {
  const r = spawnSync(process.execPath, [join(REPO, 'scripts', 'wix-doctor.mjs'), '--repo', REPO, '--soft'], { stdio: 'inherit' });
  void r;
}

say(`\n✅ Installed. Next:`);
say(`   • Read wix-elements.md (the element map Claude now uses).`);
say(`   • Refresh anytime: npm run wix:elements`);
say(`   • New code-owned section: npm run wix:scaffold custom-element <name>`);
say(`   • Visual layer (geometry/styles): cd visual && npm install, then see visual/README.md`);
say(`   • Ceiling & options: docs/wix-addon/STRUCTURAL-EDITING.md`);
if (!DRY) say(`\n   ⚠ Review changes before committing. Consider whether to commit wix-elements.* (recommended) and how it interacts with your Wix Git sync.`);
