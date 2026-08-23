import { mapDbRowToTransaction } from './mappers';
import { getPricesForSymbols, latestFetchedAt } from './prices';

import { withClient } from '@/lib/db';
import type {
  CryptoPosition,
  CryptoPortfolioOverview,
  CryptoTransaction,
} from '@/types/finance';

/**
 * Crypto portfolio engine.
 *
 * Replays a user's transactions chronologically using the average cost
 * basis method to derive per-symbol positions (quantity, cost basis,
 * realized P/L) plus portfolio-wide totals. The core replay lives in
 * the pure {@link calculatePositions} function so it can be unit tested
 * without any database access.
 *
 * Semantics per movement type:
 * - deposit / staking / airdrop / genesis: acquisition at
 *   `price_at_transaction` (zero-cost when absent)
 * - withdrawal with recorded price: disposal, realized P/L booked
 * - withdrawal without price: disposal at average cost, P/L neutral
 * - exchange: cost basis carries over from source to destination symbol
 * - fee paid in crypto (`fee_crypto`, or a standalone `fee` row):
 *   disposal booked as a realized loss
 * - wallet_transfer: balance-neutral, ignored
 */

const QTY_EPSILON = 1e-12;

interface SymbolLedger {
  qty: number;
  costBasis: number;
  realizedPL: number;
}

function emptyLedger(): SymbolLedger {
  return { qty: 0, costBasis: 0, realizedPL: 0 };
}

export class Ledger {
  private readonly ledgers = new Map<string, SymbolLedger>();

  get(symbol: string): SymbolLedger {
    const key = symbol.toUpperCase();
    let ledger = this.ledgers.get(key);
    if (!ledger) {
      ledger = emptyLedger();
      this.ledgers.set(key, ledger);
    }
    return ledger;
  }

  entries(): [string, SymbolLedger][] {
    return [...this.ledgers.entries()];
  }

  acquire(symbol: string, qty: number, cost: number): void {
    if (!(qty > 0)) return;
    const ledger = this.get(symbol);
    ledger.qty += qty;
    ledger.costBasis += Math.max(0, cost);
  }

  /**
   * Remove up to `qty` units from `symbol`. Returns the cost actually
   * removed (used by exchanges to carry basis over to the destination
   * symbol). `unitProceeds` values disposals at a known sale price;
   * `null` books them at average cost (P/L neutral); `bookAsLoss`
   * records zero proceeds (fees).
   */
  dispose(
    symbol: string,
    qty: number,
    unitProceeds: number | null,
    bookAsLoss = false,
  ): number {
    if (!(qty > 0)) return 0;
    const ledger = this.get(symbol);
    if (ledger.qty <= QTY_EPSILON) return 0;

    const removedQty = Math.min(qty, ledger.qty);
    const avgCost = ledger.costBasis / ledger.qty;
    const removedCost = avgCost * removedQty;

    const proceeds = bookAsLoss
      ? 0
      : unitProceeds !== null
        ? unitProceeds * removedQty
        : removedCost;
    ledger.realizedPL += proceeds - removedCost;

    ledger.qty -= removedQty;
    ledger.costBasis -= removedCost;
    if (ledger.qty <= QTY_EPSILON) {
      ledger.qty = 0;
      ledger.costBasis = 0;
    }
    return removedCost;
  }

  realizedPLTotal(): number {
    return this.entries().reduce((sum, [, l]) => sum + l.realizedPL, 0);
  }
}

