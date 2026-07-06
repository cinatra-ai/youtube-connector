// The connector-owned youtube connection client (cinatra#975 Wave 3 —
// vendor-client inversion, epic #978): `register(ctx)` registers it as the
// existing `@cinatra-ai/host:youtube-connection` capability, and its behavior
// must stay byte-equivalent to the core `@/lib/youtube-api` client it
// relocates. These pins MIRROR core's youtube-api.test.ts matrix (the GLOBAL,
// actor-less mint reads ONLY an app-scoped Nango connection and fails CLOSED;
// no legacy default-id fallback) and ADD the seam pins the relocation
// introduces: the worker use-gate rides
// `@cinatra-ai/host:instance-connection-gate` with the EXACT core audit
// source label ("youtube-api"), a gate `false` suppresses the mint, an
// unexpected gate error stays fail-loud, and an unpublished capability fails
// LOUD naming the capability.

import { describe, expect, it, vi, beforeEach } from "vitest";

import { register, type YouTubeConnectionProvider } from "../register";
import { _resetYouTubeDepsForTests } from "../deps";

const YOUTUBE_CONNECTION_CAPABILITY = "@cinatra-ai/host:youtube-connection";

type SavedRecord = {
  connectorKey: string;
  providerConfigKey: string;
  connectionId: string;
  scope?: "app" | "user";
  userId?: string;
  displayName?: string;
};

/** Stub of the nango-system surface subset the client uses. Honors the scope
 * filter the way the real nango-connector does: with no scope option ALL
 * records are visible (the pre-fix leak); with { scope: "app" } only
 * app-scoped records return. */
function buildNangoSurface(records: SavedRecord[], { configured = true } = {}) {
  const mintCalls: Array<{ providerConfigKey: string; connectionId: string; options?: unknown }> = [];
  const clearCalls: Array<{ connectorKey: string; options?: { scope?: "app" | "user"; userId?: string } }> = [];
  const deleteCalls: Array<{ providerConfigKey: string; connectionId: string }> = [];
  const impl = {
    isNangoConfigured: () => configured,
    listSavedNangoConnections: (connectorKey: string, options?: { scope?: "app" | "user"; userId?: string }) => {
      let pool = records.filter((r) => r.connectorKey === connectorKey);
      if (options?.scope) {
        pool = pool.filter((r) => (r.scope ?? "app") === options.scope);
        if (options.userId) pool = pool.filter((r) => r.userId === options.userId);
      }
      return pool;
    },
    getPrimarySavedNangoConnection: (connectorKey: string, options?: { scope?: "app" | "user"; userId?: string }) => {
      return impl.listSavedNangoConnections(connectorKey, options)[0] ?? null;
    },
    getNangoConnection: async (providerConfigKey: string, connectionId: string, options?: unknown) => {
      mintCalls.push({ providerConfigKey, connectionId, options });
      return { credentials: { type: "OAUTH2", access_token: `token-for-${connectionId}` } };
    },
    deleteNangoConnection: async (providerConfigKey: string, connectionId: string) => {
      deleteCalls.push({ providerConfigKey, connectionId });
    },
    clearNangoConnectionRecords: async (connectorKey: string, options?: { scope?: "app" | "user"; userId?: string }) => {
      clearCalls.push({ connectorKey, options });
    },
  };
  return { impl, mintCalls, clearCalls, deleteCalls };
}

/** Permissive worker-gate stub (the deny/no-identity matrix is pinned
 * per-test by overriding `authorize`). */
function buildGate(authorize: (input: unknown) => Promise<boolean> = async () => true) {
  const authorizeWorkerConnectionUse = vi.fn(authorize);
  return { impl: { authorizeWorkerConnectionUse }, authorizeWorkerConnectionUse };
}

/** Activate register(ctx) against stub host capabilities and capture the
 * provider the connector registers. */
function activate(impls: Record<string, unknown>) {
  const registered = new Map<string, { packageName: string; impl: unknown }>();
  const resolveProviders = vi.fn((capability: string) =>
    impls[capability] !== undefined
      ? [{ packageName: "@cinatra-ai/host", impl: impls[capability] }]
      : [],
  );
  const ctx = {
    capabilities: {
      registerProvider: (capability: string, provider: { packageName: string; impl: unknown }) => {
        registered.set(capability, provider);
      },
      resolveProviders,
    },
  } as never;
  register(ctx);
  const provider = registered.get(YOUTUBE_CONNECTION_CAPABILITY);
  return {
    registered,
    resolveProviders,
    provider,
    client: provider?.impl as YouTubeConnectionProvider,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  _resetYouTubeDepsForTests();
});

