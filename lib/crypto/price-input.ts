/**
 * Crypto price sanity checks.
 */

const PRICE_DEVIATION_WARN_THRESHOLD = 0.25;
const STABLECOIN_DEVIATION_THRESHOLD = 0.15;
const RECENT_TX_WINDOW_DAYS = 30;

const KNOWN_STABLECOINS = new Set([
  'USDT',
  'USDC',
  'DAI',
  'FDUSD',
  'TUSD',
  'PYUSD',
  'BUSD',
  'USDS',
  'USDP',
  'EURC',
  'EURT',
  'AEUR',
  'FRAX',
  'LUSD',
  'GHO',
  'CRVUSD',
  'SUSD',
  'RLUSD',
  'USD1',
]);

export function isLikelyStablecoin(symbol: string): boolean {
  return KNOWN_STABLECOINS.has(symbol.trim().toUpperCase());
}

function isPositiveFinite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

/**
 * Derives the per-unit fiat price from the total euros spent and the
 * crypto amount received. Returns null when either input is not usable.
 */
export function unitPriceFromTotal(
  totalEur: number,
  amount: number,
): number | null {
  if (!isPositiveFinite(totalEur) || !isPositiveFinite(amount)) return null;
  return totalEur / amount;
}

/**
 * Total fiat implied by a per-unit price and a crypto amount.
 */
export function impliedTotalEur(
  unitPrice: number,
  amount: number,
): number | null {
  if (!isPositiveFinite(unitPrice) || !isPositiveFinite(amount)) return null;
  return unitPrice * amount;
}

export type PriceSanityLevel = 'ok' | 'info' | 'warn';

export type PriceSanityReason =
  'stablecoin' | 'recent-deviation' | 'historical-deviation' | null;

export interface PriceSanityInput {
  symbol?: string | null;
  unitPrice?: number | string | null;
  amount?: number | string | null;
  marketPriceEur?: number | null;
  transactionDate?: string | null;
  now?: Date;
}

export interface PriceSanityResult {
  level: PriceSanityLevel;
  deviationPercent: number | null;
  reason: PriceSanityReason;
}

function toNumber(value: number | string | null | undefined): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '') {
    return Number(value);
  }
  return NaN;
}

/**
 * Cross-checks a manually entered per-unit price against the current
 * market price. Catches the classic data-entry mistake of typing the
 * total euros spent into the per-unit price field (e.g. recording
 * 910 EUR/USDT instead of 0.86 EUR/USDT).
 *
 * Levels:
 * - 'warn': very likely a mistake (stablecoin far from parity, or a
 *   recent transaction deviating strongly from market)
 * - 'info': large deviation on an older transaction; often legitimate
 *   (historic purchase price) but worth double-checking
 * - 'ok': plausible or not enough information to judge
 */
export function evaluatePriceSanity(
  input: PriceSanityInput,
): PriceSanityResult {
  const unitPrice = toNumber(input.unitPrice);
  const marketPriceEur = toNumber(input.marketPriceEur);

  const base: PriceSanityResult = {
    level: 'ok',
    deviationPercent: null,
    reason: null,
  };

  if (!isPositiveFinite(unitPrice) || !isPositiveFinite(marketPriceEur)) {
    return base;
  }

  const deviation = Math.abs(unitPrice - marketPriceEur) / marketPriceEur;
  const deviationPercent = Math.round(deviation * 100);

  if (input.symbol && isLikelyStablecoin(input.symbol)) {
    if (deviation > STABLECOIN_DEVIATION_THRESHOLD) {
      return { level: 'warn', deviationPercent, reason: 'stablecoin' };
    }
    return { level: 'ok', deviationPercent, reason: null };
  }

  if (deviation <= PRICE_DEVIATION_WARN_THRESHOLD) {
    return { level: 'ok', deviationPercent, reason: null };
  }

  const reference = input.now ?? new Date();
  let ageDays = Number.POSITIVE_INFINITY;
  if (input.transactionDate) {
    const txTime = new Date(input.transactionDate).getTime();
    if (Number.isFinite(txTime)) {
      ageDays = (reference.getTime() - txTime) / 86_400_000;
    }
  }

  if (ageDays <= RECENT_TX_WINDOW_DAYS) {
    return { level: 'warn', deviationPercent, reason: 'recent-deviation' };
  }
  return { level: 'info', deviationPercent, reason: 'historical-deviation' };
}
