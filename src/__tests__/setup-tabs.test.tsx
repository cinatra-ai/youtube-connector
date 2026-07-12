// Coverage for the spec-driven tabbed setup layout (connector-setup-tabs
// epic, cinatra-ai/youtube-connector#44): the setup page composes the shared
// `@cinatra-ai/sdk-ui` Tabs primitive into Setup, then the reserved Help tab
// ALWAYS LAST — this connector has no extra per-connector config beyond
// connecting, so per design/specs/app-connectors.html §II ("a connector that
// only needs to explain itself may carry Help and no other tab") the tablist
// is exactly these two.
//
// `@cinatra-ai/sdk-ui` is only an OPTIONAL peer dependency of this connector
// (never installed standalone — see settings-page-toast.test.tsx), so the two
// suites below split the same way that file does:
//
//   - "source contract" reads the authored source of settings-page.tsx to pin
//     tab ORDER (Help last), the shared-primitive import (no copied
//     tabs.tsx), and boundary respect (no non-SDK `@cinatra-ai/*` import).
//   - "DOM render" mocks `@cinatra-ai/sdk-ui/*` with a faithful, minimal
//     reimplementation of the real contracts (role="tablist"/"tab"/"tabpanel",
//     aria-selected, click-to-switch) to prove PRESENCE, ORDER, and CONTENT
//     MAPPING with a real @testing-library/react render — the accessible
//     keyboard-nav/roving-focus semantics themselves are Radix's, already
//     covered by the shared primitive's own suite in the cinatra monorepo;
//     this connector's contract is that it wires Setup/Help correctly.

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import * as React from "react";
import { render, cleanup, screen, within, fireEvent } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { registerYouTubeConnector, _resetYouTubeDepsForTests } from "../deps";

const SOURCE = readFileSync(join(process.cwd(), "src/settings-page.tsx"), "utf-8");

describe("settings-page.tsx — source contract (tab order + boundary + shared primitive)", () => {
  it("imports the shared sdk-ui Tabs primitive (no copied tabs.tsx)", () => {
    expect(SOURCE).toMatch(
      /import \{ Tabs, TabsContent, TabsListRow, TabsTrigger \} from "@cinatra-ai\/sdk-ui\/tabs";/,
    );
  });

  it("declares exactly two tabs — Setup then Help, in that order", () => {
    const triggerValues = [...SOURCE.matchAll(/<TabsTrigger value="([^"]+)">/g)].map(
      (m) => m[1],
    );
    expect(triggerValues).toEqual(["setup", "help"]);
  });

  it("Help is always LAST", () => {
    const triggerValues = [...SOURCE.matchAll(/<TabsTrigger value="([^"]+)">/g)].map(
      (m) => m[1],
    );
    expect(triggerValues[triggerValues.length - 1]).toBe("help");
  });

  it("declares matching TabsContent panels for both tabs", () => {
    expect(SOURCE).toMatch(/<TabsContent\s+value="setup"/);
    expect(SOURCE).toMatch(/<TabsContent\s+value="help"/);
  });

  it("stays inside the extension — no non-SDK @cinatra-ai/* import", () => {
    const cinatraImports = [...SOURCE.matchAll(/from "(@cinatra-ai\/[^"]+)"/g)].map(
      (m) => m[1],
    );
    for (const spec of cinatraImports) {
      expect(spec === "@cinatra-ai/sdk-extensions" || spec.startsWith("@cinatra-ai/sdk-ui/")).toBe(
        true,
      );
    }
  });

  it("uses the shared ConnectorSetupPage / ConnectorSetupColumns / ConnectionStatusCard shells (does not hand-roll the chrome)", () => {
    expect(SOURCE).toMatch(
      /import \{ ConnectorSetupPage \} from "@cinatra-ai\/sdk-ui\/connector-setup-page";/,
    );
    expect(SOURCE).toMatch(
      /import \{ ConnectorSetupColumns \} from "@cinatra-ai\/sdk-ui\/connector-setup-columns";/,
    );
    expect(SOURCE).toMatch(
      /import \{ ConnectionStatusCard \} from "@cinatra-ai\/sdk-ui\/connection-status-card";/,
    );
  });
});

