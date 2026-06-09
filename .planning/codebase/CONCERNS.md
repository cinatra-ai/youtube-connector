# Codebase Concerns

**Analysis Date:** 2026-06-09

## Tech Debt

**Empty index.ts barrel:**
- Issue: `src/index.ts` exports nothing (`export {}`). A comment explains the settings-page export was removed and consumers must import `@cinatra-ai/youtube-connector/settings-page` directly. This is a non-standard pattern — package.json has no `exports` map to formalize subpath imports, so the direct subpath relies on implicit bundler/resolver behavior rather than declared package exports.
- Files: `src/index.ts`, `package.json`
- Impact: Consumers importing from the package root get nothing. There is no `exports` field in `package.json` to explicitly declare the `./settings-page` and `./setup-page` subpaths, so resolution depends entirely on the host bundler's fallback behavior and is not guaranteed across all toolchains.
- Fix approach: Add an `exports` map to `package.json` with explicit subpath entries for `./setup-page` and `./settings-page` pointing to their respective source files, and remove or clarify the empty barrel.

**No package exports map:**
- Issue: `package.json` has no `exports` field. The `main` field points to `./src/index.ts` (a TypeScript source file, not a compiled artifact), which is only usable inside the monorepo where the host build pipeline handles compilation. External consumers or standalone installs would not receive compiled output.
- Files: `package.json`
- Impact: Not independently installable or resolvable outside the monorepo. The CI workflow acknowledges this by explicitly skipping install, typecheck, and tests for "source mirror" repos.
- Fix approach: If standalone distribution is ever needed, add a `build` step and an `exports` map referencing `dist/` outputs. For now, document the monorepo-only constraint explicitly in `package.json`.

## Known Bugs

**`getFrontendConfig` and `getPrimarySavedConnections` are optional-chained with fallback:**
- Symptoms: If `ctx.nango.getFrontendConfig` or `ctx.nango.getPrimarySavedConnections` is undefined (e.g., nango port not fully configured), the page silently renders as if no connection exists, with no error surfaced to the user.
- Files: `src/settings-page.tsx` (lines 29-31)
- Trigger: Host that injects a `ctx.nango` port missing one or both methods.
- Workaround: The `??` fallbacks (`{}` and `{}`) prevent a crash but produce a broken UI state — the connect button appears without valid Nango config, leading to a failed OAuth flow.

## Security Considerations

**Error message reflected into UI from URL search params:**
- Risk: The `error` query parameter is read from `searchParams` and rendered directly into the DOM without sanitization (`src/settings-page.tsx` line 43). If a redirect URL can be crafted to include arbitrary text in the `error` param, that text appears in a styled error div. Since this is a server component rendering JSX, React escapes the string, so XSS via HTML injection is prevented — but social-engineering or phishing text could be injected into the error banner by crafting a redirect URL.
- Files: `src/settings-page.tsx` (lines 23, 41-44)
- Current mitigation: React JSX string escaping prevents HTML/script injection.
- Recommendations: Validate `error` param against a known set of error codes/messages before rendering. Do not render arbitrary server-redirected strings verbatim.

**`.npmrc` present:**
- The `.npmrc` file exists at the repo root. Its contents were not read (forbidden file category). It may contain a registry token or auth configuration that should not be committed.
- Files: `.npmrc`
- Recommendations: Verify `.npmrc` contains no secrets; use environment-variable-based auth (`//registry.example.com/:_authToken=${TOKEN}`) rather than literal tokens.

## Performance Bottlenecks

**Sequential promise resolution where parallel is possible:**
- Problem: `src/settings-page.tsx` awaits `searchParams` and `ctx.authSession.getActor()` in a `Promise.all`, which is correct. However, `ctx.nango.getFrontendConfig()` and `ctx.nango.getPrimarySavedConnections()` are awaited sequentially after that (lines 29-30), adding two serial async round-trips.
- Files: `src/settings-page.tsx` (lines 29-31)
- Cause: The two nango calls are independent and could be parallelized with a second `Promise.all`.
- Improvement path: Combine into `Promise.all([ctx.nango.getFrontendConfig?.(), ctx.nango.getPrimarySavedConnections?.({...})])`.

