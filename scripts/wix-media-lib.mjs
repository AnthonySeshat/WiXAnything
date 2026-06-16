/**
 * wix-media-lib.mjs  —  Wix + Claude Addon (Media bridge: pure logic)
 *
 * No I/O, no network, no global `fetch` — every side effect is injected. This
 * mirrors visual/lib.mjs so selftest can exercise the real logic offline with
 * fixtures (the CLI wrapper wix-media.mjs supplies fs/env/global fetch).
 *
 * WHY this module exists: a Wix CLI repo contains ZERO image files — only code
 * syncs to Git; every uploaded photo lives in the cloud Media Manager. So an
 * agent is "media-blind": it only sees an asset where a `wix:image://…` URL is
 * hard-coded into Velo. This module recovers media two ways:
 *   1. scanCodeForMedia()  — zero-auth: every Wix media URL already in the code.
 *   2. walkMedia()         — with a Wix API key: the real Media Manager tree.
 */

// ─── .env parsing (so creds can live in a gitignored .env, like headless/) ───
export function parseDotenv(text) {
  const out = {};
  if (!text) return out;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    // strip a single layer of matching quotes; leave inner content verbatim
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
}

// ─── Velo wix:image:// URI <-> Media Manager file ────────────────────────────
// Velo .src form:  wix:image://v1/<mediaId>/<filename>#originWidth=W&originHeight=H
// <mediaId> is the WixMedia GUID (the REST `media.image.image.id`, e.g.
// "11062b_abc…~mv2.jpg"). The #origin* hint is used by Wix to pick scaling.

// decodeURIComponent throws a URIError on a malformed escape (a bare "%" in a
// hard-coded URL). Never let that abort the zero-auth code scan — fall back raw.
function safeDecode(s) { try { return decodeURIComponent(s); } catch { return s; } }

