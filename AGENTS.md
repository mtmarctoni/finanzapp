# AGENTS

This document provides an overview of the agents or automated processes used in the FinanzApp project. Each agent is described with its purpose, triggers, configuration, and other relevant details.

---

## Agent Overview

### 1. **Database Seeder**

- **Purpose**: Seeds the development database with test data.
- **Trigger**: Manually triggered using the `seed:dev` script.
- **Configuration**:
  - Requires a PostgreSQL database connection.
  - Environment variables:
    - `DATABASE_URL`: Connection string for the database.
- **Dependencies**:
  - `tsx` for executing TypeScript scripts.
  - `uuid` for generating unique identifiers.
- **Logs/Monitoring**: Outputs logs to the terminal during execution.

### 2. **Test Data Reset**

- **Purpose**: Resets test user data to a clean state.
- **Trigger**: Manually triggered using the `reset:test` script.
- **Configuration**:
  - Requires a PostgreSQL database connection.
  - Environment variables:
    - `DATABASE_URL`: Connection string for the database.
- **Dependencies**:
  - `tsx` for executing TypeScript scripts.
- **Logs/Monitoring**: Outputs logs to the terminal during execution.

### 3. **End-to-End Testing Agent**

- **Purpose**: Runs end-to-end tests to ensure application functionality.
- **Trigger**: Manually triggered using the `test:e2e` or `test:e2e:ui` scripts.
- **Configuration**:
  - Requires a running development server.
  - Environment variables:
    - `NEXTAUTH_URL`: URL of the running application.
- **Dependencies**:
  - `@playwright/test` for browser automation.
- **Logs/Monitoring**: Generates test reports and logs in the `playwright-report/` directory.

---

## Adding New Agents

To add a new agent:

1. Define its purpose and functionality.
2. Create the necessary scripts or processes.
3. Document the agent in this file, including its triggers, configuration, and dependencies.

---

## Release Versioning

Every push to `main` triggers `.github/workflows/release.yml`, which runs
semantic-release. The version bump is derived **exclusively from commit
messages**, so the commit convention below is what determines the release tag.

### The git tag is the source of truth

There is no version to bump by hand and no version file in the repo. The
`version` field in `package.json` is a fixed `0.0.0-development` placeholder;
leave it alone. semantic-release pushes a `vX.Y.Z` tag and publishes the release
notes as a GitHub Release. It commits nothing back to `main`, because the
ruleset on `main` only accepts changes through a pull request. If you find
yourself wanting to bump a version, you want a commit message instead.

### What produces a release

| Commit type                                                 | Bump  | Tag created |
| ----------------------------------------------------------- | ----- | ----------- |
| `BREAKING CHANGE:` in the body                              | major | yes         |
| `feat(scope):`                                              | minor | yes         |
| `fix(scope):`                                               | patch | yes         |
| `perf(scope):`                                              | patch | yes         |
| `revert(scope):`                                            | patch | yes         |
| `docs`, `test`, `chore`, `refactor`, `style`, `build`, `ci` | none  | no          |

This filtering is deliberate: the tag stream is meant to be a readable log of
meaningful changes, not one tag per merge. A branch made entirely of `refactor`
and `test` commits deploys without cutting a tag, and that is expected.

### Version numbers are chosen by commit type, not by you

This is the part worth internalising. Do not try to engineer a version number.
Ask "what kind of change is this?" and let the type answer:

- Adding a capability the user did not have before → `feat` → minor.
- Restoring correct behaviour that already existed → `fix` → patch.
- A change that invalidates existing data, APIs, or workflows → `BREAKING CHANGE`
  footer → major.
- Everything else → one of the silent types above.

Because a redesign like PR #122 is a `feat`, it will correctly land as a
minor. Reach for `BREAKING CHANGE` only when something genuinely stops working
that used to work — in this codebase that means a ledger schema change, a
removed API field, or a changed calculation. Renaming a component or restyling
the UI is **not** breaking, no matter how large the diff.

## Conventional Commit Convention

Format, enforced by `commitlint.config.mjs` via the `.githooks/commit-msg` hook:

```
<type>(<scope>): <subject in the imperative mood>

<optional body>

<optional footer: BREAKING CHANGE: ...>
```

Rules the hook will reject:

