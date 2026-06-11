# __APP_NAME__ — companion app setup (L2)

This is the **supported** way to (a) get a code-owned section to **appear on your site
from code** (auto-placed on the homepage at install) and (b) **configure it live inside
Wix Studio** from an Editor Add-on panel. It does **not** add/move native Studio elements
— that ceiling is documented in `docs/wix-addon/STRUCTURAL-EDITING.md`.

> ⚠️ Honest scope: the Editor SDK fully controls **this app's own widget** and can read
> the current selection (and, depending on element type, edit a selected element's
> text/image). It **cannot** add, move, resize, reorder, or delete native elements, and
> it only runs **with the Studio editor open** (it needs the injected platform context).

## What the scaffold gave you

```
companion-app/
  package.json            # @wix/cli app project (deps: @wix/editor, @wix/sdk)
  widget/
    element.js            # the code-owned web component (your UI, 100% code)
    element.json          # manifest — installation.staticContainer "HOMEPAGE" auto-adds it
  panel/
    index.html            # Editor Add-on panel UI (self-hosted page)
    panel.js              # uses @wix/editor: getSelection / widget.setProp / setDesignPreset
```

## One-time setup

1. **Create the app skeleton** (gives you the canonical structure + an `appDefinitionId`):
   ```bash
   cd companion-app
   npm create @wix/app@latest .     # accept defaults; choose a Site Widget / Custom Element extension
   npm install
   ```
   Then merge the scaffolded `widget/` and `panel/` files into the generated extension
   folders (the generator's layout is authoritative for your CLI version — keep its
   `element.json` field names, paste in our `element.js` UI and the `installation` block).

2. **Register the Editor Add-on panel.** In the Wix **Developers dashboard** for your app,
   add an *Editor Add-on / Widget settings panel* and point its URL at the panel
   (during dev this is the HTTPS localhost URL that `wix dev` prints; in prod, your
   deployed panel URL).

3. **Run it against your real site:**
   ```bash
   wix dev        # opens the Studio editor with your app loaded
   ```
   The widget auto-adds to the homepage; open its panel to drive `title` / preset.

4. **Install on the site for real:** publish/build the app and install it on your site via
   the app's **unlisted/custom App-Distribution URL** (no App Market review needed for a
   private app on your own site).

## How Claude uses this

- Claude edits `widget/element.js` → the section's markup/styles/layout/behavior are 100%
  code (unlimited *within the widget*).
- Claude can change the panel (`panel/panel.js`) to expose more props/presets.
- `widget.setProp(name, value)` / `widget.setDesignPreset(id)` configure the live widget;
  `elements.getSelection()` tells Claude what the user is pointing at.

## Coexists with your site repo

Keep this `companion-app/` next to (or separate from) your Git-integrated site repo. The
site stays a normal Studio site; the app just adds a code-owned, auto-placed region plus an
in-editor control panel. Refresh the element map after install with `npm run wix:elements`.
