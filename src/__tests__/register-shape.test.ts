// `register(ctx)` shape — mirrors the github/gmail/google-calendar
// serverEntry pattern: the connector binds its host deps slot itself
// (always-bind, lazy per-call host-service resolution over
// `@cinatra-ai/host:google-oauth`). Registration must stay REGISTRATION-ONLY
// (no I/O at activation — probe safety: required/guarded activation must
// never perform I/O), and an unbound slot must fail LOUD naming the package
// and the registration step.

import { describe, expect, it, vi, beforeEach } from "vitest";

import { register } from "../register";
import { getYouTubeDeps, registerYouTubeConnector, _resetYouTubeDepsForTests } from "../deps";

function activateWithServices(impls: Record<string, unknown>) {
  const resolveProviders = vi.fn((capability: string) =>
    impls[capability] !== undefined
      ? [{ packageName: "@cinatra-ai/host", impl: impls[capability] }]
      : [],
  );
  const ctx = {
    capabilities: { registerProvider: () => {}, resolveProviders },
  } as never;
  register(ctx);
  return { resolveProviders };
}

const CONNECTED_STATUS = {
  status: "connected" as const,
  accountEmail: "ada@example.com",
};

beforeEach(() => {
  vi.clearAllMocks();
  _resetYouTubeDepsForTests();
});

describe("register(ctx) — deps binding", () => {
  it("binds the deps slot at activation, resolving the host service LAZILY at call time", async () => {
    const getStatus = vi.fn(async () => CONNECTED_STATUS);
    const { resolveProviders } = activateWithServices({
      "@cinatra-ai/host:google-oauth": { getStatus },
    });
    // No host-service resolution happened at registration (probe-safe), but
    // the slot IS bound — settings-page bundles resolving it later succeed.
    expect(resolveProviders).not.toHaveBeenCalled();
    expect(getStatus).not.toHaveBeenCalled();

    await expect(getYouTubeDeps().oauth.getStatus()).resolves.toEqual(CONNECTED_STATUS);
    expect(getStatus).toHaveBeenCalledTimes(1);
  });

  it("REPLACES a pre-bound deps slot (always-bind — a hot-update digest swap re-binds fresh resolvers)", async () => {
    const sentinel = vi.fn(async () => CONNECTED_STATUS);
    registerYouTubeConnector({ oauth: { getStatus: sentinel } });
    activateWithServices({
      "@cinatra-ai/host:google-oauth": {
        getStatus: async () => ({ status: "not_connected" as const }),
      },
    });
    await expect(getYouTubeDeps().oauth.getStatus()).resolves.toMatchObject({
      status: "not_connected",
    });
    expect(sentinel).not.toHaveBeenCalled();
  });

  it("fails LOUD (descriptive) on a missing host service at call time", () => {
    activateWithServices({});
    expect(() => getYouTubeDeps().oauth.getStatus()).toThrow(
      /host service "@cinatra-ai\/host:google-oauth" is not registered/,
    );
  });

  it("fails LOUD with the package name + registration step when the SLOT itself is unbound", () => {
    // No register(ctx) ran at all (e.g. a settings-page bundle resolving the
    // slot before activation): the getter must name the package and the
    // missing registration step.
    expect(() => getYouTubeDeps()).toThrow(
      /@cinatra-ai\/youtube-connector: host runtime deps not registered[\s\S]*registerYouTubeConnector/,
    );
  });
});