describe("register(ctx) — youtube-connection provider flip (#975 Wave 3)", () => {
  it("registers the client under the EXISTING host capability id, keyed to this package", () => {
    const { provider, resolveProviders } = activate({});
    expect(provider?.packageName).toBe("@cinatra-ai/youtube-connector");
    expect(provider?.impl).toBeTruthy();
    // Probe-safe: registration performed NO host-service resolution.
    expect(resolveProviders).not.toHaveBeenCalled();
  });

  it("fails LOUD (descriptive) when the nango-system capability was never published", async () => {
    const { client } = activate({});
    await expect(client.getConfiguredAccessToken()).rejects.toThrow(
      /host service "nango-system" is not registered/,
    );
  });

  it("fails LOUD when the instance-connection-gate capability was never published", async () => {
    const { impl } = buildNangoSurface([
      { connectorKey: "youtube", providerConfigKey: "cinatra-youtube-app", connectionId: "app-conn", scope: "app" },
    ]);
    const { client } = activate({ "nango-system": impl });
    await expect(client.getConfiguredAccessToken()).rejects.toThrow(
      /host service "@cinatra-ai\/host:instance-connection-gate" is not registered/,
    );
  });
});

describe("getConfiguredAccessToken — global actor-less mint (core #272 parity)", () => {
  it("returns null when Nango is unconfigured (no record read, no gate, no mint)", async () => {
    const { impl, mintCalls } = buildNangoSurface([], { configured: false });
    const gate = buildGate();
    const { client } = activate({
      "nango-system": impl,
      "@cinatra-ai/host:instance-connection-gate": gate.impl,
    });

    await expect(client.getConfiguredAccessToken()).resolves.toBeNull();
    expect(mintCalls).toHaveLength(0);
    expect(gate.authorizeWorkerConnectionUse).not.toHaveBeenCalled();
  });

  it("does NOT return a user-scoped token to the global reader (fails closed)", async () => {
    const { impl, mintCalls } = buildNangoSurface([
      {
        connectorKey: "youtube",
        providerConfigKey: "cinatra-youtube",
        connectionId: "user-alice",
        scope: "user",
        userId: "alice",
      },
    ]);
    const gate = buildGate();
    const { client } = activate({
      "nango-system": impl,
      "@cinatra-ai/host:instance-connection-gate": gate.impl,
    });

    await expect(client.getConfiguredAccessToken()).resolves.toBeNull();
    // Critically: no mint attempt at all — no fallback to default ids — and
    // no gate probe for an invisible record.
    expect(mintCalls).toHaveLength(0);
    expect(gate.authorizeWorkerConnectionUse).not.toHaveBeenCalled();
  });

  it("mints from an app-scoped saved connection through the worker gate with the EXACT core audit-source label", async () => {
    const { impl, mintCalls } = buildNangoSurface([
      { connectorKey: "youtube", providerConfigKey: "cinatra-youtube-app", connectionId: "app-conn", scope: "app" },
    ]);
    const gate = buildGate();
    const { client } = activate({
      "nango-system": impl,
      "@cinatra-ai/host:instance-connection-gate": gate.impl,
    });

    await expect(client.getConfiguredAccessToken()).resolves.toBe("token-for-app-conn");
    // Audit-source parity: the seam receives the identical source label the
    // core client passed to enforceConnectionUse ("youtube-api").
    expect(gate.authorizeWorkerConnectionUse).toHaveBeenCalledExactlyOnceWith({
      connectorKey: "youtube",
      connectionId: "app-conn",
      source: "youtube-api",
    });
    // The credential refresh options are the core client's, verbatim.
    expect(mintCalls).toEqual([
      {
        providerConfigKey: "cinatra-youtube-app",
        connectionId: "app-conn",
        options: { forceRefresh: true, refreshToken: true },
      },
    ]);
  });

  it("prefers the app-scoped record even when a user-scoped one is also present", async () => {
    const { impl, mintCalls } = buildNangoSurface([
      {
        connectorKey: "youtube",
        providerConfigKey: "cinatra-youtube",
        connectionId: "user-alice",
        scope: "user",
        userId: "alice",
      },
      { connectorKey: "youtube", providerConfigKey: "cinatra-youtube-app", connectionId: "app-conn", scope: "app" },
    ]);
    const gate = buildGate();
    const { client } = activate({
      "nango-system": impl,
      "@cinatra-ai/host:instance-connection-gate": gate.impl,
    });

    await expect(client.getConfiguredAccessToken()).resolves.toBe("token-for-app-conn");
    expect(mintCalls.map(({ providerConfigKey, connectionId }) => ({ providerConfigKey, connectionId }))).toEqual([
      { providerConfigKey: "cinatra-youtube-app", connectionId: "app-conn" },
    ]);
  });

  it("returns null (no fallback default mint) when no saved connection exists", async () => {
    const { impl, mintCalls } = buildNangoSurface([]);
    const gate = buildGate();
    const { client } = activate({
      "nango-system": impl,
      "@cinatra-ai/host:instance-connection-gate": gate.impl,
    });

    await expect(client.getConfiguredAccessToken()).resolves.toBeNull();
    expect(mintCalls).toHaveLength(0);
  });

  it("returns null WITHOUT minting when the worker gate resolves false (deny OR no identity row — fail closed)", async () => {
    const { impl, mintCalls } = buildNangoSurface([
      { connectorKey: "youtube", providerConfigKey: "cinatra-youtube-app", connectionId: "app-conn", scope: "app" },
    ]);
    const gate = buildGate(async () => false);
    const { client } = activate({
      "nango-system": impl,
      "@cinatra-ai/host:instance-connection-gate": gate.impl,
    });

    await expect(client.getConfiguredAccessToken()).resolves.toBeNull();
    expect(mintCalls).toHaveLength(0);
  });

  it("rethrows an unexpected gate error (fail-loud — only deny/no-identity fold to null)", async () => {
    const { impl, mintCalls } = buildNangoSurface([
      { connectorKey: "youtube", providerConfigKey: "cinatra-youtube-app", connectionId: "app-conn", scope: "app" },
    ]);
    const gate = buildGate(async () => {
      throw new Error("audit store unavailable");
    });
    const { client } = activate({
      "nango-system": impl,
      "@cinatra-ai/host:instance-connection-gate": gate.impl,
    });

    await expect(client.getConfiguredAccessToken()).rejects.toThrow("audit store unavailable");
    expect(mintCalls).toHaveLength(0);
  });

  it("returns null for a non-OAUTH2 or blank credential shape", async () => {
    const { impl } = buildNangoSurface([
      { connectorKey: "youtube", providerConfigKey: "cinatra-youtube-app", connectionId: "app-conn", scope: "app" },
    ]);
    impl.getNangoConnection = async () => ({ credentials: { type: "BASIC", access_token: "   " } });
    const gate = buildGate();
    const { client } = activate({
      "nango-system": impl,
      "@cinatra-ai/host:instance-connection-gate": gate.impl,
    });

    await expect(client.getConfiguredAccessToken()).resolves.toBeNull();
  });
});

