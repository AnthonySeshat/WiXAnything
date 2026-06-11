// ── Velo glue for the <__TAG__> custom element ──────────────────────────────
// Paste into the page's Velo code (e.g. src/pages/<Page>.<id>.js), inside onReady.
// Assumes you placed the Custom Element in the editor and gave it the ID #__ID__.

$w.onReady(() => {
  // Send config IN (the element reads data-config in attributeChangedCallback):
  $w('#__ID__').setAttribute(
    'data-config',
    JSON.stringify({ title: 'Hello from Velo' })
  );

  // Receive events OUT (the element dispatches CustomEvent('action', ...)):
  $w('#__ID__').on('action', (event) => {
    console.log('custom element action:', event.detail);
    // e.g. update a Text element, navigate, call a backend web method, etc.
  });
});
