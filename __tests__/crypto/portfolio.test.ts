import { calculatePositions, type Ledger } from '@/lib/crypto/portfolio';
import type { CryptoTransaction } from '@/types/finance';

jest.mock('@/lib/db', () => ({
  getPool: jest.fn(),
  withClient: jest.fn(),
  withPool: jest.fn(),
}));

function tx(overrides: Partial<CryptoTransaction> = {}): CryptoTransaction {
  return {
    id: 'tx-id',
    recordId: null,
    transactionType: 'deposit',
    cryptoSymbol: 'BTC',
    amount: 1,
    priceAtTransaction: null,
    toCryptoSymbol: null,
    toAmount: null,
    fromWallet: null,
    toWallet: null,
    fee: 0,
    feeCrypto: null,
    notes: null,
    transactionDate: '2024-01-01T00:00:00.000Z',
    externalTxId: null,
    userId: 'user-1',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function positionOf(
  ledger: Ledger,
  symbol: string,
): { qty: number; costBasis: number; realizedPL: number } {
  const entry = ledger.entries().find(([s]) => s === symbol);
  if (!entry) throw new Error(`No ledger entry for ${symbol}`);
  return entry[1];
}

describe('calculatePositions', () => {
  it('accumulates buys into quantity and cost basis with zero realized P/L', () => {
    const ledger = calculatePositions([
      tx({ cryptoSymbol: 'BTC', amount: 1, priceAtTransaction: 30000 }),
      tx({
        cryptoSymbol: 'BTC',
        amount: 0.5,
        priceAtTransaction: 40000,
        transactionDate: '2024-02-01T00:00:00.000Z',
      }),
    ]);

    const btc = positionOf(ledger, 'BTC');
    expect(btc.qty).toBeCloseTo(1.5);
    expect(btc.costBasis).toBeCloseTo(50000);
    expect(btc.realizedPL).toBeCloseTo(0);
  });

  it('books positive realized P/L when selling above average cost', () => {
    const ledger = calculatePositions([
      tx({ cryptoSymbol: 'BTC', amount: 1, priceAtTransaction: 10000 }),
      tx({
        transactionType: 'withdrawal',
        cryptoSymbol: 'BTC',
        amount: 0.5,
        priceAtTransaction: 20000,
        transactionDate: '2024-02-01T00:00:00.000Z',
      }),
    ]);

    const btc = positionOf(ledger, 'BTC');
    expect(btc.qty).toBeCloseTo(0.5);
    expect(btc.costBasis).toBeCloseTo(5000);
    expect(btc.realizedPL).toBeCloseTo(5000);
  });

  it('books negative realized P/L when selling below average cost', () => {
    const ledger = calculatePositions([
      tx({ cryptoSymbol: 'BTC', amount: 1, priceAtTransaction: 10000 }),
      tx({
        transactionType: 'withdrawal',
        cryptoSymbol: 'BTC',
        amount: 0.5,
        priceAtTransaction: 6000,
        transactionDate: '2024-02-01T00:00:00.000Z',
      }),
    ]);

    const btc = positionOf(ledger, 'BTC');
    expect(btc.realizedPL).toBeCloseTo(-2000);
    expect(btc.costBasis).toBeCloseTo(5000);
  });

  it('carries exchange cost basis to the destination symbol', () => {
    const ledger = calculatePositions([
      tx({ cryptoSymbol: 'ETH', amount: 1, priceAtTransaction: 2000 }),
      tx({
        transactionType: 'exchange',
        cryptoSymbol: 'ETH',
        amount: 1,
        priceAtTransaction: 2000,
        toCryptoSymbol: 'SOL',
        toAmount: 10,
        transactionDate: '2024-02-01T00:00:00.000Z',
      }),
    ]);

    const eth = positionOf(ledger, 'ETH');
    expect(eth.qty).toBeCloseTo(0);
    expect(eth.costBasis).toBeCloseTo(0);
    expect(eth.realizedPL).toBeCloseTo(0);

    const sol = positionOf(ledger, 'SOL');
    expect(sol.qty).toBeCloseTo(10);
    expect(sol.costBasis).toBeCloseTo(2000);
    expect(sol.realizedPL).toBeCloseTo(0);
  });

  it('treats withdrawals without recorded price as P/L neutral', () => {
    const ledger = calculatePositions([
      tx({ cryptoSymbol: 'SOL', amount: 1, priceAtTransaction: 100 }),
      tx({
        transactionType: 'withdrawal',
        cryptoSymbol: 'SOL',
        amount: 0.5,
        priceAtTransaction: null,
        transactionDate: '2024-02-01T00:00:00.000Z',
      }),
    ]);

    const sol = positionOf(ledger, 'SOL');
    expect(sol.qty).toBeCloseTo(0.5);
    expect(sol.costBasis).toBeCloseTo(50);
    expect(sol.realizedPL).toBeCloseTo(0);
  });

  it('books inline crypto fees as a realized loss', () => {
    const ledger = calculatePositions([
      tx({
        cryptoSymbol: 'SOL',
        amount: 1,
        priceAtTransaction: 100,
        fee: 0.5,
        feeCrypto: 'SOL',
      }),
    ]);

    const sol = positionOf(ledger, 'SOL');
    expect(sol.qty).toBeCloseTo(0.5);
    expect(sol.costBasis).toBeCloseTo(50);
    expect(sol.realizedPL).toBeCloseTo(-50);
  });

  it('books standalone fee rows as a realized loss', () => {
    const ledger = calculatePositions([
      tx({ cryptoSymbol: 'SOL', amount: 1, priceAtTransaction: 100 }),
      tx({
        transactionType: 'fee',
        cryptoSymbol: 'SOL',
        amount: 0.25,
        transactionDate: '2024-02-01T00:00:00.000Z',
      }),
    ]);

    const sol = positionOf(ledger, 'SOL');
    expect(sol.qty).toBeCloseTo(0.75);
    expect(sol.costBasis).toBeCloseTo(75);
    expect(sol.realizedPL).toBeCloseTo(-25);
  });

  it('adds staking rewards at zero cost', () => {
    const ledger = calculatePositions([
      tx({ cryptoSymbol: 'ETH', amount: 1, priceAtTransaction: 2000 }),
      tx({
        transactionType: 'staking',
        cryptoSymbol: 'ETH',
        amount: 0.1,
        priceAtTransaction: null,
        transactionDate: '2024-02-01T00:00:00.000Z',
      }),
    ]);

    const eth = positionOf(ledger, 'ETH');
    expect(eth.qty).toBeCloseTo(1.1);
    expect(eth.costBasis).toBeCloseTo(2000);
  });

  it('clamps disposals larger than the tracked balance without negative quantities', () => {
    const ledger = calculatePositions([
      tx({ cryptoSymbol: 'BTC', amount: 0.5, priceAtTransaction: 100 }),
      tx({
        transactionType: 'withdrawal',
        cryptoSymbol: 'BTC',
        amount: 1,
        priceAtTransaction: 120,
        transactionDate: '2024-02-01T00:00:00.000Z',
      }),
    ]);

    const btc = positionOf(ledger, 'BTC');
    expect(btc.qty).toBeCloseTo(0);
    expect(btc.costBasis).toBeCloseTo(0);
    expect(btc.realizedPL).toBeCloseTo(0.5 * 120 - 50);
  });

  it('ignores wallet transfers', () => {
    const ledger = calculatePositions([
      tx({ cryptoSymbol: 'BTC', amount: 1, priceAtTransaction: 100 }),
      tx({
        transactionType: 'wallet_transfer',
        cryptoSymbol: 'BTC',
        amount: 5,
        fromWallet: 'A',
        toWallet: 'B',
        transactionDate: '2024-02-01T00:00:00.000Z',
      }),
    ]);

    const btc = positionOf(ledger, 'BTC');
    expect(btc.qty).toBeCloseTo(1);
    expect(btc.costBasis).toBeCloseTo(100);
  });

  it('replays transactions chronologically regardless of input order', () => {
    const ledger = calculatePositions([
      tx({
        transactionType: 'withdrawal',
        cryptoSymbol: 'BTC',
        amount: 0.5,
        priceAtTransaction: 20000,
        transactionDate: '2024-02-01T00:00:00.000Z',
      }),
      tx({ cryptoSymbol: 'BTC', amount: 1, priceAtTransaction: 10000 }),
    ]);

    const btc = positionOf(ledger, 'BTC');
    expect(btc.qty).toBeCloseTo(0.5);
    expect(btc.realizedPL).toBeCloseTo(5000);
  });
});
