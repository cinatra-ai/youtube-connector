# Coding Conventions

**Analysis Date:** 2026-06-09

## Naming Patterns

**Files:**
- `kebab-case` for filenames: `settings-page.tsx`, `setup-page.tsx`, `index.ts`
- `.tsx` extension for React components, `.ts` for non-JSX modules

**Functions/Components:**
- React components use `PascalCase`: `YouTubeSettingsPage`, `YouTubeConnectorSetupPage`
- Helper functions use `camelCase`: `pickSearchParam`
- Default export for dispatch-route entry pages (`setup-page.tsx`), named exports for reusable components (`settings-page.tsx`)

**Variables:**
- `camelCase` for all local variables and destructured props
- `SCREAMING_SNAKE_CASE` not used; constants follow `camelCase`

**Types:**
- Type aliases use `PascalCase` with a descriptive suffix: `SettingsYouTubePageProps`, `ConnectorSetupPageProps`
- Use `type` (not `interface`) for prop shapes
- Import types with `import type` (`verbatimModuleSyntax` enforced)

## Code Style

**Formatting:**
- No Prettier config detected in this repo — formatting is enforced by the parent monorepo when the package is consumed there
- Indentation: 2 spaces (observed in source files)
- Trailing commas present in multi-line object/array literals

**Linting:**
- No ESLint config detected in this standalone repo
- TypeScript `strict: true` is set in `tsconfig.json`; `noImplicitAny` is relaxed to `false`

**TypeScript:**
- `verbatimModuleSyntax: true` — all type-only imports must use `import type`
- `isolatedModules: true` — each file must be independently compilable
- Target: `ES2023`, module resolution: `bundler`
- `jsx: react-jsx` (no explicit React import required in `.tsx` files)

## Import Organization

**Order (observed):**
1. Type imports (`import type { ... }`) from `@cinatra-ai/sdk-extensions`
2. Value imports from `@cinatra-ai/sdk-ui/...`
3. Local relative imports (`./settings-page`)

**Path Aliases:**
- None defined; all non-local imports use full package names

**Peer Dependencies:**
- `react`, `@cinatra-ai/sdk-extensions`, `@cinatra-ai/sdk-ui` are declared as optional `peerDependencies` — never as `dependencies` or `devDependencies`
- CI enforces this shape via `package.json` validation in `.github/workflows/ci.yml`

## Error Handling

**Patterns:**
- Defensive `throw new Error(...)` for invariant violations that should never be reached at runtime (e.g., missing `userId` in `settings-page.tsx`)
- Error messages are namespaced with the package name: `[youtube-connector] settings-page: no userId on actor`
- Optional chaining (`?.`) and nullish coalescing (`?? {}`, `?? []`) used for nullable API results rather than try/catch

## Logging

**Framework:** None — no logger dependency present

**Patterns:**
- No `console.log` / `console.error` in source files; errors are surfaced via thrown `Error` instances or UI error messages rendered from `searchParams.error`

## Comments

**When to Comment:**
- Inline comments explain non-obvious design decisions and intentional omissions (e.g., why `NangoUserConnectButton` handles both connect and reconnect, why `scope: "user"` must be passed explicitly)
- Comments reference the Cinatra architecture/port model for future readers
- TODO/FIXME comments: none detected

**JSDoc/TSDoc:**
- Not used in this package; prop types are documented via TypeScript type aliases

## Function Design

**Size:** Functions are small and focused — largest is `YouTubeSettingsPage` at ~40 lines including JSX

**Parameters:** Props are destructured at the function signature level

**Return Values:**
- Async components return JSX (`Promise<JSX.Element>`) implicitly
- Helper functions return simple scalar values (`string | undefined`)

**Async pattern:**
- `async/await` used throughout; `Promise.all` for concurrent independent awaits (e.g., `searchParams` + `ctx.authSession.getActor()`)

## Module Design

**Exports:**
- `src/index.ts` re-exports nothing (intentionally empty, with a comment explaining consumers import sub-paths directly)
- Named export for reusable page: `export async function YouTubeSettingsPage`
- Default export for dispatch route entry: `export default async function YouTubeConnectorSetupPage`

**Barrel Files:**
- `src/index.ts` is a stub, not a barrel — sub-path imports are the intended consumer pattern (e.g., `@cinatra-ai/youtube-connector/settings-page`)

---

*Convention analysis: 2026-06-09*
