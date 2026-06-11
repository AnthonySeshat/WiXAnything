# Wix partnership pitch — email draft

**To:** bizdev@wix.com
**Subject:** Partnership: AI‑native site building & editing for Wix (Claude × Wix)

---

Hi Wix Business Development team,

My name is [Your name]. I run [Your business] — a business currently built and operating on
Wix — and I'm also a developer. I've built a working integration between **Anthropic's
Claude (Claude Code)** and **Wix**, and I'd like to explore a partnership that lets it go
further — natively and safely — inside the Wix platform.

**What I've already built (using only official Wix tooling, fully within your Terms):**

1. **Element visibility for AI.** A tool that surfaces a Wix Studio site's complete element
   map — every element ID and type, per page — to Claude, by reading the Wix CLI's generated
   type definitions (`.wix/types`) and the official `wix sync-types`. This solves the core
   blocker today: AI assistants can't "see" the containers, text, and images placed in the
   Studio editor, so they can't reliably write Velo against them. Now they can.
2. **Code‑owned components.** Claude scaffolds Custom Elements / widget code that drop into a
   real Wix site, giving the AI full control of those sections in code.
3. **Headless front‑ends.** Using the official `@wix/sdk`, Claude builds complete,
   code‑controlled front‑ends that reuse a Wix site's data (CMS, Stores, Members) — full
   creative freedom, deployable on Wix or anywhere.

Everything above is **100% within Wix's Terms** — no reverse‑engineering, no editor
automation, no scraping. It runs on official CLIs, SDKs, and the app framework.

**The opportunity — what a partnership would unlock:**

There is exactly **one** capability that would turn this into true AI‑native site editing:
**supported, programmatic write access to the Studio editor's component model** (the layer
behind `@wix/platform-editor-sdk` / document services), so an AI can **add, move, resize,
and arrange native elements** on a real Wix site the way a designer does in the editor.
Today that's internal‑only. With partner / early access — or a sanctioned API — **Claude
could become a genuine AI co‑designer inside Wix**, letting a fast‑growing population of
AI‑first builders create and edit real Wix sites conversationally.

**Why this matters for Wix:**

- **Category leadership:** positions Wix as the leading **AI‑native website platform** at the
  exact moment this category is forming.
- **Growth:** drives new site creation and Premium upgrades from AI‑first builders.
- **Retention of the AI building wave inside Wix's ecosystem** — rather than it flowing to
  headless/competitor stacks.

I'd love to show you a **live demo** and discuss how to do this safely within Wix's platform
and partner framework. I can share a private repository, a recorded walkthrough, and a
one‑page technical summary of precisely which API surface would be involved — and I'm happy
to work within whatever review, sandboxing, or partner‑app constraints you'd require.

I'd genuinely rather build this **with** Wix than around it. Thank you for your time — I
think there's a real and timely opportunity here.

Best regards,
[Your name]
[Your business / role]
[Email] · [Phone]
[Optional: link to demo video / private repo]

---

## Notes before you send
- **Primary contact:** `bizdev@wix.com` (Wix Business Development — the official channel for
  partnership/integration proposals). Media only: `pr@wix.com`.
- **Secondary paths** if you want more surface area: the **Wix Partner Program**
  (wix.com/partners) and the **Wix Dev Center** community (dev.wix.com).
- **Before sending:** fill every `[bracket]`, and consider attaching/linking a 60–90s screen
  recording of Claude reading the element map + building a Headless page — a working demo is
  far more persuasive than the description.
- Keep the repo **private** and share it read‑only on request (it is private now).
