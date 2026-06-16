# CMS bridge — let Claude see your Wix Data Collections

Velo's `wix-data` queries run against **Data Collections** (the Wix CMS). The collection
ids, field **keys**, and field **types** aren't in the repo — so an agent writing a query
has to guess them, and a wrong field key (`.eq("title", …)` when the field is actually
`name`) returns nothing with no error. `npm run wix:cms` removes the guessing by listing
the live CMS schema into committed, agent-readable files:

| File | What it is |
|------|-----------|
| `wix-cms.md` | One section per collection: its `id`, type, field table (key · type · required · reference · display name), permissions, and a ready-to-paste `wixData.query(...)` snippet. |
| `wix-cms.json` | The same, machine-readable. |

It also fills the `WIX-CMS` block in `CLAUDE.md`.

## What you need

A **Wix API key** with the **Manage Data Collections** permission, plus your **site ID** —
the same `.env` setup as the media bridge (see [`MEDIA.md`](MEDIA.md) for the full walk-through).

1. **Create / reuse the API key.** Wix dashboard → **Settings → API Keys**. Grant the key
   the **"Manage Data Collections"** permission (`SCOPE.DC-DATA.DATA-COLLECTIONS-MANAGE`).
   You can grant this on the *same* key you use for media — just add both permissions.

   > **On read-only:** "Manage Data Collections" is the **only** permission Wix documents for
   > the List Data Collections endpoint, and it implies write access. `wix:cms` itself only
   > ever issues read-only `GET` requests (it never creates/edits/deletes a collection), but
   > the *key* technically carries manage rights — so treat that key as sensitive and keep it
   > in `.env` (gitignored), same as always.

2. **Site ID** — from the dashboard URL after `/dashboard/`, or it falls back to the `siteId`
   in `wix.config.json`.

3. **Put them in `.env`** at the repo root (already gitignored):

   ```ini
   WIX_API_KEY=<your-api-key>
   WIX_SITE_ID=<your-site-id>
   ```

4. **Run it:**

   ```bash
   npm run wix:cms
   ```

   Without a key it writes a short stub explaining setup and exits cleanly (so it's safe in
   `npm run wix:full`). With a key you'll see `✓ N collection(s)`.

## Using the schema in Velo

Each collection section gives a copy-paste starting point:

```js
import wixData from 'wix-data';
const { items } = await wixData.query("<collectionId>").limit(50).find();
```

- Use the collection **`id`** and field **`key`** values **verbatim** — they're the real
  names the query engine matches on, not the human display names.
- `REFERENCE` / `MULTI_REFERENCE` fields show their target as `→ <collectionId>`; pull the
  referenced item(s) with `.include("<fieldKey>")` or `wixData.queryReferenced(...)`.
- `IMAGE` / `VIDEO` / `MEDIA_GALLERY` fields store `wix:image://…`-style values — cross-
  reference [`wix-media.md`](../wix-media.md) (the [media bridge](MEDIA.md)) for the actual assets.

## What's listed

All collections the key can see: your own (**`NATIVE`**) collections first, then app/system
collections (**`WIX_APP`** / **`BLOCKS_APP`** — Stores, Members, Bookings, etc.). System
fields are marked `(system)`.

## Limits & honesty

- Reflects the CMS **at run time**; re-run `npm run wix:cms` after schema changes.
- Listing is capped (1000 collections) as a safety backstop; if hit, the artifact says so.
- If a REST call fails mid-listing (e.g. a `429`), whatever was already fetched is kept and
  the artifact is marked **partial** rather than silently empty.
- This lists the **schema** (structure), not the row data. For reading/writing rows, use the
  Wix Data Items REST API or `wix-data` in Velo with the keys from here.
