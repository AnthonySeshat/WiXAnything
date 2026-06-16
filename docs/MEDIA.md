# Media bridge — let Claude see your Wix Media Manager

A Wix CLI repo has **zero image files**. Only code syncs to Git; every uploaded photo,
video, and document lives in the cloud **Media Manager**. So an agent can only "see" an
asset where a `wix:image://…` URL happens to be hard-coded in Velo — it cannot browse
your media folders from the repo.

`npm run wix:media` bridges that gap into two committed, agent-readable files at the repo
root:

| File | What it is |
|------|-----------|
| `wix-media.md` | Human/agent tables: media grouped by Media Manager folder, with each file's **Velo src**, type, size, dimensions, plus media URLs already used in code. |
| `wix-media.json` | The same, machine-readable. |

It also fills the `WIX-MEDIA` block in `CLAUDE.md`.

## Two layers (it degrades gracefully)

1. **Zero-auth code scan — always runs.** Scans `src/` for every Wix media URL already
   referenced (`wix:image://`, `wix:video://`, `wix:document://`, and public
   `static.wixstatic.com` / `*.usrfiles.com` / `*.wixmp.com` URLs). No login needed.

2. **Full Media Manager listing — needs a Wix API key.** Lists every folder and file via
   the Wix Site Media REST API. **Read-only** — nothing in your Media Manager changes.

## Enabling the full listing

You need a **Wix API key** with the **Read Media Manager** permission, plus your **site ID**.

1. **Create the API key.** Wix dashboard → **Settings → API Keys** (account-level API Keys
   Manager). Create a key and grant it the **"Read Media Manager"** permission
   (`SCOPE.DC-MEDIA.READ-MEDIAMANAGER`). Read-only is enough.

2. **Find your site ID.** It's the segment after `/dashboard/` in your Wix dashboard URL.
   (If `wix.config.json` in this repo already has a `siteId`, the script uses that as a
   fallback and you can skip setting `WIX_SITE_ID`.)

3. **Put the credentials in a gitignored `.env`** at the repo root (the addon's
   `.gitignore` already ignores `.env`):

   ```ini
   WIX_API_KEY=<your-api-key>
   WIX_SITE_ID=<your-site-id>
   ```

   Environment variables (`WIX_API_KEY` / `WIX_SITE_ID`) also work and take precedence.
   The key is **never** written to the generated artifacts — only the media listing is.

4. **Run it:**

   ```bash
   npm run wix:media
   ```

   You should see `✓ N files in M folders`. If you see `401`/`403`, re-check the key's
   permission and the site ID; `429` means you're rate-limited — wait a minute and retry.

## Using the media in Velo

Each file row gives a **Velo src**. Set it directly on an Image (or Gallery item):

```js
$w('#heroImage').src = "wix:image://v1/<mediaId>/<filename>#originWidth=3264&originHeight=2448";
```

Copy the `veloSrc` value **verbatim** — don't hand-edit the `<mediaId>`. Folder names
("Materials/Sheet Metal", etc.) are labels to help you find the right asset; they are not
part of `.src`.

## Telling Claude which folder is which

Once the listing works, you don't have to type out every material by hand — point Claude
at folders instead: *"the **Materials/Panel Clad** folder is panel cladding, **Materials/
Sheet Metal** is sheet metal — build the cladding filter from those."* Claude reads the
folder paths and file Velo srcs straight from `wix-media.md`.

## Refresh

Re-run `npm run wix:media` after uploading or moving media. It's also chained into
`npm run wix:full` (non-fatal), so the full picture — elements + layout + media — refreshes
together.

## Limits & honesty

- The listing reflects the Media Manager **at run time**; re-run after changes.
- Listing is capped (500 folders / 5000 files) as a safety backstop; if hit, the artifact
  says so rather than silently truncating.
- The `wix:image://v1/<mediaId>/…` mapping from a file's WixMedia id is the well-established
  Velo convention, but Wix's REST reference doesn't spell out the transform verbatim — if a
  generated `veloSrc` ever fails to render, fetch the canonical src from the editor/Media
  Manager for that one file and prefer that.
