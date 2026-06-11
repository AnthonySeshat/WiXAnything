# Wix MCP — useful for DATA, not for elements

The Wix MCP server is a good complement to this addon, but be clear on the division of
labor:

| Need | Use |
|------|-----|
| See/edit page **elements, IDs, Velo** | **This addon** (`wix-elements.md`) — the *only* source |
| Read/write **CMS collections, products, orders, CRM, business data** | **Wix MCP** |
| Search **Wix API docs** | Wix MCP |

**No Wix MCP (official, per-site, or Composio) can read or edit the visual element tree,
element IDs, or Velo code.** That's why this addon parses `.wix/types` instead.

## Install the official Wix MCP into Claude Code (optional)

Requires Node 19.9+.

```bash
claude mcp add --transport http wix https://mcp.wix.com/mcp
```

Then restart Claude Code. It exposes account/REST tooling (e.g. list sites, call site
REST APIs for Wix Data / Stores / Bookings / CRM, and docs search) — handy for managing
the **data** behind your site (e.g. product/option CMS collections), while the addon
handles the **page elements**.

> Composio's Wix toolkit is an alternative wrapper over the same REST surface; it also
> does not expose elements/Velo. Pick one if you want CMS/CRM access from Claude.
