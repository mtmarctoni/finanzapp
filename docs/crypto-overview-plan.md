# Plan: Resumen Cripto (Crypto Overview)

Status: **Draft — awaiting approval**

Branch: `feat-overview-crypto`

## Problem

The crypto module (`/investment/crypto`) supports recording buy/sell/transfer
movements (`crypto_transactions`), but there is no overview page. The user
cannot see at a glance how much crypto they hold, what it is worth today, or
whether they are up or down.

## Goals

- Classic portfolio summary, nothing fancy: current value, invested cost,
  unrealized P/L, realized P/L.
- Per-symbol holdings breakdown with live prices.
- Fits existing stack and conventions (no ORM, no Redux, Spanish UI, EUR).

## Decisions

| Decision     | Choice                                                     |
| ------------ | ---------------------------------------------------------- |
| Price source | CoinGecko public API (`/coins/markets`, `vs_currency=eur`) |
| P/L scope    | Unrealized **and** realized                                |
| Placement    | Section on top of existing `/investment/crypto` page       |
| Charts       | None                                                       |
| Caching      | Postgres table `crypto_prices`, TTL 5 minutes              |

## Architecture

```
app/investment/crypto/page.tsx
  └─ <CryptoOverview>            (client component, Suspense-wrapped)
       └─ GET /api/crypto/overview          [new, session-scoped]
            ├─ lib/crypto/portfolio.ts      avg-cost engine (pure + testable)
            └─ lib/crypto/prices.ts         CoinGecko client + DB cache
                 └─ crypto_prices           [new global cache table]
```

Prices are market-wide, so the cache table is intentionally **not**
user-scoped.

## Implementation Steps

### 1. DB migration — `db/migrations/20260822_create_crypto_prices.sql`

```sql
CREATE TABLE IF NOT EXISTS crypto_prices (
  symbol VARCHAR(20) PRIMARY KEY,
  price_eur NUMERIC NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 2. Types — `types/finance.ts`

New types (the pre-declared-but-never-populated optional fields on
`CryptoHoldingsSummary` remain untouched for backward compatibility):

```ts
type CryptoSymbolPrice = {
  symbol: string;
  priceEur: number | null;
  fetchedAt: string; // ISO timestamp of last successful fetch
  stale: boolean;
  priceKnown: boolean;
};

type CryptoPosition = {
  symbol: string;
  amount: number;
  costBasis: number; // EUR cost of coins currently held
  averageCost: number;
  realizedPL: number; // EUR locked in from disposals so far
  price: CryptoSymbolPrice;
  currentValue: number | null; // null when price unknown
  unrealizedPL: number | null;
  unrealizedPLPercent: number | null;
};

type CryptoPortfolioTotals = {
  totalValue: number | null; // null if any held symbol lacks a price
  totalCostBasis: number;
  unrealizedPL: number | null;
  unrealizedPLPercent: number | null;
  realizedPL: number;
};

