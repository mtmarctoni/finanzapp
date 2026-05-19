import type { CryptoHoldingsSummary } from '@/types/finance';
import { withClient } from '@/lib/db';

/**
 * Aggregate holdings across all of a user's crypto transactions and
 * derive a per-symbol balance + cost basis. The CTE structure is
 * preserved verbatim from the original implementation in
 * `lib/cryptoActions.ts`; only the connection management was lifted
 * into the shared `withClient` helper.
 */
export async function aggregateHoldings(
  userId: string,
): Promise<CryptoHoldingsSummary[]> {
  return withClient(async (client) => {
    const result = await client.sql`
      WITH crypto_movements AS (
        SELECT
          crypto_symbol,
          SUM(CASE
            WHEN transaction_type IN ('deposit', 'staking', 'airdrop') THEN amount
            ELSE 0
          END) AS deposited,
          SUM(CASE
            WHEN transaction_type = 'deposit' THEN amount * COALESCE(price_at_transaction, 0)
            ELSE 0
          END) AS invested,
          SUM(CASE
            WHEN transaction_type = 'withdrawal' THEN amount
            ELSE 0
          END) AS withdrawn,
          SUM(CASE
            WHEN transaction_type = 'exchange' THEN amount
            ELSE 0
          END) AS exchanged_out,
          SUM(CASE
            WHEN fee_crypto = crypto_symbol THEN fee
            ELSE 0
          END) AS fees_paid
        FROM crypto_transactions
        WHERE user_id = ${userId}
        GROUP BY crypto_symbol
      ),
      exchanges_in AS (
        SELECT
          to_crypto_symbol AS crypto_symbol,
          SUM(to_amount) AS exchanged_in
        FROM crypto_transactions
        WHERE user_id = ${userId}
          AND transaction_type = 'exchange'
          AND to_crypto_symbol IS NOT NULL
        GROUP BY to_crypto_symbol
      )
      SELECT
        m.crypto_symbol,
        (
          COALESCE(m.deposited, 0)
          - COALESCE(m.withdrawn, 0)
          - COALESCE(m.exchanged_out, 0)
          + COALESCE(e.exchanged_in, 0)
          - COALESCE(m.fees_paid, 0)
        ) AS total_amount,
        m.invested AS total_invested
      FROM crypto_movements m
      LEFT JOIN exchanges_in e ON m.crypto_symbol = e.crypto_symbol
      WHERE (
        COALESCE(m.deposited, 0)
        - COALESCE(m.withdrawn, 0)
        - COALESCE(m.exchanged_out, 0)
        + COALESCE(e.exchanged_in, 0)
        - COALESCE(m.fees_paid, 0)
      ) > 0
      ORDER BY m.invested DESC NULLS LAST
    `;

    return result.rows.map((row) => {
      const totalAmount = parseFloat(row.total_amount as string);
      const totalInvested = parseFloat((row.total_invested as string) || '0');
      return {
        symbol: row.crypto_symbol as string,
        totalAmount,
        totalInvested,
        averagePrice: totalAmount > 0 ? totalInvested / totalAmount : 0,
      };
    });
  });
}

/**
 * Distinct crypto symbols a user has interacted with — both source and
 * destination of exchanges count.
 */
export async function listUserSymbols(userId: string): Promise<string[]> {
  return withClient(async (client) => {
    const result = await client.sql`
      SELECT DISTINCT crypto_symbol FROM crypto_transactions
       WHERE user_id = ${userId}
      UNION
      SELECT DISTINCT to_crypto_symbol FROM crypto_transactions
       WHERE user_id = ${userId} AND to_crypto_symbol IS NOT NULL
      ORDER BY 1
    `;
    return result.rows.map((row) => row.crypto_symbol as string);
  });
}
