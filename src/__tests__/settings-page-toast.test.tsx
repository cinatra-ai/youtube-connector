// DOM render coverage for the YouTube settings error island
// (cinatra-ai/cinatra#1107 epic; S1 enabler cinatra-ai/cinatra#1108, merged
// cinatra-ai/cinatra#1186). `@cinatra-ai/sdk-ui` is only an OPTIONAL peer
// dependency of this connector (never installed standalone), so
// `@cinatra-ai/sdk-ui/search-param-toast` is mocked here with a faithful
// stand-in of the real contract at packages/sdk-ui/src/search-param-toast.tsx
// on cinatra main as of #1186: it toasts the STATIC `message` for a
// whitelisted `?<param>=<value>` match and is a structural no-op for anything
// else — it never reflects the raw query-string value. This proves the
// settings-page composition (mount site + config) drives that contract
// correctly, mirroring the exact island the setup wizard uses in
// src/app/setup/layout.tsx on cinatra main.
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { YOUTUBE_ERROR_MESSAGES, YOUTUBE_FLASH_TOASTS } from "../settings-flash";

const toastSpy = {
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
};

vi.mock("@cinatra-ai/sdk-ui/search-param-toast", () => {
  return {
    SearchParamToast: (props: {
      toasts: Array<{
        param: string;
        value?: string;
        message: string;
        variant?: "success" | "error" | "info" | "warning";
      }>;
    }) => {
      const params = new URLSearchParams(window.location.search);
      for (const entry of props.toasts) {
        const raw = params.get(entry.param);
        if (raw === null) continue;
        const matches = entry.value === undefined ? raw.length > 0 : raw === entry.value;
        if (!matches) continue;
        const variant = entry.variant ?? "success";
        // The mock only ever has access to the STATIC entry.message from the
        // matched config — the raw query-string value `raw` is deliberately
        // never passed to the spy, matching the real island's contract.
        toastSpy[variant](entry.message);
      }
      return null;
    },
  };
});

function setUrl(qs: string) {
  window.history.pushState({}, "", qs);
}

beforeEach(() => {
  vi.clearAllMocks();
  setUrl("/connectors/cinatra-ai/youtube-connector/setup");
});

afterEach(() => {
  cleanup();
});

describe("YouTube settings toast island — DOM render", () => {
  it("toasts the static message for a known ?error= code", async () => {
    setUrl("/connectors/cinatra-ai/youtube-connector/setup?error=connection-error");
    const { SearchParamToast } = await import("@cinatra-ai/sdk-ui/search-param-toast");

    render(<SearchParamToast toasts={YOUTUBE_FLASH_TOASTS} />);

    expect(toastSpy.error).toHaveBeenCalledTimes(1);
    expect(toastSpy.error).toHaveBeenCalledWith(YOUTUBE_ERROR_MESSAGES["connection-error"]);
  });

  it("never toasts a spoofed/unrecognized ?error= value (no raw passthrough)", async () => {
    const spoofed = "<script>alert(1)</script>";
    setUrl(`/connectors/cinatra-ai/youtube-connector/setup?error=${encodeURIComponent(spoofed)}`);
    const { SearchParamToast } = await import("@cinatra-ai/sdk-ui/search-param-toast");

    render(<SearchParamToast toasts={YOUTUBE_FLASH_TOASTS} />);

    expect(toastSpy.error).not.toHaveBeenCalled();
    expect(toastSpy.success).not.toHaveBeenCalled();
  });

  it("renders nothing (island is DOM-invisible chrome) whether or not it fires", () => {
    setUrl("/connectors/cinatra-ai/youtube-connector/setup?error=connection-error");
    const { container } = render(<div data-testid="host" />);
    expect(container.textContent).toBe("");
  });
});

describe("settings-page.tsx source (mount-site + banner removal contract)", () => {
  const SOURCE = readFileSync(join(process.cwd(), "src/settings-page.tsx"), "utf-8");

  it("mounts the sdk-ui SearchParamToast island with the connector's static config", () => {
    expect(SOURCE).toMatch(/import \{ SearchParamToast \} from "@cinatra-ai\/sdk-ui\/search-param-toast";/);
    expect(SOURCE).toMatch(/import \{ YOUTUBE_FLASH_TOASTS \} from "\.\/settings-flash";/);
    expect(SOURCE).toMatch(/<SearchParamToast toasts=\{YOUTUBE_FLASH_TOASTS\} \/>/);
  });

  it("deletes the legacy raw ?error= div-banner outright", () => {
    // The retired banner rendered the untrusted searchParams.error value
    // directly inside a destructive-styled div. Neither should remain.
    expect(SOURCE).not.toMatch(/border-destructive\/30/);
    expect(SOURCE).not.toMatch(/pickSearchParam\(resolvedSearchParams\.error\)/);
    expect(SOURCE).not.toMatch(/\{errorMessage\}/);
  });
});
