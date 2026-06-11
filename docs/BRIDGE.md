# The compliant bridge: code → your real Wix site

This is the **rules-respecting** way to make Claude's creations appear on your **actual Wix
site** (not a separate Headless front end). It's the strongest in-editor proof for the Wix
partnership conversation, and it's something you can ship today.

## What it is

Claude builds a section as a **Custom Element** (a standard web component) — 100% code it
owns: markup, styling, interactivity, state. You embed it **once** in the Wix editor. From
then on, editing the code updates the section on the live site. No reverse-engineering, no
editor automation — just Wix's official Custom Element feature.

A complete, polished reference lives in [`examples/bridge/`](../examples/bridge/):
`quote-configurator.js` (an interactive, live-updating estimate card) + its Velo glue.

## The loop

```
Claude writes/edits  src/public/custom-elements/<name>.js   (a web component)
        │   (optional) npm run wix:build-element  → bundles to one file if it uses imports
        ▼
You embed it ONCE in the editor:  Add (+) → Embed → Custom Element
        │   Tag name: <name>   ·   source: public/custom-elements/<name>.js   ·   set its ID
        ▼
Velo glue feeds it data IN (setAttribute) and reads results OUT (events)
        ▼
It renders on the LIVE Wix site. Future changes = pure code.
```

## Step by step

1. **Scaffold** (or copy the bridge example):
   ```bash
   npm run wix:scaffold custom-element pricing-card
   # or use examples/bridge/quote-configurator.js as a starting point
   ```
2. **(Optional) bundle** a rich/multi-file component into the single file Wix hosts:
   ```bash
   npm run wix:build-element src/public/custom-elements/pricing-card.js
   ```
   Dependency-free single-file components don't need this — they work as-is.
3. **Embed once** in the editor: `Add (+) → Embed Code → Custom Element`, set the **Tag
   name** and point it at the public file, then give the element an **ID** (e.g. `#pricingCard`).
4. **Wire Velo** (see the `.velo-glue.js`): push data in with `setAttribute`, listen for the
   component's events. Optionally feed it from a CMS collection so it's data-driven.
5. **Refresh the map:** `npm run wix:elements` so the new id shows up for Claude.

## Why this is the partnership proof

It demonstrates, **within Wix's Terms**, that Claude can build real, polished, data-driven
sections that live on a real Wix site and update from code. The one thing it can't do —
place/move that section as **native** editor elements without a manual embed — is exactly the
capability that supported `platform-editor-sdk` access would unlock. You show the compliant
foundation working; you ask Wix for the last mile. See
[`STRUCTURAL-EDITING.md`](STRUCTURAL-EDITING.md) and [`../PARTNERSHIP-PITCH.md`](../PARTNERSHIP-PITCH.md).

## Limits (be honest in the demo)

- One manual embed per section (Wix platform limit).
- Custom elements are sandboxed: no `$w`/Velo inside, HTTPS only, load after the page,
  talk to Velo only via attributes (in) and events (out).
