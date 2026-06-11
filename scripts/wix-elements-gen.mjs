#!/usr/bin/env node
/**
 * wix-elements-gen.mjs  —  Wix + Claude Addon (Tier 1: read-visibility)
 *
 * Turns the GITIGNORED, hidden Wix CLI type maps (.wix/types/<pageId>/<pageId>.d.ts)
 * into committed, agent-readable artifacts at the repo root:
 *
 *   - wix-elements.json   (machine-readable inventory of every element + type)
 *   - wix-elements.md     (human/agent-readable tables, per page + global)
 *   - updates the WIX-ELEMENTS block inside CLAUDE.md (if present)
 *
 * WHY: Wix stores every element id -> $w type in .wix/types, but that folder is
 * in .gitignore, so a gitignore-respecting coding agent never reads it and "can't
 * see" the elements. We surface it. The maps are id->type ONLY (no geometry/
 * hierarchy), and HiddenCollapsedElement masks the real type until the element is
 * shown — both facts are reported honestly below.
 *
 * Usage:
 *   node scripts/wix-elements-gen.mjs [--repo <path>] [--out <path>] [--quiet]
 *   (defaults: --repo = cwd, --out = <repo>)
 */

import { readFileSync, writeFileSync, readdirSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { join, basename, relative } from 'node:path';
import { createHash } from 'node:crypto';

// Content hash of the parsed .wix/types page maps — stamped into the output so a
// stale-but-committed map is detectable on a FRESH CLONE (git discards mtimes).
// Must stay identical to the copy in wix-check.mjs.
export function hashTypes(typesDir) {
  if (!existsSync(typesDir)) return null;
  const parts = [];
  for (const entry of readdirSync(typesDir)) {
    if (['wix-code-types', 'backend', 'public'].includes(entry)) continue;
    const f = entry === 'masterPage' ? join(typesDir, 'masterPage', 'masterPage.d.ts') : join(typesDir, entry, entry + '.d.ts');
    let c = null; try { c = readFileSync(f, 'utf8'); } catch {}
    if (c != null) parts.push([entry, c]);
  }
  parts.sort((a, b) => a[0].localeCompare(b[0]));
  const h = createHash('sha256');
  for (const [k, v] of parts) { h.update(k); h.update(v); }
  return h.digest('hex').slice(0, 16);
}

// ----- args -----------------------------------------------------------------
const argv = process.argv.slice(2);
function arg(name, def) {
  const i = argv.indexOf(name);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : def;
}
const REPO = arg('--repo', process.cwd());
const OUT = arg('--out', REPO);
const QUIET = argv.includes('--quiet');
const DIFF = argv.includes('--diff'); // compare against the previous wix-elements.json before overwriting
const VISUAL = arg('--visual', null); // optional wix-visual.json (geometry/styles from a published-site scan)
const SOFT = argv.includes('--soft'); // downgrade format-drift errors to warnings (don't exit non-zero)
const log = (...a) => { if (!QUIET) console.log(...a); };
const parseWarnings = []; // a non-empty .d.ts that yields 0 elements ⇒ Wix format drift ⇒ fail loud

const TYPES_DIR = join(REPO, '.wix', 'types');
const PAGES_DIR = join(REPO, 'src', 'pages');

mkdirSync(OUT, { recursive: true }); // ensure the output dir exists

// ----- helpers --------------------------------------------------------------
function readIfExists(p) { try { return readFileSync(p, 'utf8'); } catch { return null; } }

/** Recursively collect all .js/.jsw/.web.js files under src/ for reference scanning. */
function collectSrcCode(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    let st;
    try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) collectSrcCode(full, acc);
    else if (/\.(jsw?|ts)$/.test(name)) {
      const txt = readIfExists(full);
      if (txt != null) acc.push({ file: full, txt });
    }
  }
  return acc;
}

/**
 * Parse a .d.ts ElementsMap into [{id, type, hidden}] preserving order, deduped.
 * Resilient to format drift: scopes to the `…ElementsMap = … { … }` block when
 * present, reads the FULL right-hand side of each entry (so an intersection like
 * `$w.Box & $w.HiddenCollapsedElement` keeps its real type AND the hidden flag),
 * and de-duplicates by id.
 */
