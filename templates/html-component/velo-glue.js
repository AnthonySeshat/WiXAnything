// ── Velo glue for the HtmlComponent #__ID__ ─────────────────────────────────
// Place the HtmlComponent in the editor, set its ID to #__ID__, and point it at
// this folder's page.html (Embed → Embed HTML → "Website address", or upload).

$w.onReady(() => {
  // Receive messages FROM the iframe:
  $w('#__ID__').onMessage((event) => {
    const msg = event.data || {};
    if (msg.type === 'ready') {
      // iframe is up — send it config:
      $w('#__ID__').postMessage({ type: 'config', title: 'Hello from Velo' });
    }
    if (msg.type === 'action') {
      console.log('iframe action at', msg.at);
    }
  });
});
