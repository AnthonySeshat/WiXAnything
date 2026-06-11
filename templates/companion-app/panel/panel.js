// __APP_NAME__ — Editor Add-on panel logic. Uses the REAL @wix/editor SDK
// (verified against @wix/editor v1.566.0). Runs only inside the Studio editor.
//
// Verified, supported capabilities used here:
//   elements.getSelection()         -> Promise<IElement[]>   (read what the user selected)
//   elements.onSelectionChange(cb)  -> fires on selection change
//   widget.setProp(name, value)     -> set a prop on THIS app's widget (fully supported)
//   widget.setDesignPreset(id)      -> switch the widget's design preset
//   pages.addTemplate(id, opts)     -> add an app-owned page
//   editor.host()/auth()            -> REST client + auth headers for Wix APIs
//
// HONEST LIMITS (from research): this SDK can fully control the app's OWN widget,
// read the user's selection, and (depending on element type) edit a selected
// element's text / image content — but it CANNOT add, move, resize, reorder, or
// delete native Studio elements. That ceiling is a Wix platform limit, not ours.

import { elements, widget /*, pages, editor */ } from '@wix/editor';

const $ = (id) => document.getElementById(id);

async function refreshSelection() {
  try {
    const sel = await elements.getSelection();
    $('selInfo').textContent = sel.length
      ? JSON.stringify(sel, (k, v) => (typeof v === 'function' ? undefined : v), 2)
      : 'nothing selected';
  } catch (e) {
    $('selInfo').textContent = 'getSelection failed: ' + (e?.message || e) +
      '\n(are you running this inside the Studio editor?)';
  }
}

$('setTitle').addEventListener('click', async () => {
  // Drive the app's own widget — fully supported, persists with the site.
  await widget.setProp('title', $('titleInput').value);
});

$('setPreset').addEventListener('click', async () => {
  await widget.setDesignPreset($('presetInput').value);
});

// React to the user clicking around the canvas.
elements.onSelectionChange(() => refreshSelection());
refreshSelection();
