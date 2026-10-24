# Compatible Dependency Updates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Incorporate compatible dependency updates from Dependabot #165 and #166 without weakening the existing security fix.

**Architecture:** Preserve commit `483e751`. Update production and development dependencies in separate logical changes, regenerate the shared pnpm lockfile, and retain advisory overrides unless resolution proves them unnecessary. No application behavior changes or major-version migrations are intended.

**Tech Stack:** Node 24, pnpm 11.1.3, Next.js 16, React 19, Jest 29, Playwright.

**Spec:** User-approved scope in this conversation: compatible patch/minor updates from both Dependabot groups, Next.js and eslint-config-next at 16.4.2, fix fast-uri advisories, retain the security commit, separate maintenance commits, and rerun checks including E2E when a safe test database is available.

## Global Constraints

- Work on `fix/security-cve-2026-10`; do not rewrite the existing security commit.
- No major-version upgrades, deprecated-database migration, or unrelated application refactoring.
- Pin next and eslint-config-next to 16.4.2; keep react/react-dom versions aligned.
- Preserve existing package version pins unless explicitly updating the pinned package within its major.
- Keep package.json version at 0.0.0-development.
- Do not push, create/close PRs, or merge as part of this execution.
- Never initialize or reset an unidentified database; E2E needs a confirmed disposable test database.

## Review Focus

- Dependency graph consistency: frozen installation must accept the final manifest and workspace overrides.
- AI SDK compatibility: keep providers and ai within their current major versions and run AI-related unit tests as part of the full suite.
- Form and UI behavior: run unit tests and browser tests where the environment safely supports them.
- Security floors: audit must report no remaining advisories, or explicitly document any unresolved advisories without adding suppressions.
- Browser/tooling compatibility: new Playwright browser binaries and all existing static checks must remain usable.

## Files

- `package.json`: compatible direct dependency versions, separated by production/development scope.
- `pnpm-lock.yaml`: regenerated resolution graph for each logical update.
- `pnpm-workspace.yaml`: narrow fast-uri override only if a normal transitive update does not resolve the advisories.
- This plan: execution checklist and verification results.

### Task 1: Complete the security remediation

**Interfaces:** Consume the existing lockfile and pnpm audit; produce a fixed fast-uri resolution without new advisory suppressions.

- [x] Run `pnpm audit --json` to capture the current fast-uri failures.
- [x] Update fast-uri transitively to a patched compatible 3.x release (minimum 3.1.9); add a narrowly scoped workspace override only if needed.
- [x] Run `pnpm audit` and frozen-lockfile validation; expect no vulnerabilities and no manifest/lock mismatch, or document any newly discovered advisory.
- [x] Review the security-only diff; prepare a `fix(deps)` commit separately from maintenance updates.

### Task 2: Update compatible production dependencies

**Interfaces:** Consume the secured dependency graph; produce production versions covering #165 without major migrations.

- [x] Refresh registry metadata and review #165's exact production package list.
- [x] Update compatible production dependencies, staying within each current major; retain exact pins for packages currently pinned and use next 16.4.2.
- [x] Keep AI SDK/provider versions on their existing majors and react/react-dom aligned; do not upgrade react type packages across majors.
- [x] Run `pnpm test --runInBand`, `pnpm typecheck`, and `pnpm build`; expect all passing.
- [x] Review the production-only diff; prepare a separate `chore(deps)` commit.

### Task 3: Update compatible development dependencies and verify

**Interfaces:** Consume the updated production graph; produce final development versions covering #166 and a verification report.

- [x] Update compatible development dependencies within existing majors; pin eslint-config-next to 16.4.2 and keep Jest/environment/type majors unchanged.
- [x] Run `pnpm install --frozen-lockfile`, `pnpm check`, `pnpm knip`, `pnpm test --runInBand`, `pnpm build`, and `pnpm audit`; expect passing outputs.
- [x] Inspect test-environment prerequisites without printing secrets. Run E2E across configured browsers only against a confirmed disposable database; otherwise report the blocker without touching database data.
- [x] Review final manifest/lock/override diffs for unexpected upgrades and run `git diff --check`.
- [x] Prepare a separate `chore(deps)` development-tooling commit and report checks, limitations, and remaining Dependabot overlap; do not change the external PRs.

## Execution Notes

- The fast-uri update command did not move its transitive copies; a narrow workspace override now resolves 3.1.9. Full audit: zero vulnerabilities.
- Next.js and eslint-config-next moved together in the production group to avoid an intermediate mismatch. React/react-dom are both 19.3.1; AI SDK/provider majors are unchanged.
- Pin jest-dom to 6.9.1: the registry marks 6.10.0 deprecated for accidental breaking changes and recommends 6.9.1 for the 6.x line. Future safe 6.x updates require reviewing this pin.
- Baseline and production-update runs each passed all 499 tests across 67 suites.
- E2E execution is blocked: no database connection environment variables or local environment file, and the Docker daemon is unavailable. No database or external configuration was changed. Playwright test discovery and browser download configuration were checked, not browser execution.
- The user approved four commit groups/messages. Security, production, and development changes were committed separately as `3c0de81`, `222a626`, and `ab9240b`; this document is the fourth group. No push or PR actions taken.
- Final review uses a separate self-review pass, consistent with the user's direct-execution choice; it is not an independent review.
- Final verification: frozen offline install, `pnpm check` (typecheck/lint/dependency boundaries/formatting), knip, all 499 tests in 67 suites, production build, full audit, and diff whitespace checks passed. Playwright discovers 75 tests across Chromium, Firefox, and WebKit.
- Final self-review found no blocking dependency/configuration findings. Direct package names and major versions are unchanged, framework pairs align, existing security floors remain, and no application code, scripts, environment files, or CI configuration were changed by these updates.
- Both Dependabot groups' requested manifest versions are covered or exceeded within existing majors (including the Zod fix already present). Their PRs remain open and untouched; successful browser execution remains a release-readiness limitation.
