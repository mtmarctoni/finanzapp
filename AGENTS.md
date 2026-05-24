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

## Agent Workflow: Git Merging & Pull Request Protocol

When a feature, fix, or chore is complete and ready to be integrated into the `main` branch, you must follow this exact workflow to maintain a professional, linear Git history.

### 1. Verify Build Status

- Ensure the automated CI/CD pipeline checks are passing on your feature branch.
- Do not attempt to merge code if there are failing tests or linting errors.

### 2. Create the Pull Request

- Open a Pull Request from your feature branch into `main`.
- Fill out the `.github/PULL_REQUEST_TEMPLATE.md` thoroughly, ensuring the "Financial & Data Integrity Impacts" section is accurate.
- Title the PR using the Conventional Commits standard (e.g., `feat(ledger): implement double-entry balancing logic`).

### 3. Execute the Squash Merge

- Always use the **Squash and Merge** strategy. Never create a standard merge commit or a raw rebase.
- Because the repository is configured to use the "Pull request title and description" for squash commits, the PR title will become the commit title, and your markdown PR body will become the commit body. No manual string concatenation is required.

#### Command Execution (GitHub CLI)

If you are managing Git via the terminal, use the GitHub CLI to merge and automatically clean up the branch:

```bash
gh pr merge --squash --delete-branch
```

---

For any questions or issues, please contact the project maintainers.
