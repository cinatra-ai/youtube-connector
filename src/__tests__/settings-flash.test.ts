// Codes-only flash-protocol unit coverage for the YouTube settings error
// island (cinatra-ai/cinatra#1107 epic; S1 enabler cinatra-ai/cinatra#1108,
// merged cinatra-ai/cinatra#1186). See ../settings-flash.ts for the contract:
// the mounted <SearchParamToast> must only ever be able to show one of these
// STATIC messages, never the raw `?error=` query-string text.

import { describe, expect, it } from "vitest";

import { YOUTUBE_ERROR_MESSAGES, YOUTUBE_FLASH_TOASTS } from "../settings-flash";

describe("YOUTUBE_ERROR_MESSAGES (static code -> message map)", () => {
  it("defines only known, non-empty static messages", () => {
    const codes = Object.keys(YOUTUBE_ERROR_MESSAGES);
    expect(codes.length).toBeGreaterThan(0);
    for (const code of codes) {
      const message = YOUTUBE_ERROR_MESSAGES[code as keyof typeof YOUTUBE_ERROR_MESSAGES];
      expect(typeof message).toBe("string");
      expect(message.length).toBeGreaterThan(0);
      // The message must never equal the code itself (that would be the
      // exact raw-passthrough defect this migration retires).
      expect(message).not.toBe(code);
    }
  });
});

describe("YOUTUBE_FLASH_TOASTS (SearchParamToastConfig[] built from the map)", () => {
  it("emits exactly one config entry per known code, all on the `error` param, error variant", () => {
    const codes = Object.keys(YOUTUBE_ERROR_MESSAGES);
    expect(YOUTUBE_FLASH_TOASTS).toHaveLength(codes.length);
    for (const entry of YOUTUBE_FLASH_TOASTS) {
      expect(entry.param).toBe("error");
      expect(entry.variant).toBe("error");
      expect(typeof entry.value).toBe("string");
      expect(codes).toContain(entry.value);
      // The configured message must be the STATIC map value keyed by code,
      // never anything URL-derived.
      expect(entry.message).toBe(
        YOUTUBE_ERROR_MESSAGES[entry.value as keyof typeof YOUTUBE_ERROR_MESSAGES],
      );
    }
  });

  it("has a config entry for the known connection-error code with its exact static message", () => {
    const entry = YOUTUBE_FLASH_TOASTS.find((t) => t.value === "connection-error");
    expect(entry).toBeDefined();
    expect(entry?.message).toBe(YOUTUBE_ERROR_MESSAGES["connection-error"]);
  });

  it("would ignore a code that isn't in the static map (no wildcard/passthrough entry)", () => {
    const spoofedCode = "<script>alert(1)</script>";
    const match = YOUTUBE_FLASH_TOASTS.find((t) => t.value === spoofedCode);
    expect(match).toBeUndefined();
  });
});