function parseElementsMap(dts) {
  const out = [];
  const seen = new Set();
  if (!dts) return out;
  // Scope to the ElementsMap object body if we can find it; else parse the whole file.
  const block = dts.match(/ElementsMap\s*=\s*(?:[^={]*&\s*)?\{([\s\S]*?)\n\}/);
  const body = block ? block[1] : dts;
  // Each entry: "#id": <RHS up to ; or end-of-line>
  const re = /"(#[^"]+)"\s*:\s*([^;\n]+)/g;
  let m;
  while ((m = re.exec(body)) !== null) {
    const id = m[1];
    if (seen.has(id)) continue;
    const types = [...m[2].matchAll(/\$w\.(\w+)/g)].map(x => x[1]);
    if (!types.length) continue;
    const hidden = types.includes('HiddenCollapsedElement');
    // primary type = first non-hidden type if the entry is an intersection, else the type itself
    const type = types.find(t => t !== 'HiddenCollapsedElement') || types[0];
    seen.add(id);
    out.push({ id, type, hidden });
  }
  return out;
}

/**
 * Per-type guidance: how to actually manipulate the element from Velo.
 * The whole point is to stop Claude doing `.text` on a Box / MultiStateBox.
 */
function guidance(type) {
  switch (type) {
    case 'Text': return '.text = "..."  (string; supports inline HTML via .html)';
    case 'Button': return '.label = "..."  •  .link = "..."  •  .onClick(fn)';
    case 'Image': return '.src = "wix:image://..." or URL  •  .alt = "..."';
    case 'VectorImage': return '.src = "..."  (SVG)';
    case 'Box': return 'CONTAINER — NO .text. Use .show()/.hide()/.collapse()/.expand(), .background, .onClick. Set its CHILD text elements instead.';
    case 'MultiStateBox': return 'CONTAINER OF STATES — NO .text. Use .changeState("stateId"), read .currentState, .onChange(fn).';
    case 'Repeater': return '.data = [{_id:"1",...}]  •  .onItemReady(($item,data)=>{...})  •  .forEachItem(fn). Address item children via the scoped $item, NOT $w.';
    case 'Header': case 'Footer': return 'CONTAINER (site chrome) — global on every page. Use .collapse()/.expand(); set child elements.';
    case 'MenuContainer': return 'Menu container — global. Manage via menu settings / child elements.';
    case 'Page': return 'The page itself. Use $w.onReady(), .onViewportEnter, etc.';
    case 'Gallery': return '.items = [{src,...}]  •  .onItemClicked(fn)';
    case 'VideoBox': return '.src / video settings; .play()/.pause().';
    case 'AppController': return 'DATASET / controller (e.g. dynamicDataset) — NOT a visual element. Use wix-dataset: onReady, getCurrentItem, setFieldValue, save.';
    case 'TextInput': case 'TextBox': return '.value = "..."  •  .placeholder  •  .onInput(fn)  •  read with .value';
    case 'RichTextBox': return '.value (HTML string)  •  .onChange(fn)';
    case 'Dropdown': return '.options = [{label,value}]  •  .value  •  .onChange(fn)';
    case 'RadioButtonGroup': case 'CheckboxGroup': return '.options = [{label,value}]  •  .value / .selectedIndices  •  .onChange(fn)';
    case 'Checkbox': case 'Switch': return '.checked = true/false  •  .onChange(fn)';
    case 'Slider': return '.value = n  •  .min/.max/.step  •  .onChange(fn)';
    case 'DatePicker': return '.value = new Date(...)  •  .onChange(fn)';
    case 'UploadButton': return '.uploadFiles()  •  .onChange(fn)  •  read .value (files)';
    case 'Slideshow': return '.changeSlide(n)  •  .next()/.previous()  •  .currentIndex';
    case 'Accordion': return 'Container of folds — manage via child elements / collapse-expand.';
    case 'Table': return '.rows = [...]  •  .columns = [...]  •  .onRowSelect(fn)';
    case 'HiddenCollapsedElement': return '⚠ HIDDEN/COLLAPSED by default — TRUE TYPE UNKNOWN from types. Call .expand()/.show() first; you cannot rely on .text/.label until you confirm the real element type in the editor.';
    default: return `$w.${type} — check the Wix $w API for the correct property/method.`;
  }
}

const SETTABLE_TEXT = new Set(['Text']);

