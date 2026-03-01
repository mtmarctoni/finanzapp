"use server";

import { createClient } from "@vercel/postgres";
import { revalidatePath } from "next/cache";
import { v4 as uuidv4 } from "uuid";
import type {
  CryptoTransaction,
  CryptoTransactionFormData,
  CryptoWallet,
  CryptoHoldingsSummary,
} from "@/types/finance";

interface CryptoTransactionFilter {
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

interface PaginatedCryptoTransactions {
  transactions: CryptoTransaction[];
  total: number;
  totalPages: number;
}

// Helper function to convert snake_case DB row to camelCase
function mapDbRowToTransaction(
  row: Record<string, unknown>
): CryptoTransaction {
  return {
    id: row.id as string,
    recordId: row.record_id as string | null,
    transactionType:
      row.transaction_type as CryptoTransaction["transactionType"],
    cryptoSymbol: row.crypto_symbol as string,
    amount: parseFloat(row.amount as string),
    priceAtTransaction: row.price_at_transaction
      ? parseFloat(row.price_at_transaction as string)
      : null,
    toCryptoSymbol: row.to_crypto_symbol as string | null,
    toAmount: row.to_amount ? parseFloat(row.to_amount as string) : null,
    fromWallet: row.from_wallet as string | null,
    toWallet: row.to_wallet as string | null,
    fee: parseFloat((row.fee as string) || "0"),
    feeCrypto: row.fee_crypto as string | null,
    notes: row.notes as string | null,
    transactionDate: (row.transaction_date as Date).toISOString(),
    externalTxId: row.external_tx_id as string | null,
    userId: row.user_id as string,
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
  };
}

function mapDbRowToWallet(row: Record<string, unknown>): CryptoWallet {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    name: row.name as string,
    walletType: row.wallet_type as CryptoWallet["walletType"],
    address: row.address as string | null,
    notes: row.notes as string | null,
    active: row.active as boolean,
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
  };
}

// ============================================
// CRYPTO TRANSACTIONS CRUD
// ============================================

