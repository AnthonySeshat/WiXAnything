#!/usr/bin/env node
/**
 * wixanything-visual / scan.mjs
 *
 * Reads the PUBLISHED Wix page and produces the VISUAL layer the .wix/types map
 * lacks: per-element geometry (x/y/w/h), computed styles, and parent/child layering,
 * keyed by your Velo nicknames (#IDs). ToS-safe: it loads a public page like any
 * browser — it does NOT automate the editor.
 *
 *   node scan.mjs <publishedPageUrl> [--out wix-visual.json] [--elements <wix-elements.json>]
 *
 * How the nickname->geometry join works:
 *   1. Wix's Thunderbolt page model (siteassets.parastorage.com) maps every Velo
 *      nickname (role) to a rendered comp id: {"compId":"comp-xxxx","role":"styleRepeater"}.
 *   2. Each comp id is a real DOM element -> getBoundingClientRect + getComputedStyle.
 *   3. Join 1+2 -> nickname -> {compId, box, style, parentNickname}.
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i !== -1 && argv[i + 1] ? argv[i + 1] : d; };
const URL = argv.find(a => !a.startsWith('--'));
const OUT = arg('--out', 'wix-visual.json');
const ELEMENTS = arg('--elements', null);
if (!URL) { console.error('Usage: node scan.mjs <publishedPageUrl> [--out file] [--elements wix-elements.json]'); process.exit(2); }

const STYLE_PROPS = ['display','position','backgroundColor','color','fontFamily','fontSize','fontWeight',
  'textAlign','lineHeight','borderRadius','borderColor','borderWidth','padding','margin','zIndex',
  'flexDirection','justifyContent','alignItems','gap','opacity','boxShadow'];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1024 } });

const blobs = [];
page.on('response', async (res) => {
  try {
    const u = res.url();
    if (!/parastorage|thunderbolt|siteassets/.test(u)) return;
    const ct = res.headers()['content-type'] || '';
    if (!/json|javascript|text/.test(ct)) return;
    const t = await res.text();
    if (t.includes('"role":"') || /"\w+":"comp-/.test(t)) blobs.push(t);
  } catch {}
});

console.log('loading', URL);
try { await page.goto(URL, { waitUntil: 'networkidle', timeout: 90000 }); } catch (e) { console.log('goto note:', e.message); }
// materialize lazy sections
await page.evaluate(async () => { const H = document.body.scrollHeight; for (let y = 0; y < H; y += 700) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 110)); } window.scrollTo(0, 0); });
await page.waitForTimeout(2500);
const title = await page.title();

// 1) build comp-id -> nickname from the page model
const comp2nick = {};
const reConn = /"compId":"(comp-[a-z0-9]+)","role":"([A-Za-z][\w-]*)"/g;
const reMap = /"([A-Za-z][\w-]*)":"(comp-[a-z0-9]+)"/g;
for (const b of blobs) { let m; while ((m = reConn.exec(b))) comp2nick[m[1]] = m[2]; }
for (const b of blobs) { let m; while ((m = reMap.exec(b))) if (!comp2nick[m[2]]) comp2nick[m[2]] = m[1]; }
const compIds = Object.keys(comp2nick);
console.log(`mapped ${compIds.length} nicknames from the page model`);

// 2) geometry + styles for each comp id
const visual = await page.evaluate(({ compIds, STYLE_PROPS }) => {
  const out = {};
  for (const cid of compIds) {
    const el = document.getElementById(cid);
    if (!el) { out[cid] = null; continue; }
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const style = {}; for (const p of STYLE_PROPS) style[p] = cs[p];
    out[cid] = {
      tag: el.tagName.toLowerCase(),
      box: { x: Math.round(r.x + window.scrollX), y: Math.round(r.y + window.scrollY), w: Math.round(r.width), h: Math.round(r.height) },
      rendered: r.width > 0 && r.height > 0,
      style,
      parentComp: el.parentElement?.closest('[id^="comp-"]')?.id ?? null,
      text: (el.innerText || '').trim().slice(0, 60) || undefined,
    };
  }
  return out;
}, { compIds, STYLE_PROPS });

// 3) join -> nickname-keyed
const byNick = {};
for (const [cid, nick] of Object.entries(comp2nick)) {
  const v = visual[cid];
  byNick[nick] = v
    ? { compId: cid, rendered: v.rendered, box: v.box, text: v.text, style: v.style, parentNickname: v.parentComp ? (comp2nick[v.parentComp] || null) : null }
    : { compId: cid, rendered: false };
}

const renderedCount = Object.values(byNick).filter(v => v.rendered).length;
const result = { url: URL, title, scrapedViewport: { w: 1440, h: 1024 }, counts: { mapped: compIds.length, rendered: renderedCount }, elements: byNick };
writeFileSync(OUT, JSON.stringify(result, null, 2));
console.log(`\n✓ ${renderedCount}/${compIds.length} elements rendered with geometry → wrote ${OUT}`);

// optional: enrich the element map with type info in the console summary
let typeOf = {};
if (ELEMENTS) { try { const j = JSON.parse(readFileSync(ELEMENTS, 'utf8')); for (const p of j.pages) for (const e of p.elements) typeOf[e.id.replace('#','')] = e.type; for (const e of (j.global||[])) typeOf[e.id.replace('#','')] = e.type; } catch {} }

console.log('\n=== sample of YOUR configurator elements (nickname · type · box · key style) ===');
for (const nick of ['styleRepeater','styleName','modelsDesc','quoteMulti','submitBtn','nextBtn1','header1','imageX2']) {
  const v = byNick[nick];
  if (!v) { console.log(`  #${nick}: (not in page model)`); continue; }
  if (!v.rendered) { console.log(`  #${nick}: mapped but not rendered (hidden/collapsed)`); continue; }
  console.log(`  #${nick} · ${typeOf[nick] || '?'} · box ${v.box.x},${v.box.y} ${v.box.w}x${v.box.h} · bg ${v.style.backgroundColor} · font ${v.style.fontSize}`);
}
await browser.close();