// ----- discover pages -------------------------------------------------------
if (!existsSync(TYPES_DIR)) {
  console.error(`\n[wix-elements] ERROR: ${TYPES_DIR} not found.`);
  console.error('  The Wix type maps are not present. Run "wix sync-types" (logged in) first,');
  console.error('  e.g. via: node scripts/wix-doctor.mjs --repo "' + REPO + '"\n');
  process.exit(2);
}

// Map pageId -> { name, file } from src/pages/<Name>.<id>.js
const pageMeta = {};
if (existsSync(PAGES_DIR)) {
  for (const f of readdirSync(PAGES_DIR)) {
    const m = f.match(/^(.*)\.([a-z0-9]{4,6})\.js$/i);
    if (m) pageMeta[m[2]] = { name: m[1], file: join('src', 'pages', f) };
  }
}

// Reference scan corpus (ALL src code, not just one page — avoids false "unused").
const corpus = collectSrcCode(join(REPO, 'src'));
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const relPath = (f) => relative(REPO, f).split('\\').join('/'); // clean, relative, POSIX — never leaks an absolute path/username
/**
 * Which Velo files reference an element + which events are wired.
 * Anchored so `#text1` does NOT match `#text10`, and it detects Wix's editor-attached
 * handlers `export function <nick>_<event>()` — which carry no `#id` string and were
 * previously mislabelled "not in code".
 */
const refsOf = (id) => {
  const en = escapeRe(id.slice(1));
  const selRe = new RegExp('#' + en + '(?![\\w-])');                       // $w('#id') / "#id"
  const expRe = new RegExp('export\\s+function\\s+' + en + '_(\\w+)\\s*\\(', 'g'); // editor-wired handler
  const onRe = new RegExp('#' + en + "['\"]\\s*\\)\\s*\\.(on[A-Za-z]\\w*)\\s*\\(", 'g'); // $w('#id').onClick(
  const files = new Set(), events = new Set();
  for (const c of corpus) {
    let hit = selRe.test(c.txt);
    let m; expRe.lastIndex = 0;
    while ((m = expRe.exec(c.txt))) { hit = true; events.add(m[1]); }
    onRe.lastIndex = 0;
    while ((m = onRe.exec(c.txt))) { events.add(m[1].replace(/^on/, '').toLowerCase()); }
    if (hit) files.add(relPath(c.file));
  }
  return { referencedIn: [...files], events: [...events] };
};

// ----- parse master + pages -------------------------------------------------
// optional visual layer (geometry/styles/layering from a published-site scan)
let visualMap = {};
if (VISUAL) { try { visualMap = (JSON.parse(readIfExists(VISUAL) || '{}').elements) || {}; } catch {} }
// Invert parent -> children ONCE, so a container can list the child elements inside it.
// This is what makes "a Box has no .text — set its CHILD Text element" actionable.
const childrenOf = {};
for (const [nick, v] of Object.entries(visualMap)) {
  if (v && v.rendered && v.parentNickname) (childrenOf[v.parentNickname] ||= []).push(nick);
}
const viz = (id) => {
  const nick = id.replace('#', '');
  const v = visualMap[nick];
  if (!v || !v.rendered) return null;
  return {
    box: v.box,
    parentNickname: v.parentNickname ?? null,
    children: (childrenOf[nick] || []).map(n => '#' + n),  // the elements nested inside this one
    text: v.text ?? undefined,                              // current text/label content (if any)
    style: v.style,                                         // full computed-style subset the scanner captured
  };
};

// Recover the true type of a HiddenCollapsedElement: (a) from Velo accessor usage,
// (b) from the rendered DOM tag the scanner records — removes a class of guessing.
function recoverHiddenType(id) {
  const en = escapeRe(id.slice(1));
  const accRe = new RegExp("\\$w\\(\\s*['\"]#" + en + "['\"]\\s*\\)\\s*\\.([a-zA-Z]\\w*)", 'g');
  const ACC = [[/^(changeState|currentState)$/, 'MultiStateBox'], [/^label$/, 'Button'],
    [/^(text|html)$/, 'Text'], [/^src$/, 'Image'], [/^(data|onItemReady|forEachItem)$/, 'Repeater'],
    [/^value$/, 'TextInput'], [/^checked$/, 'Checkbox']];
  for (const c of corpus) {
    let m; accRe.lastIndex = 0;
    while ((m = accRe.exec(c.txt))) for (const [pat, t] of ACC) if (pat.test(m[1])) return { type: t, via: 'velo .' + m[1] };
  }
  const v = visualMap[id.slice(1)];
  const TAG = { img: 'Image', button: 'Button', a: 'Button', input: 'TextInput', textarea: 'TextBox', h1: 'Text', h2: 'Text', h3: 'Text', p: 'Text', span: 'Text' };
  if (v && v.tag && TAG[v.tag]) return { type: TAG[v.tag], via: 'rendered <' + v.tag + '>' };
  return null;
}

