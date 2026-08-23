import {
  evaluatePriceSanity,
  impliedTotalEur,
  isLikelyStablecoin,
  unitPriceFromTotal,
} from '@/lib/crypto/price-input';

const NOW = new Date('2026-08-23T12:00:00Z');

describe('unitPriceFromTotal', () => {
  it('derives the per-unit price from total spent', () => {
    expect(unitPriceFromTotal(910, 1056.055)).toBeCloseTo(0.8616975441, 8);
    expect(unitPriceFromTotal(910, 1049.503)).toBeCloseTo(0.8670770831, 8);
  });

  it('returns null for invalid inputs', () => {
    expect(unitPriceFromTotal(0, 100)).toBeNull();
    expect(unitPriceFromTotal(-5, 100)).toBeNull();
    expect(unitPriceFromTotal(100, 0)).toBeNull();
    expect(unitPriceFromTotal(Number.NaN, 100)).toBeNull();
    expect(unitPriceFromTotal(100, Number.NaN)).toBeNull();
  });
});

describe('impliedTotalEur', () => {
  it('multiplies unit price by amount', () => {
    expect(impliedTotalEur(500, 1.19673)).toBeCloseTo(598.365, 3);
  });

  it('returns null for invalid inputs', () => {
    expect(impliedTotalEur(null as never, 10)).toBeNull();
    expect(impliedTotalEur(10, null as never)).toBeNull();
    expect(impliedTotalEur(-1, 10)).toBeNull();
  });
});

describe('isLikelyStablecoin', () => {
  it('matches known stablecoins case-insensitively', () => {
    expect(isLikelyStablecoin('USDT')).toBe(true);
    expect(isLikelyStablecoin('usdc')).toBe(true);
    expect(isLikelyStablecoin(' EURC ')).toBe(true);
    expect(isLikelyStablecoin('BTC')).toBe(false);
    expect(isLikelyStablecoin('ZANO')).toBe(false);
  });
});

describe('evaluatePriceSanity', () => {
  it('is ok when there is nothing to compare against', () => {
    expect(
      evaluatePriceSanity({ unitPrice: 910, marketPriceEur: null }),
    ).toEqual({ level: 'ok', deviationPercent: null, reason: null });
    expect(evaluatePriceSanity({ marketPriceEur: 100 })).toEqual({
      level: 'ok',
      deviationPercent: null,
      reason: null,
    });
    expect(evaluatePriceSanity({ unitPrice: 0, marketPriceEur: 100 })).toEqual({
      level: 'ok',
      deviationPercent: null,
      reason: null,
    });
  });

  it('is ok when the price is close to market', () => {
    const result = evaluatePriceSanity({
      symbol: 'BCH',
      unitPrice: 500,
      marketPriceEur: 451.98,
      transactionDate: '2026-02-05',
      now: NOW,
    });
    expect(result.level).toBe('ok');
    expect(result.deviationPercent).toBe(11);
  });

  it('warns on a stablecoin far from parity regardless of tx age (regression: 910 typed instead of 0.86)', () => {
    const result = evaluatePriceSanity({
      symbol: 'USDT',
      unitPrice: 910,
      marketPriceEur: 0.86,
      transactionDate: '2026-03-07',
      now: NOW,
    });
    expect(result.level).toBe('warn');
    expect(result.reason).toBe('stablecoin');
    expect(result.deviationPercent).toBeGreaterThan(10000);
  });

  it('accepts a stablecoin within tolerance of its market price', () => {
    const result = evaluatePriceSanity({
      symbol: 'USDT',
      unitPrice: 0.86,
      marketPriceEur: 0.8617,
      transactionDate: '2026-03-07',
      now: NOW,
    });
    expect(result.level).toBe('ok');
  });

  it('warns on a recent non-stable transaction deviating strongly from market', () => {
    const result = evaluatePriceSanity({
      symbol: 'BTC',
      unitPrice: 300,
      marketPriceEur: 451.98,
      transactionDate: '2026-08-20',
      now: NOW,
    });
    expect(result.level).toBe('warn');
    expect(result.reason).toBe('recent-deviation');
  });

  it('only informs on an old purchase deviating strongly from market', () => {
    const result = evaluatePriceSanity({
      symbol: 'BTC',
      unitPrice: 33800,
      marketPriceEur: 65500,
      transactionDate: '2024-01-01',
      now: NOW,
    });
    expect(result.level).toBe('info');
    expect(result.reason).toBe('historical-deviation');
  });

  it('treats a future-dated transaction as recent', () => {
    const result = evaluatePriceSanity({
      symbol: 'SOL',
      unitPrice: 500,
      marketPriceEur: 79.75,
      transactionDate: '2027-01-01',
      now: NOW,
    });
    expect(result.level).toBe('warn');
    expect(result.reason).toBe('recent-deviation');
  });

  it('falls back to info when the date is missing but deviation is large', () => {
    const result = evaluatePriceSanity({
      symbol: 'SOL',
      unitPrice: 500,
      marketPriceEur: 79.75,
    });
    expect(result.level).toBe('info');
    expect(result.reason).toBe('historical-deviation');
  });
});