// ---------------------------------------------------------------------------
// DOM render — faithful minimal mocks of the sdk-ui contracts this page
// composes. Kept intentionally simple (no Radix): the shared primitive's own
// accessible tab semantics (roles, aria-selected, roving focus) are proven
// once in the cinatra monorepo's tabs.test.tsx, not re-proven per connector.
// ---------------------------------------------------------------------------

const TabsCtx = React.createContext<{ value: string; setValue: (v: string) => void } | null>(
  null,
);

vi.mock("@cinatra-ai/sdk-ui/tabs", () => {
  function Tabs({
    defaultValue,
    children,
    className,
  }: {
    defaultValue: string;
    children: React.ReactNode;
    className?: string;
  }) {
    const [value, setValue] = React.useState(defaultValue);
    return (
      <TabsCtx.Provider value={{ value, setValue }}>
        <div data-slot="tabs" className={className}>
          {children}
        </div>
      </TabsCtx.Provider>
    );
  }
  function TabsListRow({
    children,
    "aria-label": ariaLabel,
  }: {
    children: React.ReactNode;
    "aria-label"?: string;
  }) {
    return (
      <div role="tablist" aria-label={ariaLabel}>
        {children}
      </div>
    );
  }
  function TabsTrigger({ value, children }: { value: string; children: React.ReactNode }) {
    const ctx = React.useContext(TabsCtx);
    if (!ctx) throw new Error("TabsTrigger rendered outside Tabs");
    const selected = ctx.value === value;
    // A `role="tab"` element (not a literal `<button>` — this is test-only
    // mock scaffolding standing in for Radix's real trigger, kept outside the
    // shadcn-wrapper carve-out on purpose) is enough for
    // @testing-library/react's role queries and click-to-switch behavior.
    return (
      <div
        role="tab"
        aria-selected={selected}
        tabIndex={selected ? 0 : -1}
        onClick={() => ctx.setValue(value)}
      >
        {children}
      </div>
    );
  }
  function TabsContent({
    value,
    children,
    className,
  }: {
    value: string;
    children: React.ReactNode;
    className?: string;
  }) {
    const ctx = React.useContext(TabsCtx);
    if (!ctx) throw new Error("TabsContent rendered outside Tabs");
    const active = ctx.value === value;
    return (
      <div role="tabpanel" data-state={active ? "active" : "inactive"} className={className} hidden={!active}>
        {children}
      </div>
    );
  }
  return { Tabs, TabsListRow, TabsTrigger, TabsContent, TabsList: TabsListRow };
});

vi.mock("@cinatra-ai/sdk-ui/connector-setup-page", () => ({
  ConnectorSetupPage: ({
    title,
    description,
    children,
  }: {
    title: string;
    description?: string;
    children: React.ReactNode;
  }) => (
    <main>
      <h1>{title}</h1>
      {description ? <p>{description}</p> : null}
      {children}
    </main>
  ),
}));

vi.mock("@cinatra-ai/sdk-ui/connector-setup-columns", () => ({
  ConnectorSetupColumns: ({
    fields,
    aside,
  }: {
    fields: React.ReactNode;
    aside: React.ReactNode;
  }) => (
    <div>
      <div data-testid="setup-fields">{fields}</div>
      <div data-testid="setup-aside">{aside}</div>
    </div>
  ),
}));

vi.mock("@cinatra-ai/sdk-ui/connection-status-card", () => ({
  ConnectionStatusCard: ({ status }: { status: string }) => (
    <div data-testid="connection-status-card">{status}</div>
  ),
}));

vi.mock("@cinatra-ai/sdk-ui/nango", () => ({
  NangoUserConnectButton: ({
    connectLabel,
    reconnectLabel,
    connected,
    disabled,
  }: {
    connectLabel?: string;
    reconnectLabel?: string;
    connected?: boolean;
    disabled?: boolean;
  }) => (
    // `role="button"` (not a literal `<button>` — see the TabsTrigger mock
    // comment above for why) is enough for the role/name/aria-disabled
    // assertions this suite makes.
    <div role="button" aria-disabled={disabled}>
      {connected ? reconnectLabel : connectLabel}
    </div>
  ),
}));

vi.mock("@cinatra-ai/sdk-ui/search-param-toast", () => ({
  SearchParamToast: () => null,
}));

// Re-import AFTER the mocks above are registered (vi.mock is hoisted).
import { YouTubeSettingsPage } from "../settings-page";

