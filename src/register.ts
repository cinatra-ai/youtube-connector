// The youtube connector's `register(ctx)` server entry.
//
// The host no longer statically wires this connector — this entry binds the
// connector's host deps AT ACTIVATION by adapting the per-concern host service
// published in the capability registry (`@cinatra-ai/host:google-oauth`). The
// adapter field resolves the host service LAZILY at call time, so activation
// order against the host's boot imports never matters.
//
// YouTube uses the SHARED Google OAuth client, so the only host surface it
// needs is the connector-level OAuth-config status — used by the settings page
// to gate the connect button (cinatra#426 `disabled` prop) before sending the
// user into a guaranteed-fail flow.
//
// SDK imports here are TYPE-ONLY (host-peer value-import gate): the host
// services arrive as DATA through `ctx.capabilities`.

import type {
  ExtensionHostContext,
  HostGoogleOAuthService,
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

export function register(ctx: ExtensionHostContext): void {
  const oauth = () =>
    hostService<HostGoogleOAuthService>(ctx, "@cinatra-ai/host:google-oauth");

  registerYouTubeConnector({
    oauth: {
      getStatus: () =>
        oauth().getStatus() as Promise<YouTubeOAuthStatusResult>,
    },
  });
}
