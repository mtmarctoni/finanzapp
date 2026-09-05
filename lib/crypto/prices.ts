import { withPool } from '@/lib/db';
import type { CryptoSymbolPrice } from '@/types/finance';

/**
 * Crypto price service.
 *
 * Resolves current EUR prices per symbol from CoinGecko's public API,
 * backed by the `crypto_prices` table as a shared cache. Rows younger
 * than PRICE_TTL_MS are served without any outbound request; stale or
 * missing symbols are refreshed in a single batched call and upserted.
 * On API failure, stale cached rows are used instead so callers degrade
 * gracefully instead of erroring.
 */

const PRICE_TTL_MS = 5 * 60 * 1000;
const COINGECKO_MARKETS_URL = 'https://api.coingecko.com/api/v3/coins/markets';
const REQUEST_TIMEOUT_MS = 10_000;

interface CoinGeckoMarketCoin {
  id: string;
  symbol: string;
  current_price: number;
  market_cap: number | null;
}

interface CachedPriceRow {
  symbol: string;
  priceEur: number;
  fetchedAtMs: number;
}

function isPriceFresh(row: CachedPriceRow, now = Date.now()): boolean {
  return now - row.fetchedAtMs < PRICE_TTL_MS;
}

async function readCachedPrices(
  symbols: string[],
): Promise<Map<string, CachedPriceRow>> {
  return withPool(async (pool) => {
    const result = await pool.query(
      `SELECT symbol, price_eur, fetched_at FROM crypto_prices
        WHERE symbol = ANY($1::varchar[])`,
      [symbols],
    );
    const map = new Map<string, CachedPriceRow>();
    for (const row of result.rows) {
      map.set(row.symbol as string, {
        symbol: row.symbol as string,
        priceEur: parseFloat(row.price_eur as string),
        fetchedAtMs: new Date(row.fetched_at as Date).getTime(),
      });
    }
    return map;
  });
}

async function cachePrices(rows: CachedPriceRow[]): Promise<void> {
  if (rows.length === 0) return;
  await withPool(async (pool) => {
    await pool.query(
      `INSERT INTO crypto_prices (symbol, price_eur, fetched_at)
       SELECT symbol, price_eur, fetched_at
         FROM UNNEST($1::varchar[], $2::numeric[], $3::timestamptz[])
            AS t(symbol, price_eur, fetched_at)
       ON CONFLICT (symbol) DO UPDATE
         SET price_eur = EXCLUDED.price_eur,
             fetched_at = EXCLUDED.fetched_at`,
      [
        rows.map((row) => row.symbol),
        rows.map((row) => row.priceEur),
        rows.map((row) => new Date(row.fetchedAtMs).toISOString()),
      ],
    );
  });
}

/**
 * Batch-fetch current EUR prices from CoinGecko's /coins/markets endpoint.
 * Tickers are not unique on CoinGecko, so per symbol we keep the entry with
 * the highest market cap.
 */
async function fetchCoinGeckoPrices(
  symbols: string[],
): Promise<Map<string, CachedPriceRow>> {
  const apiKey = process.env.COINGECKO_API_KEY;
  const headers: Record<string, string> = { accept: 'application/json' };
  if (apiKey) headers['x-cg-demo-api-key'] = apiKey;

  const params = new URLSearchParams({
    vs_currency: 'eur',
    symbols: symbols.join(','),
    order: 'market_cap_desc',
    per_page: '250',
    page: '1',
  });

  const response = await fetch(`${COINGECKO_MARKETS_URL}?${params}`, {
    headers,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(`CoinGecko API error: ${response.status}`);
  }

  const coins = (await response.json()) as CoinGeckoMarketCoin[];
  const wanted = new Set(symbols.map((s) => s.toUpperCase()));
  interface Candidate extends CachedPriceRow {
    marketCap: number;
  }
  const best = new Map<string, Candidate>();
  const fetchedAtMs = Date.now();

  for (const coin of coins) {
    const symbol = coin.symbol.toUpperCase();
    if (!symbol || !wanted.has(symbol)) continue;
    if (
      typeof coin.current_price !== 'number' ||
      !Number.isFinite(coin.current_price)
    ) {
      continue;
    }
    const marketCap = coin.market_cap ?? Number.NEGATIVE_INFINITY;
    const incumbent = best.get(symbol);
    if (!incumbent || marketCap > incumbent.marketCap) {
      best.set(symbol, {
        symbol,
        priceEur: coin.current_price,
        fetchedAtMs,
        marketCap,
      });
    }
  }

  const result = new Map<string, CachedPriceRow>();
  for (const [symbol, candidate] of best) {
    result.set(symbol, {
      symbol: candidate.symbol,
      priceEur: candidate.priceEur,
      fetchedAtMs: candidate.fetchedAtMs,
    });
  }
  return result;
}

function unknownPrice(symbol: string): CryptoSymbolPrice {
  return {
    symbol,
    priceEur: null,
    fetchedAt: null,
    stale: false,
    priceKnown: false,
  };
}

export async function getPricesForSymbols(
  symbols: string[],
): Promise<CryptoSymbolPrice[]> {
  const unique = [
    ...new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean)),
  ];
  if (unique.length === 0) return [];

  const cached = await readCachedPrices(unique);
  const toFetch: string[] = [];
  for (const symbol of unique) {
    const row = cached.get(symbol);
    if (!row || !isPriceFresh(row)) toFetch.push(symbol);
  }

  let refreshed: Map<string, CachedPriceRow> = new Map();
  if (toFetch.length > 0) {
    try {
      refreshed = await fetchCoinGeckoPrices(toFetch);
      await cachePrices([...refreshed.values()]);
    } catch (error) {
      console.error('[crypto/prices] CoinGecko refresh failed:', error);
    }
  }

  const results = unique.map<CryptoSymbolPrice>((symbol) => {
    const fresh = refreshed.get(symbol);
    if (fresh) {
      return {
        symbol,
        priceEur: fresh.priceEur,
        fetchedAt: new Date(fresh.fetchedAtMs).toISOString(),
        stale: false,
        priceKnown: true,
      };
    }

    const row = cached.get(symbol);
    if (row && isPriceFresh(row)) {
      return {
        symbol,
        priceEur: row.priceEur,
        fetchedAt: new Date(row.fetchedAtMs).toISOString(),
        stale: false,
        priceKnown: true,
      };
    }

    if (row) {
      return {
        symbol,
        priceEur: row.priceEur,
        fetchedAt: new Date(row.fetchedAtMs).toISOString(),
        stale: true,
        priceKnown: true,
      };
    }

    return unknownPrice(symbol);
  });

  return results.map((price) => ({ ...price }));
}

export function latestFetchedAt(prices: CryptoSymbolPrice[]): string | null {
  let max = 0;
  for (const price of prices) {
    if (!price.fetchedAt) continue;
    const ms = new Date(price.fetchedAt).getTime();
    if (ms > max) max = ms;
  }
  return max > 0 ? new Date(max).toISOString() : null;
}
