# Technology Stack

**Analysis Date:** 2026-06-09

## Languages

**Primary:**
- TypeScript (strict mode) - All source files under `src/`
- TSX - React component files (`src/settings-page.tsx`, `src/setup-page.tsx`)

**Secondary:**
- Not applicable

## Runtime

**Environment:**
- ES2023 target, ESNext module format (see `tsconfig.json`)
- Runs as a Cinatra AI connector plugin — hosted inside the Cinatra extension runtime, not a standalone server

**Package Manager:**
- npm (`.npmrc` present — note existence only, contents not read)
- Lockfile: Not detected in repo root (likely managed by consuming monorepo or workspace)

## Frameworks

**Core:**
- React 19 (`^19.2.3`) — peer dependency; JSX transform via `react-jsx` (`tsconfig.json`)

**Testing:**
- Not detected — no test files, no jest/vitest config present

**Build/Dev:**
- TypeScript compiler (`tsc`) — configured via `tsconfig.json`; outputs to `dist/`, source maps and declaration maps enabled
- Module resolution: `bundler` mode (see `tsconfig.json` `moduleResolution`)

## Key Dependencies

**Critical (peer dependencies):**
- `react` `^19.2.3` — UI rendering; required by JSX components in `src/settings-page.tsx` and `src/setup-page.tsx`
- `@cinatra-ai/sdk-extensions` `*` — provides `ExtensionHostContext` type; host port injection for `authSession` and `nango`; imported in `src/settings-page.tsx` and `src/setup-page.tsx`
- `@cinatra-ai/sdk-ui` `*` (optional) — provides marketplace UI primitives (`Main`, `PageHeader`, `PageContent`, `NangoUserConnectButton`); imported from `@cinatra-ai/sdk-ui/marketplace` in `src/settings-page.tsx`

**Infrastructure:**
- No runtime infrastructure dependencies (no express, no database clients, no HTTP clients)

## Configuration

**Environment:**
- `.npmrc` file present — note existence only, not read
- No `.env` files detected

**Build:**
- `tsconfig.json` — standalone strict TypeScript config; targets `src/`, outputs to `dist/`
- `package.json` — declares Cinatra connector manifest under `"cinatra"` key:
  - `apiVersion: cinatra.ai/v1`
  - `kind: connector`
  - `requestedHostPorts: ["authSession", "nango"]`

## Platform Requirements

**Development:**
- Node.js (version not pinned; no `.nvmrc` or `.node-version` detected)
- TypeScript toolchain

**Production:**
- Deployed as a Cinatra AI connector plugin; the host runtime provides `authSession` and `nango` ports via `ExtensionHostContext`
- No standalone server or container deployment — runs embedded in the Cinatra extension host

---

*Stack analysis: 2026-06-09*
