#!/usr/bin/env node
/**
 * wixanything-visual / scan.mjs
 *
 * Reads the PUBLISHED Wix page and produces the VISUAL layer the .wix/types map
 * lacks: per-element geometry (x/y/w/h), computed styles, and parent/child layering,
 * keyed by your Velo nicknames (#IDs). ToS-safe: it loads a public page like any
 * browser and clicks through it like a visitor — it does NOT automate the editor.
 *
 *   node scan.mjs <publishedPageUrl> [<url2> …] [--url <u>] [--out wix-visual.json] [--elements <wix-elements.json>] [--full] [--steps 6]
 *
 * Scan one OR MORE pages (positional URLs and/or repeated --url) into a single v2
 * file ({version:2, pages:[…]}); each page is fingerprint-matched to its .wix/types
 * page by the generator, so layout never leaks across same-named elements.
 *
 * --full walks multi-state UIs (e.g. a step configurator): it selects an option and
 * clicks Next at each step, re-scanning and MERGING so elements that only render on
 * later steps still get captured.
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import { buildComp2Nick, joinByNick, isAdvanceCandidateSafe } from './lib.mjs';

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i !== -1 && argv[i + 1] ? argv[i + 1] : d; };
const OUT = arg('--out', 'wix-visual.json');
const ELEMENTS = arg('--elements', null);
const FULL = argv.includes('--full');
const SOFT = argv.includes('--soft'); // don't exit non-zero if the page model maps 0 nicknames
const ALLOW_SUBMIT = argv.includes('--allow-submit'); // opt-in: also click submit/checkout-like buttons (RISKY on a live site)
const STEPS = Number(arg('--steps', '6'));
// Collect page URLs from positionals AND repeated `--url`. Skip the VALUES of
// value-taking flags so e.g. `--out file.json` is never mistaken for a URL.
const VALUE_FLAGS = new Set(['--out', '--elements', '--steps']);
const urls = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--url') { if (argv[i + 1] && !argv[i + 1].startsWith('--')) urls.push(argv[++i]); continue; }
  if (a.startsWith('--')) { if (VALUE_FLAGS.has(a)) i++; continue; }
  urls.push(a);
}
const URLS = [...new Set(urls)];
const lastSeg = (u) => { try { return new globalThis.URL(u).pathname.split('/').filter(Boolean).pop() || null; } catch { return null; } };
if (!URLS.length) { console.error('Usage: node scan.mjs <url...> [--url u] [--out f] [--elements f] [--full] [--steps n]'); process.exit(2); }

const STYLE_PROPS = ['display','position','backgroundColor','color','fontFamily','fontSize','fontWeight',
  'textAlign','lineHeight','borderRadius','borderColor','borderWidth','padding','margin','zIndex',
  'flexDirection','justifyContent','alignItems','gap','opacity','boxShadow'];

const browser = await chromium.launch({ headless: true });

// Scan ONE published page in its own fresh browser page with isolated state, so
// scanning several URLs in one run never cross-contaminates blobs/geometry.
async function scanOne(url) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1024 } });
  try {
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

    console.log('loading', url);
    try { await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 }); } catch (e) { console.log('goto note:', e.message); }

    // nickname map from the page model (pure logic lives in lib.mjs, tested offline)
    const comp2nick = buildComp2Nick(blobs);
    const compIds = Object.keys(comp2nick);
    const nick2comp = {}; for (const [c, n] of Object.entries(comp2nick)) if (!nick2comp[n]) nick2comp[n] = c;
    console.log(`mapped ${compIds.length} nicknames from the page model`);
    if (blobs.length && compIds.length === 0) {
      console.error('[visual] ⚠ mapped 0 nicknames from a non-empty page model — Wix format may have changed.');
      if (!SOFT) throw new Error('mapped 0 nicknames from a non-empty page model');
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
      // controls and NEVER submit/checkout-like buttons (isAdvanceCandidateSafe, tested in lib).
      async function clickAdvance() {
        const candidates = ['nextBtn1', 'nextBtn2', 'nextBtn3', 'nextBtn4'];
        if (ALLOW_SUBMIT) candidates.push('submitBtn');
        for (const n of candidates) {
          if (!isAdvanceCandidateSafe(n, ALLOW_SUBMIT)) continue; // never click submit/checkout-like controls by default
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

    // join -> nickname-keyed (pure logic in lib.mjs)
    const byNick = joinByNick(comp2nick, acc);
    const renderedCount = Object.values(byNick).filter(v => v.rendered).length;
    console.log(`✓ ${url}: ${renderedCount}/${compIds.length} nicknames with geometry`);
    return { url, full: FULL, pageSlug: lastSeg(url), pageId: null, counts: { mapped: compIds.length, rendered: renderedCount }, elements: byNick };
  } finally {
    await page.close();
  }
}

// Drive every URL through one shared browser; one bad URL doesn't abort the rest,
// but a failure still flags exit 1 (preserves the fail-loud format-drift signal for
// standalone/CI use — SOFT mode never throws, so it stays exit 0).
const pagesOut = [];
for (const u of URLS) {
  try { pagesOut.push(await scanOne(u)); }
  catch (e) { console.log('scan failed', u, '—', e.message); process.exitCode = 1; }
}
// v2 multi-page shape (the generator's loader still accepts old v1 single-page files).
writeFileSync(OUT, JSON.stringify({ version: 2, scannedAt: new Date().toISOString(), scrapedViewport: { w: 1440, h: 1024 }, pages: pagesOut }, null, 2));
console.log(`\n✓ wrote ${OUT} — ${pagesOut.length} page scan(s)`);

let typeOf = {};
if (ELEMENTS) { try { const j = JSON.parse(readFileSync(ELEMENTS, 'utf8')); for (const p of j.pages) for (const e of p.elements) typeOf[e.id.replace('#','')] = e.type; for (const e of (j.global||[])) typeOf[e.id.replace('#','')] = e.type; } catch {} }
for (const pg of pagesOut) {
  console.log(`\n=== ${pg.url} (${pg.counts.rendered}/${pg.counts.mapped}) ===`);
  for (const [nick, v] of Object.entries(pg.elements).filter(([, v]) => v.rendered).slice(0, 6)) {
    console.log(`  #${nick}: ${typeOf[nick] || '?'} · ${v.box.x},${v.box.y} ${v.box.w}x${v.box.h}`);
  }
}
await browser.close();