function makeCtx(opts: { connected: boolean; oauthConfigured: boolean }) {
  registerYouTubeConnector({
    oauth: {
      getStatus: async () => ({
        status: opts.oauthConfigured ? ("connected" as const) : ("not_connected" as const),
      }),
    },
  });

  const connectionRecord = opts.connected
    ? {
        connectorKey: "youtube",
        connectionId: "conn_123",
        providerConfigKey: "google",
        connectedAt: "2026-01-01T00:00:00.000Z",
        email: "ada@example.com",
      }
    : null;

  return {
    authSession: { getActor: async () => ({ userId: "user_1" }) },
    nango: {
      getFrontendConfig: async () => ({}),
      getPrimarySavedConnections: async () => ({ youtube: connectionRecord }),
    },
  } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  _resetYouTubeDepsForTests();
});

afterEach(() => {
  cleanup();
});

describe("YouTubeSettingsPage — DOM render (tab presence / order / content mapping)", () => {
  it("renders exactly two tabs, Setup then Help, with Help last", async () => {
    const ctx = makeCtx({ connected: false, oauthConfigured: true });
    render(await YouTubeSettingsPage({ ctx }));

    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(2);
    expect(tabs.map((t) => t.textContent)).toEqual(["Setup", "Help"]);
    expect(tabs[tabs.length - 1].textContent).toBe("Help");
  });

  it("Setup tab is selected by default and shows the connect action; Help panel is hidden", async () => {
    const ctx = makeCtx({ connected: false, oauthConfigured: true });
    render(await YouTubeSettingsPage({ ctx }));

    const [setupTab, helpTab] = screen.getAllByRole("tab");
    expect(setupTab.getAttribute("aria-selected")).toBe("true");
    expect(helpTab.getAttribute("aria-selected")).toBe("false");

    const panels = screen.getAllByRole("tabpanel", { hidden: true });
    const setupPanel = panels.find((p) => p.getAttribute("data-state") === "active")!;
    const helpPanel = panels.find((p) => p.getAttribute("data-state") === "inactive")!;
    expect(within(setupPanel).getByText("Connect")).toBeTruthy();
    expect(helpPanel.hidden).toBe(true);
  });

  it("clicking the Help tab switches selection and reveals Help content mapped to that tab only", async () => {
    const ctx = makeCtx({ connected: false, oauthConfigured: true });
    render(await YouTubeSettingsPage({ ctx }));

    // Avoid a hard dependency on @testing-library/user-event (not a listed
    // devDependency here) — a plain click event exercises the same onClick
    // contract the real Radix trigger fires.
    const helpTab = screen.getByRole("tab", { name: "Help" });
    fireEvent.click(helpTab);

    expect(helpTab.getAttribute("aria-selected")).toBe("true");
    const helpPanel = screen.getByText(/Prerequisite/).closest('[role="tabpanel"]') as HTMLElement;
    expect(helpPanel.hidden).toBe(false);
    expect(within(helpPanel).getByText(/Connect your account/)).toBeTruthy();
    expect(within(helpPanel).getByText(/transcript discovery/)).toBeTruthy();

    // The Setup-only connect action must not leak into the Help panel.
    expect(within(helpPanel).queryByText("Connect")).toBeNull();
  });

  it("connected state maps 'Connected as <email>' + Reconnect + a connected status card into the Setup tab", async () => {
    const ctx = makeCtx({ connected: true, oauthConfigured: true });
    render(await YouTubeSettingsPage({ ctx }));

    expect(screen.getByText("Connected as ada@example.com")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reconnect" })).toBeTruthy();
    expect(screen.getByTestId("connection-status-card").textContent).toBe("connected");
  });

  it("disconnected + unconfigured OAuth: connect button disabled, prerequisite line shown, no stale 'Not connected' copy", async () => {
    const ctx = makeCtx({ connected: false, oauthConfigured: false });
    render(await YouTubeSettingsPage({ ctx }));

    const connectButton = screen.getByRole("button", { name: "Connect" });
    expect(connectButton.getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByText(/Google OAuth credentials/)).toBeTruthy();
    expect(screen.queryByText("Not connected")).toBeNull();
    expect(screen.getByTestId("connection-status-card").textContent).toBe("disconnected");
  });
});
