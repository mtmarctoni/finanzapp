import { v4 as uuidv4 } from 'uuid';
import type { CryptoWallet } from '@/types/finance';
import { withClient } from '@/lib/db';
import { mapDbRowToWallet } from './mappers';

export async function listWallets(userId: string): Promise<CryptoWallet[]> {
  return withClient(async (client) => {
    const result = await client.sql`
      SELECT * FROM crypto_wallets
       WHERE user_id = ${userId} AND active = true
       ORDER BY name ASC
    `;
    return result.rows.map(mapDbRowToWallet);
  });
}

export async function insertWallet(
  data: { name: string; walletType: string; address?: string; notes?: string },
  userId: string,
): Promise<CryptoWallet> {
  const id = uuidv4();
  const now = new Date();

  return withClient(async (client) => {
    const result = await client.sql`
      INSERT INTO crypto_wallets (
        id, user_id, name, wallet_type, address, notes,
        active, created_at, updated_at
      ) VALUES (
        ${id},
        ${userId},
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
    return mapDbRowToWallet(result.rows[0]);
  });
}

/**
 * Distinct wallet names that have actually been used as a from_wallet
 * or to_wallet in any of the user's transactions. Useful for autocomplete.
 */
export async function listUsedWallets(userId: string): Promise<string[]> {
  return withClient(async (client) => {
    const result = await client.sql`
      SELECT DISTINCT wallet FROM (
        SELECT from_wallet AS wallet FROM crypto_transactions
         WHERE user_id = ${userId} AND from_wallet IS NOT NULL
        UNION
        SELECT to_wallet AS wallet FROM crypto_transactions
         WHERE user_id = ${userId} AND to_wallet IS NOT NULL
      ) AS wallets
      ORDER BY wallet
    `;
    return result.rows.map((row) => row.wallet as string);
  });
}
