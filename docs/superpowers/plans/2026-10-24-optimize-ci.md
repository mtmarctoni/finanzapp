# CI Runtime Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce total GitHub Actions runner time without removing existing checks, browser coverage, or merge protection.

**Architecture:** Collapse the nine non-E2E CI jobs into one fail-fast quality/build job with one dependency installation. Keep `e2e-tests` as the existing required check and explicitly fail it when prerequisites fail rather than silently skipping it. Remove unnecessary CodeQL setup and bound Dependabot retries to relevant failed work.

**Tech Stack:** GitHub Actions, Ubuntu 24.04, Node 24, pnpm 11.1.3, existing Jest/Playwright checks, dependency-free Node test runner, GitHub CLI.

**Spec:** The CI audit and recommendations in this conversation, followed by the user's instruction to optimize the repository. This first pass implements the coverage-preserving recommendations only.

## Execution Status

- [x] Task 1: consolidated CI with tested fail-closed E2E guards.
- [x] Task 2: removed CodeQL application installation; retained scan coverage and check identity.
- [x] Task 3: tested current-head-only, failed-job-only, bounded Dependabot retries.
- [x] Local verification and independent review: 499 application tests and 24 CI tests passed; lint, types, formatting, architecture, Knip, workflow/shell lint, and frozen-lockfile installation passed. Reviewer found no blocking code issues.
- [ ] Hosted verification after approved publication: runtime savings and CodeQL/E2E execution remain unmeasured. Implementation is recorded on the feature branch; no pushes, repository setting changes, or remote workflow executions were performed.

Existing dependency blockers were preserved, not bypassed: audit fails on Next.js,
Zod and Undici advisories; Next.js 16.4.0 stops the build with SecurityFatalError
after compilation/type checking/prerendering. Their locked versions are unchanged.
Dependabot E2E also still requires separately approved database-secret configuration.

Review follow-up: the consolidated quality job has a 10-minute ceiling; inspect
hosted timeout headroom before lowering it further. All three browsers and all
original checks/triggers are retained. A small direct `yaml` development dependency
supports parsed workflow tests instead of a handwritten YAML parser.

## Global Constraints

- Keep all existing check commands, all three Playwright browsers, and current PR/main/scheduled triggers.
- Preserve `e2e-tests`, `Analyze (javascript-typescript, none)`, and the CodeQL analysis category.
- Do not change repository settings, required checks, secrets, infrastructure, release behavior, or dependency security policy.
- Do not switch PR execution to `pull_request_target` or expose additional credentials.
- Keep frozen-lockfile installs, existing audit severity/exceptions, pinned actions, and shared-database serialization.
- Work on the existing clean `chore/optimize-ci` feature branch; do not commit, push, or merge without the applicable approval.
- Missing Dependabot database secrets remain a configuration blocker: fail early and explain it, never mark unexecuted tests successful.
- Production-server E2E, reduced browser cadence, and removal of post-merge checks are deferred until separately benchmarked or approved.

## Review Focus

- Failed, skipped, or cancelled quality jobs must not produce a successful required E2E result.
- Human PR commit ranges must still be available; Dependabot and main pushes must not execute PR commitlint.
- Missing database configuration must fail before installation or browser downloads, without printing secrets.
- Successful or superseded Dependabot runs must not cause older failed runs to be retried.
- Retry automation must inspect failed jobs only, reject non-Dependabot manual targets, and avoid unbounded attempts.

---

### Task 1: Consolidate CI and retain a fail-closed required result

**Files:**

- Modify: `.github/workflows/ci.yml`
- Create: `scripts/ci/workflows.test.mjs`

**Interfaces:**

- Consumes: existing package scripts, action versions, PR SHAs, and CI database environment variables.
- Produces: `quality` job and existing `e2e-tests` job with `needs: quality`; `node --test scripts/ci/workflows.test.mjs` checks safety contracts.

