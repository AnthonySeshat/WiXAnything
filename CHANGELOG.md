# Changelog

## Unreleased

### Added
- **Media bridge** (`npm run wix:media`) — a Wix repo has **zero image files** (only code
  syncs to Git; every photo/video lives in the cloud **Media Manager**), so an agent could
  only "see" an asset where a `wix:image://…` URL was hard-coded. This surfaces media into
  committed, agent-readable `wix-media.md` / `wix-media.json` + a `CLAUDE.md` block.
  Two layers, degrading gracefully: a **zero-auth code scan** (every Wix media URL already in
  `src/`) always runs; with a **Wix API key** (`WIX_API_KEY` + `WIX_SITE_ID` in a gitignored
  `.env`, scope *Read Media Manager*) it lists the **whole Media Manager** — folders + files,
  each with the ready-to-use Velo `.src`. Read-only. Chained (non-fatal) into `npm run wix:full`.
  Setup + limits in [`docs/MEDIA.md`](docs/MEDIA.md). Pure logic in `scripts/wix-media-lib.mjs`,
  covered offline by the self-test (fake-fetch folder walk/paging + code-scan e2e).

## 0.2.0 — 2026-06-11

A big round: the visual layer, a validation benchmark, a static linter, content-hash
staleness, CI, and two packaging fixes found by installing on a fresh site.

### Added
- **Visual layer** — `visual/scan.mjs` reads the *published* page (ToS-safe) for per-element
  **geometry, computed styles, and parent/child layering**, merged into the map. `--full`
  walks multi-state UIs (e.g. step forms). Run it all with `npm run wix:full -- --url "…"`.
- **Benchmark** ([`docs/BENCHMARK.md`](docs/BENCHMARK.md)) — blind-vs-sighted: same model went
  **2/10 → 10/10** first-try Velo correct, element-ID hallucinations **7 → 0**.
- **`wix:lint`** — conservative static Velo check: `.text`/`.html` on a container (error),
  `$w('#id')` literals not in the map (warn). Wired into a non-blocking pre-commit hook.
- **`wix:check`** — staleness guard via a content hash (`inputsHash`), so a stale committed
  map is caught even on a fresh clone. Also a pre-commit warning.
- **`wixanything.config.json`** — remembers the published URL so `npm run wix:full` needs no
  args; first run auto-installs the visual scanner; doctor preflights for the Wix CLI.
- **CI** — self-test on Node 18/20/22 × ubuntu + windows.
- Capability matrix in the README; cross-agent `AGENTS.md`; an enriched `CLAUDE.md` digest.
- More scaffolds/commands: `wix:app` (companion app), `wix:build-element` (bundler), `wix:diff`.

### Changed
- Element map now surfaces the **nesting tree (children) + text content + styles** and a
  **recovered type** for hidden elements; per-type guidance moved to a single legend (smaller map).
- `referencedIn` is anchored (no more `#text1`/`#text10` collisions) and detects editor-wired
  `export function <nick>_<event>` handlers; events surfaced per element.
- Hardened the `.d.ts` parser and the Thunderbolt nickname map; added a **fail-loud format-drift
  canary**. The visual step-walker never clicks submit/checkout on a live site.
- Scan internals extracted to a tested `visual/lib.mjs`; CI-safe postinstall.

### Fixed
- **Install crash**: `.githooks/pre-commit` and `visual/lib.mjs` were referenced by the installer
  but missing from the published package → installs failed. Both now ship, and a packaging
  regression test asserts npm pack includes every file the installer copies.
- Generated paths no longer leak absolute paths / the OS username (PII).

## 0.1.0

Initial release: surfaces the gitignored `.wix/types` element maps into a committed,
agent-readable `wix-elements.md`/`.json` + `CLAUDE.md` block; `wix:elements`/`wix:doctor`,
code-owned-UI scaffolds, the installer, and the honest-ceiling docs.
