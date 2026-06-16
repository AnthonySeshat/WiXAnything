# Visual layer scraper

Reads the **published** Wix page and produces the visual data the `.wix/types` map
can't: per-element **geometry (x/y/w/h), computed styles, and parent/child layering**,
keyed by your Velo nicknames (`#IDs`). This is the layer the official Wix + Claude
integration does **not** expose to an external agent.

## ✅ Why it's ToS-safe (not the L3 risk)

It loads a **public web page like any browser** and reads the rendered DOM. It does **not**
automate the Wix editor, log into your account, or touch the document model. Reading a
public site you own carries none of the account-ban risk of editor automation.

## How it works

1. Wix's Thunderbolt page model (from `siteassets.parastorage.com`) maps every Velo
   nickname to a rendered comp id: `{"compId":"comp-xxxx","role":"styleRepeater"}`.
2. Each comp id is a real DOM element → `getBoundingClientRect` + `getComputedStyle`.
3. Join → `nickname → { compId, box, style, parentNickname }`.

## Use

```bash
cd visual
npm install                      # playwright + chromium (one-time)
# one page:
node scan.mjs "<published-page-url>" --out wix-visual.json --elements ../wix-elements.json
# or several pages in one run (whole-site coverage):
node scan.mjs "<page-1-url>" "<page-2-url>" --out wix-visual.json --elements ../wix-elements.json
```

Multiple pages are written to one **v2** file (`{ version: 2, pages: [...] }`); old
single-page files still work. Then enrich the element map with it:

```bash
node ../scripts/wix-elements-gen.mjs --repo <your-wix-site> --visual visual/wix-visual.json
```

Now `wix-elements.md` has a **Layout** column (x,y · w×h) and `wix-elements.json` carries
`layout: { box, style, parentNickname }` per element. The generator **fingerprint-matches**
each scan to its `.wix/types` page, so a page's geometry is never attached to same-named
elements on other pages (a page you didn't scan simply has a blank Layout).

## Safety

`--full` drives a **live published site** like a visitor. By default it only clicks step
**navigation** (`nextBtn1…4`) and selects the first option in repeaters — it will **never**
click submit/checkout/booking-like buttons, so it can't create a lead, booking, or order.
Pass `--allow-submit` only if you understand it may trigger the final action on a real site.

## Limits (be honest)

- **Reflects the PUBLISHED/test-site state**, not your unsaved editor work. Publish (or use
  the `?rc=` test-site URL) to capture the latest.
- Only **currently-rendered** elements have geometry. Multi-state UIs (e.g. a step
  configurator) only render the active step; run a scan per state/step/page to cover all.
- Repeater **item** children render per-item; the nickname maps to the template, so item
  children may show as not-rendered. Scan covers top-level layout reliably.
