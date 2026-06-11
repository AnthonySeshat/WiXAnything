/**
 * <quote-configurator>  —  a real, polished Wix Custom Element (the "bridge" demo).
 *
 * This is what "code → real Wix site" looks like: a self-contained web component
 * Claude fully owns in code (markup, styling, interactivity, state), embedded once
 * in the Wix editor. Updating this file updates the section on the live site.
 * No dependencies, no build step required — a single ES module Wix can host.
 *
 * Velo IN:   $w('#quoteConfig').setAttribute('data-options', JSON.stringify([...]))
 * Velo OUT:  $w('#quoteConfig').on('quotechange', e => e.detail.total)
 *            $w('#quoteConfig').on('submit',      e => e.detail)  // {total, selections}
 */
class QuoteConfigurator extends HTMLElement {
  static get observedAttributes() { return ['data-options', 'data-currency', 'data-title']; }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._opts = [];
    this._selected = {};
    this._currency = '$';
    this._title = 'Configure your quote';
  }

  connectedCallback() { this._ensureDefaults(); this._render(); }

  attributeChangedCallback(name, _o, v) {
    if (name === 'data-options' && v) { try { this._opts = JSON.parse(v); this._selected = {}; } catch {} }
    if (name === 'data-currency' && v) this._currency = v;
    if (name === 'data-title' && v) this._title = v;
    if (this.isConnected) this._render();
  }

  _ensureDefaults() {
    if (this._opts.length) return;
    // Sensible demo data so it looks real even before Velo sends options.
    this._opts = [
      { id: 'beds', label: 'Bedrooms', choices: [
        { label: '1', price: 0 }, { label: '2', price: 18000 }, { label: '3', price: 34000 } ] },
      { id: 'bath', label: 'Bathrooms', choices: [
        { label: '1', price: 0 }, { label: '2', price: 12000 } ] },
      { id: 'cladding', label: 'Exterior', choices: [
        { label: 'Weatherboard', price: 0 }, { label: 'Brick', price: 9000 }, { label: 'Render', price: 14000 } ] },
    ];
  }

  _total() {
    return this._opts.reduce((sum, o) => {
      const pick = this._selected[o.id] ?? 0;
      return sum + (o.choices[pick]?.price ?? 0);
    }, 0);
  }

  _money(n) { return this._currency + n.toLocaleString(); }

  _emit(name, detail) {
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
  }

  _select(optId, choiceIdx) {
    this._selected[optId] = choiceIdx;
    this._render();
    this._emit('quotechange', { total: this._total(), selections: this._selectionSummary() });
  }

  _selectionSummary() {
    return this._opts.map(o => ({
      option: o.label,
      choice: o.choices[this._selected[o.id] ?? 0]?.label,
    }));
  }

  _render() {
    const total = this._total();
    this.shadowRoot.innerHTML = `
      <style>
        :host { display:block; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }
        .card { background:#0f172a; color:#e2e8f0; border-radius:20px; padding:28px;
          box-shadow:0 20px 60px rgba(2,6,23,.35); max-width:560px; }
        h2 { margin:0 0 4px; font-size:1.4rem; }
        .sub { color:#94a3b8; font-size:.9rem; margin-bottom:18px; }
        .row { margin:16px 0; }
        .row > span { display:block; font-size:.8rem; letter-spacing:.04em; text-transform:uppercase; color:#7dd3fc; margin-bottom:8px; }
        .choices { display:flex; flex-wrap:wrap; gap:8px; }
        button.choice { border:1px solid #334155; background:#1e293b; color:#e2e8f0; padding:9px 14px;
          border-radius:10px; cursor:pointer; font:inherit; transition:.15s; }
        button.choice:hover { border-color:#38bdf8; }
        button.choice[aria-pressed="true"] { background:#0ea5e9; border-color:#0ea5e9; color:#04263a; font-weight:600; }
        .total { display:flex; align-items:baseline; justify-content:space-between; margin-top:22px;
          padding-top:18px; border-top:1px solid #1e293b; }
        .total .n { font-size:2rem; font-weight:700; color:#fff; }
        .cta { margin-top:18px; width:100%; padding:14px; border:0; border-radius:12px;
          background:#22d3ee; color:#04263a; font-weight:700; font-size:1rem; cursor:pointer; }
      </style>
      <div class="card">
        <h2>${this._title}</h2>
        <div class="sub">Live estimate — updates as you choose.</div>
        ${this._opts.map(o => `
          <div class="row">
            <span>${o.label}</span>
            <div class="choices">
              ${o.choices.map((c, i) => `
                <button class="choice" data-opt="${o.id}" data-idx="${i}"
                  aria-pressed="${(this._selected[o.id] ?? 0) === i}">
                  ${c.label}${c.price ? ` &middot; +${this._money(c.price)}` : ''}
                </button>`).join('')}
            </div>
          </div>`).join('')}
        <div class="total"><span>Estimated total</span><span class="n">${this._money(total)}</span></div>
        <button class="cta" id="submit">Get this quote</button>
      </div>`;

    this.shadowRoot.querySelectorAll('button.choice').forEach(btn =>
      btn.addEventListener('click', () => this._select(btn.dataset.opt, Number(btn.dataset.idx))));
    this.shadowRoot.getElementById('submit')
      .addEventListener('click', () => this._emit('submit', { total: this._total(), selections: this._selectionSummary() }));
  }
}

customElements.define('quote-configurator', QuoteConfigurator);
