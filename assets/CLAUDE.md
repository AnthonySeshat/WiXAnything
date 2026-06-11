# Working on this Wix site with Claude

This repo is a **Wix CLI (Git Integration)** site: Velo code lives in `src/`, and the
visual layout is built in the Wix Studio editor. This file (plus the **Wix + Claude
Addon**) gives you what the raw repo does not: a view of the page elements.

## 1. You CAN see every element — read the map first

> **Before targeting any element, read [`wix-elements.md`](./wix-elements.md).**
> (Machine-readable copy: `wix-elements.json`.)

Wix stores every element's `#id → $w type` in `.wix/types/…`, but that folder is
**`.gitignore`d and hidden**, which is why an agent appears "blind". The addon parses
it into the committed `wix-elements.md/json` you can read. Refresh it any time with:

```bash
npm run wix:elements      # wix sync-types + regenerate the map
```

Run that **after any change in the editor** (added an element, renamed an ID, etc.).
`wix sync-types` pulls the latest from Wix's servers; it does **not** need `wix dev` running.
Use `npm run wix:diff` to see exactly which ids were **added / removed / retyped** since the
last sync (note: move/resize/restyle don't change ids, so they won't show — confirm visually).

## 2. Hard rules of Velo `$w` (these prevent the common bugs)

- `$w('#id')` can **only select elements that already exist**. It **cannot create,
  move, delete, or re-ID** elements. New native elements must be added in the editor.
- **Pick the property by the element's TYPE** (the map's "How to set it" column):
  - `Text` → `.text` / `.html`
  - `Button` → `.label`, `.link`, `.onClick()`
  - `Image` → `.src`, `.alt`
  - `Box`, `Header`, `Footer` → **containers, NO `.text`** — use `.show()/.hide()/
    .collapse()/.expand()`, `.background`, and set their **child** Text elements.
  - `MultiStateBox` → **NO `.text`** — `.changeState("stateId")`, `.currentState`.
  - `Repeater` → `.data = [{_id, …}]`, `.onItemReady(($item,d)=>…)`; address item
    children via the scoped **`$item`**, never `$w`.
  - `AppController` (e.g. a dataset) → not visual; use `wix-dataset`.
- **`HiddenCollapsedElement` masks the true type.** A hidden Text/Box/MultiStateBox
  all look identical. `.show()/.expand()` first and confirm the real type in the
  editor before assuming `.text`/`.label`.
- "Referenced in code" in the map only means *some Velo file mentions the id*. On
  editor-built sites **most elements aren't referenced — that's normal, not "unused".**

## 3. Layout/styles — from the optional visual scan

The `.wix/types` map is **id→type only**. But if a visual scan has been run (`visual/` —
reads the **published** page, ToS-safe), `wix-elements.md` gains a **Layout** column and
`wix-elements.json` carries `layout: { box, style, parentNickname }` per element — real
position, size, computed styles, and parent. If those are absent, ask for a screenshot or
run the scan (see `visual/README.md`). Layout reflects the **published/test-site** state,
and multi-state UIs only capture rendered steps.

## 4. To add NEW UI that you fully control → use a code-owned component

`$w` can't create native elements, but you **can** own an entire section in code by
hosting it inside a container the user places **once**:

- **Custom Element** (`src/public/custom-elements/…`) — a web component; its whole DOM
  is your code. `npm run wix:scaffold custom-element <name>` to start one.
- **HtmlComponent** (iframe) — full HTML/CSS/JS, bridged by `postMessage`.
- **Repeater** — for data-driven lists into an existing item template.

- **Companion app** (`npm run wix:app "<Name>"`) — a private Wix app that auto-places a
  code-owned widget on the homepage at install and gives you an in-editor panel (real
  `@wix/editor` SDK) to configure it. Supported, but needs the editor open + a human install.

See `docs/wix-addon/STRUCTURAL-EDITING.md` for the full L0–L4 ladder of what's possible vs.
not (incl. the unsupported, account-risk L3 and the Headless L4 rebuild), and
`docs/wix-addon/HOSTS.md` for the one-time editor wiring each host needs.

## 5. Publish loop

Edit Velo in `src/` → `git push` → publish from the repo (`wix publish`, or the Wix
dashboard). Don't publish local code over newer editor changes without syncing first.

<!-- WIX-ELEMENTS:START -->
<!-- (auto-filled by `npm run wix:elements` — do not edit between these markers) -->
<!-- WIX-ELEMENTS:END -->