// Enrich a parsed element with references, events, layout, and (for hidden ones) a recovered type.
function enrich(e) {
  const out = { ...e, ...refsOf(e.id), layout: viz(e.id) };
  if (e.hidden) {
    const rec = recoverHiddenType(e.id);
    out.recoveredType = rec ? rec.type : null;
    out.guidance = rec
      ? `Hidden/collapsed — likely $w.${rec.type} (${rec.via}). .show()/.expand() first, then use the ${rec.type} API.`
      : guidance('HiddenCollapsedElement');
  } else {
    out.guidance = guidance(e.type);
  }
  return out;
}

const masterDts = readIfExists(join(TYPES_DIR, 'masterPage', 'masterPage.d.ts'));
const masterEls = parseElementsMap(masterDts).map(enrich);
if (masterDts && /\$w\./.test(masterDts) && masterEls.length === 0) parseWarnings.push('masterPage.d.ts has $w types but parsed 0 elements');

const pages = [];
for (const entry of readdirSync(TYPES_DIR)) {
  if (['wix-code-types', 'backend', 'public', 'masterPage'].includes(entry)) continue;
  const dts = readIfExists(join(TYPES_DIR, entry, `${entry}.d.ts`));
  if (!dts) continue;
  const els = parseElementsMap(dts).map(enrich);
  if (/\$w\./.test(dts) && els.length === 0) parseWarnings.push(`${entry}/${entry}.d.ts has $w types but parsed 0 elements`);
  const meta = pageMeta[entry] || { name: entry, file: null };
  pages.push({ pageId: entry, name: meta.name, file: meta.file, elementCount: els.length, elements: els });
}
pages.sort((a, b) => a.name.localeCompare(b.name));

// ----- site config ----------------------------------------------------------
let site = {};
try { site = JSON.parse(readIfExists(join(REPO, 'wix.config.json')) || '{}'); } catch {}

// ----- stats ----------------------------------------------------------------
const allEls = [...masterEls, ...pages.flatMap(p => p.elements)];
const stats = {
  pages: pages.length,
  totalElements: allEls.length,
  globalElements: masterEls.length,
  hidden: allEls.filter(e => e.hidden).length,
  referenced: allEls.filter(e => e.referencedIn.length).length,
  withLayout: allEls.filter(e => e.layout).length,
  types: [...new Set(allEls.map(e => e.type))].sort(),
};

const generatedAt = new Date().toISOString();

