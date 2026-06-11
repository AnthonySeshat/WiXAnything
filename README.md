# WiXAnything

> **Give Claude Code real sight of a Wix Studio site — every element, ID, type, layout & style — so the Velo it writes is accurate and correctly connected.**

![Node](https://img.shields.io/badge/node-%E2%89%A518-339933?logo=node.js&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-blue)
![Deps](https://img.shields.io/badge/runtime%20deps-0-brightgreen)
![Status](https://img.shields.io/badge/status-private%20beta-orange)

WiXAnything is a drop-in **knowledge layer** for the official [Wix + Claude](https://www.wix.com/blog/how-to-use-claude-with-wix)
setup (Wix CLI + Git Integration). The official integration lets Claude edit your site's
**code**; WiXAnything lets Claude actually **see the site** — so it stops guessing.

---

## Why this exists

When you connect a Wix site to a local repo, Claude can edit your Velo (JS) code — but it's
**blind to everything you built in the Studio editor.** It can't see which elements exist,
their IDs, their types, or how the page is laid out. So it guesses, and writes code like:

```js
$w('#priceBox').text = 'From $30k';   // ❌ fails — #priceBox is a Box, not a Text
```

…which targets the wrong element or the wrong property, and you burn time fixing it.

**The fix is hiding in plain sight.** Wix *already* generates a map of every element's
`#id → $w type` (via the official `wix sync-types`) — but it lands in the **gitignored**
`.wix/types/` folder, so a gitignore-respecting agent never reads it. WiXAnything:

1. **Surfaces that map** into committed, agent-readable files (`wix-elements.md` / `.json`) —
   every element's ID, type, page, whether Velo references it, and **how to set it**.
2. **Adds the visual layer** by reading your *published* page: real **geometry, computed
   styles, and layering**, keyed back to your IDs. *(The official Wix MCP/plugin exposes none
   of this to an external agent — Wix's own dev community has an open request for it.)*

**Result:** Claude codes against your **actual** site — right elements, right properties,
correctly connected — the first time. It's a read-only layer that **extends** the official
Wix + Claude integration and stays 100% within Wix's Terms (official tooling + reading your
own public page; no editor automation).

```
Before:  Claude can't see elements → guesses IDs/types → broken Velo, back-and-forth
After:   Claude reads wix-elements.md → every ID + type + layout + how to set it → it just works
```

**Measured:** in a 10-task Velo benchmark (same model, only difference = the map), Claude went
from **2/10 correct (blind) → 10/10 (sighted)**, with element-ID hallucinations **7 → 0**.
→ [`docs/BENCHMARK.md`](docs/BENCHMARK.md)

---

## How it compares

The official Wix + Claude integration edits your **code**, but nothing in it exposes the
site's **elements, layout, or styles** to an external agent. That's the gap WiXAnything fills:

| For an external coding agent | Wix MCP | Wix Site MCP | Aria (Wix AI) | **WiXAnything** |
|---|:---:|:---:|:---:|:---:|
| Element IDs + `$w` types | ❌ | ❌ | ❌ | ✅ |
| Layout + computed styles + nesting | ❌ | ❌ | ❌ | ✅ |
| Edit your Velo against real IDs | ➖ | ❌ | ❌ | ✅ |
| AI visual editing of native elements | ❌ | ❌ | ✅¹ | ➖² |
| CMS / Stores / bookings data | ✅ | ✅ | ➖ | ➖³ |

<sub>¹ Aria edits visually but only as Wix's own **first-party** agent — not your repo/agent.
² Frontier; needs Wix-internal APIs (see the ceiling doc).  ³ Use the Wix MCP for data.</sub>

## Install

Run from your Wix site's repo root (the folder with `wix.config.json`):

```bash
# 1) install the addon straight from GitHub (no local paths)
npx -y github:AnthonySeshat/WiXAnything --repo .

# 2) enable the visual (layout/styles) scanner — one-time
cd visual && npm install && cd ..

# 3) one command: sync element types + scan layout/styles + merge
npm run wix:full -- --url "<your-published-page-url>"
```

Then open **`wix-elements.md`** — that's what Claude reads. Re-run `npm run wix:full …`
(or `npm run wix:elements` for types only) after any change in the editor.

> 🔒 Needs the Wix CLI logged in (`wix login`) once, so it can sync the latest element maps.
> The committed `wix-elements.md` then works for anyone. _(This repo is private/pre-release;
> the `npx github:` install works for accounts with access. `npm publish` would later enable
> a public `npx wixanything`.)_

---

## What you get

- **🟢 Element map (proven).** `wix-elements.md`/`.json` + a `CLAUDE.md` rules block: every
  element, its `$w` type, hidden state, Velo-referenced flag, and per-type "how to set it".
  Refreshed headlessly by `wix sync-types`. `npm run wix:diff` shows what changed.
- **🎨 Visual layer (proven).** The `visual/` scanner reads your published page for real
  geometry + computed styles + layering, merged into the map (`--full` walks multi-step UIs).
- **🟡 Code-owned UI.** `npm run wix:scaffold custom-element|html-component|repeater <name>` —
  sections Claude owns 100% in code (one editor placement each). See [`docs/BRIDGE.md`](docs/BRIDGE.md).
- **🟢 Companion app.** `npm run wix:app "<name>"` — a private `@wix/cli` app that auto-places
  a code-owned widget on the homepage + an Editor panel (real `@wix/editor` SDK).
- **📄 The honest ceiling.** [`docs/STRUCTURAL-EDITING.md`](docs/STRUCTURAL-EDITING.md) grades
  what's possible vs. what needs Wix's internal APIs. [`docs/MCP-SETUP.md`](docs/MCP-SETUP.md):
  Wix MCP is for data (CMS/CRM), not elements.

## Commands

| Command | Does |
|---------|------|
| `npm run wix:full -- --url "<page>"` | element map **+** layout/styles **+** merge (one shot) |
| `npm run wix:elements` | `wix sync-types` + regenerate the element map (types) |
| `npm run wix:diff` | regenerate + report ids **added / removed / retyped** |
| `npm run wix:doctor` | auth check → sync → generate, with status |
| `npm run wix:scaffold <kind> <name>` | scaffold a code-owned component |
| `npm run wix:app "<name>"` | scaffold the companion app (widget + editor panel) |

## How it works

```
.wix/types/<pageId>.d.ts         published page (Thunderbolt model + rendered DOM)
   (gitignored id→type map,         │  comp-id ↔ nickname + geometry + computed styles
    via official wix sync-types)     ▼
        └────────────┬───────────────┘
                     ▼
   wix-elements.json + wix-elements.md + CLAUDE.md   (committed; Claude reads these)
```

Pure Node, **zero runtime dependencies** (the visual scanner adds Playwright in `visual/`).
`npm run selftest` validates the toolkit without a real site.

## Limits to know

- The `.wix/types` map is **id→type only**; geometry/styles come from the optional visual
  scan, which reads the **published/test-site** state (use `--full` for multi-step UIs).
- `HiddenCollapsedElement` masks the real type until the element is shown.
- `$w` can **never create** native elements — new native UI needs one editor placement
  (or a code-owned Custom Element / the companion app). True visual structural editing of
  native elements is a Wix-internal capability (see the honest ceiling doc).

## Security

`.env` is never committed (gitignored + a pre-commit hook blocks it). The Wix Headless/OAuth
client ID is public-by-design. See [`SECURITY.md`](SECURITY.md).

## License

MIT — see [LICENSE](LICENSE). Not affiliated with or endorsed by Wix.com or Anthropic;
"Wix"/"Velo" are trademarks of Wix.com Ltd., "Claude" of Anthropic.
