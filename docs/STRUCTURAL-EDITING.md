# What Claude can and cannot do to a Wix site (the honest ceiling)

Researched against a real Wix CLI repo, the live `@wix/editor` SDK (v1.566.0), and Wix
docs. This is the straight story — graded by how achievable each thing actually is.

## TL;DR

> A fully-supported, **headless** tool that adds / moves / reorders / restyles **native
> Studio elements** by code **does not exist.** No public Wix API (`$w`, `@wix/editor`,
> companion-app extensions, REST) can create, move, resize, reorder, or delete a native
> canvas element. That machinery lives only in Wix's internal `@wix/platform-editor-sdk`
> (not on public npm) + private document-services, injected only into the live editor.

But "everything" is reachable in **layers**:

| Layer | What it does | Feasibility | Risk |
|------|--------------|-------------|------|
| **L0** Element map + `--diff` | See every id→type; detect **added/removed/retyped** ids (NOT move/restyle) | ✅ proven | none |
| **L1** Code-owned regions | **Unlimited** add/move/resize/restyle **inside** custom-element / HTML regions | ✅ proven | none |
| **L2** Companion app | Auto-place a widget on the homepage at install; read selection; fully drive the app's **own** widget (props/preset); edit selected element text/image | 🟢 supported, **app-only, editor open + human** | none |
| **L3** Local-Editor automation | The *only* path to true native add/move on the **existing** site (Playwright → internal API) | 🟠 speculative | ⚠️ ToS / account-ban |
| **L4** Headless | **Total** structural freedom — pages become your Astro/React code | 🟢 supported | none, but it's a **rebuild** |

## ✅ L0 + L1 — works today, code-only, zero risk

- **See & correctly target every element** (`wix-elements.md`), and a `--diff` that catches
  structural add/remove/retype between syncs. (Move/resize/restyle change no id/type, so
  they're invisible to the diff — confirm those with a screenshot.)
- **Change content/behavior of existing elements** — `.text`, `.src`, `.label`, `.link`,
  `.show()/.hide()/.collapse()/.expand()`, `.background`, events, `.changeState()`.
- **Own entire NEW sections in code** — Custom Element / HtmlComponent / Repeater
  (`npm run wix:scaffold`). One manual placement per host, pure code thereafter.

## 🟢 L2 — the supported companion app (`npm run wix:app "<Name>"`)

A private `@wix/cli` app installed on your own site (no App Market review). It:
- **Auto-places** a code-owned Site Widget on the homepage at install
  (`installation.staticContainer: "HOMEPAGE"`) — the one supported "appears from code" path.
- Ships an **Editor Add-on panel** (real `@wix/editor`): `elements.getSelection()` /
  `onSelectionChange()` to read what's selected, `widget.setProp()` / `setDesignPreset()`
  to fully drive the app's own widget, `pages.addTemplate()` to add app pages.
- **Honest limit:** it controls the app's **own** widget completely and can read/(content-)
  edit the **selected** native element, but **cannot** add/move/resize/reorder/delete native
  elements, and it only runs **with the Studio editor open** (needs the injected platform
  context — `IncorrectEnvironment` otherwise). Not headless. See `companion-app/SETUP.md`.

## 🟠 L3 — native structural editing (opt-in frontier, unsupported)

Driving the authenticated `wix dev` Local Editor with Playwright is the only way to truly
add/move/restyle **native** elements on the existing site. Changes **persist** (a new
server-side UI version, bumped `wix.config.json`, re-surfaced via `wix sync-types` into
`.wix/types`). But: the editor is heavily obfuscated, the internal `documentServices` API
is undocumented and likely permission-gated, it **breaks on every editor release**, and it
runs as **your** account → plausible **Wix ToS / account-ban** exposure. Not part of this
tool by default; only ever opt-in, own-site, human-checkpointed.

## 🟢 L4 — Headless (the only supported "everything", but a rebuild)

`npm create @wix/new@latest headless` → pages become ordinary Astro/React code in git with
**100% structural freedom**, reusing your existing site's data (CMS/Stores/Members) via
`@wix/sdk` `OAuthStrategy(clientId)`; deploy via `wix deploy` or Vercel/Netlify. Cost: you
leave the Studio editor and rebuild the frontend in code (data survives; designed pages
don't port). Choose this when a project needs unconditional freedom.

## ❌ Not possible (no supported path)

- Programmatically creating/moving/deleting native canvas elements or assigning IDs from
  **code**, headlessly, on an existing Studio site.
- Reading element geometry / parent-child / layout from the repo (maps are id→type only).
- Using any Wix **MCP** to see or edit elements (data/CMS only — see `MCP-SETUP.md`).