// ----- write JSON -----------------------------------------------------------
const json = {
  $note: 'AUTO-GENERATED by scripts/wix-elements-gen.mjs from .wix/types (gitignored). Do not edit by hand. id->type only; no geometry/hierarchy. HiddenCollapsedElement masks the real type.',
  generatedAt,
  inputsHash: hashTypes(TYPES_DIR), // content hash of the source .d.ts maps (for fresh-clone staleness)
  site: { siteId: site.siteId ?? null, uiVersion: site.uiVersion ?? null },
  stats,
  global: masterEls.map(({ id, type, hidden, recoveredType, referencedIn, events, guidance, layout }) => ({ id, type, hidden, recoveredType, referencedInVelo: referencedIn.length > 0, referencedIn, events, guidance, layout })),
  pages: pages.map(p => ({
    pageId: p.pageId, name: p.name, file: p.file, elementCount: p.elementCount,
    elements: p.elements.map(({ id, type, hidden, recoveredType, referencedIn, events, guidance, layout }) => ({ id, type, hidden, recoveredType, referencedInVelo: referencedIn.length > 0, referencedIn, events, guidance, layout })),
  })),
};
// ----- diff vs previous (the L0 mutation oracle) ----------------------------
// Honest scope: detects elements ADDED / REMOVED / TYPE-CHANGED between syncs —
// i.e. structural changes that alter the id->type map. It CANNOT see move/resize/
// reorder/restyle or content edits (those change neither id nor type); verify
// those with a screenshot. Read the OLD json BEFORE we overwrite it below.
if (DIFF) {
  const prevRaw = readIfExists(join(OUT, 'wix-elements.json'));
  const flatten = (j) => {
    const m = new Map();
    if (!j) return m;
    for (const e of (j.global || [])) m.set('global|' + e.id, e.type);
    for (const p of (j.pages || [])) for (const e of (p.elements || [])) m.set(p.pageId + '|' + e.id, e.type);
    return m;
  };
  const A = flatten(prevRaw ? JSON.parse(prevRaw) : null), B = flatten(json);
  const added = [], removed = [], changed = [];
  for (const [k, t] of B) { if (!A.has(k)) added.push([k, t]); else if (A.get(k) !== t) changed.push([k, A.get(k), t]); }
  for (const [k, t] of A) if (!B.has(k)) removed.push([k, t]);
  const pretty = (k) => { const [scope, id] = k.split('|'); return `${id} (${scope})`; };
  log('\n── element diff vs previous sync ──');
  if (!prevRaw) log('  (no previous wix-elements.json — this is the baseline)');
  else if (!added.length && !removed.length && !changed.length) log('  no structural changes (ids/types identical)');
  else {
    for (const [k, t] of added) log(`  + ADDED    ${pretty(k)} : ${t}`);
    for (const [k, t] of removed) log(`  - REMOVED  ${pretty(k)} : ${t}`);
    for (const [k, o, n] of changed) log(`  ~ RETYPED  ${pretty(k)} : ${o} → ${n}`);
    log(`  (${added.length} added, ${removed.length} removed, ${changed.length} retyped — move/resize/restyle are NOT shown here)`);
  }
  log('───────────────────────────────────\n');
}

writeFileSync(join(OUT, 'wix-elements.json'), JSON.stringify(json, null, 2));

// ----- write Markdown -------------------------------------------------------
function table(els) {
  const content = (e) => {
    const L = e.layout; if (!L) return '·';
    if (L.children && L.children.length) return '▸ ' + L.children.slice(0, 6).join(' ') + (L.children.length > 6 ? ' …' : '');
    if (L.text) return '"' + L.text.slice(0, 36) + '"';
    return '·';
  };
  const rows = els.map(e => {
    const ev = e.events && e.events.length ? ` ⚡${e.events.join('/')}` : '';
    const flag = (e.hidden ? '🙈 hidden' : (e.referencedIn.length ? '· in code' : '·')) + ev;
    const lay = e.layout && e.layout.box ? `${e.layout.box.x},${e.layout.box.y} · ${e.layout.box.w}×${e.layout.box.h}` : '·';
    const typeCell = e.recoveredType ? `${e.type}→${e.recoveredType}` : e.type;
    return `| \`${e.id}\` | \`${typeCell}\` | ${flag} | ${lay} | ${content(e).replace(/\|/g, '\\|')} |`;
  });
  return ['| ID | Type | State | Layout | Content / children |',
          '|----|------|-------|--------|--------------------|', ...rows].join('\n');
}

let md = '';
md += `# Wix Elements — ${site.siteId ? 'site ' + site.siteId : 'this site'}\n\n`;
md += `> **AUTO-GENERATED** by \`scripts/wix-elements-gen.mjs\` — do not edit by hand.\n`;
md += `> Source: \`.wix/types/*\` (gitignored, refreshed by \`wix sync-types\`). Generated: ${generatedAt}\n\n`;
md += `**${stats.pages} pages · ${stats.totalElements} elements** (${stats.globalElements} global, ${stats.hidden} hidden, ${stats.referenced} referenced in Velo${stats.withLayout ? `, ${stats.withLayout} with live layout/styles` : ''}).\n\n`;
md += `## ⚠ Read this before targeting elements\n`;
md += `- These are the **only** element IDs that exist. \`$w('#id')\` can target these and **nothing else** — it **cannot create** new elements.\n`;
md += `- When a **visual scan** has been merged, rows show **Layout** (x,y · w×h) and **Content / children** — a container's row lists its child elements (\`▸ #child …\`) and a text element shows its current text. Without a scan, the map is id→type only.\n`;
md += `- **\`HiddenCollapsedElement\` (🙈) masks the real type.** A hidden Text, Box, or MultiStateBox all show as \`HiddenCollapsedElement\`. \`.expand()\`/\`.show()\` it first; confirm the real type in the editor before using \`.text\`/\`.label\`.\n`;
md += `- **"in code" just means some Velo file references the id.** On editor-built sites most elements are NOT referenced in code — that is normal, **not** "unused".\n`;
md += `- A **\`Box\`/\`MultiStateBox\` has NO \`.text\`.** Calling \`.text\` on a container is the classic bug — set the **child** Text elements shown in its **Content / children** column, or use \`.changeState()\` for a MultiStateBox.\n\n`;
md += `## How to set each type (legend — look up a row's **Type** here)\n\n`;
md += `| Type | How to set it (Velo) |\n|------|----------------------|\n`;
for (const t of stats.types) md += `| \`${t}\` | ${guidance(t).replace(/\|/g, '\\|')} |\n`;
md += `\n`;
md += `## 🌐 Global elements (header / footer / menus — addressable on EVERY page)\n\n`;
md += table(masterEls) + '\n\n';
for (const p of pages) {
  md += `## 📄 ${p.name}  \`(${p.pageId})\`\n`;
  if (p.file) md += `Velo code: \`${p.file}\`  ·  ${p.elementCount} page elements (plus all global elements above)\n\n`;
  md += table(p.elements) + '\n\n';
}
writeFileSync(join(OUT, 'wix-elements.md'), md);

