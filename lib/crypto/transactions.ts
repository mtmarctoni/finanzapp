import { v4 as uuidv4 } from 'uuid';

import { mapDbRowToTransaction } from './mappers';

import { withClient } from '@/lib/db';
import { escapeLikePattern } from '@/lib/utils';
import type {
  CryptoTransaction,
  CryptoTransactionFormData,
} from '@/types/finance';

/**
 * Crypto transaction queries and mutations.
 *
 * Extracted from the 592-line `lib/cryptoActions.ts` so each domain
 * (transactions / wallets / holdings) lives in its own module. The
 * `lib/cryptoActions.ts` "use server" facade re-exports these.
 */

export interface CryptoTransactionFilter {
  search?: string;
  transactionType?: string;
  cryptoSymbol?: string;
  wallet?: string;
  from?: string;
  to?: string;
  page: number;
  itemsPerPage: number;
  sortBy?: string;
  sortOrder?: string;
}

export interface PaginatedCryptoTransactions {
  transactions: CryptoTransaction[];
  total: number;
  totalPages: number;
}

const VALID_SORT_FIELDS = new Set([
  'transaction_date',
  'crypto_symbol',
  'amount',
  'transaction_type',
  'created_at',
]);

interface CompiledFilter {
  whereClause: string;
  params: (string | number)[];
  nextParamIndex: number;
}

function compileTransactionFilter(
  filters: Omit<
    CryptoTransactionFilter,
    'page' | 'itemsPerPage' | 'sortBy' | 'sortOrder'
  >,
  userId: string,
): CompiledFilter {
  const conditions: string[] = ['user_id = $1'];
  const params: (string | number)[] = [userId];
  let paramIndex = 2;

  if (filters.search) {
    conditions.push(`(
      crypto_symbol ILIKE $${paramIndex} OR
      to_crypto_symbol ILIKE $${paramIndex} OR
      from_wallet ILIKE $${paramIndex} OR
      to_wallet ILIKE $${paramIndex} OR
      notes ILIKE $${paramIndex}
    )`);
    params.push(`%${escapeLikePattern(filters.search)}%`);
    paramIndex++;
  }

  if (filters.transactionType && filters.transactionType !== 'all') {
    conditions.push(`transaction_type = $${paramIndex}`);
    params.push(filters.transactionType);
    paramIndex++;
  }

  if (filters.cryptoSymbol) {
    conditions.push(
      `(crypto_symbol = $${paramIndex} OR to_crypto_symbol = $${paramIndex})`,
    );
    params.push(filters.cryptoSymbol);
    paramIndex++;
  }

  if (filters.wallet) {
    conditions.push(
      `(from_wallet = $${paramIndex} OR to_wallet = $${paramIndex})`,
    );
    params.push(filters.wallet);
    paramIndex++;
  }

  if (filters.from) {
    conditions.push(`transaction_date >= $${paramIndex}`);
    params.push(filters.from);
    paramIndex++;
  }

  if (filters.to) {
    conditions.push(`transaction_date <= $${paramIndex}`);
    params.push(filters.to);
    paramIndex++;
  }

  return {
    whereClause: conditions.join(' AND '),
    params,
    nextParamIndex: paramIndex,
  };
}

