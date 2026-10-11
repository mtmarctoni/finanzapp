import type {
  SafeboxMovement,
  SafeboxMovementType,
  SafeboxMovementWithBalance,
} from '@/types/finance';

/**
 * Safebox balance math, kept pure and cents-based so the derived total and
 * the per-movement running balances can never drift apart by floating-point
 * rounding. All amounts that reach these functions are euro values with at
 * most two decimals (enforced by `lib/safebox/validation.ts` and the
 * NUMERIC(14, 2) column).
 */

export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

function fromCents(cents: number): number {
  return cents / 100;
}

/**
 * Signed contribution of a movement to the balance, in cents. Withdrawals
 * subtract their magnitude; adjustments carry their own sign.
 */
export function movementContributionCents(
  movementType: SafeboxMovementType,
  amount: number,
): number {
  const cents = toCents(amount);
  return movementType === 'withdrawal' ? -cents : cents;
}

/**
 * Expected safebox cash, in cents: opening + deposits - withdrawals +
 * adjustments. The safe can never hold a negative amount, so guards in the
 * repo reject movements that would push this below zero.
 */
export function computeBalanceCents(
  movements: Pick<SafeboxMovement, 'movementType' | 'amount'>[],
): number {
  return movements.reduce(
    (total, movement) =>
      total + movementContributionCents(movement.movementType, movement.amount),
    0,
  );
}

export function computeBalance(
  movements: Pick<SafeboxMovement, 'movementType' | 'amount'>[],
): number {
  return fromCents(computeBalanceCents(movements));
}

/**
 * Annotate each movement with the balance right after it happened. Input
 * must be chronological (oldest first); the output keeps the same order.
 */
export function withRunningBalance(
  movements: SafeboxMovement[],
): SafeboxMovementWithBalance[] {
  let balanceCents = 0;
  return movements.map((movement) => {
    balanceCents += movementContributionCents(
      movement.movementType,
      movement.amount,
    );
    return { ...movement, balanceAfter: fromCents(balanceCents) };
  });
}
