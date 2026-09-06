# Plan: "Analytics by Tipo" page (`/analytics/tipo`)

Status: REVIEWED via /plan-eng-review (interactive) + outside-voice challenge. All decisions approved by user.

## Goal

New analytics subpage focused on a **Tipo** (free-text `finance_entries.tipo`, e.g. `Piso JB38`):

1. **Subpage navigation** — a row of button-links on both `/analytics` and `/analytics/tipo` ("General" | "Por Tipo"), preserving the current query string when navigating.
2. **Tipo-scoped summary** — total spend (`Gasto`), invest (`Inversión`), earn (`Ingreso`), net, and movement counts for the selected Tipo.
3. **Expense breakdown** — where the money goes: doughnut + bar chart by `que` (category) with counts/percentages (reuse `TipoExplorer` card).
4. **Temporal trends** — when: monthly/yearly line trend + spending velocity for the selected Tipo.
5. **Full filter table** — paginated, sortable, read-only table of every underlying entry for the current filters (`tipo`, `accion`, `que`, date range, amounts), so the user sees exactly the data behind the charts.
6. **URL state** — selected tipo lives at `?type=<urlencoded tipo>`; refresh/bookmarks preserve it.

## Architecture (data flow)

```
/analytics/tipo (server component, force-dynamic, Suspense skeleton)
 └─ tipo-page-content.tsx ('use client' orchestrator)
     ├─ useAnalyticsData() ────────── GET /api/analytics?type=...&action=...&groupBy=...
     │    (12 parallel aggregate queries; tipo-scoped via tipo IN (…) on (user_id, tipo) index)
     │    → typeData, tipoQueData, typeTemporalData, sums{gastos,ingresos,inversion},
     │      metrics.perAction, tipoToQueMap
     │
     ├─ AnalyticsFilter (shared bar: search/dates/accion/que/platform/amounts/groupBy)
     │    emits ARRAYS for actions/types/categories  ← 1C fix (prerequisite)
     │
     ├─ Summary cards (Gasto | Inversión | Ingreso | Neto) ← sums + perAction
     ├─ Doughnut "Gasto por categoría" ← getTipoQueDoughnutData(tipoQueData, tipo) [NEW helper]
     ├─ TipoExplorer (CONTROLLED selectedTipo) ← tipoQueData + getTipoExplorerData
     ├─ Trend chart (CONTROLLED selectedTipo) ← typeTemporalData ∩ tipo + getTipoTrendData
     ├─ SpendingVelocity ← computeTipoSpendingVelocity(typeTemporalData ∩ tipo, 'Gasto')
     │
     ├─ URL sync: useEffect on selectedTipo → router.replace(`/analytics/tipo?type=…`)
     │
     └─ tipo-entries-table.tsx ─────── GET /api/entries?tipo=…&que=…&accion=…&from=…&to=…
          │                             &minAmount=…&maxAmount=…&page=…&sortBy=…&sortOrder=…
          │                             (server-side LIMIT/OFFSET + whitelisted sort)
          └─ own state: page, sortBy, sortOrder; AbortController cancels stale fetches
```

Two endpoints, one filter state: `/api/analytics` owns aggregates, `/api/entries` owns raw rows (decision 5A). Both derive from the same `filters` object so views stay consistent; both show loading states on the same state change.

## Decisions (all user-approved)

| #   | Decision                                                            | Choice                                                                                 |
| --- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 1C  | Filter-shape bug (fetch crashes silently when any dropdown is used) | Fix at source (`AnalyticsFilter` emits arrays) AND defensive `asArray()` guard in hook |
| 2A  | URL state scope                                                     | Only `?type=` synced, tipo page only                                                   |
| 3A  | Currency formatting                                                 | New components import shared `formatCurrency` (lib/utils.ts:32)                        |
| 4A  | E2E                                                                 | Full Playwright user-journey spec                                                      |
| 5A  | Table data source                                                   | Reuse `/api/entries` (two endpoints, one filter state)                                 |
| 6A  | TipoExplorer/TrendExplorer internal tipo state                      | Optional controlled `selectedTipo`/`onTipoChange` props (backward compatible)          |
| 7A  | Subnav navigation                                                   | Links preserve current query string                                                    |

