/**
 * wix-cms-lib.mjs  —  Wix + Claude Addon (CMS schema bridge: pure logic)
 *
 * No I/O, no network, no global `fetch` — every side effect is injected, so the
 * self-test can exercise this offline (mirrors wix-media-lib.mjs / visual/lib.mjs).
 *
 * WHY: an agent writing Velo `wix-data` queries can't see the site's CMS — it
 * doesn't know which collections exist or their field keys/types, so it guesses
 * (`.eq("title", …)` when the field is actually `name`). This lists every Data
 * Collection + field schema via the Wix Data REST API into a committed artifact.
 */

// ─── Reference target of a reference/multi-reference field ───────────────────
function refOf(field) {
  const tm = field?.typeMetadata || {};
  return tm.reference?.referencedCollectionId || tm.multiReference?.referencedCollectionId || null;
}

// ─── Normalize a REST DataCollection into our flat record ────────────────────
export function normalizeCollection(c) {
  if (!c) return null;
  const fields = (c.fields || []).map(f => ({
    key: f.key ?? null,
    displayName: f.displayName ?? null,
    type: f.type ?? null,                 // TEXT | NUMBER | IMAGE | REFERENCE | …
    ref: refOf(f),                        // referenced collection id (for REFERENCE/MULTI_REFERENCE)
    required: !!f.required,
    readOnly: !!f.readOnly,
    system: !!f.systemField,
  }));
  const p = c.permissions || null;
  return {
    id: c.id ?? null,                     // the value you pass to wixData.query("…")
    displayName: c.displayName ?? c.id ?? null,
    collectionType: c.collectionType ?? null, // NATIVE | WIX_APP | BLOCKS_APP | EXTERNAL
    fieldCount: fields.length,
    fields,
    permissions: p ? { read: p.read ?? null, insert: p.insert ?? null, update: p.update ?? null, remove: p.remove ?? null } : null,
  };
}

// ─── List every Data Collection via REST (fetch is INJECTED) ─────────────────
// Offset-paged (paging.limit / paging.offset; pagingMetadata.total). Returns
// { collections, truncated, error } — keeps whatever it fetched before a failure.
export async function listCollections({ apiKey, siteId, fetchImpl, maxCollections = 1000, log = () => {} }) {
  if (!apiKey || !siteId) throw new Error('listCollections: apiKey and siteId are required');
  if (typeof fetchImpl !== 'function') throw new Error('listCollections: fetchImpl is required');
  const headers = { Authorization: apiKey, 'wix-site-id': siteId, 'Content-Type': 'application/json' };
  const base = 'https://www.wixapis.com/wix-data/v2/collections';
  const limit = 100;
  const acc = [];
  let offset = 0, total = Infinity, pages = 0, truncated = false, error = null;
  try {
    do {
      const res = await fetchImpl(`${base}?paging.limit=${limit}&paging.offset=${offset}`, { headers });
      if (res.status === 429) { const e = new Error('rate-limited'); e.code = 429; throw e; }
      if (!res.ok) { const e = new Error(`HTTP ${res.status}`); e.code = res.status; try { e.body = await res.text(); } catch {} throw e; }
      const json = await res.json();
      const batch = json.collections || [];
      for (const c of batch) {
        if (acc.length >= maxCollections) { truncated = true; break; }
        acc.push(c);
      }
      const pm = json.pagingMetadata || {};
      total = Number.isFinite(pm.total) ? pm.total : acc.length;
      offset += batch.length;
      if (!batch.length || truncated) break;
      if (++pages > 100) { truncated = true; break; } // backstop against a broken pager
    } while (acc.length < total);
  } catch (e) {
    error = e; // keep partial results; caller decides how to surface
    log(`⚠ collection listing interrupted after ${acc.length}: ${e.message}`);
  }
  return { collections: acc, truncated, error };
}

// ─── A Velo wix-data query snippet for a collection ──────────────────────────
export function sampleQuery(col) {
  return `const { items } = await wixData.query(${JSON.stringify(col.id)}).limit(50).find();`;
}

