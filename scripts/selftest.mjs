#!/usr/bin/env node
/**
 * selftest.mjs — no real Wix site needed. Builds a synthetic repo in a temp dir,
 * runs the generator + scaffolder, and asserts the important behaviors:
 *   - every element is mapped with the right type
 *   - a Box / MultiStateBox is flagged "NO .text" (the classic bug)
 *   - HiddenCollapsedElement is flagged hidden / type-unknown
 *   - master elements merge, page names resolve, referenced-in-Velo works
 *   - scaffolded custom element is valid JS and registers the right tag
 * Exit 0 = pass, 1 = fail.
 */
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
let failures = 0;
const ok = (cond, msg) => { console.log(`${cond ? '  ✓' : '  ✗'} ${msg}`); if (!cond) failures++; };
const node = (args, opts) => spawnSync(process.execPath, args, { encoding: 'utf8', ...opts });

// --- build a synthetic Wix repo --------------------------------------------
const dir = mkdtempSync(join(tmpdir(), 'wix-selftest-'));
try {
  mkdirSync(join(dir, 'src/pages'), { recursive: true });
  mkdirSync(join(dir, '.wix/types/p0001'), { recursive: true });
  mkdirSync(join(dir, '.wix/types/masterPage'), { recursive: true });
  writeFileSync(join(dir, 'wix.config.json'), JSON.stringify({ siteId: 'selftest', uiVersion: '1' }));
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'selftest', scripts: {} }));
  writeFileSync(join(dir, 'src/pages/Home.p0001.js'), '$w.onReady(()=>{ $w("#title").text="hi"; $w("#text1").show(); });\nexport function ctaBtn_click(event){ }\n');
  writeFileSync(join(dir, '.wix/types/masterPage/masterPage.d.ts'),
    'type MasterPageElementsMap = {\n\t"#header1": $w.Header;\n}\n');
  writeFileSync(join(dir, '.wix/types/p0001/p0001.d.ts'),
    '/// <reference path="..\\masterPage\\masterPage.d.ts" />\n' +
    'type PageElementsMap = MasterPageElementsMap & {\n' +
    '\t"#title": $w.Text;\n\t"#card": $w.Box;\n\t"#states": $w.MultiStateBox;\n\t"#secret": $w.HiddenCollapsedElement;\n\t"#hiddenBox": $w.Box & $w.HiddenCollapsedElement;\n\t"#card": $w.Box;\n\t"#text1": $w.Text;\n\t"#text10": $w.Text;\n\t"#ctaBtn": $w.Button;\n}\n');

  // --- run generator --------------------------------------------------------
  console.log('generator:');
  const g = node([join(__dirname, 'wix-elements-gen.mjs'), '--repo', dir, '--quiet']);
  ok(g.status === 0, 'exits 0');
  const json = JSON.parse(readFileSync(join(dir, 'wix-elements.json'), 'utf8'));
  const page = json.pages.find(p => p.pageId === 'p0001');
  ok(!!page && page.name === 'Home', 'resolves page name "Home" from filename');
  ok(json.global.some(e => e.id === '#header1' && e.type === 'Header'), 'parses master element #header1:Header');
  const byId = Object.fromEntries(page.elements.map(e => [e.id, e]));
  ok(byId['#title']?.type === 'Text', '#title typed as Text');
  ok(byId['#title']?.referencedInVelo === true, '#title detected as referenced in Velo');
  ok(/NO \.text/.test(byId['#card']?.guidance || ''), '#card (Box) flagged NO .text');
  ok(/changeState/.test(byId['#states']?.guidance || ''), '#states (MultiStateBox) → changeState guidance');
  ok(byId['#secret']?.hidden === true, '#secret flagged hidden');
  ok(/TRUE TYPE UNKNOWN/.test(byId['#secret']?.guidance || ''), '#secret hidden-type warning present');
  ok(byId['#hiddenBox']?.type === 'Box' && byId['#hiddenBox']?.hidden === true, 'intersection ($w.Box & Hidden) → type Box + hidden flag');
  ok(page.elements.filter(e => e.id === '#card').length === 1, 'duplicate #card deduped to one entry');
  ok(byId['#text1']?.referencedInVelo === true, '#text1 detected as referenced');
  ok(byId['#text10']?.referencedInVelo === false, '#text10 NOT false-matched by #text1 (anchored)');
  ok(byId['#ctaBtn']?.referencedInVelo === true, 'editor-wired export function ctaBtn_click detected');
  ok((byId['#ctaBtn']?.events || []).includes('click'), '#ctaBtn click event surfaced');
  ok(existsSync(join(dir, 'wix-elements.md')), 'writes wix-elements.md');

  // --- visual merge: nesting tree + text passthrough (the north star) -------
  console.log('visual merge:');
  writeFileSync(join(dir, 'viz.json'), JSON.stringify({ elements: {
    card: { compId: 'comp-1', rendered: true, box: { x: 0, y: 0, w: 200, h: 120 }, style: { display: 'flex' }, parentNickname: null },
    title: { compId: 'comp-2', rendered: true, box: { x: 8, y: 8, w: 180, h: 24 }, style: {}, parentNickname: 'card', text: 'Hello world' },
  } }));
  const gv = node([join(__dirname, 'wix-elements-gen.mjs'), '--repo', dir, '--quiet', '--visual', join(dir, 'viz.json')]);
  ok(gv.status === 0, 'exits 0 with --visual');
  const bv = Object.fromEntries(JSON.parse(readFileSync(join(dir, 'wix-elements.json'), 'utf8')).pages.find(p => p.pageId === 'p0001').elements.map(e => [e.id, e]));
  ok((bv['#card']?.layout?.children || []).includes('#title'), '#card lists #title as a child (parent→children inverted)');
  ok(bv['#title']?.layout?.text === 'Hello world', '#title text content passed through');
  ok(bv['#title']?.layout?.parentNickname === 'card', '#title parentNickname preserved');

  // --- run scaffolder -------------------------------------------------------
  console.log('scaffolder:');
  const s = node([join(__dirname, 'wix-scaffold.mjs'), 'custom-element', 'pricing-widget', '--repo', dir]);
  ok(s.status === 0, 'exits 0');
  const elPath = join(dir, 'src/public/custom-elements/pricing-widget.js');
  ok(existsSync(elPath), 'creates element.js');
  const el = readFileSync(elPath, 'utf8');
  ok(el.includes("customElements.define('pricing-widget'"), 'registers <pricing-widget> tag');
  ok(node(['--check', elPath]).status === 0, 'element.js is valid JS (node --check)');

  // --- L0 --diff oracle -----------------------------------------------------
  console.log('diff oracle:');
  // add a new element to the page map, then diff vs the baseline json from earlier
  writeFileSync(join(dir, '.wix/types/p0001/p0001.d.ts'),
    '/// <reference path="..\\masterPage\\masterPage.d.ts" />\n' +
    'type PageElementsMap = MasterPageElementsMap & {\n' +
    '\t"#title": $w.Text;\n\t"#card": $w.Box;\n\t"#states": $w.MultiStateBox;\n\t"#secret": $w.HiddenCollapsedElement;\n\t"#hiddenBox": $w.Box & $w.HiddenCollapsedElement;\n\t"#newBtn": $w.Button;\n}\n');
  const d = node([join(__dirname, 'wix-elements-gen.mjs'), '--repo', dir, '--diff']);
  ok(d.status === 0, 'exits 0');
  ok(/\+ ADDED\s+#newBtn/.test(d.stdout || ''), 'diff reports #newBtn as ADDED');

  // --- L2 companion app scaffold -------------------------------------------
  console.log('companion app (L2):');
  const a = node([join(__dirname, 'wix-app-scaffold.mjs'), 'Quote Tools', '--repo', dir]);
  ok(a.status === 0, 'exits 0');
  const widgetJs = join(dir, 'companion-app/widget/quote-tools-widget.js');
  const panelJs = join(dir, 'companion-app/panel/panel.js');
  ok(existsSync(widgetJs), 'creates widget element.js');
  ok(existsSync(panelJs), 'creates editor panel.js');
  ok(/@wix\/editor/.test(readFileSync(panelJs, 'utf8')), 'panel imports @wix/editor');
  ok(node(['--check', widgetJs]).status === 0, 'widget js is valid JS');
  ok(JSON.parse(readFileSync(join(dir, 'companion-app/widget/element.json'), 'utf8')).installation.staticContainer === 'HOMEPAGE', 'element.json auto-adds to HOMEPAGE');

  // --- bridge: build-element bundler (dependency-free copy path, no network) -
  console.log('build-element (bridge):');
  writeFileSync(join(dir, 'comp.js'), 'class X extends HTMLElement{}\ncustomElements.define("x-y", X);\n');
  const b = node([join(__dirname, 'wix-build-element.mjs'), join(dir, 'comp.js'), '--out', join(dir, 'out.js')]);
  ok(b.status === 0, 'exits 0 on a no-imports component');
  ok(existsSync(join(dir, 'out.js')), 'produces a single output file');
  ok(node(['--check', join(__dirname, '..', 'examples', 'bridge', 'quote-configurator.js')]).status === 0, 'bridge reference component is valid JS');
} finally {
  rmSync(dir, { recursive: true, force: true });
}

console.log(`\n${failures === 0 ? '✅ ALL PASSED' : `❌ ${failures} FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
