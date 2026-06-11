/**
 * __TAG__  —  Wix Custom Element (a standard Web Component).
 *
 * Everything inside here is 100% code-owned by Claude: markup, styles, behavior.
 * Wix only hosts the <__TAG__> tag on the page; the editor never touches its insides.
 *
 * Velo talks IN  via attributes:  $w('#__ID__').setAttribute('data-config', JSON.stringify(...))
 * Velo listens OUT via events:     $w('#__ID__').on('action', (e) => { e.detail ... })
 *
 * Constraints (Wix custom element sandbox): no $w / no Velo APIs in here, no cookies,
 * HTTPS only, loads after the page, single bundled ES module, message-passing only.
 */
class __CLASS__ extends HTMLElement {
  static get observedAttributes() {
    return ['data-config'];
  }

  constructor() {
    super();
    this._root = this.attachShadow({ mode: 'open' });
    this._config = {};
  }

  connectedCallback() {
    this._render();
  }

  attributeChangedCallback(name, _old, value) {
    if (name === 'data-config' && value) {
      try { this._config = JSON.parse(value); } catch { this._config = {}; }
      this._render();
    }
  }

  /** Emit an event Velo can catch with $w('#__ID__').on('action', ...). */
  _emit(name, detail) {
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
  }

  _render() {
    const title = this._config.title ?? '__NAME__';
    this._root.innerHTML = `
      <style>
        :host { display:block; font-family: inherit; }
        .card { padding: 24px; border-radius: 16px; background: #0f172a; color: #fff; }
        .card h2 { margin: 0 0 8px; font-size: 1.25rem; }
        button { margin-top: 16px; padding: 10px 18px; border:0; border-radius: 10px;
                 background:#22d3ee; color:#0f172a; font-weight:600; cursor:pointer; }
      </style>
      <div class="card">
        <h2>${title}</h2>
        <p>Code-owned section. Edit <code>src/public/custom-elements/__FILE__</code>.</p>
        <button type="button" id="cta">Click me</button>
      </div>
    `;
    this._root.getElementById('cta')?.addEventListener('click', () => {
      this._emit('action', { source: '__TAG__', at: Date.now() });
    });
  }
}

customElements.define('__TAG__', __CLASS__);
