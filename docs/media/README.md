# Media assets for the README

Drop the demo media here, then reference it from the top-level `README.md`.

## What to add

| File | What it is | Notes |
|------|-----------|-------|
| `demo.gif` | The hero demo (60–90s) | Uncomment the `![WiXAnything demo](docs/media/demo.gif)` line in `README.md` once added. |
| `element-map.png` | Screenshot of `wix-elements.md` rendered (the Layout column) | Optional — a strong static visual if a GIF is too heavy. |
| `before-after.png` | Optional: Claude guessing vs. coding accurately | Optional. |

## Suggested demo script (for `demo.gif`)

1. In the Claude Code terminal (connected to your Wix repo):
   `npx -y github:AnthonySeshat/WiXAnything --repo .`  → shows `📦 WiXAnything → .`
2. `npm run wix:full -- --url "<your-published-page>"` → watch it sync types + walk the
   page for layout/styles + merge.
3. Open `wix-elements.md` → scroll the table (type + Layout + how-to-set).
4. Ask Claude a real task that uses real IDs/types/layout, e.g.
   *"wire `#nextBtn1` to advance `#quoteMulti` and update `#bedroomSelection`"* — show it
   getting it right the first time.

## Capture tips

- **Windows:** [ScreenToGif](https://www.screentogif.com/) (free) → export GIF or MP4.
- Keep GIFs **under ~10 MB** so GitHub renders them inline (trim, ~12–15 fps, ~1280px wide).
- For longer walkthroughs, record MP4 and link it (GitHub plays uploaded MP4s in issues/PRs,
  or host on YouTube/Loom and link from the README).
