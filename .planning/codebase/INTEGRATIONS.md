# External Integrations

**Analysis Date:** 2026-06-09

## APIs & External Services

**YouTube Data API:**
- Service: YouTube Data API (Google)
- What it's used for: Reading channel uploads, listing videos, feeding transcript/summary/media-research workflows
- SDK/Client: No direct SDK import in this connector — OAuth connection is brokered entirely through Nango (see below)
- Auth: OAuth via Google sign-in, reusing existing Google credentials; managed by Nango

**Nango (OAuth connection broker):**
- Service: Nango — third-party OAuth connection management platform
- What it's used for: Establishing and storing user-scoped YouTube OAuth connections; providing frontend config for the connect button
- SDK/Client: `NangoUserConnectButton` from `@cinatra-ai/sdk-ui/marketplace` (`src/settings-page.tsx`); host port `ctx.nango` injected via `ExtensionHostContext`
- Connector key: `"youtube"` (used in `NangoUserConnectButton` and `ctx.nango.getPrimarySavedConnections`)
- Auth: Host-injected `ctx.nango` port; no direct Nango API key in this package

## Data Storage

**Databases:**
- Not applicable — this connector does not directly access any database. Connection state (saved Nango connections) is retrieved via host port `ctx.nango.getPrimarySavedConnections` injected by the Cinatra extension runtime

**File Storage:**
- Not applicable

**Caching:**
- Not applicable

## Authentication & Identity

**Auth Provider:**
- Google OAuth (via Nango) — users connect their YouTube/Google account through the Nango-managed OAuth flow
- Session identity: Host-injected `ctx.authSession.getActor()` returns the current actor's `userId`; used in `src/settings-page.tsx` to scope Nango connection lookups to the authenticated user
- Defensive check: If `actor.userId` is absent, an error is thrown to prevent mis-scoped data access (`src/settings-page.tsx` line 21)

## Monitoring & Observability

**Error Tracking:**
- Not detected — no Sentry, Datadog, or similar SDK imported

**Logs:**
- Not detected — no structured logging library; a single `throw new Error(...)` guards the null userId case in `src/settings-page.tsx`

## CI/CD & Deployment

**Hosting:**
- Deployed as a Cinatra AI connector plugin inside the Cinatra extension host runtime; not a standalone service
- `.github/` directory present (CI config exists) — specific workflow details not read

**CI Pipeline:**
- `.github/` directory present; contents not inspected

## Environment Configuration

**Required env vars:**
- None directly consumed by this package; all secrets and API keys are injected at runtime via the Cinatra host ports (`ctx.authSession`, `ctx.nango`)

**Secrets location:**
- `.npmrc` present (note existence only — may contain registry auth token, not read)
- No `.env` files detected in repo

## Webhooks & Callbacks

**Incoming:**
- Not detected — no webhook endpoint handlers in `src/`

**Outgoing:**
- Not detected — no outgoing webhook calls; OAuth callback flow is handled by Nango externally

---

*Integration audit: 2026-06-09*
