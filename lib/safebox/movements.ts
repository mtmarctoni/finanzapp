import type { VercelClient } from '@vercel/postgres';

import { movementContributionCents, toCents } from './balance';

import { withClient } from '@/lib/db';
import type {
  SafeboxMovement,
  SafeboxMovementInput,
  SafeboxSummary,
} from '@/types/finance';

/**
 * Safebox movement queries and mutations.
 *
 * The balance is never stored: every read derives it from the full movement
 * history, so the total and the ledger can never diverge. Guards keep the
 * physical invariant that a safe cannot hold negative cash: the first
 * movement must be the opening count, withdrawals and negative adjustments
 * cannot exceed the expected cash, and deletions cannot push it below zero.
 */

export type InsertMovementResult =
  | { ok: true; movement: SafeboxMovement }
  | {
      ok: false;
      reason: 'opening-required' | 'opening-exists' | 'insufficient-funds';
    };

export type DeleteMovementResult =
  'deleted' | 'not-found' | 'insufficient-funds';

function mapDbRowToMovement(row: Record<string, unknown>): SafeboxMovement {
  return {
    id: row.id as string,
    movementType: row.movement_type as SafeboxMovement['movementType'],
    amount: parseFloat(row.amount as string),
    note: (row.note as string | null) ?? null,
    movementDate: (row.movement_date as Date).toISOString(),
    createdAt: (row.created_at as Date).toISOString(),
  };
}

interface SafeboxStats {
  movementCount: number;
  balanceCents: number;
}

/** Current ledger stats for the guard checks, inside `client`'s transaction. */
async function readStats(
  client: VercelClient,
  userId: string,
): Promise<SafeboxStats> {
  const result = await client.query(
    `SELECT COUNT(*)::int AS movement_count,
            COALESCE(SUM(CASE WHEN movement_type = 'withdrawal' THEN -amount ELSE amount END), 0)::float AS balance
       FROM safebox_movements
      WHERE user_id = $1`,
    [userId],
  );
  return {
    movementCount: result.rows[0].movement_count as number,
    balanceCents: toCents(parseFloat(result.rows[0].balance as string)),
  };
}

/**
 * Every movement of the user's safebox, oldest first, so callers can fold
 * running balances over it. Safebox volume is low (a handful of movements
 * per week), so there is deliberately no pagination.
 */
export async function listMovements(
  userId: string,
): Promise<SafeboxMovement[]> {
  return withClient(async (client) => {
    const result = await client.sql`
      SELECT id, movement_type, amount, note, movement_date, created_at
        FROM safebox_movements
       WHERE user_id = ${userId}
       ORDER BY movement_date ASC, created_at ASC, id ASC
    `;
    return result.rows.map(mapDbRowToMovement);
  });
}

export async function getSummary(userId: string): Promise<SafeboxSummary> {
  return withClient(async (client) => {
    const result = await client.sql`
      SELECT COUNT(*)::int AS movement_count,
             COALESCE(SUM(CASE WHEN movement_type IN ('opening', 'deposit') THEN amount ELSE 0 END), 0)::float AS total_in,
             COALESCE(SUM(CASE WHEN movement_type = 'withdrawal' THEN amount ELSE 0 END), 0)::float AS total_out,
             COALESCE(SUM(CASE WHEN movement_type = 'adjustment' THEN amount ELSE 0 END), 0)::float AS total_adjustments,
             COALESCE(SUM(CASE WHEN movement_type = 'withdrawal' THEN -amount ELSE amount END), 0)::float AS balance,
             COALESCE(BOOL_OR(movement_type = 'opening'), false) AS has_opening
        FROM safebox_movements
       WHERE user_id = ${userId}
    `;
    const row = result.rows[0];
    return {
      balance: parseFloat(row.balance as string),
      totalIn: parseFloat(row.total_in as string),
      totalOut: parseFloat(row.total_out as string),
      totalAdjustments: parseFloat(row.total_adjustments as string),
      movementCount: row.movement_count as number,
      hasOpening: row.has_opening as boolean,
    };
  });
}

/**
 * Record a movement after checking the ledger rules:
 * - the first movement ever must be the `opening` count;
 * - `opening` is only valid as that first movement;
 * - withdrawals and negative adjustments cannot exceed the expected cash.
 *
 * The check and the insert share one transaction so a rolled-back guard
 * never leaves a partial write.
 */
export async function insertMovement(
  input: SafeboxMovementInput,
  userId: string,
): Promise<InsertMovementResult> {
  return withClient(async (client) => {
    await client.query('BEGIN');
    try {
      const stats = await readStats(client, userId);

      if (input.movementType === 'opening' && stats.movementCount > 0) {
        await client.query('ROLLBACK');
        return { ok: false, reason: 'opening-exists' };
      }
      if (input.movementType !== 'opening' && stats.movementCount === 0) {
        await client.query('ROLLBACK');
        return { ok: false, reason: 'opening-required' };
      }

      const contributionCents = movementContributionCents(
        input.movementType,
        input.amount,
      );
      if (stats.balanceCents + contributionCents < 0) {
        await client.query('ROLLBACK');
        return { ok: false, reason: 'insufficient-funds' };
      }

      const result = await client.sql`
        INSERT INTO safebox_movements (
          movement_type, amount, note, movement_date, user_id
        ) VALUES (
          ${input.movementType},
          ${input.amount},
          ${input.note ?? null},
          ${input.movementDate},
          ${userId}
        )
        RETURNING id, movement_type, amount, note, movement_date, created_at
      `;
      await client.query('COMMIT');
      return { ok: true, movement: mapDbRowToMovement(result.rows[0]) };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });
}

/**
 * Remove a mistaken movement. Deleting a deposit (or a positive adjustment)
 * can push the derived balance below zero once later withdrawals exist, so
 * the same physical invariant guards it.
 */
export async function deleteMovement(
  id: string,
  userId: string,
): Promise<DeleteMovementResult> {
  return withClient(async (client) => {
    await client.query('BEGIN');
    try {
      const existing = await client.sql`
        SELECT id, movement_type, amount
          FROM safebox_movements
         WHERE id = ${id} AND user_id = ${userId}
         LIMIT 1
      `;
      if (existing.rows.length === 0) {
        await client.query('ROLLBACK');
        return 'not-found';
      }

      const stats = await readStats(client, userId);
      const removed = existing.rows[0];
      const remainingCents =
        stats.balanceCents -
        movementContributionCents(
          removed.movement_type as SafeboxMovement['movementType'],
          parseFloat(removed.amount as string),
        );
      if (remainingCents < 0) {
        await client.query('ROLLBACK');
        return 'insufficient-funds';
      }

      await client.sql`
        DELETE FROM safebox_movements
         WHERE id = ${id} AND user_id = ${userId}
      `;
      await client.query('COMMIT');
      return 'deleted';
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });
}
