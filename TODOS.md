# TODOS.md

Backlog items accepted during the `feat/analytics-by-tipo` review cycle. All 4 are out of scope for the "Analytics by Tipo" PR; each is scheduled for a standalone change once this PR lands.

## 1. Delete dead `components/analytics/TipoDeepDive.tsx`

- **Status**: pending
- **What**: Remove the component (0 imports today; abandoned twin of `TipoExplorer`) and its export from `components/analytics/index.ts` if present.
- **Why**: Dead code; confusing next to the controlled `TipoExplorer`.

## 2. Wide URL filter sync in `useAnalyticsData`

- **Status**: pending
- **Prerequisite**: this PR's `asArray()` URL-state guard.
- **What**: Write all filters (action, type, category, platform, que, period) to the URL on both the `/analytics` and `/analytics/tipo` pages, and debounce search keystrokes.
- **Why**: Current URL state is partial (`/analytics` keeps only a subset of filters); full sync makes browsing/sharing/back-forward consistent.

## 3. Currency DRY cleanup — replace inline `toLocaleString` with `formatCurrency`

- **Status**: pending
- **What**: Replace 51 inline `toLocaleString('es-ES', { style: 'currency' })` call sites in `components/analytics/*` and `analytics-page-content.tsx` with the existing `formatCurrency` helper (`lib/utils.ts`).
- **Why**: Pure mechanical; no behavior change. Removes duplicates and centralizes es-ES/EUR formatting.

## 4. Dynamic years on the `/analytics` quick-filter buttons

- **Status**: pending
- **What**: Replace the hardcoded `[2025, 2024, 2023]` list at `analytics-page-content.tsx` (currently around line 155) with years derived from the data (e.g. min/max of available periods).
- **Why**: The hardcoded list drifts from the transaction history over time.