export async function getCryptoTransactions(
  filters: CryptoTransactionFilter,
  session: { user: { id: string } }
): Promise<PaginatedCryptoTransactions> {
  const client = createClient();
  await client.connect();

  try {
    const {
      search = "",
      transactionType = "",
      cryptoSymbol = "",
      wallet = "",
      from = "",
      to = "",
      page = 1,
      itemsPerPage = 50,
      sortBy = "transaction_date",
      sortOrder = "desc",
    } = filters;

    // Build WHERE conditions
    const conditions: string[] = ["user_id = $1"];
    const params: (string | number)[] = [session.user.id];
    let paramIndex = 2;

    if (search) {
      conditions.push(`(
        crypto_symbol ILIKE $${paramIndex} OR 
        to_crypto_symbol ILIKE $${paramIndex} OR 
        from_wallet ILIKE $${paramIndex} OR 
        to_wallet ILIKE $${paramIndex} OR 
        notes ILIKE $${paramIndex}
      )`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (transactionType && transactionType !== "all") {
      conditions.push(`transaction_type = $${paramIndex}`);
      params.push(transactionType);
      paramIndex++;
    }

    if (cryptoSymbol) {
      conditions.push(
        `(crypto_symbol = $${paramIndex} OR to_crypto_symbol = $${paramIndex})`
      );
      params.push(cryptoSymbol);
      paramIndex++;
    }

    if (wallet) {
      conditions.push(
        `(from_wallet = $${paramIndex} OR to_wallet = $${paramIndex})`
      );
      params.push(wallet);
      paramIndex++;
    }

    if (from) {
      conditions.push(`transaction_date >= $${paramIndex}`);
      params.push(from);
      paramIndex++;
    }

    if (to) {
      conditions.push(`transaction_date <= $${paramIndex}`);
      params.push(to);
      paramIndex++;
    }

    const whereClause = conditions.join(" AND ");

    // Validate sortBy to prevent SQL injection
    const validSortFields = [
      "transaction_date",
      "crypto_symbol",
      "amount",
      "transaction_type",
      "created_at",
    ];
    const safeSortBy = validSortFields.includes(sortBy)
      ? sortBy
      : "transaction_date";
    const safeSortOrder = sortOrder === "asc" ? "ASC" : "DESC";

    // Count total
    const countQuery = `SELECT COUNT(*) FROM crypto_transactions WHERE ${whereClause}`;
    const countResult = await client.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count, 10);

    // Get paginated results
    const offset = (page - 1) * itemsPerPage;
    const dataQuery = `
      SELECT * FROM crypto_transactions 
      WHERE ${whereClause}
      ORDER BY ${safeSortBy} ${safeSortOrder}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(itemsPerPage, offset);

    const dataResult = await client.query(dataQuery, params);
    const transactions = dataResult.rows.map(mapDbRowToTransaction);

    return {
      transactions,
      total,
      totalPages: Math.ceil(total / itemsPerPage),
    };
  } finally {
    await client.end();
  }
}

export async function getCryptoTransactionById(
  id: string,
  session: { user: { id: string } }
): Promise<CryptoTransaction | null> {
  const client = createClient();
  await client.connect();

  try {
    const result = await client.sql`
      SELECT * FROM crypto_transactions 
      WHERE id = ${id} AND user_id = ${session.user.id}
    `;

    if (result.rows.length === 0) {
      return null;
    }

    return mapDbRowToTransaction(result.rows[0]);
  } finally {
    await client.end();
  }
}

export async function createCryptoTransaction(
  formData: CryptoTransactionFormData,
  session: { user: { id: string } }
): Promise<CryptoTransaction> {
  const client = createClient();
  await client.connect();

  try {
    const id = uuidv4();
    const now = new Date();

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
        ${session.user.id},
        ${now.toISOString()},
        ${now.toISOString()}
      )
      RETURNING *
    `;

    revalidatePath("/investment/crypto");
    return mapDbRowToTransaction(result.rows[0]);
  } finally {
    await client.end();
  }
}

export async function updateCryptoTransaction(
  id: string,
  formData: Partial<CryptoTransactionFormData>,
  session: { user: { id: string } }
): Promise<CryptoTransaction | null> {
  const client = createClient();
  await client.connect();

  try {
    // First check if the transaction exists and belongs to the user
    const existing = await client.sql`
      SELECT id FROM crypto_transactions 
      WHERE id = ${id} AND user_id = ${session.user.id}
    `;

    if (existing.rows.length === 0) {
      return null;
    }

    const now = new Date();

    const result = await client.sql`
      UPDATE crypto_transactions SET
        transaction_type = COALESCE(${
          formData.transactionType
        }, transaction_type),
        crypto_symbol = COALESCE(${formData.cryptoSymbol?.toUpperCase()}, crypto_symbol),
        amount = COALESCE(${formData.amount}, amount),
        price_at_transaction = COALESCE(${
          formData.priceAtTransaction
        }, price_at_transaction),
        to_crypto_symbol = COALESCE(${formData.toCryptoSymbol?.toUpperCase()}, to_crypto_symbol),
        to_amount = COALESCE(${formData.toAmount}, to_amount),
        from_wallet = COALESCE(${formData.fromWallet}, from_wallet),
        to_wallet = COALESCE(${formData.toWallet}, to_wallet),
        fee = COALESCE(${formData.fee}, fee),
        fee_crypto = COALESCE(${formData.feeCrypto?.toUpperCase()}, fee_crypto),
        notes = COALESCE(${formData.notes}, notes),
        transaction_date = COALESCE(${
          formData.transactionDate
        }, transaction_date),
        external_tx_id = COALESCE(${formData.externalTxId}, external_tx_id),
        updated_at = ${now.toISOString()}
      WHERE id = ${id} AND user_id = ${session.user.id}
      RETURNING *
    `;

    revalidatePath("/investment/crypto");
    return mapDbRowToTransaction(result.rows[0]);
  } finally {
    await client.end();
  }
}

export async function deleteCryptoTransaction(
  id: string,
  session: { user: { id: string } }
): Promise<boolean> {
  const client = createClient();
  await client.connect();

  try {
    const result = await client.sql`
      DELETE FROM crypto_transactions 
      WHERE id = ${id} AND user_id = ${session.user.id}
      RETURNING id
    `;

    revalidatePath("/investment/crypto");
    return result.rows.length > 0;
  } finally {
    await client.end();
  }
}

export async function duplicateCryptoTransaction(
  id: string,
  session: { user: { id: string } }
): Promise<CryptoTransaction | null> {
  const client = createClient();
  await client.connect();

  try {
    // Fetch the existing transaction
    const existing = await client.sql`
      SELECT * FROM crypto_transactions 
      WHERE id = ${id} AND user_id = ${session.user.id}
    `;

    if (existing.rows.length === 0) {
      return null;
    }

    const transaction = existing.rows[0];
    const newId = uuidv4();
    const now = new Date();

    // Insert a duplicate transaction with a new ID and timestamps
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
        ${session.user.id},
        ${now.toISOString()},
        ${now.toISOString()}
      )
      RETURNING *
    `;

    revalidatePath("/investment/crypto");
    return mapDbRowToTransaction(result.rows[0]);
  } finally {
    await client.end();
  }
}

// ============================================
// CRYPTO WALLETS CRUD
// ============================================

export async function getCryptoWallets(session: {
  user: { id: string };
}): Promise<CryptoWallet[]> {
  const client = createClient();
  await client.connect();

  try {
    const result = await client.sql`
      SELECT * FROM crypto_wallets 
      WHERE user_id = ${session.user.id} AND active = true
      ORDER BY name ASC
    `;

    return result.rows.map(mapDbRowToWallet);
  } finally {
    await client.end();
  }
}

export async function createCryptoWallet(
  data: { name: string; walletType: string; address?: string; notes?: string },
  session: { user: { id: string } }
): Promise<CryptoWallet> {
  const client = createClient();
  await client.connect();

  try {
    const id = uuidv4();
    const now = new Date();

    const result = await client.sql`
      INSERT INTO crypto_wallets (
        id, user_id, name, wallet_type, address, notes, active, created_at, updated_at
      ) VALUES (
        ${id},
        ${session.user.id},
        ${data.name},
        ${data.walletType},
        ${data.address || null},
        ${data.notes || null},
        true,
        ${now.toISOString()},
        ${now.toISOString()}
      )
      RETURNING *
    `;

    revalidatePath("/investment/crypto");
    return mapDbRowToWallet(result.rows[0]);
  } finally {
    await client.end();
  }
}

// ============================================
// CRYPTO HOLDINGS SUMMARY
// ============================================

export async function getCryptoHoldings(session: {
  user: { id: string };
}): Promise<CryptoHoldingsSummary[]> {
  const client = createClient();
  await client.connect();

  try {
    // Calculate holdings by aggregating all transactions
    const result = await client.sql`
      WITH crypto_movements AS (
        -- Deposits and purchases (positive)
        SELECT 
          crypto_symbol,
          SUM(CASE 
            WHEN transaction_type IN ('deposit', 'staking', 'airdrop') THEN amount 
            ELSE 0 
          END) as deposited,
          SUM(CASE 
            WHEN transaction_type = 'deposit' THEN amount * COALESCE(price_at_transaction, 0)
            ELSE 0
          END) as invested,
          -- Withdrawals (negative)
          SUM(CASE 
            WHEN transaction_type = 'withdrawal' THEN amount 
            ELSE 0 
          END) as withdrawn,
          -- Exchanges out (negative)
          SUM(CASE 
            WHEN transaction_type = 'exchange' THEN amount 
            ELSE 0 
          END) as exchanged_out,
          -- Fees (negative)
          SUM(CASE 
            WHEN fee_crypto = crypto_symbol THEN fee 
            ELSE 0 
          END) as fees_paid
        FROM crypto_transactions
        WHERE user_id = ${session.user.id}
        GROUP BY crypto_symbol
      ),
      exchanges_in AS (
        -- Exchanges received (positive)
        SELECT 
          to_crypto_symbol as crypto_symbol,
          SUM(to_amount) as exchanged_in
        FROM crypto_transactions
        WHERE user_id = ${session.user.id}
          AND transaction_type = 'exchange'
          AND to_crypto_symbol IS NOT NULL
        GROUP BY to_crypto_symbol
      )
      SELECT 
        m.crypto_symbol,
        (COALESCE(m.deposited, 0) - COALESCE(m.withdrawn, 0) - COALESCE(m.exchanged_out, 0) + COALESCE(e.exchanged_in, 0) - COALESCE(m.fees_paid, 0)) as total_amount,
        m.invested as total_invested
      FROM crypto_movements m
      LEFT JOIN exchanges_in e ON m.crypto_symbol = e.crypto_symbol
      WHERE (COALESCE(m.deposited, 0) - COALESCE(m.withdrawn, 0) - COALESCE(m.exchanged_out, 0) + COALESCE(e.exchanged_in, 0) - COALESCE(m.fees_paid, 0)) > 0
      ORDER BY m.invested DESC NULLS LAST
    `;

    return result.rows.map((row) => ({
      symbol: row.crypto_symbol as string,
      totalAmount: parseFloat(row.total_amount as string),
      totalInvested: parseFloat((row.total_invested as string) || "0"),
      averagePrice:
        parseFloat((row.total_invested as string) || "0") /
          parseFloat(row.total_amount as string) || 0,
    }));
  } finally {
    await client.end();
  }
}

// ============================================
// HELPER: Get unique crypto symbols used
// ============================================

export async function getCryptoSymbols(session: {
  user: { id: string };
}): Promise<string[]> {
  const client = createClient();
  await client.connect();

  try {
    const result = await client.sql`
      SELECT DISTINCT crypto_symbol FROM crypto_transactions
      WHERE user_id = ${session.user.id}
      UNION
      SELECT DISTINCT to_crypto_symbol FROM crypto_transactions
      WHERE user_id = ${session.user.id} AND to_crypto_symbol IS NOT NULL
      ORDER BY 1
    `;

    return result.rows.map((row) => row.crypto_symbol as string);
  } catch (error) {
    console.error("Error in getCryptoSymbols:", error);
    throw error;
  } finally {
    await client.end();
  }
}

// ============================================
// HELPER: Get unique wallets used
// ============================================

export async function getUsedWallets(session: {
  user: { id: string };
}): Promise<string[]> {
  const client = createClient();
  await client.connect();

  try {
    const result = await client.sql`
      SELECT DISTINCT wallet FROM (
        SELECT from_wallet as wallet FROM crypto_transactions
        WHERE user_id = ${session.user.id} AND from_wallet IS NOT NULL
        UNION
        SELECT to_wallet as wallet FROM crypto_transactions
        WHERE user_id = ${session.user.id} AND to_wallet IS NOT NULL
      ) AS wallets
      ORDER BY wallet
    `;

    return result.rows.map((row) => row.wallet as string);
  } catch (error) {
    console.error("Error in getUsedWallets:", error);
    throw error;
  } finally {
    await client.end();
  }
}
