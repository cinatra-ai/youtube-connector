# Testing Patterns

**Analysis Date:** 2026-06-09

## Test Framework

**Runner:** Not applicable — no test framework is installed or configured in this repo

**Assertion Library:** Not applicable

**Run Commands:**
```bash
# CI runs `pnpm test --if-present` but skips for source-mirror repos (host-internal @cinatra-ai/* peers)
# The cinatra monorepo runs the actual tests when this package is consumed as a workspace member
pnpm test --if-present   # no-op in standalone context
```

## Test File Organization

**Location:** No test files exist in this repository

**Naming:** Not applicable

**Structure:** Not applicable

## Test Structure

**Note:** This repository is a **source mirror** — a Cinatra connector extracted from the monorepo. The CI pipeline (`ci.yml`) explicitly detects this case by checking for host-internal `@cinatra-ai/*` optional peer dependencies and skips standalone install, typecheck, and test steps with the message: `"Skipping standalone tests (host-internal @cinatra-ai/* peers — the cinatra monorepo runs these)."`

Tests for this package are maintained and executed within the **cinatra monorepo**, not in this repo.

## Mocking

**Framework:** Not applicable — no tests present

**What to Mock (design guidance from source):**
- `ctx.authSession.getActor()` — returns actor with `userId`
- `ctx.nango.getFrontendConfig()` — returns Nango frontend config
- `ctx.nango.getPrimarySavedConnections()` — returns connection map keyed by connector key (e.g., `"youtube"`)

## Fixtures and Factories

**Test Data:** Not applicable

**Location:** Not applicable

## Coverage

**Requirements:** None enforced in this repo; coverage is the monorepo's responsibility

**View Coverage:** Not applicable

## Test Types

**Unit Tests:** Not present in this repo; handled by monorepo

**Integration Tests:** Not present in this repo; handled by monorepo

**E2E Tests:** Not applicable

## CI Validation (Substitute Gate)

In lieu of local tests, CI (`ci.yml`) runs these validation steps against this repo directly:

1. **Dependency-shape check** — validates that no `@cinatra-ai/*` packages leaked into `dependencies`/`devDependencies` and that all first-party peers are marked `peerDependenciesMeta.optional`
2. **Typecheck skip** — explicitly skipped for source mirrors (monorepo typechecks)
3. **Pack dry-run** — `npm pack --dry-run` validates package shape and publish payload without resolving peers
4. **Kind-specific gate** — connector kind has no additional gate (`echo "No kind-specific gate for this extension kind."`)

These gates catch packaging regressions without requiring standalone test execution.

## Common Patterns

**Async Testing:** Not applicable — no tests present

**Error Testing:** Not applicable — no tests present

---

*Testing analysis: 2026-06-09*
