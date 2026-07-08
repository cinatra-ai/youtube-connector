# Changelog

All notable changes to this project are documented here, derived from the
project's merged pull request and release-tag history.

## v0.1.4 — 2026-07-07

Pairs with Cinatra 0.1.7, which removes the core YouTube client.

- feat: own the YouTube connection client, relocated from Cinatra core and registered under the same existing host capability id (provider flip, no contract change), persisting and authorizing through published host capabilities including the instance-connection gate (cinatra#975 W3) (#36)

## v0.1.3 — 2026-07-04

- feat: final connection access-scoping declaration — default scope "user" (cinatra#954 W4) (#35)
- test: add register(ctx) shape coverage + drop stray package-lock.json (#31)
- chore: add cinatra.vendor connector provenance metadata (#32)
- chore(deps): declare cinatra.consumes for closure-gate enrollment (#33)
- docs: expand README to the org standard (#19) (#20); CHANGELOG reconstructed from tag + merged-PR history (#34)
- chore: strip private tracker references from public source and workflow comments (#25, #28)
- ci: ramp the ui-gate raw-JSX block to error (#21); adopt source-leak-gate (#22, #23); re-vendor the ui-gate preset with the dynamic-import ban (#24); pin the release workflow to the gated reusable extension-release flow (release-approval wall) (#29)

## v0.1.2 — 2026-06-25

- feat: gate YouTube connect button on Google OAuth config state (#16) (#18)

## v0.1.1 — 2026-06-23

- ci: adopt source-leak-gate (#1)
- ci: adopt source-leak-gate (#2)
- chore: add .gitignore (#3)
- ci: adopt org gates — SHA-pin all remote uses: refs, bump leak-gate to v0.1.0, add pinned+gitignore gate callers (#4)
- chore: keep internal planning notes untracked (#5)
- chore: npm packaging hygiene — files allowlist + source-archive export-ignore (#6)
- ci: adopt the org ui-design-system gate (#7)
- ci(release): grant contents: write + pin reusable workflow to .github HEAD (#8)
- chore: Configure Renovate (#9)
- ci: repin reusable release workflow (immutable-safe decoration + corrected build-input provisioning) (#11)
- ci: add truthful-attribution-gate in WARN (advisory) mode (#12)
- ci: adopt the reusable extension->host IoC conformance gate (org-wide rollout) (#13)
- ci: tag-driven GitHub release on v* (#14)
- ci: adopt secret-scan-gate (#15)
- release: v0.1.1 (#17)

## v0.1.0 — 2026-06-03

- Initial release.

