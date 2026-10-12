import { withClient } from '@/lib/db';

/** Internal only: parent locks prevent new FK references while counting cascades.
 * The public boundary already reserved the submitted parent rows. This reserves
 * only additional SET NULL rows; an oversized total rejects before DELETE.
 */
export async function deleteWithPreviewBudget(
  kind: 'entry' | 'merchant',
  ids: string[],
  userId: string,
  authorizeAdditional?: (units: number) => Promise<void>,
) {
  if (!authorizeAdditional)
    throw new Error('Preview deletion requires a cascade authorizer');
  const unique = [...new Set(ids)];
  const parent = kind === 'entry' ? 'finance_entries' : 'merchants';
  const child = kind === 'entry' ? 'crypto_transactions' : 'finance_entries';
  const column = kind === 'entry' ? 'record_id' : 'merchant_id';
  const cast = kind === 'entry' ? 'text' : 'uuid';
  // Table/column/cast identifiers come solely from the internal enum above.
  await withClient(async (client) => {
    await client.query('BEGIN');
    try {
      const owned = await client.query(
        `SELECT id FROM ${parent} WHERE user_id = $1 AND id = ANY($2::${cast}[]) ORDER BY id FOR UPDATE`,
        [userId, unique],
      );
      const lockedIds = owned.rows.map((row) => row.id);
      const references = await client.query(
        `SELECT id FROM ${child} WHERE ${column} = ANY($1::${cast}[]) LIMIT 61`,
        [lockedIds],
      );
      if (unique.length + references.rows.length > 60) {
        await authorizeAdditional(61); // shared Preview batch rejection
        throw new Error('Preview deletion exceeds its work bound');
      }
      if (references.rows.length)
        await authorizeAdditional(references.rows.length);
      await client.query(
        `DELETE FROM ${parent} WHERE user_id = $1 AND id = ANY($2::${cast}[])`,
        [userId, lockedIds],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });
}
