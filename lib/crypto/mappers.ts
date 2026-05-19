import type { CryptoTransaction, CryptoWallet } from '@/types/finance';

/**
 * Convert a snake_case row from `crypto_transactions` into the
 * camelCase domain object the rest of the app uses.
 *
 * Pulled out of `lib/cryptoActions.ts` so transactions, holdings,
 * wallets, and tests can share one source of truth instead of
 * duplicating mapping logic.
 */
export function mapDbRowToTransaction(
  row: Record<string, unknown>,
): CryptoTransaction {
  return {
    id: row.id as string,
    recordId: row.record_id as string | null,
    transactionType:
      row.transaction_type as CryptoTransaction['transactionType'],
    cryptoSymbol: row.crypto_symbol as string,
    amount: parseFloat(row.amount as string),
    priceAtTransaction: row.price_at_transaction
      ? parseFloat(row.price_at_transaction as string)
      : null,
    toCryptoSymbol: row.to_crypto_symbol as string | null,
    toAmount: row.to_amount ? parseFloat(row.to_amount as string) : null,
    fromWallet: row.from_wallet as string | null,
    toWallet: row.to_wallet as string | null,
    fee: parseFloat((row.fee as string) || '0'),
    feeCrypto: row.fee_crypto as string | null,
    notes: row.notes as string | null,
    transactionDate: (row.transaction_date as Date).toISOString(),
    externalTxId: row.external_tx_id as string | null,
    userId: row.user_id as string,
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
  };
}

export function mapDbRowToWallet(row: Record<string, unknown>): CryptoWallet {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    name: row.name as string,
    walletType: row.wallet_type as CryptoWallet['walletType'],
    address: row.address as string | null,
    notes: row.notes as string | null,
    active: row.active as boolean,
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
  };
}