- The type must be one of: `feat`, `fix`, `perf`, `refactor`, `docs`, `style`,
  `test`, `build`, `ci`, `chore`, `revert`.
- **A scope is mandatory.** The scope is the subsystem, and it is what readers
  scan in the release notes.
- No trailing period on the subject.
- Subject and header must fit in 100 characters.

### Scopes in use

`auth`, `entries`, `ledger`, `categories`, `merchants`, `records`, `recurring`,
`analytics`, `dashboard`, `crypto`, `settings`, `ui`, `shell`, `ai`,
`quick-add`, `receipts`, `db`, `deps`, `ci`, `docs`, `plan`.

### Examples

```
feat(ledger): implement double-entry balancing logic
fix(auth): send signed-out visits to the sign-in page
refactor(ui): drop unused UI primitives and Radix dependencies
test(receipts): cover the receipt flow end to end
docs(plan): record the finance-form calendar-day slip as a follow-up
fix(deps): bump next to 16.3.6 for the next/og RCE advisory
```

A dependency bump is `chore(deps)` unless it fixes something users would hit,
such as a security advisory; then it is `fix(deps)` so it cuts a patch.

A breaking change carries the marker in the **body**, not the subject:

```
feat(ledger): switch to integer cents for all amounts

All ledger amounts are now stored as integer cents rather than floats...

BREAKING CHANGE: the `amount` column is now bigint and no longer accepts
decimals. Existing rows have been migrated by rounding to the nearest cent.
```

---

## Agent Workflow: Git Merging & Pull Request Protocol

When a feature, fix, or chore is complete and ready to be integrated into the `main` branch, you must follow this exact workflow to maintain a professional, linear Git history.

### 1. Verify Build Status

- Ensure the automated CI/CD pipeline checks are passing on your feature branch.
- Do not attempt to merge code if there are failing tests or linting errors.

### 2. Create the Pull Request

- Open a Pull Request from your feature branch into `main`.
- Fill out the `.github/PULL_REQUEST_TEMPLATE.md` thoroughly, ensuring the "Financial & Data Integrity Impacts" section is accurate.
- Title the PR using the Conventional Commits standard (e.g., `feat(ledger): implement double-entry balancing logic`).

### 3. Every Commit on the Branch Must Be Conventional

This is the rule that makes the release tag correct, so it applies to the
individual commits on your branch — not just the PR title.

- Each commit must pass `commitlint` (`.githooks/commit-msg`, wired up by
  `core.hooksPath`). If a commit was rejected, fix the message rather than
  bypassing with `--no-verify`.
- Write one logical change per commit, and give each one its own accurate type.
  A branch that implements a feature and fixes a bug in passing needs both a
  `feat` and a `fix` commit, not one commit with a mixed type.
- Put a `BREAKING CHANGE:` footer in the body of the commit that actually
  breaks things, not in a separate marker commit.

### 4. Merge with Rebase — Never Squash

- Use the **Rebase and merge** strategy. Do **not** use Squash and Merge.
  Merge commits are not an option: the ruleset on `main` requires linear
  history, and the repository has merge commits disabled.
- Squash collapses a branch's commits into one, which discards every individual
  type and leaves only the PR title. That loses information semantic-release
  needs in order to pick the right bump, and it makes `git log` on `main` useless
  for reconstructing why a version was cut.
- Rebase and merge replays each branch commit onto `main` unchanged in message,
  so every conventional commit reaches `main`'s history. That history is the
  input to the next release calculation.

#### Command Execution (GitHub CLI)

```bash
# Correct: preserves the branch's conventional commits in main's history.
gh pr merge --rebase --delete-branch

# Never: gh pr merge --squash --delete-branch
```

If a pull request has already been squash-merged by mistake, do not rewrite
published history. The squash commit carries the PR title, so the release is
still cut from that title's type; check that it is the type you wanted.

### 5. Confirm the Release

- After the merge lands, watch the **Release** workflow run on `main`. It should
  cut a tag if the branch contained `feat`, `fix`, or `perf` commits.
- If no tag appears and you expected one, the cause is almost always a branch
  whose commits were all silent types, or a squash merge. Check
  `git log --oneline <last-tag>..main` to see what types actually landed.

---

For any questions or issues, please contact the project maintainers.
