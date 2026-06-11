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
