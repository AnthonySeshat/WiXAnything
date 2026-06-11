#!/usr/bin/env node
/**
 * wixanything-visual / scan.mjs
 *
 * Reads the PUBLISHED Wix page and produces the VISUAL layer the .wix/types map
 * lacks: per-element geometry (x/y/w/h), computed styles, and parent/child layering,
 * keyed by your Velo nicknames (#IDs). ToS-safe: it loads a public page like any
 * browser and clicks through it like a visitor — it does NOT automate the editor.
 *
 *   node scan.mjs <publishedPageUrl> [--out wix-visual.json] [--elements <wix-elements.json>] [--full] [--steps 6]
 *
 * --full walks multi-state UIs (e.g. a step configurator): it selects an option and
 * clicks Next at each step, re-scanning and MERGING so elements that only render on
 * later steps still get captured.
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i !== -1 && argv[i + 1] ? argv[i + 1] : d; };
const URL = argv.find(a => !a.startsWith('--'));
const OUT = arg('--out', 'wix-visual.json');
const ELEMENTS = arg('--elements', null);
const FULL = argv.includes('--full');
const SOFT = argv.includes('--soft'); // don't exit non-zero if the page model maps 0 nicknames
const ALLOW_SUBMIT = argv.includes('--allow-submit'); // opt-in: also click submit/checkout-like buttons (RISKY on a live site)
const STEPS = Number(arg('--steps', '6'));
if (!URL) { console.error('Usage: node scan.mjs <url> [--out f] [--elements f] [--full] [--steps n]'); process.exit(2); }

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

// nickname maps from the page model — hardened against whitespace, key order, and
// structural keys that also point at comp-ids (parent/id/type/… are NOT nicknames).
const comp2nick = {};
const STRUCTURAL = new Set(['compId', 'role', 'id', 'type', 'parent', 'dataQuery', 'propertyQuery',
  'designQuery', 'behaviorQuery', 'connectionQuery', 'styleId', 'skin', 'componentType', 'metaData', 'layout', 'props', 'mobileStructure']);
// (1) connection records {"compId":"comp-x","role":"<nick>"} in EITHER order, whitespace-tolerant
const connA = /"compId"\s*:\s*"(comp-[a-z0-9]+)"[^}]*?"role"\s*:\s*"([A-Za-z][\w-]*)"/g;
const connB = /"role"\s*:\s*"([A-Za-z][\w-]*)"[^}]*?"compId"\s*:\s*"(comp-[a-z0-9]+)"/g;
for (const b of blobs) {
  let m;
  connA.lastIndex = 0; while ((m = connA.exec(b))) comp2nick[m[1]] = m[2];
  connB.lastIndex = 0; while ((m = connB.exec(b))) comp2nick[m[2]] = m[1];
}
// (2) fallback flat map "<nick>":"comp-x" — skip structural keys so junk isn't treated as a nickname
const flat = /"([A-Za-z][\w-]*)"\s*:\s*"(comp-[a-z0-9]+)"/g;
for (const b of blobs) {
  let m; flat.lastIndex = 0;
  while ((m = flat.exec(b))) { if (!STRUCTURAL.has(m[1]) && !comp2nick[m[2]]) comp2nick[m[2]] = m[1]; }
}
const compIds = Object.keys(comp2nick);
const nick2comp = {}; for (const [c, n] of Object.entries(comp2nick)) if (!nick2comp[n]) nick2comp[n] = c;
console.log(`mapped ${compIds.length} nicknames from the page model`);
if (blobs.length && compIds.length === 0) {
  console.error('[visual] ⚠ mapped 0 nicknames from a non-empty page model — Wix format may have changed.');
  if (!SOFT) { await browser.close(); process.exit(1); }
}

async function autoScroll() {
  await page.evaluate(async () => { const H = document.body.scrollHeight; for (let y = 0; y < H; y += 700) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 90)); } window.scrollTo(0, 0); });
  await page.waitForTimeout(600);
}
async function scanCurrent() {
  return page.evaluate(({ compIds, STYLE_PROPS }) => {
    const out = {};
    for (const cid of compIds) {
      const el = document.getElementById(cid);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (!(r.width > 0 && r.height > 0)) continue;
      const cs = getComputedStyle(el);
      const style = {}; for (const p of STYLE_PROPS) style[p] = cs[p];
      out[cid] = { tag: el.tagName.toLowerCase(),
        box: { x: Math.round(r.x + window.scrollX), y: Math.round(r.y + window.scrollY), w: Math.round(r.width), h: Math.round(r.height) },
        rendered: true, style, parentComp: el.parentElement?.closest('[id^="comp-"]')?.id ?? null,
        text: (el.innerText || '').trim().slice(0, 60) || undefined };
    }
    return out;
  }, { compIds, STYLE_PROPS });
}

const acc = {}; // compId -> visual (first good capture wins)
const merge = (s) => { let added = 0; for (const [c, v] of Object.entries(s)) if (!acc[c]) { acc[c] = v; added++; } return added; };

await autoScroll();
let total = merge(await scanCurrent());
console.log(`state 0: ${total} elements rendered`);

if (FULL) {
  const isVisible = async (cid) => { const l = page.locator('#' + cid); return (await l.count()) && (await l.first().isVisible().catch(() => false)); };
  async function selectFirstOption() {
    for (const [cid, n] of Object.entries(comp2nick)) {
      if (!/repeater/i.test(n)) continue;
      if (!(await isVisible(cid))) continue;
      try { await page.locator('#' + cid + ' [id^="comp-"]').first().click({ timeout: 1500, force: true }); return n; } catch {}
    }
    return null;
  }
  // SAFETY: this drives a LIVE published site. By default we only click step-NAVIGATION
  // controls and NEVER submit/checkout-like buttons (which could create a lead/booking/
  // order). Pass --allow-submit to opt in (at your own risk).
  const DANGER = /submit|checkout|pay|buy|book|order|delete|remove|confirm|finish|send/i;
  async function clickAdvance() {
    const candidates = ['nextBtn1', 'nextBtn2', 'nextBtn3', 'nextBtn4'];
    if (ALLOW_SUBMIT) candidates.push('submitBtn');
    for (const n of candidates) {
      if (!ALLOW_SUBMIT && DANGER.test(n)) continue; // never click submit/checkout-like controls by default
      const cid = nick2comp[n]; if (!cid) continue;
      if (!(await isVisible(cid))) continue;
      try { await page.locator('#' + cid).first().click({ timeout: 2500, force: true }); return n; } catch {}
    }
    return null;
  }
  let stale = 0;
  for (let step = 1; step <= STEPS && stale < 2; step++) {
    const sel = await selectFirstOption();
    await page.waitForTimeout(500);
    const adv = await clickAdvance();
    if (!adv) { console.log(`step ${step}: no advance control found — stopping`); break; }
    await page.waitForTimeout(1500);
    await autoScroll();
    const added = merge(await scanCurrent());
    total += added;
    console.log(`step ${step}: clicked ${adv}${sel ? ' (after selecting in ' + sel + ')' : ''} → +${added} new (total ${total})`);
    stale = added === 0 ? stale + 1 : 0;
  }
}

// join -> nickname-keyed
const byNick = {};
for (const [cid, nick] of Object.entries(comp2nick)) {
  const v = acc[cid];
  byNick[nick] = v
    ? { compId: cid, rendered: true, tag: v.tag, box: v.box, text: v.text, style: v.style, parentNickname: v.parentComp ? (comp2nick[v.parentComp] || null) : null }
    : { compId: cid, rendered: false };
}
const renderedCount = Object.values(byNick).filter(v => v.rendered).length;
writeFileSync(OUT, JSON.stringify({ url: URL, full: FULL, scrapedViewport: { w: 1440, h: 1024 }, counts: { mapped: compIds.length, rendered: renderedCount }, elements: byNick }, null, 2));
console.log(`\n✓ coverage: ${renderedCount}/${compIds.length} nicknames with geometry → wrote ${OUT}`);

let typeOf = {};
if (ELEMENTS) { try { const j = JSON.parse(readFileSync(ELEMENTS, 'utf8')); for (const p of j.pages) for (const e of p.elements) typeOf[e.id.replace('#','')] = e.type; for (const e of (j.global||[])) typeOf[e.id.replace('#','')] = e.type; } catch {} }
console.log('\n=== sample of captured elements (nickname · type · box) ===');
for (const [nick, v] of Object.entries(byNick).filter(([, v]) => v.rendered).slice(0, 8)) {
  console.log(`  #${nick}: ${typeOf[nick] || '?'} · ${v.box.x},${v.box.y} ${v.box.w}x${v.box.h}`);
}
await browser.close();
