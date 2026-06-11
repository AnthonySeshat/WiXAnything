# L4 Headless — setup

A fully code-controlled front end (Astro) that reuses your **existing Wix site's data**.
100% ToS-compliant: it uses the official `@wix/sdk` and does **not** touch the Studio editor.

> What this is / isn't: this is a **separate** front end you host (Wix / Vercel / Netlify).
> It gives Claude total structural freedom (it's just code). It does **not** modify your
> Wix Studio site — your existing site stays exactly as is. Your **data** (CMS, Stores,
> Members…) is shared.

## 1. Create a Headless OAuth client (2 min)

1. Wix dashboard → **Settings → Headless** (or developers.wix.com → Headless).
2. Create an **OAuth app** with a **Client / Visitor** token.
3. Point the Headless project at the **same site** whose data you want to reuse
   (e.g. the OTTOP "Expandable Homes" site).
4. Copy the **Client ID**.

## 2. Configure & run

```bash
cd headless
cp .env.example .env          # then paste your client id into WIX_CLIENT_ID
npm install
npm run dev                   # http://localhost:4321
```

The home page shows a green status once the client id is set.

## 3. Show your live data

Set the demo collection id (your CMS collection, e.g. the expandable-homes options):

```bash
# in .env
WIX_DEMO_COLLECTION=YourCollectionId
```

`src/lib/wix.js → queryCollection()` is where data is read. The exact `@wix/data` query
shape can vary by version; if a query errors, adjust it per the
[Wix Data SDK docs](https://dev.wix.com/docs/sdk) for your installed `@wix/data`.

Add Stores/Bookings/Members the same way (`@wix/stores`, `@wix/bookings`, …): import the
module, pass it into `createClient({ modules })`, and query it in a page.

## 4. Build / deploy

```bash
npm run build      # static output in dist/
npm run preview
```

- **Static** (default): data is fetched at build time. Great for content that changes
  occasionally; rebuild to refresh.
- **SSR / request-time data:** add a server adapter and set `output: 'server'`:
  ```bash
  npx astro add node          # or @astrojs/vercel, @astrojs/netlify
  ```
- Deploy `dist/` (static) or the SSR build to Wix-managed hosting (`wix deploy` if you
  scaffolded via the Wix CLI), Vercel, Netlify, or anywhere.

## 5. Checkout / login flows

Ecommerce/auth (cart checkout, member login) bounce through Wix-hosted pages via
`redirects.createRedirectSession()` — see the Wix Headless docs. The catalog/content you
render yourself; the secure money/auth steps redirect to Wix and come back.

## Why this matters for the partnership pitch

This proves Claude can build a complete, polished, **rules-respecting** Wix-powered site in
code. The one capability it can't do — pushing this structure back into the **Studio
editor** — is exactly the Wix-internal API access (`platform-editor-sdk` / document-services)
to request in a partnership. See `../docs/wix-addon/STRUCTURAL-EDITING.md`.
