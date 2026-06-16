// Pure, browser-free logic for the visual scanner — importable and testable offline
// (scan.mjs launches Playwright at module top level, so this code lived untested).

// Structural keys that also point at comp-ids in the page model but are NOT nicknames.
export const STRUCTURAL = new Set(['compId', 'role', 'id', 'type', 'parent', 'dataQuery', 'propertyQuery',
  'designQuery', 'behaviorQuery', 'connectionQuery', 'styleId', 'skin', 'componentType', 'metaData', 'layout', 'props', 'mobileStructure']);

/**
 * Build comp-id -> nickname from Wix Thunderbolt page-model blobs.
 * Hardened: matches {compId,role} in EITHER key order, whitespace-tolerant; the flat
 * "<nick>":"comp-x" fallback skips structural keys so junk isn't treated as a nickname.
 */
export function buildComp2Nick(blobs) {
  const comp2nick = {};
  const connA = /"compId"\s*:\s*"(comp-[a-z0-9]+)"[^}]*?"role"\s*:\s*"([A-Za-z][\w-]*)"/g;
  const connB = /"role"\s*:\s*"([A-Za-z][\w-]*)"[^}]*?"compId"\s*:\s*"(comp-[a-z0-9]+)"/g;
  const flat = /"([A-Za-z][\w-]*)"\s*:\s*"(comp-[a-z0-9]+)"/g;
  for (const b of blobs) {
    let m;
    connA.lastIndex = 0; while ((m = connA.exec(b))) comp2nick[m[1]] = m[2];
    connB.lastIndex = 0; while ((m = connB.exec(b))) comp2nick[m[2]] = m[1];
  }
  for (const b of blobs) {
    let m; flat.lastIndex = 0;
    while ((m = flat.exec(b))) { if (!STRUCTURAL.has(m[1]) && !comp2nick[m[2]]) comp2nick[m[2]] = m[1]; }
  }
  return comp2nick;
}

// Submit/checkout-like controls we must NOT click on a LIVE site (could create a lead/order).
export const DANGER = /submit|checkout|pay|buy|book|order|delete|remove|confirm|finish|send/i;
export const isAdvanceCandidateSafe = (nick, allowSubmit = false) => allowSubmit || !DANGER.test(nick);

/** Join comp-id -> nickname with the accumulated per-comp visual data into a nickname-keyed map. */
export function joinByNick(comp2nick, acc) {
  const byNick = {};
  for (const [cid, nick] of Object.entries(comp2nick)) {
    const v = acc[cid];
    byNick[nick] = v
      ? { compId: cid, rendered: true, tag: v.tag, box: v.box, text: v.text, style: v.style, parentNickname: v.parentComp ? (comp2nick[v.parentComp] || null) : null }
      : { compId: cid, rendered: false };
  }
  return byNick;
}

// ── Page-scoped attribution ─────────────────────────────────────────────────
// A scan reads ONE published page but can't know which .wix/types page it is —
// nicknames like #text1 repeat on every page. These pure functions let the
// generator attribute a scan to exactly one page by FINGERPRINT (which set of
// page-specific nicknames it best matches), so geometry merges only into that
// page (+ shared master/global chrome), never leaking onto same-named elements
// elsewhere. All inputs are plain Sets/objects → unit-testable offline.

/**
 * Match a scan's nickname Set to the page whose PAGE-SPECIFIC nick set overlaps
 * most (Jaccard). Master/global nicks are dropped from scoring — they appear on
 * every page and would flatten the discrimination. Jaccard is 1.0 only at the
 * true page and defeats BOTH subset and superset auto-nickname collisions.
 * Below the overlap/Jaccard floors a scan matches NO page (master geometry only)
 * rather than being force-fit. Deterministic tie-break (jaccard→inter→coverage→
 * pageId), so pass pageSets iterated in sorted-pageId order.
 */
export function matchScanToPage(scanNicks, pageSets, masterSet, opts = {}) {
  const { minOverlap = 1, minJaccard = 0.10, ambiguousMargin = 0.05, explicitPageId = null } = opts;
  if (explicitPageId && pageSets.has(explicitPageId))
    return { pageId: explicitPageId, via: 'pageId', jaccard: 1, ambiguous: false, candidates: [] };
  const fpSpec = new Set();
  for (const n of scanNicks) if (!masterSet.has(n)) fpSpec.add(n);
  const scored = [];
  for (const [pageId, set] of pageSets) {
    let inter = 0; for (const n of fpSpec) if (set.has(n)) inter++;
    const union = fpSpec.size + set.size - inter;
    scored.push({ pageId, inter, jaccard: union ? inter / union : 0, coverage: set.size ? inter / set.size : 0 });
  }
  scored.sort((a, b) => b.jaccard - a.jaccard || b.inter - a.inter || b.coverage - a.coverage
    || (a.pageId < b.pageId ? -1 : a.pageId > b.pageId ? 1 : 0));
  const top = scored[0], next = scored[1] || null;
  if (!top || top.inter < minOverlap || top.jaccard < minJaccard)
    return { pageId: null, via: 'none', jaccard: top ? top.jaccard : 0, ambiguous: false, candidates: scored.slice(0, 3) };
  // Exact tie: two pages with indistinguishable page-specific nick sets — refuse to
  // guess (picking the lexicographically-first page would re-introduce a cross-page
  // leak). Attribute to NO page → only shared master geometry is used.
  if (next && top.jaccard === next.jaccard && top.inter === next.inter && top.coverage === next.coverage)
    return { pageId: null, via: 'tie', jaccard: top.jaccard, ambiguous: true, runnerUp: next, candidates: scored.slice(0, 3) };
  const ambiguous = !!next && (top.jaccard - next.jaccard) < ambiguousMargin;
  return { pageId: top.pageId, via: 'fingerprint', jaccard: top.jaccard, ambiguous, runnerUp: next, candidates: scored.slice(0, 3) };
}

/**
 * Attribute a list of scans to pages. Master/global nicks merge into a shared
 * masterGeom from ANY scan (first rendered wins); each scan's page-specific
 * nicks merge ONLY into its matched page's geometry. Returns { masterGeom,
 * pageGeom: {pageId->geom}, diagnostics } for the generator to enrich per page.
 */
export function attributeScans(scans, pageSets, masterSet, opts = {}) {
  const masterGeom = {}, pageGeom = {}, diagnostics = [];
  const keepMerge = (dst, src, keep) => {
    for (const [n, v] of Object.entries(src))
      if (keep(n) && (!dst[n] || (!dst[n].rendered && v.rendered))) dst[n] = v;
  };
  for (const scan of (scans || [])) {
    const els = scan.elements || {};
    keepMerge(masterGeom, els, (n) => masterSet.has(n));
    const m = matchScanToPage(new Set(Object.keys(els)), pageSets, masterSet, { ...opts, explicitPageId: scan.pageId || null });
    const label = scan.pageSlug || scan.url || '(scan)';
    if (!m.pageId) { diagnostics.push({ scan: label, matched: null, reason: 'no confident page', candidates: m.candidates }); continue; }
    if (m.ambiguous && opts.strictAmbiguous) { diagnostics.push({ scan: label, matched: m.pageId, ambiguous: true, suppressed: true }); continue; }
    const dst = (pageGeom[m.pageId] ||= {});
    keepMerge(dst, els, (n) => pageSets.get(m.pageId).has(n));
    diagnostics.push({ scan: label, matched: m.pageId, via: m.via, jaccard: +m.jaccard.toFixed(3), ambiguous: m.ambiguous });
  }
  return { masterGeom, pageGeom, diagnostics };
}
