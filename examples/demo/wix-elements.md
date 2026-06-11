# Wix Elements — site demo-0000-0000-0000-000000000000

> **AUTO-GENERATED** by `scripts/wix-elements-gen.mjs` — do not edit by hand.
> Source: `.wix/types/*` (gitignored, refreshed by `wix sync-types`). Generated: 2026-06-11T01:57:29.815Z

**2 pages · 19 elements** (5 global, 2 hidden, 3 referenced in Velo).

## ⚠ Read this before targeting elements
- These are the **only** element IDs that exist. `$w('#id')` can target these and **nothing else** — it **cannot create** new elements.
- The map is **id → type only**. There is **no geometry, parent/child, or layout** here. For visual context, open the Local Editor or ask for a screenshot.
- **`HiddenCollapsedElement` (🙈) masks the real type.** A hidden Text, Box, or MultiStateBox all show as `HiddenCollapsedElement`. `.expand()`/`.show()` it first; confirm the real type in the editor before using `.text`/`.label`.
- **"in code" just means some Velo file references the id.** On editor-built sites most elements are NOT referenced in code — that is normal, **not** "unused".
- A **`Box`/`MultiStateBox` has NO `.text`.** (This is the classic bug — e.g. `#modelsDesc` is a `Box`, so set its child Text elements, don't do `.text` on it.)

## 🌐 Global elements (header / footer / menus — addressable on EVERY page)

| ID | Type | State | How to set it (Velo) |
|----|------|-------|----------------------|
| `#header1` | `Header` | · | CONTAINER (site chrome) — global on every page. Use .collapse()/.expand(); set child elements. |
| `#footer1` | `Footer` | · | CONTAINER (site chrome) — global on every page. Use .collapse()/.expand(); set child elements. |
| `#mainMenu` | `MenuContainer` | · | Menu container — global. Manage via menu settings / child elements. |
| `#logo` | `Image` | · | .src = "wix:image://..." or URL  •  .alt = "..." |
| `#mobileMenu` | `HiddenCollapsedElement` | 🙈 hidden | ⚠ HIDDEN/COLLAPSED by default — TRUE TYPE UNKNOWN from types. Call .expand()/.show() first; you cannot rely on .text/.label until you confirm the real element type in the editor. |

## 📄 Contact  `(cont02)`
Velo code: `src\pages\Contact.cont02.js`  ·  6 page elements (plus all global elements above)

| ID | Type | State | How to set it (Velo) |
|----|------|-------|----------------------|
| `#page1` | `Page` | · | The page itself. Use $w.onReady(), .onViewportEnter, etc. |
| `#nameInput` | `TextInput` | · | .value = "..."  •  .placeholder  •  .onInput(fn)  •  read with .value |
| `#emailInput` | `TextInput` | · | .value = "..."  •  .placeholder  •  .onInput(fn)  •  read with .value |
| `#messageBox` | `TextBox` | · | .value = "..."  •  .placeholder  •  .onInput(fn)  •  read with .value |
| `#submitButton` | `Button` | · in code | .label = "..."  •  .link = "..."  •  .onClick(fn) |
| `#successState` | `MultiStateBox` | · | CONTAINER OF STATES — NO .text. Use .changeState("stateId"), read .currentState, .onChange(fn). |

## 📄 Home  `(home01)`
Velo code: `src\pages\Home.home01.js`  ·  8 page elements (plus all global elements above)

| ID | Type | State | How to set it (Velo) |
|----|------|-------|----------------------|
| `#page1` | `Page` | · | The page itself. Use $w.onReady(), .onViewportEnter, etc. |
| `#heroTitle` | `Text` | · in code | .text = "..."  (string; supports inline HTML via .html) |
| `#heroImage` | `Image` | · | .src = "wix:image://..." or URL  •  .alt = "..." |
| `#ctaButton` | `Button` | · in code | .label = "..."  •  .link = "..."  •  .onClick(fn) |
| `#featureBox` | `Box` | · | CONTAINER — NO .text. Use .show()/.hide()/.collapse()/.expand(), .background, .onClick. Set its CHILD text elements instead. |
| `#featureRepeater` | `Repeater` | · | .data = [{_id:"1",...}]  •  .onItemReady(($item,data)=>{...})  •  .forEachItem(fn). Address item children via the scoped $item, NOT $w. |
| `#stepStates` | `MultiStateBox` | · | CONTAINER OF STATES — NO .text. Use .changeState("stateId"), read .currentState, .onChange(fn). |
| `#promoBanner` | `HiddenCollapsedElement` | 🙈 hidden | ⚠ HIDDEN/COLLAPSED by default — TRUE TYPE UNKNOWN from types. Call .expand()/.show() first; you cannot rely on .text/.label until you confirm the real element type in the editor. |