## Fragile Areas

**`setup-page.tsx` wraps settings-page without `await`:**
- Files: `src/setup-page.tsx`
- Why fragile: `YouTubeConnectorSetupPage` calls `YouTubeSettingsPage(...)` and returns the result directly without `await`. Since `YouTubeSettingsPage` is `async`, the return type is `Promise<JSX.Element>`, not `JSX.Element`. In a React Server Component context, returning a Promise is generally acceptable, but if the framework requires a resolved element this could cause subtle rendering failures.
- Safe modification: Add `await` before the `YouTubeSettingsPage(...)` call in `setup-page.tsx`.
- Test coverage: No tests exist in this repo; this is entirely untested.

**Connector key hardcoded as `"youtube"`:**
- Files: `src/settings-page.tsx` (lines 31, 58)
- Why fragile: The Nango connection key `"youtube"` and the `connectorKey="youtube"` prop are hardcoded strings. A rename or multi-provider extension of this connector would require manual find-and-replace across the file.
- Safe modification: Extract to a named constant at the top of the file.

## Scaling Limits

**Single YouTube account per user:**
- Current capacity: The connector retrieves only `connections.youtube` — a single connection per user scope.
- Limit: Users with multiple YouTube channels or accounts cannot connect more than one.
- Scaling path: Not applicable for the current product scope, but the Nango port API would need to support multi-connection retrieval if multiple accounts are needed.

## Dependencies at Risk

**Unpinned wildcard peer dependencies:**
- Risk: `@cinatra-ai/sdk-extensions` and `@cinatra-ai/sdk-ui` are declared as `"*"` version peers. Any breaking change in those packages will silently affect this connector with no version contract enforced.
- Impact: `src/settings-page.tsx` and `src/setup-page.tsx` both import from these packages. A breaking API change in `sdk-ui/marketplace` (e.g., `NangoUserConnectButton` prop changes) would cause a runtime or compile-time failure only caught at integration time in the monorepo.
- Migration plan: Pin to a minimum semver range (e.g., `">=0.1.0"`) once the SDK packages stabilize, or adopt workspace protocol versioning within the monorepo.

**React peer pinned to `^19.2.3`:**
- Risk: React 19 is a major version with breaking changes from React 18. Pinning to `^19.2.3` means the connector requires React 19 and will not work in workspaces still on React 18.
- Impact: Any host environment not yet on React 19 cannot use this connector.
- Migration plan: Document the React 19 requirement explicitly in README.md.

## Missing Critical Features

**No disconnect / revoke control:**
- Problem: The UI intentionally omits a disconnect button (comment in `src/settings-page.tsx` line 53-56 explains this). Users can reconnect via `NangoUserConnectButton` but cannot explicitly revoke access from within the connector UI.
- Blocks: Users who want to remove YouTube access without going through Nango's admin interface have no self-service option.

**No error code validation:**
- Problem: The `error` search param is rendered as-is with no mapping to user-friendly messages or validation against known error codes.
- Blocks: Consistent, branded error messaging; protection against misleading text in the error banner.

## Test Coverage Gaps

**Zero tests:**
- What's not tested: All component logic in `src/settings-page.tsx` and `src/setup-page.tsx` — actor resolution, nango config fetching, connection state rendering, error banner rendering, the `pickSearchParam` utility.
- Files: `src/settings-page.tsx`, `src/setup-page.tsx`
- Risk: Regressions in the OAuth connect flow, actor gating, or UI rendering will go undetected until runtime in the monorepo.
- Priority: High — the CI workflow explicitly skips tests for this repo (source mirror pattern), so there is no automated safety net at all.

---

*Concerns audit: 2026-06-09*
