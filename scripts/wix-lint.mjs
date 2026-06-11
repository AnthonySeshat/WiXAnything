#!/usr/bin/env node
/**
 * wix-lint.mjs — conservative static Velo check using the element map.
 * Catches, BEFORE runtime, the two bugs the benchmark isolated:
 *   ✖ ERROR   .text/.html on a CONTAINER type (Box/MultiStateBox/Header/Footer/Menu/Page/Repeater/…)
 *   ⚠ warn    $w('#id') literal whose id isn't in wix-elements.json (typo/renamed, or stale map)
 *
 * Only LITERAL '#id' selectors are checked — dynamic selectors ($w(varOrTemplate)) are
 * skipped, so false positives stay rare. Errors exit non-zero; warnings only with --strict.
 *
 *   node scripts/wix-lint.mjs [--repo <path>] [--strict]
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i !== -1 && argv[i + 1] ? argv[i + 1] : d; };
const REPO = arg('--repo', process.cwd());
const STRICT = argv.includes('--strict');

const mapPath = join(REPO, 'wix-elements.json');
if (!existsSync(mapPath)) { console.error('wix-lint: wix-elements.json not found — run `npm run wix:elements` first.'); process.exit(0); }
let map; try { map = JSON.parse(readFileSync(mapPath, 'utf8')); } catch { console.error('wix-lint: could not parse wix-elements.json'); process.exit(0); }

const typeOf = {};
const add = (e) => { typeOf[e.id] = e.recoveredType || e.type; };
for (const e of (map.global || [])) add(e);
for (const p of (map.pages || [])) for (const e of (p.elements || [])) add(e);
const validIds = new Set(Object.keys(typeOf));
const CONTAINERS = new Set(['Box', 'MultiStateBox', 'Header', 'Footer', 'MenuContainer', 'Page', 'Repeater', 'Slideshow', 'Accordion']);

function srcFiles(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const n of readdirSync(dir)) {
    const p = join(dir, n); let s; try { s = statSync(p); } catch { continue; }
    if (s.isDirectory()) srcFiles(p, acc);
    else if (/\.(jsw?|ts)$/.test(n)) acc.push(p);
  }
  return acc;
}

const findings = [];
const sel = /\$w\(\s*(['"])#([\w-]+)\1\s*\)\s*\.\s*([A-Za-z_]\w*)/g; // $w('#id').prop  (literal only)
for (const f of srcFiles(join(REPO, 'src'))) {
  let txt; try { txt = readFileSync(f, 'utf8'); } catch { continue; }
  const rel = relative(REPO, f).split('\\').join('/');
  let m; sel.lastIndex = 0;
  while ((m = sel.exec(txt)) !== null) {
    const id = '#' + m[2], prop = m[3];
    const line = txt.slice(0, m.index).split('\n').length;
    if (!validIds.has(id)) { findings.push({ sev: 'warn', file: rel, line, msg: `unknown id ${id} — not in the element map (typo/renamed element, or regenerate the map if you just added it)` }); continue; }
    const t = typeOf[id];
    if ((prop === 'text' || prop === 'html') && CONTAINERS.has(t)) {
      findings.push({ sev: 'error', file: rel, line, msg: `${id} is a ${t} (container) — it has no .${prop}; set a child element${t === 'MultiStateBox' ? ', or use .changeState()' : ''} instead.` });
    }
  }
}

for (const f of findings) console.log(`${f.file}:${f.line}  ${f.sev === 'error' ? '✖ ERROR' : '⚠ warn '}  ${f.msg}`);
const errors = findings.filter(f => f.sev === 'error').length;
const warns = findings.filter(f => f.sev === 'warn').length;
console.log(`\nwix-lint: ${errors} error(s), ${warns} warning(s).` + (findings.length ? '' : ' ✓ clean'));
process.exit(errors || (STRICT && warns) ? 1 : 0);
