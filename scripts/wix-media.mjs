#!/usr/bin/env node
/**
 * wix-media.mjs  —  Wix + Claude Addon (Media bridge)
 *
 * A Wix CLI repo has ZERO image files: only code syncs to Git, while every
 * uploaded photo/video lives in the cloud Media Manager. So Claude is
 * "media-blind" — it can only see an asset where a `wix:image://…` URL is
 * hard-coded into Velo. This bridges that gap into committed, agent-readable
 * artifacts at the repo root:
 *
 *   - wix-media.json   (machine-readable: folders + files + in-code references)
 *   - wix-media.md     (tables grouped by Media Manager folder + a Velo `.src`)
 *   - updates the WIX-MEDIA block inside CLAUDE.md (if present)
 *
 * Two layers, graceful degradation:
 *   • ALWAYS (zero-auth): scans src/ for every Wix media URL already in code.
 *   • WITH A WIX API KEY: lists the real Media Manager folder/file tree (REST,
 *     read-only — scope "Read Media Manager"). Creds come from env or a
 *     gitignored .env: WIX_API_KEY + WIX_SITE_ID (site id falls back to
 *     wix.config.json). Read-only: nothing in the Media Manager is changed.
 *
 * Usage:
 *   node scripts/wix-media.mjs [--repo <path>] [--out <path>] [--no-api] [--quiet]
 */

import { readFileSync, writeFileSync, readdirSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
  parseDotenv, scanCodeForMedia, normalizeFile, foldersToTree,
  walkMedia, renderMediaMarkdown, renderClaudeMediaBlock,
} from './wix-media-lib.mjs';

// ─── args ────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i !== -1 && argv[i + 1] ? argv[i + 1] : d; };
const REPO = arg('--repo', process.cwd());
const OUT = arg('--out', REPO);
const NO_API = argv.includes('--no-api');
const QUIET = argv.includes('--quiet');
const SOFT = argv.includes('--soft'); // never exit non-zero (postinstall / chained use)
const log = (...a) => { if (!QUIET) console.log(...a); };

mkdirSync(OUT, { recursive: true });
const readIf = (p) => { try { return readFileSync(p, 'utf8'); } catch { return null; } };
const relPath = (f) => relative(REPO, f).split('\\').join('/');

// ─── resolve credentials: process.env > .env > headless/.env; siteId fallback ─
function resolveCreds() {
  const envFiles = { ...parseDotenv(readIf(join(REPO, '.env'))), ...parseDotenv(readIf(join(REPO, 'headless', '.env'))) };
  const apiKey = process.env.WIX_API_KEY || envFiles.WIX_API_KEY || null;
  let siteId = process.env.WIX_SITE_ID || envFiles.WIX_SITE_ID || null;
  if (!siteId) { try { siteId = (JSON.parse(readIf(join(REPO, 'wix.config.json')) || '{}').siteId) || null; } catch {} }
  return { apiKey, siteId };
}

// ─── collect Velo/HTML source for the zero-auth code scan ────────────────────
function collectSrc(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    let st; try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) collectSrc(full, acc);
    else if (/\.(jsw?|ts|json|html?|css)$/i.test(name)) {
      const txt = readIf(full);
      if (txt != null) acc.push({ file: relPath(full), txt });
    }
  }
  return acc;
}

