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

For any questions or issues, please contact the project maintainers.
