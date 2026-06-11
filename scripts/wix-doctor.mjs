#!/usr/bin/env node
/**
 * wix-doctor.mjs  —  Wix + Claude Addon
 *
 * Preflight + freshness for the element map. Cross-platform, NON-INTERACTIVE
 * (never opens a device-code / arrow-key prompt that would hang in an agent/CI).
 *
 * Steps:
 *   1. `wix whoami`  — gate. If logged out, print a login hint and exit 3
 *      (callers in a postinstall chain should treat this as non-fatal).
 *   2. `wix sync-types` — pull the latest element maps from Wix servers into
 *      .wix/types (stdin is /ignored/ so the Ink TTY UI can't grab raw mode).
 *      Failure here is non-fatal — we still regenerate from whatever exists.
 *   3. run wix-elements-gen.mjs to (re)build wix-elements.json/.md + CLAUDE.md.
 *
 * Usage: node scripts/wix-doctor.mjs [--repo <path>] [--no-sync]
 */

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i !== -1 && argv[i + 1] ? argv[i + 1] : d; };
const REPO = arg('--repo', process.cwd());
const OUT = arg('--out', REPO);
const NO_SYNC = argv.includes('--no-sync');
const SOFT = argv.includes('--soft'); // never fail the caller (e.g. postinstall)
const exit = (code) => process.exit(SOFT ? 0 : code);

// stdin:'ignore' is the key: a non-TTY stdin stops the Wix CLI's Ink UI from
// trying to switch the terminal into raw mode (the crash seen in .wix/debug.log).
function wix(args) {
  return spawnSync('wix', args, {
    cwd: REPO, shell: true, encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

console.log(`\n🩺 wix-doctor  (repo: ${REPO})`);

// 1) auth gate ---------------------------------------------------------------
const who = wix(['whoami']);
const whoOut = `${who.stdout || ''}${who.stderr || ''}`;
const loggedIn = who.status === 0 && /Logged in as/i.test(whoOut);
if (loggedIn) {
  const m = whoOut.match(/Logged in as\s+([^\s]+)/i);
  console.log(`✓ logged in${m ? ' as ' + m[1] : ''}`);
} else {
  console.log('✗ not logged in to the Wix CLI.');
  console.log('  → Run this yourself in your terminal:  wix login');
  console.log('  (skipping sync; will still generate from any cached .wix/types)');
}

// 2) sync types (non-fatal) --------------------------------------------------
if (loggedIn && !NO_SYNC) {
  process.stdout.write('… wix sync-types (pulling latest element maps) ');
  const sync = wix(['sync-types']);
  if (sync.status === 0) console.log('✓');
  else {
    console.log('✗ (non-fatal)');
    if (sync.stderr) console.log('   ' + sync.stderr.trim().split('\n').slice(-3).join('\n   '));
  }
}

// 3) generate ----------------------------------------------------------------
if (!existsSync(join(REPO, '.wix', 'types'))) {
  console.log('✗ no .wix/types present yet — cannot generate the element map.');
  console.log('  Log in (wix login) then re-run, or run `wix dev` once to populate it.');
  console.log('  (any previously committed wix-elements.md still applies)');
  exit(loggedIn ? 1 : 3);
}

const gen = spawnSync(process.execPath, [join(__dirname, 'wix-elements-gen.mjs'), '--repo', REPO, '--out', OUT], {
  stdio: 'inherit',
});
exit(gen.status ?? 0);
