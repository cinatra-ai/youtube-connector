// The youtube connector's `register(ctx)` server entry.
//
// The host no longer statically wires this connector — this entry binds the
// connector's host deps AT ACTIVATION by adapting the per-concern host service
// published in the capability registry (`@cinatra-ai/host:google-oauth`). The
// adapter field resolves the host service LAZILY at call time, so activation
// order against the host's boot imports never matters.
//
// YouTube uses the SHARED Google OAuth client, so the only host surface the
// SETTINGS PAGE needs is the connector-level OAuth-config status — used to
// gate the connect button (cinatra#426 `disabled` prop) before sending the
// user into a guaranteed-fail flow.
//
// Since cinatra#975 Wave 3 this entry ALSO registers the connector-owned
// youtube connection client (the former core `@/lib/youtube-api`) as the
// `@cinatra-ai/host:youtube-connection` capability — see the module section
// below.
//
// SDK imports here are TYPE-ONLY (host-peer value-import gate): the host
// services arrive as DATA through `ctx.capabilities`.

import type {
  ExtensionHostContext,
  HostGoogleOAuthService,
  HostInstanceConnectionGateService,
  HostYouTubeConnectionService,
  NangoSystemSurface,
} from "@cinatra-ai/sdk-extensions";
import { registerYouTubeConnector, type YouTubeOAuthStatusResult } from "./deps";

const PACKAGE_NAME = "@cinatra-ai/youtube-connector";

// Lazy per-concern host-service resolution (the capability id is an inlined
// string literal — the SDK constants are values and this graph must stay
// type-only).
function hostService<T>(ctx: ExtensionHostContext, capability: string): T {
  const provider = ctx.capabilities.resolveProviders(capability)[0];
  if (!provider) {
    throw new Error(
      `${PACKAGE_NAME}: host service "${capability}" is not registered — ` +
        `the host boot wiring (register-host-connector-services) must run before connector calls.`,
    );
  }
  return provider.impl as T;
}

// --- youtube connection client (cinatra#975 Wave 3 — vendor-client
// inversion, epic #978) -------------------------------------------------------
// This connector now OWNS the youtube connection client: it INVERTED out of
// core (`@/lib/youtube-api`) and is registered as the existing
// `@cinatra-ai/host:youtube-connection` capability (in register() below) — a
// provider flip under the SAME id the host has published since cinatra#172
// Stage H4, so the consumer (the media-feeds scraper's deps adapter) keeps
// resolving it unchanged. Persistence rides the connector-authored
// `nango-system` capability (the identical surface core's `@/lib/nango-system`
// resolver wraps); authorization rides the host-published
// `@cinatra-ai/host:instance-connection-gate` seam (cinatra#1077) — the gate
// decision, the audit rows and the InternalWorker actor construction all stay
// HOST-side (authz stays core — #975).
//
// Behavior byte-equivalent to the core client:
//   - The mint is a GLOBAL, actor-less reader: it resolves ONLY an app-scoped
//     saved connection ({ scope: "app" } — a per-user record is invisible) and
//     FAILS CLOSED to null; it never falls back to the legacy default
//     provider/connection ids.
//   - The per-connection use-gate (cinatra#952 W2) runs through
//     `authorizeWorkerConnectionUse` — the actor-less worker gate that IS the
//     youtube-api scraper-mint pattern: no seeding; no identity row AND a
//     use-gate deny both fold to a bare `false` (return null — do not use the
//     credential; the deny is still audited host-side); any other error stays
//     fail-loud. The audit `source` label stays EXACTLY the core client's
//     ("youtube-api" — audit-source parity).
//   - The OAUTH2 credential-shape check + trim guard are verbatim.
// The minted bearer is returned IN-PROCESS to the media-feeds scraper and is
// never logged.
const YOUTUBE_CONNECTOR_KEY = "youtube";
const YOUTUBE_APP_SCOPE = { scope: "app" } as const;
const YOUTUBE_AUDIT_SOURCE = "youtube-api";

/** The full connection surface this connector registers under the existing
 * `@cinatra-ai/host:youtube-connection` id: the contract's
 * `getConfiguredAccessToken` mint PLUS the app-scoped status/clear members the
 * core `@/lib/youtube-api` module exported (`getYouTubeAPIStatus` /
 * `clearYouTubeAPISettings`) — carried here so the follow-up core-eviction PR
 * can re-point core's setup-status consumer at this capability. */