export function parseWixImageUri(uri) {
  if (typeof uri !== 'string') return null;
  const m = uri.match(/^wix:image:\/\/v1\/([^/]+)(?:\/([^#?]*))?(?:#(.*))?$/);
  if (!m) return null;
  const [, mediaId, filename = '', hash = ''] = m;
  const w = hash.match(/originWidth=(\d+)/);
  const h = hash.match(/originHeight=(\d+)/);
  return {
    mediaId: safeDecode(mediaId),
    filename: filename ? safeDecode(filename) : null,
    width: w ? Number(w[1]) : null,
    height: h ? Number(h[1]) : null,
  };
}

/**
 * Build the Velo `.src` string for an image, from its Media Manager fields.
 * The filename segment is percent-encoded (Wix's canonical src does this) so a
 * name with spaces / "#" / "%" yields a valid URI that round-trips through
 * parseWixImageUri — agents copy this verbatim, so it must actually resolve.
 * The mediaId is an opaque WixMedia id (only unreserved chars ~ _ - .) → left as-is.
 */
export function buildVeloImageUri({ mediaId, filename, width, height }) {
  if (!mediaId) return null;
  let uri = `wix:image://v1/${mediaId}`;
  if (filename) uri += `/${encodeURIComponent(filename)}`;
  const hints = [];
  if (width) hints.push(`originWidth=${width}`);
  if (height) hints.push(`originHeight=${height}`);
  if (hints.length) uri += `#${hints.join('&')}`;
  return uri;
}

// ─── Zero-auth: recover every Wix media reference already in the code ────────
// corpus = [{ file: '<relpath>', txt: '<source>' }, …]
// Detects the four `wix:<kind>://` schemes Velo uses, plus public CDN URLs
// (static.wixstatic.com / *.usrfiles.com / *.wixmp.com) that show up in code.
export function scanCodeForMedia(corpus = []) {
  const byKey = new Map(); // dedupe by raw URL; merge the files that reference it
  const add = (kind, raw, parsed, file) => {
    let rec = byKey.get(raw);
    if (!rec) { rec = { kind, raw, ...parsed, referencedIn: [] }; byKey.set(raw, rec); }
    if (file && !rec.referencedIn.includes(file)) rec.referencedIn.push(file);
  };
  // Trim trailing punctuation a URL can't really end in (incl. brackets the
  // char-class below doesn't stop at: ] } >). A match containing a template
  // placeholder (`${…}` / `{{…}}`) is code, not a real asset — skip it.
  const clean = (s) => s.replace(/[.,;\]}>]+$/, '');
  const templated = (s) => /\$\{|\{\{/.test(s);
  // wix:image:// — keep the structured fields so we can show dimensions/id.
  const imgRe = /wix:image:\/\/v1\/[^\s"'`)]+/g;
  // other wix: schemes (video/audio/document/vector/shape) — capture whole token.
  const otherRe = /wix:(video|audio|document|vector|shape|secure):\/\/[^\s"'`)]+/g;
  // public CDN media URLs that appear directly in Velo/HTML. Subdomains are
  // hyphenated (images-wixmp-….wixmp.com), and wixstatic serves /media + /shapes.
  const cdnRe = /https?:\/\/(?:static\.wixstatic\.com|[a-z0-9-]+\.usrfiles\.com|[a-z0-9-]+\.wixmp\.com)\/[^\s"'`)]+/gi;
  for (const { file, txt } of corpus) {
    if (typeof txt !== 'string') continue;
    let m;
    imgRe.lastIndex = 0;
    while ((m = imgRe.exec(txt))) {
      const raw = clean(m[0]);
      if (templated(raw)) continue;
      const p = parseWixImageUri(raw) || {};
      add('image', raw, { mediaId: p.mediaId ?? null, filename: p.filename ?? null, width: p.width ?? null, height: p.height ?? null }, file);
    }
    otherRe.lastIndex = 0;
    while ((m = otherRe.exec(txt))) {
      const raw = clean(m[0]);
      if (templated(raw)) continue;
      add(m[1], raw, {}, file);
    }
    cdnRe.lastIndex = 0;
    while ((m = cdnRe.exec(txt))) {
      const raw = clean(m[0]);
      if (templated(raw)) continue;
      add('cdn', raw, {}, file);
    }
  }
  return [...byKey.values()];
}

// ─── Normalize a REST FileDescriptor into our flat record ────────────────────
export function normalizeFile(f) {
  if (!f) return null;
  const img = f.media?.image?.image || null;
  const vid = f.media?.video || null;
  const doc = f.media?.document || null;
  const aud = f.media?.audio || null;
  const rec = {
    id: f.id ?? null,
    displayName: f.displayName ?? null,
    mediaType: f.mediaType ?? null,            // IMAGE | VIDEO | AUDIO | DOCUMENT | VECTOR | …
    parentFolderId: f.parentFolderId ?? null,
    sizeInBytes: f.sizeInBytes != null ? Number(f.sizeInBytes) : null,
    private: f.private ?? null,
    url: f.url ?? img?.url ?? null,
    width: img?.width ?? null,
    height: img?.height ?? null,
    altText: img?.altText ?? null,
    veloSrc: null,
  };
  // The media id used inside a Velo wix:*:// URI (per-type nested object).
  const mediaId = img?.id || vid?.id || doc?.id || aud?.id || null;
  if (mediaId) {
    if (f.mediaType === 'IMAGE') rec.veloSrc = buildVeloImageUri({ mediaId, filename: f.displayName, width: rec.width, height: rec.height });
    else rec.veloSrc = `wix:${(f.mediaType || 'media').toLowerCase()}://v1/${mediaId}/${f.displayName || ''}`;
    rec.mediaId = mediaId;
  } else rec.mediaId = null;
  return rec;
}

// ─── Build a path-labelled folder tree from a flat folder list ───────────────
// Returns folders enriched with a human `path` ("/Materials/Sheet Metal").
export function foldersToTree(folders = [], rootId = 'media-root') {
  const byId = new Map(folders.map(f => [f.id, { ...f, path: null }]));
  const pathOf = (id, guard = 0) => {
    if (id === rootId || id == null || guard > 64) return '';
    const f = byId.get(id);
    if (!f) return '';
    if (f.path != null) return f.path;
    const parent = pathOf(f.parentFolderId, guard + 1);
    f.path = `${parent}/${f.displayName ?? id}`;
    return f.path;
  };
  for (const f of byId.values()) pathOf(f.id);
  return [...byId.values()].sort((a, b) => (a.path || '').localeCompare(b.path || ''));
}

// ─── Pull a paging cursor out of a Wix REST response (shape varies) ──────────
export function nextCursorOf(resp) {
  if (!resp) return null;
  const c = resp.pagingMetadata?.cursors?.next
    ?? resp.nextCursor?.cursors?.next
    ?? (typeof resp.nextCursor === 'string' ? resp.nextCursor : resp.nextCursor?.next)
    ?? resp.cursors?.next
    ?? null;
  return c || null; // treat "" as "no more pages"
}

// ─── Walk the Media Manager via REST (fetch is INJECTED) ─────────────────────
// fetchImpl(url, { headers }) must resolve to { ok, status, json() }.
// Returns { folders, files, truncated } — pure orchestration, no global state.
export async function walkMedia({ apiKey, siteId, fetchImpl, maxFolders = 500, maxFiles = 5000, rootId = 'media-root', log = () => {} }) {
  if (!apiKey || !siteId) throw new Error('walkMedia: apiKey and siteId are required');
  if (typeof fetchImpl !== 'function') throw new Error('walkMedia: fetchImpl is required');
  const headers = { Authorization: apiKey, 'wix-site-id': siteId, 'Content-Type': 'application/json' };
  const base = 'https://www.wixapis.com/site-media/v1';

  async function getJson(path) {
    const res = await fetchImpl(base + path, { headers });
    if (res.status === 429) { const e = new Error('rate-limited'); e.code = 429; throw e; }
    if (!res.ok) { const e = new Error(`HTTP ${res.status}`); e.code = res.status; e.body = await safeText(res); throw e; }
    return res.json();
  }
  async function safeText(res) { try { return await res.text(); } catch { return ''; } }

  async function pageAll(pathFor, key) {
    const acc = [];
    let cursor = null, pages = 0;
    do {
      const path = pathFor(cursor);
      const resp = await getJson(path);
      for (const item of (resp[key] || [])) acc.push(item);
      cursor = nextCursorOf(resp);
      if (++pages > 200) break; // hard backstop against a broken cursor loop
    } while (cursor);
    return acc;
  }

  const folders = [];
  const files = [];
  const queue = [rootId];
  const visited = new Set();
  let truncated = false;

  while (queue.length) {
    const parent = queue.shift();
    if (visited.has(parent)) continue;
    visited.add(parent);

    const subs = await pageAll(
      (cur) => `/folders?parentFolderId=${encodeURIComponent(parent)}&paging.limit=100${cur ? `&paging.cursor=${encodeURIComponent(cur)}` : ''}`,
      'folders');
    for (const f of subs) {
      if (folders.length >= maxFolders) { truncated = true; break; }
      folders.push(f);
      if (!visited.has(f.id)) queue.push(f.id);
    }

    const fs_ = await pageAll(
      (cur) => `/files?parentFolderId=${encodeURIComponent(parent)}&paging.limit=100${cur ? `&paging.cursor=${encodeURIComponent(cur)}` : ''}`,
      'files');
    for (const f of fs_) {
      if (files.length >= maxFiles) { truncated = true; break; }
      files.push(f);
    }
    if (truncated) { log(`⚠ hit cap (${maxFolders} folders / ${maxFiles} files) — listing truncated`); break; }
  }
  return { folders, files, truncated };
}

// ─── Render the agent-facing Markdown ────────────────────────────────────────
export function renderMediaMarkdown(model) {
  const { generatedAt, site, source, stats, foldersByPath = [], filesByFolder = new Map(), codeReferences = [], truncated } = model;
  const esc = (s) => String(s ?? '').replace(/\|/g, '\\|');
  let md = '';
  md += `# Wix Media — ${site?.siteId ? 'site ' + site.siteId : 'this site'}\n\n`;
  md += `> **AUTO-GENERATED** by \`scripts/wix-media.mjs\` — do not edit by hand.\n`;
  md += `> Source: ${source}. Generated: ${generatedAt}\n\n`;
  md += `**${stats.files} files in ${stats.folders} folders`;
  md += `${stats.codeReferences ? ` · ${stats.codeReferences} media URLs found in code` : ''}**.\n\n`;

  md += `## ⚠ How Wix media works (read before using these)\n`;
  md += `- A Wix repo has **no local image files** — every asset lives in the cloud **Media Manager**. This file is how you "see" them.\n`;
  md += `- To put an image on an element in Velo: \`$w('#someImage').src = "<veloSrc>";\` using the **Velo src** value below.\n`;
  md += `- The Velo src is \`wix:image://v1/<mediaId>/<filename>#originWidth=…&originHeight=…\`. Use it **verbatim** — don't hand-edit the mediaId.\n`;
  md += `- Folder names are **labels only**; \`.src\` is set by the per-file Velo src, not by folder. Use folders to find the right asset (e.g. "Materials/Sheet Metal").\n`;
  if (source === 'code scan only (no API key)') {
    md += `- ⚠ **No API key configured**, so this lists only media **already referenced in code** — not the full Media Manager. See \`docs/wix-addon/MEDIA.md\` to enable the full listing.\n`;
  }
  if (truncated) md += `- ⚠ Listing was **truncated** at the safety cap — some folders/files are not shown.\n`;
  md += `\n`;

  if (foldersByPath.length || filesByFolder.size) {
    md += `## 🗂 Media Manager\n\n`;
    // group: root first, then each folder by path
    const groups = [{ id: 'media-root', path: '/ (root)' }, ...foldersByPath.map(f => ({ id: f.id, path: f.path || f.displayName || f.id }))];
    for (const g of groups) {
      const fl = filesByFolder.get(g.id) || [];
      if (!fl.length && g.id !== 'media-root') { md += `### 📁 ${esc(g.path)}  _(empty / subfolders only)_\n\n`; continue; }
      if (!fl.length) continue;
      md += `### 📁 ${esc(g.path)}  _(${fl.length})_\n\n`;
      md += `| File | Type | Size | Dimensions | Velo src |\n|------|------|------|-----------|----------|\n`;
      for (const f of fl) {
        const size = f.sizeInBytes ? humanBytes(f.sizeInBytes) : '·';
        const dim = f.width && f.height ? `${f.width}×${f.height}` : '·';
        const src = f.veloSrc ? `\`${esc(f.veloSrc)}\`` : (f.url ? esc(f.url) : '·');
        md += `| ${esc(f.displayName)} | ${esc(f.mediaType || '·')} | ${size} | ${dim} | ${src} |\n`;
      }
      md += `\n`;
    }
  }

  if (codeReferences.length) {
    md += `## 🔗 Media referenced in this repo's code\n\n`;
    md += `These Wix media URLs are hard-coded in Velo/HTML — reuse them directly.\n\n`;
    md += `| Kind | URL / Velo src | Referenced in |\n|------|----------------|---------------|\n`;
    for (const r of codeReferences) {
      const where = (r.referencedIn || []).map(f => `\`${esc(f)}\``).join(' ') || '·';
      md += `| ${esc(r.kind)} | \`${esc(r.raw)}\` | ${where} |\n`;
    }
    md += `\n`;
  }
  return md;
}

export function humanBytes(n) {
  n = Number(n) || 0;
  const u = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${i === 0 ? n : n.toFixed(1)} ${u[i]}`;
}

// ─── Render the CLAUDE.md digest block ───────────────────────────────────────
export function renderClaudeMediaBlock(model, { start, end }) {
  const { generatedAt, stats, source } = model;
  return [
    start,
    '## Wix media map (auto-generated — do not edit between the markers)',
    `_Generated ${generatedAt} · ${stats.files} files · ${stats.folders} folders · ${stats.codeReferences} in-code URLs · source: ${source}._`,
    '',
    '**To use an image (or any asset) on the site, read `wix-media.md`.** Then:',
    '- Set an Image element with the file\'s **Velo src**: `$w(\'#img\').src = "wix:image://v1/<mediaId>/<file>#originWidth=…&originHeight=…";` — copy it verbatim.',
    '- Find assets by **folder** (e.g. "Materials/Sheet Metal"); folder names are labels, the `.src` comes from the per-file Velo src.',
    '- The repo has **no local image files** — every asset is in the cloud Media Manager, so this map is the only way to reference them by code.',
    '- Refresh after uploading/moving media: `npm run wix:media`. Without a Wix API key it lists only media already used in code; see `docs/wix-addon/MEDIA.md` to enable the full Media Manager listing.',
    end,
  ].join('\n');
}