export async function listTransactions(
  filters: CryptoTransactionFilter,
  userId: string,
): Promise<PaginatedCryptoTransactions> {
  const {
    page = 1,
    itemsPerPage = 50,
    sortBy = 'transaction_date',
    sortOrder = 'desc',
    ...rest
  } = filters;
  const { whereClause, params, nextParamIndex } = compileTransactionFilter(
    rest,
    userId,
  );

  const safeSortBy = VALID_SORT_FIELDS.has(sortBy)
    ? sortBy
    : 'transaction_date';
  const safeSortOrder = sortOrder === 'asc' ? 'ASC' : 'DESC';

  return withClient(async (client) => {
    const countResult = await client.query(
      `SELECT COUNT(*) FROM crypto_transactions WHERE ${whereClause}`,
      params,
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const offset = (page - 1) * itemsPerPage;
    const dataResult = await client.query(
      `SELECT * FROM crypto_transactions
        WHERE ${whereClause}
        ORDER BY ${safeSortBy} ${safeSortOrder}
        LIMIT $${nextParamIndex} OFFSET $${nextParamIndex + 1}`,
      [...params, itemsPerPage, offset],
    );

    return {
      transactions: dataResult.rows.map(mapDbRowToTransaction),
      total,
      totalPages: Math.ceil(total / itemsPerPage),
    };
  });
}

export async function findTransactionById(
  id: string,
  userId: string,
): Promise<CryptoTransaction | null> {
  return withClient(async (client) => {
    const result = await client.sql`
      SELECT * FROM crypto_transactions
       WHERE id = ${id} AND user_id = ${userId}
       LIMIT 1
    `;
    if (result.rows.length === 0) return null;
    return mapDbRowToTransaction(result.rows[0]);
  });
}

export async function insertTransaction(
  formData: CryptoTransactionFormData,
  userId: string,
): Promise<CryptoTransaction> {
  const id = uuidv4();
  const now = new Date();

  return withClient(async (client) => {
    const result = await client.sql`
      INSERT INTO crypto_transactions (
        id, record_id, transaction_type, crypto_symbol, amount,
        price_at_transaction, to_crypto_symbol, to_amount,
        from_wallet, to_wallet, fee, fee_crypto, notes,
        transaction_date, external_tx_id, user_id, created_at, updated_at
      ) VALUES (
        ${id},
        ${formData.recordId || null},
        ${formData.transactionType},
        ${formData.cryptoSymbol.toUpperCase()},
        ${formData.amount},
        ${formData.priceAtTransaction || null},
        ${formData.toCryptoSymbol?.toUpperCase() || null},
        ${formData.toAmount || null},
        ${formData.fromWallet || null},
        ${formData.toWallet || null},
        ${formData.fee || 0},
        ${formData.feeCrypto?.toUpperCase() || null},
        ${formData.notes || null},
        ${formData.transactionDate},
        ${formData.externalTxId || null},
        ${userId},
        ${now.toISOString()},
        ${now.toISOString()}
      )
      RETURNING *
    `;
    return mapDbRowToTransaction(result.rows[0]);
  });
}

export async function updateTransactionById(
  id: string,
  formData: Partial<CryptoTransactionFormData>,
  userId: string,
): Promise<CryptoTransaction | null> {
  return withClient(async (client) => {
    const existing = await client.sql`
      SELECT id FROM crypto_transactions
       WHERE id = ${id} AND user_id = ${userId}
       LIMIT 1
    `;
    if (existing.rows.length === 0) return null;

    const now = new Date();
    const result = await client.sql`
      UPDATE crypto_transactions SET
        transaction_type     = COALESCE(${formData.transactionType}, transaction_type),
        crypto_symbol        = COALESCE(${formData.cryptoSymbol?.toUpperCase()}, crypto_symbol),
        amount               = COALESCE(${formData.amount}, amount),
        price_at_transaction = COALESCE(${formData.priceAtTransaction}, price_at_transaction),
        to_crypto_symbol     = COALESCE(${formData.toCryptoSymbol?.toUpperCase()}, to_crypto_symbol),
        to_amount            = COALESCE(${formData.toAmount}, to_amount),
        from_wallet          = COALESCE(${formData.fromWallet}, from_wallet),
        to_wallet            = COALESCE(${formData.toWallet}, to_wallet),
        fee                  = COALESCE(${formData.fee}, fee),
        fee_crypto           = COALESCE(${formData.feeCrypto?.toUpperCase()}, fee_crypto),
        notes                = COALESCE(${formData.notes}, notes),
        transaction_date     = COALESCE(${formData.transactionDate}, transaction_date),
        external_tx_id       = COALESCE(${formData.externalTxId}, external_tx_id),
        updated_at           = ${now.toISOString()}
      WHERE id = ${id} AND user_id = ${userId}
      RETURNING *
    `;
    return mapDbRowToTransaction(result.rows[0]);
  });
}

export async function deleteTransactionById(
  id: string,
  userId: string,
): Promise<boolean> {
  return withClient(async (client) => {
    const result = await client.sql`
      DELETE FROM crypto_transactions
       WHERE id = ${id} AND user_id = ${userId}
       RETURNING id
    `;
    return result.rows.length > 0;
  });
}

export async function duplicateTransactionById(
  id: string,
  userId: string,
): Promise<CryptoTransaction | null> {
  return withClient(async (client) => {
    const existing = await client.sql`
      SELECT * FROM crypto_transactions
       WHERE id = ${id} AND user_id = ${userId}
       LIMIT 1
    `;
    if (existing.rows.length === 0) return null;

    const transaction = existing.rows[0];
    const newId = uuidv4();
    const now = new Date();

    const result = await client.sql`
      INSERT INTO crypto_transactions (
        id, record_id, transaction_type, crypto_symbol, amount,
        price_at_transaction, to_crypto_symbol, to_amount,
        from_wallet, to_wallet, fee, fee_crypto, notes,
        transaction_date, external_tx_id, user_id, created_at, updated_at
      ) VALUES (
        ${newId},
        ${transaction.record_id},
        ${transaction.transaction_type},
        ${transaction.crypto_symbol},
        ${transaction.amount},
        ${transaction.price_at_transaction},
        ${transaction.to_crypto_symbol},
        ${transaction.to_amount},
        ${transaction.from_wallet},
        ${transaction.to_wallet},
        ${transaction.fee},
        ${transaction.fee_crypto},
        ${transaction.notes},
        ${transaction.transaction_date},
        ${transaction.external_tx_id},
        ${userId},
        ${now.toISOString()},
        ${now.toISOString()}
      )
      RETURNING *
    `;
    return mapDbRowToTransaction(result.rows[0]);
  });
}