async function main() {
  log(`\n🖼  wix-media  (repo: ${REPO})`);

  // 1) zero-auth: media URLs already in the code -----------------------------
  const corpus = collectSrc(join(REPO, 'src'));
  const codeReferences = scanCodeForMedia(corpus);
  log(`• code scan: ${codeReferences.length} Wix media URL(s) found in src/`);

  // 2) optional: the live Media Manager via REST -----------------------------
  let folders = [], files = [], truncated = false, source = 'code scan only (no API key)';
  const { apiKey, siteId } = resolveCreds();
  if (!NO_API && apiKey && siteId) {
    log(`• Media Manager: listing via REST (site ${siteId}) …`);
    try {
      const res = await walkMedia({ apiKey, siteId, fetchImpl: fetch, log });
      folders = res.folders; files = res.files; truncated = res.truncated;
      source = codeReferences.length ? 'Wix Media Manager API + code scan' : 'Wix Media Manager API';
      log(`  ✓ ${files.length} files in ${folders.length} folders`);
    } catch (e) {
      const hint = e.code === 401 || e.code === 403
        ? ' (check the API key + that it has the "Read Media Manager" permission, and WIX_SITE_ID)'
        : e.code === 429 ? ' (rate-limited — wait a minute and retry)' : '';
      log(`  ✗ Media Manager listing failed: ${e.message}${hint}`);
      log('    (continuing with the code-scan results only)');
    }
  } else if (!NO_API) {
    log('• Media Manager: no WIX_API_KEY/WIX_SITE_ID found — skipping full listing.');
    log('    Set them in a .env (gitignored) to list the whole Media Manager. See docs/wix-addon/MEDIA.md.');
  }

  // 3) shape the model -------------------------------------------------------
  const normFiles = files.map(normalizeFile).filter(Boolean);
  const folderTree = foldersToTree(folders);
  const filesByFolder = new Map();
  for (const f of normFiles) {
    const k = f.parentFolderId || 'media-root';
    if (!filesByFolder.has(k)) filesByFolder.set(k, []);
    filesByFolder.get(k).push(f);
  }
  for (const arr of filesByFolder.values()) arr.sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''));

  let site = {};
  try { site = JSON.parse(readIf(join(REPO, 'wix.config.json')) || '{}'); } catch {}

  const stats = {
    folders: folderTree.length,
    files: normFiles.length,
    codeReferences: codeReferences.length,
    images: normFiles.filter(f => f.mediaType === 'IMAGE').length,
    byType: normFiles.reduce((m, f) => { const t = f.mediaType || 'OTHER'; m[t] = (m[t] || 0) + 1; return m; }, {}),
  };
  const generatedAt = new Date().toISOString();
  const model = {
    generatedAt, source, truncated,
    site: { siteId: site.siteId ?? siteId ?? null },
    stats,
    foldersByPath: folderTree,
    filesByFolder,
    files: normFiles,
    folders: folderTree,
    codeReferences,
  };

  // 4) write JSON ------------------------------------------------------------
  const json = {
    $note: 'AUTO-GENERATED by scripts/wix-media.mjs. Do not edit by hand. Media lives in the Wix cloud Media Manager (no local image files). Use a file\'s veloSrc with $w(\'#img\').src. Read-only listing.',
    generatedAt, source, truncated,
    site: model.site,
    stats,
    folders: folderTree.map(f => ({ id: f.id, displayName: f.displayName ?? null, path: f.path ?? null, parentFolderId: f.parentFolderId ?? null })),
    files: normFiles,
    codeReferences,
  };
  writeFileSync(join(OUT, 'wix-media.json'), JSON.stringify(json, null, 2));

  // 5) write Markdown --------------------------------------------------------
  writeFileSync(join(OUT, 'wix-media.md'), renderMediaMarkdown(model));

  // 6) update CLAUDE.md block (if present) -----------------------------------
  const claudePath = join(OUT, 'CLAUDE.md');
  const claude = readIf(claudePath);
  if (claude) {
    const START = '<!-- WIX-MEDIA:START -->';
    const END = '<!-- WIX-MEDIA:END -->';
    const block = renderClaudeMediaBlock(model, { start: START, end: END });
    let next;
    if (claude.includes(START) && claude.includes(END)) next = claude.replace(new RegExp(START + '[\\s\\S]*?' + END), block);
    else next = claude.trimEnd() + '\n\n' + block + '\n';
    writeFileSync(claudePath, next);
    log('[wix-media] updated CLAUDE.md media block');
  }

  log(`[wix-media] wrote ${join(OUT, 'wix-media.json')}`);
  log(`[wix-media] wrote ${join(OUT, 'wix-media.md')}`);
  log(`[wix-media] ${stats.files} files · ${stats.folders} folders · ${stats.codeReferences} in-code URLs (source: ${source})`);
}

main().catch((e) => {
  console.error('[wix-media] error: ' + (e?.stack || e?.message || e));
  process.exit(SOFT ? 0 : 1);
});
