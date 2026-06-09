<!-- refreshed: 2026-06-09 -->
# Architecture

**Analysis Date:** 2026-06-09

## System Overview

```text
┌─────────────────────────────────────────────────────────────┐
│               Cinatra Host / Dispatch Route                  │
│   (monorepo routing layer calls connector entry points)      │
└──────────────────────────┬──────────────────────────────────┘
                           │ ExtensionHostContext (ctx)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                  Connector Entry Points                       │
│  `src/setup-page.tsx`   (setup/dispatch route)               │
│  `src/settings-page.tsx` (settings UI — also re-exported)    │
└──────────────────────────┬──────────────────────────────────┘
                           │ ctx.authSession / ctx.nango ports
                           ▼
┌─────────────────────────────────────────────────────────────┐
│             Host-Injected Port Layer (external)              │
│  authSession  →  getActor() → userId validation              │
│  nango        →  getFrontendConfig() / getPrimarySaved        │
│                  Connections() → YouTube connection state    │
└──────────────────────────┬──────────────────────────────────┘
                           │ nangoFrontendConfig + connection
                           ▼
┌─────────────────────────────────────────────────────────────┐
│               SDK UI Components (external)                   │
│  `@cinatra-ai/sdk-ui/marketplace`                            │
│  Main, PageHeader, PageContent, NangoUserConnectButton       │
└─────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| YouTubeConnectorSetupPage | Default export; dispatch-route entry point; delegates to YouTubeSettingsPage | `src/setup-page.tsx` |
| YouTubeSettingsPage | Async server component; resolves actor + Nango connection state; renders connect UI | `src/settings-page.tsx` |
| Package entry (barrel) | Empty barrel; consumers import subpaths directly | `src/index.ts` |

## Pattern Overview

**Overall:** Cinatra connector extension — a minimal React Server Component package consumed as a source mirror by the Cinatra monorepo.

**Key Characteristics:**
- All UI components are async server components (no client state, no hooks)
- Authentication and OAuth state arrive via host-injected `ExtensionHostContext` ports (`ctx.authSession`, `ctx.nango`) — the connector holds no credentials itself
- The package is a source mirror: it declares `@cinatra-ai/*` packages as optional peer dependencies and is built/typechecked/tested inside the monorepo, not standalone
- No backend logic lives in this repo; YouTube Data API access is brokered by Nango through the host

## Layers

**Entry Layer:**
- Purpose: Provide named exports consumed by the host's dispatch routing
- Location: `src/setup-page.tsx`, `src/settings-page.tsx`
- Contains: Async React Server Components
- Depends on: `ExtensionHostContext` ports, `@cinatra-ai/sdk-ui/marketplace` components
- Used by: Cinatra monorepo dispatch router

**Host Port Layer (external):**
- Purpose: Supply auth session and Nango OAuth management
- Location: Provided at runtime by Cinatra host via `ctx` parameter
- Contains: `authSession.getActor()`, `nango.getFrontendConfig()`, `nango.getPrimarySavedConnections()`
- Depends on: Cinatra monorepo internals
- Used by: `YouTubeSettingsPage`

**SDK UI Layer (external):**
- Purpose: Render marketplace-consistent UI shell and Nango connect button
- Location: `@cinatra-ai/sdk-ui/marketplace` (monorepo package, not in this repo)
- Contains: `Main`, `PageHeader`, `PageContent`, `NangoUserConnectButton`
- Depends on: React 19
- Used by: `YouTubeSettingsPage`

## Data Flow

### Settings Page Request Path

1. Host dispatch route invokes `YouTubeConnectorSetupPage` with `{ searchParams, ctx }` (`src/setup-page.tsx`)
2. `YouTubeConnectorSetupPage` delegates directly to `YouTubeSettingsPage` wrapping `searchParams` in a resolved `Promise` (`src/setup-page.tsx:16`)
3. `YouTubeSettingsPage` resolves `searchParams` and calls `ctx.authSession.getActor()` in parallel (`src/settings-page.tsx:14-16`)
4. Actor `userId` is validated; missing userId throws with a defensive error (`src/settings-page.tsx:18-22`)
5. Nango frontend config and saved YouTube connection are fetched via `ctx.nango` ports, scoped to `{ scope: "user", userId }` (`src/settings-page.tsx:29-31`)
6. Component renders: error banner (if `?error=` param present), connection status, and `NangoUserConnectButton` for connect/reconnect (`src/settings-page.tsx:34-68`)

**State Management:**
- No local state; all state is derived from host ports on each render (server component pattern)
- OAuth connection lifecycle (connect / reconnect / revoke) is fully delegated to `NangoUserConnectButton`

## Key Abstractions

**ExtensionHostContext (`ctx`):**
- Purpose: Dependency-injection interface the host provides to every connector page; carries `authSession` and `nango` ports
- Examples: `src/settings-page.tsx`, `src/setup-page.tsx`
- Pattern: Passed as a prop; never imported directly — the type comes from `@cinatra-ai/sdk-extensions`

**NangoUserConnectButton:**
- Purpose: Handles first-time connect and reconnect flows; no separate disconnect control is needed because Nango revokes and re-issues on reconnect
- Examples: `src/settings-page.tsx:57-64`
- Pattern: Receives `nangoFrontendConfig` + connection metadata; manages OAuth redirect internally

## Entry Points

**Setup/Dispatch entry:**
- Location: `src/setup-page.tsx` (default export `YouTubeConnectorSetupPage`)
- Triggers: Cinatra host dispatch router mounting the connector's setup route
- Responsibilities: Accepts `packageId`, `slug`, `searchParams`, `ctx`; forwards to settings page

**Settings page (named export):**
- Location: `src/settings-page.tsx` (named export `YouTubeSettingsPage`)
- Triggers: Called by setup page, or imported directly by host via subpath `@cinatra-ai/youtube-connector/settings-page`
- Responsibilities: Full settings UI — auth check, connection state fetch, connect/reconnect surface

**Package barrel:**
- Location: `src/index.ts`
- Responsibilities: Empty — intentionally exports nothing; consumers use explicit subpath imports

## Architectural Constraints

- **Threading:** Single-threaded React server component async/await; no workers
- **Global state:** None — no module-level singletons
- **Circular imports:** None detected
- **Standalone installability:** Not standalone-installable; `@cinatra-ai/*` peers resolve only inside the Cinatra monorepo workspace
- **No backend routes:** This connector ships only UI pages; YouTube Data API calls are handled by the host's Nango integration, not by code in this repo

## Anti-Patterns

### Direct Nango import

**What happens:** Previously this connector imported `@cinatra-ai/nango-connector` directly.
**Why it's wrong:** Creates a hard dependency on a monorepo-internal package and mis-scopes user data if the host context is bypassed.
**Do this instead:** Use `ctx.nango.getFrontendConfig()` and `ctx.nango.getPrimarySavedConnections({ scope: "user", userId })` as shown in `src/settings-page.tsx:29-31`.

### Settings-page re-export from barrel

**What happens:** The barrel `src/index.ts` previously re-exported the settings page.
**Why it's wrong:** Consumers should use the explicit subpath `@cinatra-ai/youtube-connector/settings-page` so tree-shaking and subpath resolution work correctly.
**Do this instead:** Import from the subpath directly; the barrel is intentionally empty (`src/index.ts`).

## Error Handling

**Strategy:** Defensive throws for missing actor; UI-level error banner for OAuth errors passed via query param.

**Patterns:**
- Missing `actor.userId` throws `Error("[youtube-connector] settings-page: no userId on actor")` — fails fast before any data fetch (`src/settings-page.tsx:21`)
- OAuth error messages surfaced via `?error=` search param; rendered as a destructive-styled banner in the UI (`src/settings-page.tsx:40-44`)

## Cross-Cutting Concerns

**Logging:** No logging library; single defensive `throw new Error(...)` for auth failure.
**Validation:** `userId` presence check before any Nango calls; `pickSearchParam` helper normalises array-valued search params.
**Authentication:** Delegated entirely to `ctx.authSession.getActor()` — the host enforces connector policy upstream; this component adds a defensive null check only.

---

*Architecture analysis: 2026-06-09*
