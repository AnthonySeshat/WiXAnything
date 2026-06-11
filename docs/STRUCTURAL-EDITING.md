# What Claude can and cannot do to a Wix site (the honest ceiling)

Researched against a real Wix CLI repo + Wix docs. This is the straight story so you
don't waste time on dead ends.

## ✅ Fully works (code only)

- **See every element + type** — `wix-elements.md` (the addon). Solves "Claude is blind".
- **Change content & behavior of existing elements** — `.text`, `.src`, `.label`,
  `.link`, `.show()/.hide()/.collapse()/.expand()`, `.background`, event handlers,
  `.changeState()`, styles via `.style`, etc.
- **Drive data into existing structures** — Repeaters (`.data`), datasets (`wix-data`,
  `wix-dataset`), dynamic pages.
- **Own entire NEW sections in code** — via a **Custom Element** or **HtmlComponent**
  you place once (see below). Their internals are 100% code; the editor never touches them.
- **Backend & integration code** — `src/backend/*.web.js`, public modules, API calls.

## ⚠️ Possible, but needs ONE manual editor step

- **Adding a new code-owned section.** `$w` cannot create elements, so to introduce
  *new* UI you (or the user) place a single host in the editor **once**:
  a Custom Element, an HtmlComponent, or a Repeater with an item template. After that
  one placement, everything inside is pure code. Use `npm run wix:scaffold`.
- **Getting a brand-new native element's ID.** If you need a real native Text/Box/etc.,
  the user adds it + sets its ID in the Local Editor, then runs `npm run wix:elements`
  and it appears in the map. (This is the loop you were doing manually — the addon just
  makes the result visible and typed.)

## ❌ Not possible (no supported path, as of this research)

- **Programmatically creating / moving / deleting native canvas elements, or assigning
  IDs, from code.** The editor's visual element tree is a proprietary server-side
  "document model" with **no public read/write API**. `$w` and the Editor SDK only
  change *properties* of already-placed elements, not structure.
- **Reading element geometry / parent-child / layout from the repo.** The local maps are
  `id → type` only. For layout, use the Local Editor or a screenshot.
- **Using an MCP to see or edit elements.** No Wix MCP exposes the element tree, IDs, or
  Velo (see `MCP-SETUP.md`). MCP is for CMS/CRM/business data only.

## The realistic "complete site editing" workflow this enables

1. `npm run wix:doctor` → Claude can now *see* every element, correctly typed.
2. Claude edits Velo against real IDs (no more `.text`-on-a-Box mistakes).
3. For new UI, `npm run wix:scaffold custom-element <name>` → place once → pure code after.
4. For new *native* elements, user adds + IDs in editor → `npm run wix:elements` → visible.
5. `git push` → publish.

That covers the large majority of real site work in code. The only irreducible manual
step is the **one-time placement** of a new element/host in the editor — a Wix platform
limit, not an addon limit.

## Frontier (opt-in, unsupported — do not enable by default)

Driving the Local Editor with browser automation (e.g. Playwright) to drag elements and
set IDs, then `wix sync-types`, is *technically* conceivable but brittle, version-fragile,
and likely against Wix's ToS. Not part of this addon. Listed only for completeness.
