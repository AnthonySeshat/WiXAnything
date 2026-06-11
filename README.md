# WiXAnything

> **Make Claude actually see your Wix Studio elements — and edit the site in code.**

When you wire up [Claude with Wix](https://www.wix.com/blog/how-to-use-claude-with-wix)
(Wix CLI + Git Integration), Claude edits your Velo code locally — but it **can't see the
containers, text, images, and IDs you placed in the Studio editor.** It looks "blind" and
guesses wrong, e.g.:

```js
$w('#modelsDesc').text = 'Modern';   // ❌ fails — #modelsDesc is a Box, not a Text
```

**Why:** Wix *does* store every element's `#id → $w type` on disk, at
`.wix/types/<pageId>/<pageId>.d.ts` — but that folder is in **`.gitignore`**, so a
gitignore-respecting agent never reads it. This addon surfaces those maps into committed,
Claude-readable files, keeps them fresh, and adds patterns to build new UI entirely in code.

```
Before:  Claude can't see elements → guesses IDs/types → broken Velo, manual back-and-forth
After:   Claude reads wix-elements.md → every ID + correct type + how to set it → it just works
```

---

## Quick start

Inside your Wix CLI repo (the folder with `wix.config.json`):

```bash
# one-liner (after this package is published to npm):
npx wixanything

# or, straight from GitHub before publishing:
npx github:AnthonySeshat/WiXAnything

# or clone this repo and run the installer at your site:
node /path/to/WiXAnything/scripts/wix-init.mjs --repo "C:/path/to/your-wix-site"
#   preview first with:  --dry-run
```

Then:

```bash
npm run wix:elements      # wix sync-types + (re)generate the element map
```

Open **`wix-elements.md`** — that's what Claude reads. Re-run `npm run wix:elements`
after any change in the editor (added/renamed an element, etc.).

> 🔒 Requires being logged in to the Wix CLI (`wix login`) the first time, so it can pull
> the latest element maps. After that the committed `wix-elements.md` works for anyone.

---

## What you get

### 🟢 Tier 1 — Claude can SEE every element
`wix-elements.md` / `wix-elements.json` at your repo root: every page, every element, its
`$w` type, hidden state, whether Velo references it, and **how to set it** (the correct
property per type). Plus a `CLAUDE.md` rules block. Refreshed by `wix sync-types`
(headless — **no `wix dev` needed**).

| ID | Type | How to set it |
|----|------|---------------|
| `#heroTitle` | `Text` | `.text = "..."` |
| `#ctaButton` | `Button` | `.label`, `.link`, `.onClick()` |
| `#modelsDesc` | `Box` | **NO `.text`** — set child Text elements |
| `#stepStates` | `MultiStateBox` | **NO `.text`** — `.changeState("id")` |
| `#promoBanner` | `HiddenCollapsedElement` | 🙈 hidden — `.show()` first, type unknown |

(See a full real example in [`examples/demo/wix-elements.md`](examples/demo/wix-elements.md).)

### 🟡 Tier 2 — Claude OWNS new sections in code
```bash
npm run wix:scaffold custom-element pricing-widget   # web component, 100% code-owned
npm run wix:scaffold html-component promo-banner     # iframe + postMessage bridge
npm run wix:scaffold repeater model-cards            # data-driven list pattern
```
Each needs **one** placement in the editor (see the generated `WIRING.md`); after that
it's pure code.

### 🟢 L2 — the supported companion app
```bash
npm run wix:app "Quote Tools"   # private @wix/cli app: auto-placed widget + editor panel
```
Ships a code-owned Site Widget that **auto-adds to the homepage at install**, plus an
Editor Add-on panel (real `@wix/editor` SDK) that reads the selection and fully drives the
widget's props/preset from inside Wix Studio. Finish via `companion-app/SETUP.md`.

### 📄 The honest ceiling (L0–L4)
[`docs/wix-addon/STRUCTURAL-EDITING.md`](docs/STRUCTURAL-EDITING.md) grades exactly what's
possible: L0/L1 (code-only, proven), L2 (supported companion app), L3 (unsupported
Local-Editor automation — real account-ban risk), L4 (Headless — full freedom, but a
rebuild). [`MCP-SETUP.md`](docs/MCP-SETUP.md) — Wix MCP is for **data** (CMS/CRM), not elements.

---

## Commands

| Command | Does |
|---------|------|
| `npm run wix:elements` | `wix sync-types` + regenerate the map (everyday refresh) |
| `npm run wix:elements:fast` | regenerate from cached `.wix/types` (no network) |
| `npm run wix:diff` | regenerate + report which ids were **added / removed / retyped** since last sync |
| `npm run wix:doctor` | auth check → sync → generate, with a clear status report |
| `npm run wix:scaffold <kind> <name>` | scaffold a code-owned component (L1) |
| `npm run wix:app "<App Name>"` | scaffold the supported companion app (L2): auto-placed widget + editor panel |

## How it works

```
.wix/types/<pageId>/<pageId>.d.ts   (gitignored; id→type maps; pulled by `wix sync-types`)
        │  parse + merge masterPage + tag referenced-in-Velo + per-type guidance
        ▼
wix-elements.json   wix-elements.md   CLAUDE.md block   (committed; Claude reads these)
```

Pure Node, **zero runtime dependencies**. `npm run selftest` validates it without a real site.

## Limits to know

- Maps are **id→type only** — no geometry/layout. Use the Local Editor / a screenshot for
  visual context.
- `HiddenCollapsedElement` masks the real type until the element is shown.
- `$w` can **never create** native elements — new native UI needs one editor placement.

## Troubleshooting

- **“no .wix/types present”** → run `wix login`, then `npm run wix:elements` (or `wix dev`
  once to populate it).
- **`wix sync-types` fails** → it's non-fatal; the committed `wix-elements.md` still works.
  Make sure you're logged in (`wix whoami`).
- **A new element isn't in the map** → run `npm run wix:elements` after editing in the
  editor (the maps only refresh on sync).
- **Wix Git integration** → when a site is Git-connected the editor is read-only and Wix
  pulls code from your repo. The generated files live at the repo root (not under `src/`);
  if unsure, commit them on a branch first and confirm `wix publish` is happy.

## Contributing / license

MIT — see [LICENSE](LICENSE). Issues and PRs welcome. Not affiliated with or endorsed by
Wix.com or Anthropic.