## Files

**CREATE (5):**

1. `app/analytics/tipo/page.tsx` — server wrapper, `force-dynamic`, Suspense + pulse skeleton (mirrors `app/analytics/page.tsx`).
2. `components/analytics/tipo-page-content.tsx` — orchestrator (composition above). Years for quick-filter buttons derived dynamically from `data.temporalData` (NOT hardcoded).
3. `components/analytics/tipo-entries-table.tsx` — slim READ-ONLY table (does NOT extend the 701-line edit-coupled `finance-table.tsx`). Columns: Fecha, Que, Acción, Plataforma, Importe, Detalle (mirror `TopTransactionsTable` vocabulary). States: loading spinner, empty ("No hay datos"), error + retry, abort-on-filter-change. `formatCurrency` for money.
4. `components/analytics/analytics-subnav.tsx` — button-links (Button variant outline/secondary), active state via `usePathname`, preserves query string on navigation.
5. `e2e/analytics-tipo.spec.ts` — user journey (below).

**MODIFY (7):**

5. `components/analytics-filter.tsx` — emit ARRAYS for `actions`/`types`/`categories` (currently emits plain strings at lines 94/98/115 → `.forEach` TypeError in hook → silent stale data). **Prerequisite for everything.**
6. `hooks/use-analytics-data.ts` — `asArray(v)` normalization in `fetchData` for `actions`/`categories`/`platforms`/`types`.
7. `app/api/entries/route.ts` — extract and pass `tipo`, `que`, `minAmount`, `maxAmount` (all four explicitly; missing any → silently unfiltered table).
8. `lib/entries/repo.ts` — add `que`, `minAmount`, `maxAmount` to `EntryFilter` + `compileFilter`. **Security-sensitive: parameterized `WHERE` clauses exactly matching existing patterns (`= $N`, `>= $N`, `<= $N`); no string interpolation.** Tests must assert parameterization.
9. `components/analytics-page-content.tsx` — render `<AnalyticsSubnav />` row (render-only).
10. `lib/analytics-charts.ts` — add `getTipoQueDoughnutData(tipoQueData, tipo)` (expenses only, doughnut dataset + total) following `getCategoryChartData` pattern.
11. `components/analytics/TipoExplorer.tsx` + `components/analytics/TrendExplorer.tsx` — optional controlled props `selectedTipo?: string` / `onTipoChange?: (t: string) => void`; fall back to internal `useState` when absent (existing `/analytics` page unaffected).

Plus: `TODOS.md` (new) with 4 accepted items (below).

## Implementation order (sequenced; 1C first per outside voice)

1. **Step 0 — 1C fix**: filter emits arrays + hook guard + the 2 CRITICAL regression test files. Nothing else works without this.
2. **Step 1 — backend**: repo `EntryFilter`/`compileFilter` + `/api/entries` route params + tests (`__tests__/lib/entries-repo.test.ts`, `__tests__/api/entries.test.ts`).
3. **Step 2 — leaf UI**: subnav (+ render row in `analytics-page-content.tsx`), controlled props on both explorers, doughnut helper + their tests.
4. **Step 3 — table**: `tipo-entries-table.tsx` + test.
5. **Step 4 — orchestrator + route**: `tipo-page-content.tsx`, `app/analytics/tipo/page.tsx`, URL sync + tests.
6. **Step 5 — e2e** + full `pnpm check:all` (typecheck, lint, format, jest, audit).

Commits: conventional, one per step, on `feat/analytics-by-tipo`. PR per AGENTS.md (squash-merge; Financial & Data Integrity section: read-only analytics + no data writes).

