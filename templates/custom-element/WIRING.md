# Wiring the `<__TAG__>` custom element (one-time, in the editor)

The code is 100% yours; Wix just needs to host the tag on the page **once**.

1. **Commit & serve the element file.** It lives at
   `src/public/custom-elements/__FILE__`. With `wix dev` running it's served locally;
   once published it's served from your site's public files.
2. **In the Wix editor:** `Add (+)` → `Embed Code` → `Custom Element`.
3. Open the new element's settings:
   - **Tag name:** `__TAG__`
   - **Server URL / source:** point to `public/custom-elements/__FILE__`
     (Wix shows the available public files; pick this one).
4. Select the element and set its **ID** to `__ID__` (Properties panel) so the Velo
   glue (`$w('#__ID__')`) matches.
5. Add the glue from `velo-glue.js` to that page's Velo code.
6. Run `npm run wix:elements` so `#__ID__` shows up in the element map.

After this, **all future changes are pure code** — edit `__FILE__` and the section
updates. You never need the editor for it again.

> Note: the custom element runs sandboxed — no `$w`/Velo APIs, no cookies, HTTPS only,
> loads after the page. Talk to Velo only via `setAttribute` (in) and events (out).
