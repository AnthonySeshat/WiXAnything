# Wix outreach — email draft

**To:** bizdev@wix.com
**(Secondary, dev-platform):** a support ticket / Discord via https://dev.wix.com/docs/build-apps/manage-your-app/contact-us/contact-us
**Subject:** Extending the Wix + Claude integration — external-agent access to the Velo/element layer

---

Hi Wix Business Development team,

My name is **Oliver Wilson** — I manage **OTTOP** (Brisbane, Australia), a business built and
running on Wix Studio. I'm also a developer, and I've built a working tool that **extends the
existing Wix + Claude (Anthropic) integration** in a direction your platform doesn't yet
cover for third parties. I'd like to explore doing it **with** Wix.

**The context (so I'm not telling you things you already know):** Wix already partners with
Anthropic — the official Wix MCP server and Claude plugin let Claude work with Wix sites, and
Aria brings AI editing inside Studio. My tool sits in the **one gap those don't fill**: giving
a best-in-class **external** coding agent — Claude Code, running in the developer's own repo —
a complete, structured view of a *real* Wix site so it can edit Velo with confidence.

**What it does today, using only official Wix tooling** (Git Integration, the Wix CLI,
`wix sync-types`, `@wix/sdk`) — entirely within your Terms:

- **Sees every element.** It turns the Wix CLI's element type definitions into a committed,
  agent-readable inventory — every element's ID, `$w` type, page, and whether Velo references
  it. (Today an external agent is effectively *blind* to the elements placed in Studio.)
- **Sees the layout & styling.** By reading the **published** page, it adds real geometry,
  computed styles, and parent/child layering to each element — so Claude understands how the
  site actually *looks*, not just its code. The official MCP/plugin exposes none of this to an
  external agent.
- **Edits Velo against real IDs**, scaffolds Custom Elements, and surfaces everything as a
  reviewable, version-controlled artifact.

**Why I'm reaching out instead of just using it:** the deepest value needs Wix. Your own
developer community has an **open, vote-collecting request to add element-ID and Velo support
to the Wix MCP** — which tells me this is a real, recognised gap. With official, supported
access to that element/Velo surface for external agents (and, longer term, the editor APIs
that power Aria), this becomes a first-class capability rather than a careful workaround — and
it keeps the fast-growing wave of AI-first builders **inside** Wix's ecosystem.

I'd love to show you a short **live demo** on my own site (an expandable-homes configurator),
share a private repository, and discuss how this could **extend the existing Wix–Anthropic
relationship**. I'm happy to work within whatever review, sandboxing, or partner-app
constraints you require.

Thank you for your time — I think there's a timely, concrete opportunity here, and I'd much
rather build it with Wix than around it.

Best regards,
**Oliver Wilson**
Manager, OTTOP — Brisbane, Australia
[your email] · [your phone]
[optional: link to a 60–90s demo video]

---

## Notes before you send
- **Recipient:** `bizdev@wix.com` is the **verified** official partnership channel (per Wix's
  "Contacting Wix Business Development" help article). `devpartners@wix.com` could **not** be
  verified — don't use it (risk of bounce). For a parallel technical touchpoint, file a Wix
  App-Developer support ticket / Discord via the dev.wix.com contact page above.
- **Fill the `[brackets]`** (email, phone) and, ideally, attach/link a 60–90s screen recording
  of Claude reading your element map **with the layout/styles column** and editing Velo — a
  working demo lands far harder than the description.
- **Accuracy (these were corrected from an earlier draft):** (1) the Wix↔Anthropic partnership
  **already exists** — frame this as *extending* it, not creating one; (2) AI visual editing is
  **not** "future" — Aria ships it today — so the ask is *external-agent* access to those
  APIs, not the capability itself.
- Keep the repo **private**; offer read-only access on request.