describe("getStatus — app-scoped view (core #272 parity)", () => {
  it("reports not_connected when only a user-scoped record exists", () => {
    const { impl } = buildNangoSurface([
      {
        connectorKey: "youtube",
        providerConfigKey: "cinatra-youtube",
        connectionId: "user-alice",
        scope: "user",
        userId: "alice",
      },
    ]);
    const { client } = activate({ "nango-system": impl });

    const status = client.getStatus();
    expect(status.status).toBe("not_connected");
    expect(status.detail).toBe(
      "Connect your YouTube account to enable YouTube episode discovery.",
    );
  });

  it("reports connected for an app-scoped record (displayName in the detail)", () => {
    const { impl } = buildNangoSurface([
      {
        connectorKey: "youtube",
        providerConfigKey: "cinatra-youtube-app",
        connectionId: "app-conn",
        scope: "app",
        displayName: "Brand Channel",
      },
    ]);
    const { client } = activate({ "nango-system": impl });

    const status = client.getStatus();
    expect(status.status).toBe("connected");
    expect(status.detail).toBe("Connected as Brand Channel.");
  });
});

describe("clearSettings — app-scoped clear (core #272 parity)", () => {
  it("deletes the app-scoped primary connection and clears records ONLY in the app scope", async () => {
    const { impl, clearCalls, deleteCalls } = buildNangoSurface([
      { connectorKey: "youtube", providerConfigKey: "cinatra-youtube-app", connectionId: "app-conn", scope: "app" },
    ]);
    const { client } = activate({ "nango-system": impl });

    await client.clearSettings();

    expect(deleteCalls).toEqual([
      { providerConfigKey: "cinatra-youtube-app", connectionId: "app-conn" },
    ]);
    expect(clearCalls).toHaveLength(1);
    expect(clearCalls[0].connectorKey).toBe("youtube");
    expect(clearCalls[0].options).toEqual({ scope: "app" });
  });

  it("deletes nothing when only a user-scoped record exists (invisible to the app scope)", async () => {
    const { impl, clearCalls, deleteCalls } = buildNangoSurface([
      {
        connectorKey: "youtube",
        providerConfigKey: "cinatra-youtube",
        connectionId: "user-alice",
        scope: "user",
        userId: "alice",
      },
    ]);
    const { client } = activate({ "nango-system": impl });

    await client.clearSettings();

    // No app-scoped connection → nothing deleted; the user record is
    // untouched (the clear itself stays app-scoped).
    expect(deleteCalls).toHaveLength(0);
    expect(clearCalls).toEqual([{ connectorKey: "youtube", options: { scope: "app" } }]);
  });
});