- [ ] Write Node regression tests against workflow safety contracts: a single quality dependency installation; all existing validation/build commands retained; human-PR-only commitlint and full history; unchanged browser list; explicit prerequisite failure propagation; missing database variables checked before expensive steps; no PostgreSQL apt installation.
- [ ] Run `node --test scripts/ci/workflows.test.mjs`; confirm the new assertions fail against the original workflow.
- [ ] Consolidate lint, commitlint, format, typecheck, dependency-cruise, knip, security, build, and unit tests into individually named steps in `quality`. Order inexpensive validation/audit before expensive lint/build; ordinary step failure stops later work. Preserve commitlint's event/actor condition and TruffleHog's verified-secret scanning.
- [ ] Make `e2e-tests` depend on `quality` with a job condition that runs after prerequisite failure unless the workflow is cancelled. Its first step must exit nonzero unless `needs.quality.result` is `success`; only then validate both database environment variables before checkout or setup.
- [ ] Keep E2E browser coverage, dev-server configuration, schema/migrations, seeding, credentials, and serialization unchanged. Remove the redundant PostgreSQL client apt step; use the runner's preinstalled `psql`.
- [ ] Run the regression tests and `actionlint .github/workflows/ci.yml`; confirm success. Test the extracted prerequisite guard with `success`, `failure`, `skipped`, and `cancelled`, asserting only success proceeds. Test empty and populated database variables without connecting to a database.

### Task 2: Remove unnecessary CodeQL application setup

**Files:**

- Modify: `.github/workflows/codeql.yml`
- Modify: `scripts/ci/workflows.test.mjs`

**Interfaces:**

- Consumes: existing JavaScript/TypeScript matrix and `build-mode: none`.
- Produces: unchanged required CodeQL check identity/category/query coverage without application dependency installation.

- [ ] Add failing regression assertions for no pnpm/application installation, bounded job timeout, and per-workflow/ref cancellation of superseded scans.
- [ ] Run `node --test scripts/ci/workflows.test.mjs`; confirm the new assertions fail before implementation.
- [ ] Remove pnpm setup, Node setup/cache, and `pnpm install`. Retain checkout, init, analyze, matrix, permissions, queries, category, and triggers. Add workflow concurrency with `cancel-in-progress: true` and a 10-minute job timeout.
- [ ] Run regression tests and actionlint for both changed workflows. Equivalent extraction/results still require a GitHub CodeQL run; do not claim that remote verification happened locally.

### Task 3: Limit Dependabot retry work to current actionable failures

**Files:**

- Modify: `.github/workflows/dependabot-age-retry.yml`
- Create: `scripts/ci/retry-dependabot.sh`
- Create: `scripts/ci/retry-dependabot.test.mjs`

**Interfaces:**

- Consumes: `GH_TOKEN`, `REPO`, optional `MANUAL_PR`, and GitHub CLI JSON responses.
- Produces: a testable shell entry point; reruns failed jobs only for the latest completed failing CI run on the PR's current head SHA when its failed installation logs identify the existing age-violation marker.

- [ ] Write Node tests with a temporary fake `gh` executable and canned API/log responses. Cover no PRs, latest success, running CI, stale SHA, wrong author/manual target, non-age failure, genuine age failure, failed-job filtering/pagination, and capped retries.
- [ ] Run `node --test scripts/ci/retry-dependabot.test.mjs`; confirm failure before creating the shell entry point.
- [ ] Extract retry logic into `scripts/ci/retry-dependabot.sh`, called by the workflow after a shallow checkout instead of a full-history checkout. Validate inputs, use the latest CI run for the current PR SHA rather than historical failures, and inspect only jobs whose conclusion is failure. Stop after the first confirmed age-violating job.
- [ ] Bound automatic reruns to at most five total run attempts, with at least six hours since the latest completed attempt. These are implementation defaults, not user-specified requirements. Keep `--failed` reruns, idempotent comment/label behavior, and the six-hour schedule. Remove stale retry labels for successful or confirmed non-age runs.
- [ ] Add a five-minute workflow timeout and concurrency to prevent overlapping retry automation. Retain permission needed for existing label/comment/rerun behavior; do not add permissions or secrets.
- [ ] Run all Node CI tests, `bash -n scripts/ci/retry-dependabot.sh`, ShellCheck if available, and actionlint on every modified workflow. Confirm mocked tests never contact GitHub or rerun real workflows.

### Final Verification and Handoff

- [ ] Run `node --test scripts/ci/*.test.mjs` and the full workflow lint checks.
- [ ] Run repository formatting, lint, typecheck, architecture checks, Knip, unit tests, and build. Report any existing failures distinctly; do not silently change application code or policy to make CI green.
- [ ] Review the final diff for retained commands, check identities, trigger coverage, cancellation/failure paths, shared-database safety, and credential handling.
- [ ] Record actual local verification results and explain the unresolved Dependabot-secret blocker. Savings remain estimates until comparable hosted runs are available.
- [ ] Do not trigger remote workflows, commit, push, or modify GitHub settings as part of local verification. Obtain approval before publishing and measure hosted runner time after the approved push.
