import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // *.test.tsx added alongside the pre-existing *.test.ts for the
    // toast-island DOM render coverage (cinatra-ai/cinatra#1107 — youtube
    // settings error banner -> sdk-ui toast island). jsdom is required for the
    // real @testing-library/react render() in that suite; plain *.test.ts
    // suites (e.g. register-shape) run fine under jsdom too.
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    environment: "jsdom",
  },
});