// ─── Render the agent-facing Markdown ────────────────────────────────────────
const TYPE_ORDER = { NATIVE: 0, BLOCKS_APP: 1, WIX_APP: 2, EXTERNAL: 3 };
export function renderCmsMarkdown(model) {
  const { generatedAt, site, source, stats, collections = [], truncated, error } = model;
  const esc = (s) => String(s ?? '').replace(/\|/g, '\\|');
  let md = '';
  md += `# Wix CMS schema — ${site?.siteId ? 'site ' + site.siteId : 'this site'}\n\n`;
  md += `> **AUTO-GENERATED** by \`scripts/wix-cms.mjs\` — do not edit by hand.\n`;
  md += `> Source: ${source}. Generated: ${generatedAt}\n\n`;

  if (!collections.length) {
    md += `_No collections listed._ ${error ? `(error: ${esc(error.message)})` : 'Configure a Wix API key with the **Manage Data Collections** permission — see `docs/wix-addon/CMS.md`.'}\n`;
    return md;
  }

  md += `**${stats.collections} collections** (${stats.native} native, ${stats.app} app/system) · ${stats.fields} fields total.\n\n`;
  md += `## ⚠ Before writing any \`wix-data\` query\n`;
  md += `- Use a collection's **\`id\`** verbatim in \`wixData.query("<id>")\` and a field's **\`key\`** verbatim in \`.eq("<key>", …)\` — these are the real names; don't guess from the display name.\n`;
  md += `- \`IMAGE\`/\`VIDEO\`/\`DOCUMENT\`/\`MEDIA_GALLERY\` fields store Wix media values (\`wix:image://…\`) — cross-reference \`wix-media.md\`.\n`;
  md += `- \`REFERENCE\`/\`MULTI_REFERENCE\` fields point at another collection (shown as \`→ <id>\`); resolve them with \`.include("<key>")\` or \`wixData.queryReferenced(...)\`.\n`;
  md += `- \`read\` permission shows who can read the collection from the frontend (\`ANYONE\` = public).\n`;
  if (truncated) md += `- ⚠ Listing was **truncated** at the safety cap — some collections are not shown.\n`;
  if (error) md += `- ⚠ Listing ended early (${esc(error.message)}); results below are **partial**.\n`;
  md += `\n`;

  const sorted = [...collections].sort((a, b) =>
    (TYPE_ORDER[a.collectionType] ?? 9) - (TYPE_ORDER[b.collectionType] ?? 9) ||
    (a.displayName || '').localeCompare(b.displayName || ''));

  for (const col of sorted) {
    const perm = col.permissions ? ` · read: \`${esc(col.permissions.read)}\`` : '';
    md += `## 🗄 ${esc(col.displayName)}  \`${esc(col.id)}\`\n`;
    md += `_${esc(col.collectionType || '·')} · ${col.fieldCount} fields${perm}_\n\n`;
    md += `| Field key | Type | Req | Ref | Display name |\n|-----------|------|-----|-----|--------------|\n`;
    for (const f of col.fields) {
      const ref = f.ref ? `→ \`${esc(f.ref)}\`` : '·';
      const req = f.required ? '✓' : '·';
      const sysflag = f.system ? ' _(system)_' : '';
      md += `| \`${esc(f.key)}\` | ${esc(f.type || '·')} | ${req} | ${ref} | ${esc(f.displayName || '·')}${sysflag} |\n`;
    }
    md += `\n\`\`\`js\nimport wixData from 'wix-data';\n${sampleQuery(col)}\n\`\`\`\n\n`;
  }
  return md;
}

// ─── Render the CLAUDE.md digest block ───────────────────────────────────────
export function renderClaudeCmsBlock(model, { start, end }) {
  const { generatedAt, stats, source } = model;
  return [
    start,
    '## Wix CMS schema (auto-generated — do not edit between the markers)',
    `_Generated ${generatedAt} · ${stats.collections} collections · ${stats.fields} fields · source: ${source}._`,
    '',
    '**Before writing any `wix-data` query, read `wix-cms.md`.** Then:',
    '- Pass a collection\'s **`id`** verbatim to `wixData.query("<id>")` and a field\'s **`key`** verbatim to `.eq()/.contains()/...` — never guess names from the CMS display label.',
    '- `REFERENCE`/`MULTI_REFERENCE` fields point at another collection — resolve with `.include("<key>")`.',
    '- `IMAGE`/`MEDIA_GALLERY` fields hold `wix:image://…` values — see `wix-media.md`.',
    '- Refresh after a CMS change: `npm run wix:cms` (needs a Wix API key with "Manage Data Collections"; see `docs/wix-addon/CMS.md`).',
    end,
  ].join('\n');
}