type CryptoPortfolioOverview = {
  positions: CryptoPosition[]; // sorted by value desc, unpriced last
  totals: CryptoPortfolioTotals;
  pricesUpdatedAt: string | null;
  missingPrices: string[];
};
```

### 3. Price service — `lib/crypto/prices.ts`

- `getPricesForSymbols(symbols: string[]): Promise<CryptoSymbolPrice[]>`
  - Read cached rows from `crypto_prices`; rows newer than TTL (5 min) are
    served directly.
  - Stale/missing symbols refreshed in **one** batched CoinGecko call:
    `GET /coins/markets?vs_currency=eur&symbols=BTC,ETH&per_page=250`
  - Match results case-insensitively by symbol; when multiple coins share a
    ticker keep the highest `market_cap` entry.
  - Upsert fresh results into `crypto_prices`.
  - On API failure fall back to stale cached rows (marked `stale: true`);
    never throw to the caller.
- Optional free demo key via env var `COINGECKO_API_KEY`
  (header `x-cg-demo-api-key`); document in `.env.example`.
- Rate-limit safety: DB cache caps outbound calls at ~1 per 5 min regardless
  of page traffic (unauthenticated CoinGecko allows roughly 5–15 req/min).

### 4. Portfolio engine — `lib/crypto/portfolio.ts`

Average cost basis, transactions processed chronologically per symbol.
Pure function `calculatePositions(transactions)` kept separate from DB access
for unit testing; `computePortfolio(userId)` composes it with
`listTransactions`-style loading and the price service.

| Movement                                      | Effect on engine                                                           |
| --------------------------------------------- | -------------------------------------------------------------------------- |
| `deposit` / `staking` / `airdrop` / `genesis` | qty += amount; basis += amount × `price_at_transaction` (0 when absent)    |
| `withdrawal` with recorded price              | realized P/L += proceeds − qty × avgCost                                   |
| `withdrawal` without price                    | basis removed at avg cost → neutral (never invent gains)                   |
| `exchange` out→in                             | cost basis carries over from source to destination symbol; no realized P/L |
| fee paid in symbol (`fee_crypto`)             | disposal at avg cost → realized loss                                       |
| `wallet_transfer`                             | ignored (balance-neutral, same as existing `aggregateHoldings`)            |

Unrealized P/L = remaining qty × current price − remaining basis.

Note: this fixes a latent flaw in the existing `aggregateHoldings()`
(`lib/crypto/holdings.ts`) which never subtracts disposed coins' cost from
`totalInvested`. That function stays untouched for backward compatibility;
the overview uses the new engine exclusively.

### 5. API route — `app/api/crypto/overview/route.ts`

- `GET`, session-gated exactly like `app/api/summary/route.ts`
  (401 JSON when no session).
- Returns `CryptoPortfolioOverview` as JSON. Read-only; no revalidation needed.
- Client fetcher `getCryptoOverview()` added to `lib/crypto-data.ts`,
  following the existing fetch-wrapper pattern (returns safe default on error).

### 6. UI — `components/crypto/crypto-overview.tsx`

Client component styled after the dashboard stat cards:

- 4 stat cards:
  - **Valor actual** — sum of holdings × current price
  - **Invertido (coste)** — cost basis of current holdings
  - **P/L no realizado** — green/red + percentage
  - **P/L realizado** — green/red
- Holdings table: Símbolo | Cantidad | Precio actual | Valor | Coste | P/L ± %
- Footer line: "Precios actualizados hh:mm" + manual refresh button.
- Warning chip listing symbols without CoinGecko price ("BTC sin precio en
  CoinGecko") — those positions show quantity/cost only.
- Skeleton loading state; friendly empty state when no transactions exist.
- Exported through `components/crypto/index.ts` barrel.
- Spanish copy; money via `formatCurrency` (`lib/utils.ts`), quantities with
  es-ES formatting up to 8 decimals (same as `crypto-holdings-card.tsx`).

### 7. Wire-in — `app/investment/crypto/page.tsx`

Add above the filters section:

```tsx
<Suspense fallback={<Skeleton className="h-64 w-full" />}>
  <CryptoOverview />
</Suspense>
```

Page metadata unchanged.

### 8. Tests — `__tests__/crypto/portfolio.test.ts`

Pure-engine scenarios:

1. Buys only → position equals sum of costs, zero realized.
2. Buy then sell at higher recorded price → positive realized, correct
   remaining basis.
3. Buy then sell at lower price → negative realized.
4. Exchange out→in → basis carried to destination symbol, realized stays 0.
5. Withdrawal without price → neutral (basis reduced at avg cost).
6. Fee paid in symbol → reduces position, booked as realized loss.
7. Staking/airdrop/genesis at zero cost → increases qty without basis.
8. Overdrawn balance (selling more than held) → clamped, no negative qty.
9. Unknown price → `currentValue/unrealizedPL = null`, excluded from totals.

Optional: mocked-fetch test for the price cache fallback behavior.

### 9. Verification

- `pnpm typecheck && pnpm lint && pnpm test`
- Manual smoke test on dev server with seeded data (`pnpm seed:dev`):
  - First load triggers CoinGecko call; second load within TTL serves cache.
  - Blocking network access shows stale badge with cached values instead of
    an error.
- E2E (Playwright) not in scope for this feature.

## Known Limitations (accepted)

- **Symbol ambiguity:** CoinGecko tickers are not unique; engine keeps the
  highest market-cap match. Reliable for majors (BTC, ETH…), may misprice
  exotic tickers.
- **Conservative realized P/L:** sells recorded without
  `price_at_transaction` contribute zero realized gain.
- **EUR only:** matches the rest of the app; no multi-currency support.

## Out of Scope

- Charts / allocation doughnut.
- Historical price snapshots or portfolio value over time.
- Editing prices manually (CoinGecko covers this).
- Refactoring/deprecating the legacy `aggregateHoldings()` consumers.