export type YouTubeConnectionProvider = HostYouTubeConnectionService & {
  /** App-scoped connection status (core's `getYouTubeAPIStatus`, verbatim). */
  getStatus(): { status: "connected" | "not_connected"; detail: string };
  /** App-scoped disconnect (core's `clearYouTubeAPISettings`, verbatim). */
  clearSettings(): Promise<void>;
};

/** Build the connection-client impl this connector registers. Every member
 * resolves its host capability LAZILY at call time (no resolution at
 * construction — probe-safe), and fails LOUD through hostService() when a
 * capability was never published. */
function buildYouTubeConnectionProvider(ctx: ExtensionHostContext): YouTubeConnectionProvider {
  const nango = () => hostService<NangoSystemSurface>(ctx, "nango-system");
  const gate = () =>
    hostService<HostInstanceConnectionGateService>(
      ctx,
      "@cinatra-ai/host:instance-connection-gate",
    );
  return {
    getConfiguredAccessToken: async () => {
      if (!nango().isNangoConfigured()) {
        return null;
      }

      const savedConnection = nango().getPrimarySavedNangoConnection(
        YOUTUBE_CONNECTOR_KEY,
        YOUTUBE_APP_SCOPE,
      );
      if (!savedConnection) {
        return null;
      }

      // Per-connection use-gate (cinatra#952 W2) through the host seam
      // (cinatra#1077): the host reads the identity row, builds the
      // InternalWorker actor bound to the identity row's organization and
      // audits the decision. `false` covers BOTH a missing identity row and a
      // deny — the same null contract the core client folded them to.
      const authorized = await gate().authorizeWorkerConnectionUse({
        connectorKey: YOUTUBE_CONNECTOR_KEY,
        connectionId: savedConnection.connectionId,
        source: YOUTUBE_AUDIT_SOURCE,
      });
      if (!authorized) {
        return null;
      }

      const connection = await nango().getNangoConnection(
        savedConnection.providerConfigKey,
        savedConnection.connectionId,
        { forceRefresh: true, refreshToken: true },
      );
      const credentials = (connection as {
        credentials?: {
          type?: string;
          access_token?: string;
        };
      } | null)?.credentials;

      if (credentials?.type === "OAUTH2" && typeof credentials.access_token === "string" && credentials.access_token.trim()) {
        return credentials.access_token;
      }

      return null;
    },
    getStatus: () => {
      const savedConnection = nango().getPrimarySavedNangoConnection(
        YOUTUBE_CONNECTOR_KEY,
        YOUTUBE_APP_SCOPE,
      );
      if (savedConnection) {
        return {
          status: "connected" as const,
          detail: `Connected${savedConnection.displayName ? ` as ${savedConnection.displayName}` : ""}.`,
        };
      }

      return {
        status: "not_connected" as const,
        detail: "Connect your YouTube account to enable YouTube episode discovery.",
      };
    },
    clearSettings: async () => {
      const savedConnection = nango().getPrimarySavedNangoConnection(
        YOUTUBE_CONNECTOR_KEY,
        YOUTUBE_APP_SCOPE,
      );
      if (savedConnection) {
        await nango().deleteNangoConnection(
          savedConnection.providerConfigKey,
          savedConnection.connectionId,
        );
      }
      // Scope the record clear to the app: this is the GLOBAL, actor-less
      // surface, so it must only ever touch app-scoped pointers — clearing
      // without a scope would also wipe per-user YouTube connection records.
      await nango().clearNangoConnectionRecords(YOUTUBE_CONNECTOR_KEY, YOUTUBE_APP_SCOPE);
    },
  };
}

export function register(ctx: ExtensionHostContext): void {
  const oauth = () =>
    hostService<HostGoogleOAuthService>(ctx, "@cinatra-ai/host:google-oauth");

  registerYouTubeConnector({
    oauth: {
      getStatus: () =>
        oauth().getStatus() as Promise<YouTubeOAuthStatusResult>,
    },
  });

  // cinatra#975 Wave 3 — register the connector-owned youtube connection
  // client as the `@cinatra-ai/host:youtube-connection` capability (provider
  // flip under the SAME existing id; during merge skew the host's own boot
  // registration stays first in resolution order, and the follow-up core
  // eviction PR retires it). Building the impl does no host-service
  // resolution (probe-safe) — every member resolves `nango-system` /
  // `@cinatra-ai/host:instance-connection-gate` at call time.
  ctx.capabilities.registerProvider("@cinatra-ai/host:youtube-connection", {
    packageName: PACKAGE_NAME,
    impl: buildYouTubeConnectionProvider(ctx),
  });
}
