# Codebase Structure

**Analysis Date:** 2026-06-09

## Directory Layout

```
youtube-connector/
├── src/                    # All TypeScript/TSX source files
│   ├── index.ts            # Package barrel (intentionally empty)
│   ├── settings-page.tsx   # Named-export settings UI component
│   └── setup-page.tsx      # Default-export dispatch-route entry point
├── .github/
│   └── workflows/
│       ├── ci.yml          # CI pipeline (build, typecheck, pack dry-run)
│       └── release.yml     # Release workflow
├── .planning/
│   └── codebase/           # GSD codebase map documents
├── .npmrc                  # npm/pnpm registry config
├── LICENSE                 # Apache-2.0
├── README.md               # Capability description
├── package.json            # Package manifest + cinatra extension metadata
└── tsconfig.json           # Standalone TypeScript config (targets src/)
```

## Directory Purposes

**`src/`:**
- Purpose: All connector source code
- Contains: Two React Server Component files and one empty barrel
- Key files: `src/settings-page.tsx`, `src/setup-page.tsx`, `src/index.ts`

**`.github/workflows/`:**
- Purpose: CI/CD automation
- Contains: Baseline CI gate (`ci.yml`) and release pipeline (`release.yml`)
- Key files: `.github/workflows/ci.yml`

**`.planning/codebase/`:**
- Purpose: GSD codebase map documents for AI-assisted planning
- Generated: Yes (by `/gsd-map-codebase`)
- Committed: Yes

## Key File Locations

**Entry Points:**
- `src/setup-page.tsx`: Default export `YouTubeConnectorSetupPage` — called by host dispatch router
- `src/settings-page.tsx`: Named export `YouTubeSettingsPage` — the actual settings UI

**Configuration:**
- `package.json`: Package identity, peer dependencies, and `cinatra` extension manifest (`kind: connector`, `requestedHostPorts: [authSession, nango]`)
- `tsconfig.json`: TypeScript compiler config (ES2023, ESNext modules, `bundler` module resolution, JSX `react-jsx`)
- `.npmrc`: Registry and auth token configuration (do not read — may contain tokens)

**Core Logic:**
- `src/settings-page.tsx`: Auth check, Nango connection fetch, connect/reconnect UI render

**CI:**
- `.github/workflows/ci.yml`: Validates first-party dep shape, conditionally installs/typechecks/tests, runs `npm pack --dry-run`

## Naming Conventions

**Files:**
- Kebab-case with purpose suffix: `settings-page.tsx`, `setup-page.tsx`
- Barrel: `index.ts`

**Directories:**
- Lowercase kebab-case: `src/`, `.planning/`, `.github/`

**Components:**
- PascalCase named exports matching the feature + suffix: `YouTubeSettingsPage`, `YouTubeConnectorSetupPage`

**Types:**
- PascalCase with `Props` suffix: `SettingsYouTubePageProps`, `ConnectorSetupPageProps`

**Helpers:**
- camelCase verbs: `pickSearchParam`

## Where to Add New Code

**New connector page (e.g., an advanced settings or diagnostics page):**
- Implementation: `src/<feature>-page.tsx` (named export, async server component)
- Wire up: Add subpath export to `package.json` `exports` field if needed
- Do NOT re-export from `src/index.ts`

**New shared helper:**
- Implementation: `src/<helper-name>.ts` (named export, pure function)
- Import into page files as needed

**New UI section within settings:**
- Add directly inside `src/settings-page.tsx` using `@cinatra-ai/sdk-ui/marketplace` components

**Tests (if added):**
- Co-locate or place in `src/__tests__/` — no test directory exists yet; follow monorepo convention when introduced

## Special Directories

**`dist/`:**
- Purpose: TypeScript compiler output (`outDir` in `tsconfig.json`)
- Generated: Yes
- Committed: No (not present in tracked files)

**`.planning/`:**
- Purpose: AI planning documents
- Generated: Yes
- Committed: Yes

---

*Structure analysis: 2026-06-09*
