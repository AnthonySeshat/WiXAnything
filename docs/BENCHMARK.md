# Does the element map actually improve Claude's Velo? (benchmark)

**Headline: 2/10 → 10/10 first-try correct; element-ID hallucinations 7 → 0.**

| Metric (10 Velo tasks, same model both arms) | Blind (no map) | Sighted (with `wix-elements.md`) |
|---|:---:|:---:|
| Tasks correct | **2 / 10 (20%)** | **10 / 10 (100%)** |
| Hallucinated element IDs | **7** | **0** |
| Type-mismatch bugs (e.g. `.text` on a Box) | **1** | **0** |

## Method

10 realistic Velo tasks were run against the committed, synthetic
[`examples/demo`](../examples/demo/wix-elements.md) fixture (built with deliberate traps:
a `Box`, a `MultiStateBox`, a `HiddenCollapsedElement`, a `TextBox`, a `Repeater`, and a
**non-existent** id). Each task was answered twice by the **same model** — the *only*
difference being whether the element map (`wix-elements.md`) was in context. A separate
grader scored each answer against a per-task rubric. Account-free, network-free, reproducible.

## The dominant failure: ID hallucination

When Claude can't see the elements, it writes the right *Velo pattern* but **invents a
plausible-but-wrong id** — so the code silently targets nothing at runtime:

| Task | Trap | Blind | Sighted |
|------|------|-------|---------|
| heroTitle | (control) | ✗ guessed `#heroHeading` | ✓ `#heroTitle`.text |
| featureBox | `Box` has no `.text` | ✗ `.text` on the Box | ✓ recognised container → child Text |
| stepStates | `MultiStateBox` | ✗ guessed `#multiStateBox1` | ✓ `#stepStates`.changeState |
| promoBanner | hidden, type unknown | ✗ invented `#promoText` | ✓ `.expand()` + type-unknown warning |
| featureRepeater | `Repeater` | ✗ guessed `#featuresRepeater` | ✓ `#featureRepeater`.data + onItemReady |
| messageBox | `TextBox` (.value) | ✗ guessed `#textBox1` | ✓ `#messageBox`.value |
| ctaButton | (control) | ✓ | ✓ |
| missingId | `#heroSubtitle` doesn't exist | ✗ wrote the fake id | ✓ flagged it missing → `#heroTitle` |
| nameInput | `TextInput` (.value) | ✓ | ✓ |
| successState | `MultiStateBox` | ✗ guessed `#multiStateBox1` | ✓ `#successState`.changeState |

The 2 blind passes were exactly where the *conventional* name happened to match the real id
(`#ctaButton`, `#nameInput`). Everywhere the id was non-obvious, blind guessed wrong.

## Honest caveats

- **Same model both arms** — this isolates the one variable (map present or not). It does
  **not** compare model quality.
- **The "blind" arm is a proxy** for *no element visibility* — which is exactly what the
  official Wix tooling (Wix Site MCP / Claude plugin) gives an *external* agent. It is not a
  literal run of that MCP; a fair next step is to A/B against it directly.
- **Synthetic 10-task fixture, small N**, author-designed traps. Real-site numbers will vary,
  but the hallucination mechanism is fundamental (you can't reliably target ids you can't see).
- This proves **sight changes/improves output**. It says nothing about *defensibility* or
  *demand* — those are separate questions.

_Reproduce: re-run the 10 tasks twice (with and without `examples/demo/wix-elements.md` in
context) and grade against the rubric above._
