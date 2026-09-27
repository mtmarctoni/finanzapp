import { withClient, withPool } from '@/lib/db';
import { normalizeMerchantName } from '@/lib/merchants/normalize';

/**
 * Database access for the `merchants` table — the per-user merchant memory.
 *
 * Same split as `lib/entries/repo.ts`: this is plain server-side TypeScript
 * with no `"use server"` directive, reached from client components only
 * through `lib/actions.ts` or an authenticated API route.
 *
 * Trust model. A row is *trusted* when the user has confirmed it at least
 * once (`veces_confirmado > 0`) or corrected it at least once
 * (`veces_corregido > 0`). A row created by a parse and never confirmed
 * holds the model's guess and is deliberately not trusted.
 */

const MERCHANT_COLUMNS = `
  id, canonical_name, normalized_name, tipo, plataforma_pago,
  veces_visto, veces_confirmado, veces_corregido
`;

/**
 * `@vercel/postgres` types its query generic as `QueryResultRow`, i.e.
 * `Record<string, any>`, and TypeScript does not give an `interface` an
 * implicit index signature. So pass no generic and cast the rows instead —
 * this is the same pattern as `lib/server-data.ts:236`.
 */

export interface MerchantRecord {
  id: string;
  canonical_name: string;
  normalized_name: string;
  tipo: string | null;
  plataforma_pago: string | null;
  veces_visto: number;
  veces_confirmado: number;
  veces_corregido: number;
}

export function isTrustedMerchant(merchant: MerchantRecord): boolean {
  return merchant.veces_confirmado > 0 || merchant.veces_corregido > 0;
}

function requireNormalizedName(raw: string): string {
  const normalized = normalizeMerchantName(raw);
  if (!normalized) {
    throw new Error('Merchant name is required');
  }
  return normalized;
}

export async function findMerchantByNormalizedName(
  normalizedName: string,
  userId: string,
): Promise<MerchantRecord | null> {
  if (!normalizedName) return null;

  return withPool(async (pool) => {
    const result = await pool.query(
      `SELECT ${MERCHANT_COLUMNS}
         FROM merchants
        WHERE user_id = $2 AND normalized_name = $1
        LIMIT 1`,
      [normalizedName, userId],
    );
    return (result.rows[0] as MerchantRecord | undefined) ?? null;
  });
}

/**
 * Record that a receipt was parsed for this merchant. Increments
 * `veces_visto` on repeat sightings. Never overwrites `canonical_name`:
 * the first spelling the user saw is the stable display value.
 */
export async function recordMerchantSeen(
  userId: string,
  comercio: string,
  tipo: string,
  plataformaPago: string,
): Promise<MerchantRecord> {
  const normalizedName = requireNormalizedName(comercio);

  return withClient(async (client) => {
    const result = await client.sql`
      INSERT INTO merchants (
        user_id, canonical_name, normalized_name, tipo,
        plataforma_pago, veces_visto
      ) VALUES (
        ${userId}, ${comercio}, ${normalizedName}, ${tipo},
        ${plataformaPago}, 1
      )
      ON CONFLICT (user_id, normalized_name) DO UPDATE
         SET veces_visto = merchants.veces_visto + 1,
             updated_at  = NOW()
      RETURNING id, canonical_name, normalized_name, tipo,
                plataforma_pago, veces_visto, veces_confirmado,
                veces_corregido
    `;
    return result.rows[0] as MerchantRecord;
  });
}

/**
 * Apply the user's confirmation. This is the only write that teaches.
 *
 * Done in a single statement so a concurrent confirmation cannot
 * interleave: the `veces_confirmado` / `veces_corregido` decision is made
 * by comparing the stored value to the incoming one inside the upsert,
 * rather than by reading and then writing.
 *
 * Only `tipo` decides confirm-vs-correct. `plataforma_pago` is still
 * overwritten with the latest value (memory only ever fills gaps the
 * receipt did not print), but paying the same merchant by card one week
 * and Bizum the next is not a correction, and counting it as one would
 * inflate `veces_corregido` with noise.
 *
 * `veces_visto` is deliberately untouched here: the confirmation is the
 * same sighting `recordMerchantSeen` already counted at parse time, not a
 * new one. The INSERT path still starts at 1 for a merchant first met on
 * this save.
 */
export async function applyMerchantConfirmation(input: {
  userId: string;
  comercio: string;
  tipo: string;
  plataforma_pago: string;
}): Promise<void> {
  const normalizedName = requireNormalizedName(input.comercio);

  await withClient(async (client) => {
    await client.sql`
      INSERT INTO merchants (
        user_id, canonical_name, normalized_name, tipo,
        plataforma_pago, veces_visto, veces_confirmado
      ) VALUES (
        ${input.userId}, ${input.comercio}, ${normalizedName}, ${input.tipo},
        ${input.plataforma_pago}, 1, 1
      )
      ON CONFLICT (user_id, normalized_name) DO UPDATE
         SET veces_confirmado = CASE
               WHEN merchants.tipo IS DISTINCT FROM EXCLUDED.tipo
               THEN merchants.veces_confirmado
               ELSE merchants.veces_confirmado + 1
             END,
             veces_corregido = CASE
               WHEN merchants.tipo IS DISTINCT FROM EXCLUDED.tipo
               THEN merchants.veces_corregido + 1
               ELSE merchants.veces_corregido
             END,
             tipo            = EXCLUDED.tipo,
             plataforma_pago = EXCLUDED.plataforma_pago,
             updated_at      = NOW()
    `;
  });
}

export async function listMerchants(userId: string): Promise<MerchantRecord[]> {
  return withPool(async (pool) => {
    const result = await pool.query(
      `SELECT ${MERCHANT_COLUMNS}
         FROM merchants
        WHERE user_id = $1
        ORDER BY veces_visto DESC, canonical_name ASC`,
      [userId],
    );
    return result.rows as MerchantRecord[];
  });
}

/**
 * Forget one merchant. Past entries keep their data; their `merchant_id`
 * is set to NULL by the table's `ON DELETE SET NULL`.
 */
export async function deleteMerchantById(
  id: string,
  userId: string,
): Promise<void> {
  await withClient(async (client) => {
    await client.sql`
      DELETE FROM merchants
       WHERE id = ${id}
         AND user_id = ${userId}
    `;
  });
}