## Tests (all new; 36 paths — 0 pre-existing coverage)

| File                                               | Covers                                                                                                                                          | Notes                                                                          |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `__tests__/components/analytics-filter.test.tsx`   | tipo/que/action selects emit arrays                                                                                                             | **CRITICAL REGRESSION**                                                        |
| `__tests__/hooks/use-analytics-data.test.tsx`      | asArray guard, param building, URL initial parse                                                                                                | **CRITICAL REGRESSION**                                                        |
| `__tests__/api/entries.test.ts`                    | GET passthrough (tipo/que/min/max), 401, 500                                                                                                    | mock getServerSession + getEntries (mirror `__tests__/api/v1/entries.test.ts`) |
| `__tests__/lib/entries-repo.test.ts`               | compileFilter que/min/max/tipo clauses; special-char tipo; parameterized params                                                                 | security-sensitive                                                             |
| `__tests__/components/tipo-entries-table.test.tsx` | fetch/sort/paginate/error+retry/empty/loading/abort                                                                                             |                                                                                |
| `__tests__/components/tipo-page-content.test.tsx`  | cards render from mocked hook, `router.replace` with encoded type, explorer wiring                                                              |                                                                                |
| `__tests__/components/analytics-subnav.test.tsx`   | both links + active state + query preservation                                                                                                  |                                                                                |
| `__tests__/lib/analytics-charts.test.ts`           | `getTipoQueDoughnutData` (expense-only filter, %)                                                                                               |                                                                                |
| `e2e/analytics-tipo.spec.ts`                       | login → `/analytics` → subnav → select seeded tipo `Vivienda` → `?type=` + cards/charts/table update → sort + paginate → refresh preserves tipo | `e2e/utils/auth.ts`, seed:dev data                                             |

## Failure modes (all have handling + test — 0 critical gaps)

| Failure                                              | Handling                                           | Test                       |
| ---------------------------------------------------- | -------------------------------------------------- | -------------------------- |
| Rapid filter change → stale table response           | AbortController in table                           | table test                 |
| `/api/entries` 500                                   | explicit error state + retry                       | table test                 |
| Tipo with no data in range                           | existing "No hay datos" empty states everywhere    | table + orchestrator tests |
| Free-text tipo with special chars (`&`, `%`, spaces) | `encodeURIComponent` in URL; parameterized SQL     | repo test                  |
| Stale bookmark `?type=` of a deleted tipo            | empty states, select shows placeholder             | orchestrator test          |
| Session expiry mid-investigation (401)               | table error + retry; charts keep existing behavior | table test                 |
| Month/year groupBy on trends                         | existing helpers handle both                       | orchestrator test          |

## What already exists (reused, not rebuilt)

