#!/usr/bin/env node
/**
 * wix-app-scaffold.mjs  —  WiXAnything (L2: supported companion app)
 *
 * Scaffolds a private @wix/cli COMPANION APP next to your site that:
 *   - ships a code-owned Site Widget (auto-placed on the homepage at install), and
 *   - includes an Editor Add-on panel (uses the real @wix/editor SDK) to configure
 *     that widget live inside Wix Studio and read the current selection.
 *
 * This is the supported ceiling for "appears/edits from code" on a real Studio site
 * (it does NOT add/move native elements). Finish setup via companion-app/SETUP.md.
 *
 *   node scripts/wix-app-scaffold.mjs "<App Name>" [--repo <path>] [--dir companion-app]
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i !== -1 && argv[i + 1] ? argv[i + 1] : d; };
const FLAGS = new Set(['--repo', '--dir']);
// positional = tokens that are neither a flag nor the value following a flag
const positionals = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && FLAGS.has(argv[i - 1])));
const rawName = positionals[0];
const REPO = arg('--repo', process.cwd());
const DIR = arg('--dir', 'companion-app');

if (!rawName || rawName.startsWith('--')) {
  console.error('Usage: node scripts/wix-app-scaffold.mjs "<App Name>" [--repo <path>] [--dir companion-app]');
  process.exit(2);
}

const TPL = [join(__dirname, 'wix-addon-templates'), join(__dirname, '..', 'templates')].find(p => existsSync(p));
if (!TPL) { console.error('Cannot find templates dir.'); process.exit(1); }

const kebab = (s) => s.replace(/[^a-zA-Z0-9]+/g, '-').replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase().replace(/^-+|-+$/g, '');
const camel = (s) => { const k = kebab(s).split('-'); return k[0] + k.slice(1).map(w => w[0].toUpperCase() + w.slice(1)).join(''); };
const pascal = (s) => { const c = camel(s); return c[0].toUpperCase() + c.slice(1); };
const fill = (t, m) => Object.entries(m).reduce((a, [k, v]) => a.split(k).join(v), t);
const tpl = (p) => readFileSync(join(TPL, p), 'utf8');

// always a hyphenated custom-element tag, exactly one "-widget" suffix
const tag = (kebab(rawName).replace(/-?widget$/, '') || 'app') + '-widget';
const map = {
  __APP_NAME__: rawName,
  __APP_NAME_KEBAB__: kebab(rawName) || 'companion-app',
  __WIDGET_TAG__: tag,
  __WIDGET_ID__: camel(rawName) + 'Widget',
  __CLASS__: pascal(rawName) + 'Widget',
  __NAME__: rawName,
  __ID__: camel(rawName) + 'Widget',
  __FILE__: `${kebab(rawName)}-widget.js`,
};

const base = join(REPO, DIR);
function out(rel, content) {
  const dest = join(base, rel);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, content);
  console.log('  + ' + join(DIR, rel));
}

if (existsSync(base)) console.log(`\nNote: ${DIR}/ exists — files will be overwritten.`);
console.log(`\nScaffolding companion app "${rawName}" into ${join(REPO, DIR)}`);

out('package.json', fill(tpl('companion-app/app-package.json'), map));
out(`widget/${map.__FILE__}`, fill(tpl('custom-element/element.js'), map));
out('widget/element.json', fill(tpl('companion-app/widget/element.json'), map));
out('panel/index.html', fill(tpl('companion-app/panel/index.html'), map));
out('panel/panel.js', fill(tpl('companion-app/panel/panel.js'), map));
out('SETUP.md', fill(tpl('companion-app/SETUP.md'), map));

console.log(`\nNext:`);
console.log(`  1. cd ${DIR} && npm create @wix/app@latest .   (generate the canonical app skeleton)`);
console.log(`  2. Merge widget/ + panel/ into the generated extension folders.`);
console.log(`  3. Register the panel URL in the Wix Developers dashboard.`);
console.log(`  4. wix dev   → widget auto-adds to homepage; panel configures it live.`);
console.log(`  Full steps: ${join(DIR, 'SETUP.md')}\n`);
