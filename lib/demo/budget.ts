import { withPool } from '@/lib/db';

/** A single PostgreSQL statement atomically reserves all four demo budgets.
 * Never replay on transport failure: the statement may already have committed.
 */
export async function reservePreviewBudget(visitor: string, units: number) {
  return withPool(async (pool) => {
    const result = await pool.query<{ retry_ms: number }>({
      text: 'SELECT reserve_preview_mutation($1, $2) AS retry_ms',
      values: [visitor, units],
    });
    return result.rows[0]?.retry_ms;
  });
}