| Existing                                              | Role in this plan                                                                                                                                               |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/analytics`                                  | all tipo-scoped aggregations (`typeData`, `tipoQueData`, `typeTemporalData`, `sums`, `metrics.perAction`) via `tipo IN (…)` on existing `(user_id, tipo)` index |
| `useAnalyticsData` hook                               | fetch + filter state + URL read                                                                                                                                 |
| `AnalyticsFilter`                                     | filter bar incl. tipo select with cascading que                                                                                                                 |
| `TipoExplorer` / `TrendExplorer` / `SpendingVelocity` | the "where" and "when" cards (with controlled props added)                                                                                                      |
| `lib/analytics-charts.ts` helpers                     | `getTipoExplorerData`, `getTipoTrendData`, `computeTipoSpendingVelocity`                                                                                        |
| `lib/entries/repo.ts` `findEntries`                   | pagination + sort whitelist + `tipo` clause (route wiring was the only gap)                                                                                     |
| `lib/utils.ts formatCurrency`                         | shared EUR formatting for new components                                                                                                                        |
| `TopTransactionsTable`                                | table visual vocabulary                                                                                                                                         |
| Seed data (`scripts/seed-db.ts`)                      | e2e tipos: `Salario`, `Vivienda`, `Ocio`                                                                                                                        |

## NOT in scope (this PR)

- Wide URL sync (all filters, both pages) — TODO'd
- 51-site inline currency cleanup — TODO'd
- `TipoDeepDive.tsx` dead-code deletion — TODO'd
- Dynamic years on existing `/analytics` quick buttons — TODO'd
- Seasonality card on tipo page (`getTipoSeasonalPatterns` exists; velocity + trend cover "when" for now)
- Excel/CSV export of the table; tipo management UI; new sidebar item; any `/api/analytics` change

## TODOS.md (all 4 accepted by user, created at implementation)

1. **Delete dead `components/analytics/TipoDeepDive.tsx`** (0 imports; abandoned twin of TipoExplorer).
2. **Wide URL filter sync** in `useAnalyticsData` (write all filters to URL on both pages; debounce search keystrokes). Prerequisite: this PR's asArray guard.
3. **Currency DRY cleanup**: replace 51 inline `toLocaleString('es-ES', {style:'currency'})` call sites in `components/analytics/*` + `analytics-page-content.tsx` with `formatCurrency`. Pure mechanical, no behavior change.
4. **Dynamic years** on existing `/analytics` quick-filter buttons (currently hardcoded `[2025, 2024, 2023]` at `analytics-page-content.tsx:155`).

## Parallelization (if splitting work)

| Step            | Modules                                                    | Depends on |
| --------------- | ---------------------------------------------------------- | ---------- |
| 0: 1C fix       | components/analytics-filter, hooks                         | —          |
| 1: backend      | lib/entries, app/api/entries                               | —          |
| 2: leaf UI      | components/analytics/*, lib/analytics-charts               | —          |
| 3: table        | components/analytics/tipo-entries-table                    | 1          |
| 4: orchestrator | components/analytics/tipo-page-content, app/analytics/tipo | 0, 1, 2, 3 |
| 5: e2e          | e2e/                                                       | all        |

Lane A: steps 0→2 (shared components dir) · Lane B: step 1 (independent) · then merge → step 3 → step 4 → step 5. Sequential recommended for a single implementer — 12 touched files but each small.

## Merge / workflow (per AGENTS.md)

Feature branch `feat/analytics-by-tipo` (already checked out). Squash-merge PR into `main` via `gh pr merge --squash --delete-branch`; PR title conventional (`feat(analytics): add analytics-by-tipo subpage`); fill `.github/PULL_REQUEST_TEMPLATE.md` — Financial & Data Integrity: read-only feature, no data writes; one parameterized-SQL extension on the entries read path.

## GSTACK REVIEW REPORT

| Review        | Trigger               | Why                             | Runs | Status       | Findings                                                                                                         |
| ------------- | --------------------- | ------------------------------- | ---- | ------------ | ---------------------------------------------------------------------------------------------------------------- |
| CEO Review    | `/plan-ceo-review`    | Scope & strategy                | 0    | —            | —                                                                                                                |
| Codex Review  | `/codex review`       | Independent 2nd opinion         | 0    | —            | —                                                                                                                |
| Eng Review    | `/plan-eng-review`    | Architecture & tests (required) | 1    | CLEAR (PLAN) | 2 arch issues + 1 code-quality issue + 36 test gaps, all resolved with user; 10 outside-voice findings folded in |
| Design Review | `/plan-design-review` | UI/UX gaps                      | 0    | —            | —                                                                                                                |

**VERDICT:** Eng review COMPLETE — 0 unresolved decisions, 0 critical gaps. Outside voice ran (Claude subagent; codex CLI unavailable): 10 findings — 6 factual corrections folded into plan, 3 tensions resolved with user (5A two-endpoint table, 6A controlled explorer props, 7A query-preserving subnav), 1 already-planned. 4 TODOs accepted for TODOS.md.
