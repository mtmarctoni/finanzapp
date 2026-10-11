/**
 * Server-side facade for the safebox domain.
 *
 * Mirrors `lib/cryptoActions.ts`: only API routes and server components
 * import this file, every function takes the user from a `session`
 * argument resolved with `getServerSession`, and client components talk to
 * the `/api/safebox/*` routes via `lib/safebox-data.ts`.
 */

import { revalidatePath } from 'next/cache';

import { withRunningBalance } from '@/lib/safebox/balance';
import {
  type DeleteMovementResult,
  type InsertMovementResult,
  deleteMovement,
  getSummary,
  insertMovement,
  listMovements,
} from '@/lib/safebox/movements';
import type {
  SafeboxMovementInput,
  SafeboxMovementWithBalance,
  SafeboxSummary,
} from '@/types/finance';

const SAFEBOX_REVALIDATE_PATH = '/safebox';

export async function getSafeboxSummary(session: {
  user: { id: string };
}): Promise<SafeboxSummary> {
  return getSummary(session.user.id);
}

/**
 * Every movement with the balance right after it happened, newest first for
 * display. The running balance is folded over the full ascending history,
 * so it never resets with a view window.
 */
export async function getSafeboxMovements(session: {
  user: { id: string };
}): Promise<SafeboxMovementWithBalance[]> {
  const movements = await listMovements(session.user.id);
  return withRunningBalance(movements).reverse();
}

export async function createSafeboxMovement(
  input: SafeboxMovementInput,
  session: { user: { id: string } },
): Promise<InsertMovementResult> {
  const result = await insertMovement(input, session.user.id);
  if (result.ok) revalidatePath(SAFEBOX_REVALIDATE_PATH);
  return result;
}

export async function deleteSafeboxMovement(
  id: string,
  session: { user: { id: string } },
): Promise<DeleteMovementResult> {
  const result = await deleteMovement(id, session.user.id);
  if (result === 'deleted') revalidatePath(SAFEBOX_REVALIDATE_PATH);
  return result;
}
