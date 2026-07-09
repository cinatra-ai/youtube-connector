// -----------------------------------------------------------------------------
// Codes-only flash protocol for the YouTube settings page (toast-notifications
// epic, cinatra-ai/cinatra#1107, S1 enabler cinatra-ai/cinatra#1108/#1186).
//
// Previously `src/settings-page.tsx` rendered a raw `<div>` banner containing
// the RAW `?error=` query-string value verbatim — an attacker-controlled URL
// (`/connectors/cinatra-ai/youtube-connector/setup?error=<anything>`) was
// reflected straight into the page. This module is the single source of
// truth for the STATIC replacement messages: the mounted <SearchParamToast>
// island (see settings-page.tsx) maps a known CODE to one of these static
// strings and NEVER toasts the query-string value itself, so an unrecognized
// `?error=<spoofed text>` matches no entry and is silently ignored.
// -----------------------------------------------------------------------------

import type { SearchParamToastConfig } from "@cinatra-ai/sdk-ui/search-param-toast";

export const YOUTUBE_ERROR_MESSAGES = {
  "connection-error":
    "Could not connect your YouTube account. Please try again or reconnect below.",
} as const;

export type YouTubeErrorCode = keyof typeof YOUTUBE_ERROR_MESSAGES;

// One <SearchParamToast> config entry per code: all on the `error` param,
// rendered as an error-variant toast, with the STATIC message above. Passed
// to the island mounted in settings-page.tsx.
export const YOUTUBE_FLASH_TOASTS: SearchParamToastConfig[] = Object.entries(
  YOUTUBE_ERROR_MESSAGES,
).map(([code, message]) => ({
  param: "error",
  value: code,
  message,
  variant: "error" as const,
}));
