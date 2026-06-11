# Security & secrets

## TL;DR

- **`.env` is never committed** (it's gitignored). Only `headless/.env.example` (empty
  placeholder) is in the repo.
- **`WIX_CLIENT_ID` is NOT a secret.** A Wix Headless *client/visitor* OAuth id is meant to
  ship to the browser. Leaking it grants nothing beyond what a normal site visitor can
  already read. Protect *data*, not the id (see below).
- **Real secrets never go in the repo or the browser** — only in your host's secret store.

## What's public vs secret

| Value | Sensitivity | Where it lives |
|-------|-------------|----------------|
| `WIX_CLIENT_ID` (OAuth visitor client id) | **Public by design** — visible in the browser | `.env` (local) / host env var; fine if exposed |
| Wix **API keys**, OAuth **app secrets**, admin tokens | **Secret** | Host secret store **only** — never in the repo, never in client code |
| CMS data | Controlled by **Wix collection permissions** | Wix |

**Implication:** the Headless front end's security comes from **Wix collection permissions**
(only expose collections/fields you're happy to be public), *not* from hiding the client id.
If something must stay private, don't make it publicly readable in Wix, and read it only from
server-side code using a secret `ApiKeyStrategy` key kept in your host's env store.

## How this repo is protected

1. **`.gitignore`** blocks `.env`, `.env.*` (except `.env.example`), `*.pem`, `*.key`.
2. **Pre-commit hook** (`.githooks/pre-commit`) refuses to commit any real `.env` file.
   Enable it once per clone: `git config core.hooksPath .githooks`.
3. **GitHub secret scanning + push protection** should be on (blocks pushes containing
   known secret formats). Repo → Settings → Code security.

## If a secret is ever committed

`.gitignore` does **not** remove already-committed history. So:
1. **Rotate/revoke the secret immediately** (assume it's compromised).
2. Scrub history with `git filter-repo` or BFG, then force-push.
3. Rotate again after scrubbing.

## Deploying

Put real secrets in the platform's env/secret store — **Vercel** (Project → Settings →
Environment Variables), **Netlify** (Site → Environment), or **Wix-managed hosting** env —
never in `astro.config`, source, or the repo.