export function calculatePositions(transactions: CryptoTransaction[]): Ledger {
  const ledger = new Ledger();

  const ordered = [...transactions].sort(
    (a, b) =>
      new Date(a.transactionDate).getTime() -
      new Date(b.transactionDate).getTime(),
  );

  for (const tx of ordered) {
    switch (tx.transactionType) {
      case 'wallet_transfer':
        break;

      case 'deposit':
      case 'staking':
      case 'airdrop':
      case 'genesis': {
        ledger.acquire(
          tx.cryptoSymbol,
          tx.amount,
          tx.amount * (tx.priceAtTransaction ?? 0),
        );
        break;
      }

      case 'withdrawal': {
        ledger.dispose(tx.cryptoSymbol, tx.amount, tx.priceAtTransaction);
        break;
      }

      case 'exchange': {
        const carriedCost = ledger.dispose(tx.cryptoSymbol, tx.amount, null);
        if (tx.toCryptoSymbol && tx.toAmount !== null) {
          ledger.acquire(tx.toCryptoSymbol, tx.toAmount, carriedCost);
        }
        break;
      }

      case 'fee': {
        ledger.dispose(tx.cryptoSymbol, tx.amount, null, true);
        break;
      }
    }

    if (
      tx.transactionType !== 'fee' &&
      tx.fee > 0 &&
      tx.feeCrypto &&
      tx.feeCrypto.trim() !== ''
    ) {
      ledger.dispose(tx.feeCrypto, tx.fee, null, true);
    }
  }

  return ledger;
}

async function listAllTransactionsByDate(
  userId: string,
): Promise<CryptoTransaction[]> {
  return withClient(async (client) => {
    const result = await client.sql`
      SELECT * FROM crypto_transactions
       WHERE user_id = ${userId}
       ORDER BY transaction_date ASC, created_at ASC, id ASC
    `;
    return result.rows.map(mapDbRowToTransaction);
  });
}

export async function computePortfolio(
  userId: string,
): Promise<CryptoPortfolioOverview> {
  const transactions = await listAllTransactionsByDate(userId);
  const ledger = calculatePositions(transactions);

  const heldEntries = ledger.entries().filter(([, l]) => l.qty > QTY_EPSILON);
  const heldSymbols = heldEntries.map(([symbol]) => symbol);
  const prices =
    heldSymbols.length > 0 ? await getPricesForSymbols(heldSymbols) : [];
  const priceBySymbol = new Map(
    prices.map((price) => [price.symbol.toUpperCase(), price]),
  );

  const positions = heldEntries.map<CryptoPosition>(([symbol, position]) => {
    const price = priceBySymbol.get(symbol.toUpperCase()) ?? {
      symbol,
      priceEur: null,
      fetchedAt: null,
      stale: false,
      priceKnown: false,
    };
    const currentValue =
      price.priceKnown && price.priceEur !== null
        ? position.qty * price.priceEur
        : null;
    const unrealizedPL =
      currentValue !== null ? currentValue - position.costBasis : null;
    const unrealizedPLPercent =
      unrealizedPL !== null && position.costBasis > 0
        ? (unrealizedPL / position.costBasis) * 100
        : null;

    return {
      symbol,
      amount: position.qty,
      costBasis: position.costBasis,
      averageCost: position.qty > 0 ? position.costBasis / position.qty : 0,
      realizedPL: position.realizedPL,
      price,
      currentValue,
      unrealizedPL,
      unrealizedPLPercent,
    };
  });

  positions.sort((a, b) => {
    if (a.currentValue === null && b.currentValue === null) {
      return a.symbol.localeCompare(b.symbol);
    }
    if (a.currentValue === null) return 1;
    if (b.currentValue === null) return -1;
    return b.currentValue - a.currentValue;
  });

  const missingPrices = positions
    .filter((position) => !position.price.priceKnown)
    .map((position) => position.symbol);

  const totalCostBasis = positions.reduce(
    (sum, position) => sum + position.costBasis,
    0,
  );
  const totalValue =
    missingPrices.length === 0
      ? positions.reduce(
          (sum, position) => sum + (position.currentValue ?? 0),
          0,
        )
      : null;
  const unrealizedPL = totalValue !== null ? totalValue - totalCostBasis : null;
  const unrealizedPLPercent =
    unrealizedPL !== null && totalCostBasis > 0
      ? (unrealizedPL / totalCostBasis) * 100
      : null;

  return {
    positions,
    totals: {
      totalValue,
      totalCostBasis,
      unrealizedPL,
      unrealizedPLPercent,
      realizedPL: ledger.realizedPLTotal(),
    },
    pricesUpdatedAt: latestFetchedAt(prices),
    missingPrices,
  };
}
