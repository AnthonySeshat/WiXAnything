#!/usr/bin/env node
/**
 * wix-scaffold.mjs  —  Wix + Claude Addon (Tier 2: code-owned UI)
 *
 * Generate a section that Claude fully owns in code, working around $w being
 * unable to create native elements.
 *
 *   node scripts/wix-scaffold.mjs custom-element <name> [--repo <path>]
 *   node scripts/wix-scaffold.mjs html-component  <name> [--repo <path>]
 *   node scripts/wix-scaffold.mjs repeater        <name> [--repo <path>]
 *
 * Each one still needs ONE manual placement in the editor (see the printed steps
 * and the generated WIRING.md). After that, all edits are pure code.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, appendFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const kind = argv[0];
const rawName = argv[1];
const arg = (n, d) => { const i = argv.indexOf(n); return i !== -1 && argv[i + 1] ? argv[i + 1] : d; };
const REPO = arg('--repo', process.cwd());

if (!kind || !rawName || !['custom-element', 'html-component', 'repeater'].includes(kind)) {
  console.error('Usage: node scripts/wix-scaffold.mjs <custom-element|html-component|repeater> <name> [--repo <path>]');
  process.exit(2);
}

// resolve templates dir (works in addon-dev layout and installed layout)
const TPL_CANDIDATES = [join(__dirname, 'wix-addon-templates'), join(__dirname, '..', 'templates')];
const TPL = TPL_CANDIDATES.find(p => existsSync(p));
if (!TPL) { console.error('Cannot find templates dir. Looked in:\n  ' + TPL_CANDIDATES.join('\n  ')); process.exit(1); }

// name helpers
const kebab = (s) => s.replace(/[^a-zA-Z0-9]+/g, '-').replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase().replace(/^-+|-+$/g, '');
const camel = (s) => { const k = kebab(s).split('-'); return k[0] + k.slice(1).map(w => w[0].toUpperCase() + w.slice(1)).join(''); };
const pascal = (s) => { const c = camel(s); return c[0].toUpperCase() + c.slice(1); };

const fill = (txt, map) => Object.entries(map).reduce((t, [k, v]) => t.split(k).join(v), txt);
function emit(destRel, content) {
  const dest = join(REPO, destRel);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, content);
  console.log('  + ' + destRel);
  return destRel;
}
function recordHost(line) {
  const hosts = join(REPO, 'docs', 'wix-addon', 'HOSTS.md');
  if (existsSync(hosts)) appendFileSync(hosts, `\n- ${line}`);
}

console.log(`\nScaffolding ${kind} "${rawName}" into ${REPO}`);

if (kind === 'custom-element') {
  let tag = kebab(rawName);
  if (!tag.includes('-')) tag += '-element';           // Wix requires a hyphen
  const cls = pascal(rawName) + 'Element';
  const id = camel(rawName);
  const file = `${kebab(rawName)}.js`;
  const map = { __TAG__: tag, __CLASS__: cls, __NAME__: rawName, __ID__: id, __FILE__: file };

  emit(join('src/public/custom-elements', file), fill(readFileSync(join(TPL, 'custom-element/element.js'), 'utf8'), map));
  emit(join('src/public/custom-elements', `${kebab(rawName)}.velo-glue.js`), fill(readFileSync(join(TPL, 'custom-element/velo-glue.js'), 'utf8'), map));
  emit(join('src/public/custom-elements', `${kebab(rawName)}.WIRING.md`), fill(readFileSync(join(TPL, 'custom-element/WIRING.md'), 'utf8'), map));
  recordHost(`**Custom Element** \`<${tag}>\` (id \`#${id}\`) → \`src/public/custom-elements/${file}\` — _awaiting editor placement_`);

  console.log(`\nNext (one-time in the editor):`);
  console.log(`  1. Add (+) → Embed Code → Custom Element`);
  console.log(`  2. Tag name: ${tag}   ·   source: public/custom-elements/${file}`);
  console.log(`  3. Set the element's ID to: ${id}`);
  console.log(`  4. Add the glue from ${kebab(rawName)}.velo-glue.js to the page's Velo code`);
  console.log(`  5. npm run wix:elements   (so #${id} appears in the map)`);
  console.log(`  Full steps: src/public/custom-elements/${kebab(rawName)}.WIRING.md`);
}

if (kind === 'html-component') {
  const id = camel(rawName);
  const map = { __NAME__: rawName, __ID__: id };
  emit(join('src/public/html', `${kebab(rawName)}.html`), fill(readFileSync(join(TPL, 'html-component/page.html'), 'utf8'), map));
  emit(join('src/public/html', `${kebab(rawName)}.velo-glue.js`), fill(readFileSync(join(TPL, 'html-component/velo-glue.js'), 'utf8'), map));
  recordHost(`**HtmlComponent** (id \`#${id}\`) → \`src/public/html/${kebab(rawName)}.html\` — _awaiting editor placement_`);

  console.log(`\nNext (one-time in the editor):`);
  console.log(`  1. Add (+) → Embed Code → Embed HTML (HtmlComponent)`);
  console.log(`  2. Point it at src/public/html/${kebab(rawName)}.html (or paste its contents)`);
  console.log(`  3. Set the element's ID to: ${id}`);
  console.log(`  4. Add the glue from ${kebab(rawName)}.velo-glue.js to the page's Velo code`);
  console.log(`  5. npm run wix:elements`);
}

if (kind === 'repeater') {
  const map = { '#__REPEATER__': '#' + camel(rawName) };
  emit(join('src', `${kebab(rawName)}.repeater-pattern.js`), fill(readFileSync(join(TPL, 'repeater/pattern.js'), 'utf8'), map));
  console.log(`\nNote: a Repeater's ITEM TEMPLATE (its child elements) must already exist in the editor.`);
  console.log(`Find the real repeater + child IDs in wix-elements.md, then adapt the pattern file.`);
}

console.log('');