// ----- update CLAUDE.md block (if present) ----------------------------------
const claudePath = join(OUT, 'CLAUDE.md');
const claude = readIfExists(claudePath);
if (claude) {
  const START = '<!-- WIX-ELEMENTS:START -->';
  const END = '<!-- WIX-ELEMENTS:END -->';
  const recoveredCount = allEls.filter(e => e.recoveredType).length;
  const withEvents = allEls.filter(e => e.events && e.events.length).length;
  const block = [
    START,
    '## Wix element map (auto-generated — do not edit between the markers)',
    `_Generated ${generatedAt} · ${stats.pages} pages · ${stats.totalElements} elements (${stats.withLayout} with layout, ${recoveredCount} recovered hidden-types, ${withEvents} with wired events)._`,
    '',
    '**Before targeting any element, read `wix-elements.md`.** Then:',
    '- `$w(\'#id\')` can only select the listed IDs and **cannot create** elements — never invent an id.',
    '- Pick the property by the row\'s **Type** (see the legend). A `Box`/`MultiStateBox`/`Header`/`Footer`/`Repeater` is a **container with no `.text`** — set the child elements shown in its **Content / children** column, or use `.changeState()` / `.data`.',
    '- `HiddenCollapsedElement` rows may show a recovered type (`Type→Recovered`); `.show()`/`.expand()` first.',
    '- Elements marked **⚡event** already have that handler wired — don\'t double-bind.',
    '- Refresh after any editor change: `npm run wix:full -- --url "<published page>"` (or `npm run wix:elements` for types only).',
    '- Wix docs are machine-readable: https://dev.wix.com/docs/llms.txt (or append `.md` to any docs URL).',
    END,
  ].join('\n');
  let next;
  if (claude.includes(START) && claude.includes(END)) {
    next = claude.replace(new RegExp(START + '[\\s\\S]*?' + END), block);
  } else {
    next = claude.trimEnd() + '\n\n' + block + '\n';
  }
  writeFileSync(claudePath, next);
  log('[wix-elements] updated CLAUDE.md element block');
}

// ----- summary --------------------------------------------------------------
log(`[wix-elements] ${stats.pages} pages · ${stats.totalElements} elements · ${stats.hidden} hidden · ${stats.referenced} referenced`);
log(`[wix-elements] wrote ${join(OUT, 'wix-elements.json')}`);
log(`[wix-elements] wrote ${join(OUT, 'wix-elements.md')}`);

// ----- fail-loud canary (format drift) --------------------------------------
if (allEls.length === 0) parseWarnings.push('0 elements parsed across the whole site — the Wix .d.ts format may have changed.');
if (parseWarnings.length) {
  console.error('\n[wix-elements] ⚠ FORMAT-DRIFT WARNING — parsed fewer elements than expected:');
  for (const w of parseWarnings) console.error('  - ' + w);
  if (!SOFT) {
    console.error('  The generated map may be incomplete. Exiting non-zero (pass --soft to override).\n');
    process.exit(1);
  }
  console.error('  (--soft: continuing despite drift)\n');
}
