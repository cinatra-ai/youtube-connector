// ---------------------------------------------------------------------------
// @cinatra-ai/youtube-connector — host dependency injection singleton.
//
// YouTube depends on the SHARED Google OAuth client (the same client gmail and
// google-calendar use). Its settings page needs to read the connector-level
// OAuth config status so it can gate the connect button before sending the
// user into a guaranteed-fail flow. The host owns that status; this connector
// reads it through an injected dep so it carries NO non-SDK `@cinatra-ai/*`
// code dependency (SDK-only decouple — see the gmail/google-calendar deps.ts
// for the pattern + rationale).
//
// The host binds the concrete Google-OAuth impl at activation via the
// connector's serverEntry `register(ctx)`, which adapts the per-concern host
// service published in the capability registry (`@cinatra-ai/host:google-oauth`).
// Runtime callers resolve the injected impl via `getYouTubeDeps()` on every
// call.
//
// Test compatibility: tests that load this connector directly must call
// `registerYouTubeConnector(stubDeps)` in setup.
// ---------------------------------------------------------------------------

/** Google-OAuth status result surfaced by `oauth.getStatus()`. The connector
 *  treats `status === "connected"` (the shared client is configured) as the
 *  only state in which connecting can succeed. */
export type YouTubeOAuthStatusResult = {
  status: "connected" | "incomplete" | "not_connected";
  accountEmail?: string;
  detail?: string;
};

/**
 * Structural shape of the Google-OAuth surface youtube uses. Inlined (NOT
 * imported from `@cinatra-ai/google-oauth-connection`) so the connector carries
 * no non-SDK `@cinatra-ai/*` code dependency — the host binds the concrete impl
 * at boot.
 */
export interface YouTubeOAuthCapability {
  /** Connector-level OAuth-client config status (no userId scope). Reports
   *  "connected" once the shared Google OAuth client ID + secret are
   *  configured, independent of any per-user connection. */
  getStatus(): Promise<YouTubeOAuthStatusResult>;
}

/**
 * The narrow surface of the host that youtube needs at runtime: just the
 * Google-OAuth status read (host-bound from the google-oauth-connection
 * extension via the capability registry).
 */
export interface YouTubeConnectorDeps {
  /** Google-OAuth surface (host-bound from the google-oauth-connection extension). */
  oauth: YouTubeOAuthCapability;
}

// Anchor the deps slot on `globalThis` via a namespaced+versioned Symbol so the
// activation-time registration (the connector's serverEntry `register(ctx)`,
// loaded in the instrumentation compilation) and the runtime callers — which
// live in SEPARATELY-COMPILED Next.js bundles that never import the registrar
// (the settings-page route render) — resolve the SAME slot. A module-local
// binding would leave those bundles' instance unregistered → getYouTubeDeps()
// would throw. (Same cross-compilation reason as the gmail/google-calendar deps
// slots + the SDK DI contracts.)
const YOUTUBE_DEPS_KEY = Symbol.for("@cinatra-ai/youtube-connector:host-deps/v1");
type DepsHolder = { [k: symbol]: YouTubeConnectorDeps | null | undefined };
const _holder = globalThis as unknown as DepsHolder;

/**
 * Wire the host's runtime dependencies into the youtube connector. Called once
 * at activation (the connector's serverEntry `register(ctx)`).
 *
 * Re-calling replaces the previous wiring — tests can use this to swap in
 * stubs between `describe` blocks.
 */
export function registerYouTubeConnector(deps: YouTubeConnectorDeps): void {
  _holder[YOUTUBE_DEPS_KEY] = deps;
}

/**
 * Resolve injected host deps. Throws loud if `registerYouTubeConnector` has not
 * been called — preferred over silent fallback because a missing registration
 * is always a boot-wiring bug. Callers that must degrade gracefully (e.g. the
 * settings page, which fails CLOSED on unknown OAuth config) wrap this in a
 * try/catch.
 */
export function getYouTubeDeps(): YouTubeConnectorDeps {
  const deps = _holder[YOUTUBE_DEPS_KEY];
  if (!deps) {
    throw new Error(
      "@cinatra-ai/youtube-connector: host runtime deps not registered. " +
        "The connector's serverEntry register(ctx) binds them at activation " +
        "(tests: call registerYouTubeConnector(stubDeps) in setup).",
    );
  }
  return deps;
}

/**
 * @internal Only for tests — clear deps so a fresh registration is required.
 */
export function _resetYouTubeDepsForTests(): void {
  _holder[YOUTUBE_DEPS_KEY] = null;
}
