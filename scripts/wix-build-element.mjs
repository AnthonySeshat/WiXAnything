#!/usr/bin/env node
/**
 * wix-build-element.mjs  —  bundle a Custom Element into the single self-contained
 * ES module Wix needs to host it.
 *
 * Lets Claude write RICH components (multiple files, imports, helpers) that still
 * deploy as one file. Uses esbuild via `npx` (no install needed); if esbuild isn't
 * reachable and the entry has no imports, it just copies the file (so dependency-free
 * single-file components like examples/bridge/quote-configurator.js work with zero setup).
 *
 *   node scripts/wix-build-element.mjs <entry.js> [--out <file>] [--watch]
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i !== -1 && argv[i + 1] ? argv[i + 1] : d; };
const entry = argv.find(a => !a.startsWith('--'));
const watch = argv.includes('--watch');
if (!entry || !existsSync(entry)) {
  console.error('Usage: node scripts/wix-build-element.mjs <entry.js> [--out <file>] [--watch]');
  process.exit(2);
}
const out = arg('--out', join(dirname(entry), 'dist', basename(entry).replace(/\.js$/, '') + '.bundle.js'));
mkdirSync(dirname(out), { recursive: true });

const src = readFileSync(entry, 'utf8');
const hasImports = /\bimport\s|\brequire\s*\(/.test(src);

function tryEsbuild() {
  const args = [entry, '--bundle', '--format=esm', '--minify', `--outfile=${out}`];
  if (watch) args.push('--watch');
  // prefer a locally-installed esbuild, else npx
  const local = join(process.cwd(), 'node_modules', '.bin', process.platform === 'win32' ? 'esbuild.cmd' : 'esbuild');
  const cmd = existsSync(local) ? local : 'npx';
  const finalArgs = existsSync(local) ? args : ['--yes', 'esbuild', ...args];
  const r = spawnSync(cmd, finalArgs, { stdio: watch ? 'inherit' : 'pipe', shell: true, encoding: 'utf8' });
  return r;
}

if (hasImports || watch) {
  console.log(`Bundling ${entry} → ${out}${watch ? ' (watch)' : ''}`);
  const r = tryEsbuild();
  if (watch) process.exit(r.status ?? 0);
  if (r.status === 0) { console.log('✓ bundled'); process.exit(0); }
  console.error('✗ esbuild unavailable and the entry uses imports — install esbuild or inline the imports.');
  console.error((r.stderr || '').trim().split('\n').slice(-3).join('\n'));
  process.exit(1);
} else {
  // dependency-free single file → no bundler required, just copy.
  writeFileSync(out, src);
  console.log(`✓ ${entry} has no imports — copied to ${out} (no bundler needed)`);
}
