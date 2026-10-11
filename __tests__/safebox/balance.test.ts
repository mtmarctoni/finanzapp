import {
  computeBalance,
  computeBalanceCents,
  movementContributionCents,
  withRunningBalance,
} from '@/lib/safebox/balance';
import type { SafeboxMovement } from '@/types/finance';

function movement(
  movementType: SafeboxMovement['movementType'],
  amount: number,
  id = `${movementType}-${amount}`,
): SafeboxMovement {
  return {
    id,
    movementType,
    amount,
    note: null,
    movementDate: '2026-10-01T10:00:00.000Z',
    createdAt: '2026-10-01T10:00:00.000Z',
  };
}

describe('movementContributionCents', () => {
  it('adds opening, deposit and adjustment amounts', () => {
    expect(movementContributionCents('opening', 200)).toBe(20_000);
    expect(movementContributionCents('deposit', 50.25)).toBe(5_025);
    expect(movementContributionCents('adjustment', -5)).toBe(-500);
  });

  it('subtracts withdrawal amounts', () => {
    expect(movementContributionCents('withdrawal', 50)).toBe(-5_000);
  });
});

describe('computeBalanceCents', () => {
  it('is zero with no movements', () => {
    expect(computeBalanceCents([])).toBe(0);
  });

  it('folds opening + deposits - withdrawals + adjustments', () => {
    const movements = [
      movement('opening', 200),
      movement('deposit', 100),
      movement('withdrawal', 50),
      movement('adjustment', -5),
      movement('adjustment', 2.5),
    ];
    expect(computeBalanceCents(movements)).toBe(24_750);
    expect(computeBalance(movements)).toBe(247.5);
  });

  it('is exact on amounts that binary floats mishandle', () => {
    // 0.1 + 0.2 !== 0.3 in floats; the cents math must not drift.
    const movements = [
      movement('deposit', 0.1),
      movement('deposit', 0.2),
      movement('withdrawal', 0.3),
    ];
    expect(computeBalanceCents(movements)).toBe(0);
  });
});

describe('withRunningBalance', () => {
  it('annotates each movement with the balance right after it', () => {
    const result = withRunningBalance([
      movement('opening', 200, 'a'),
      movement('deposit', 100, 'b'),
      movement('withdrawal', 50, 'c'),
      movement('adjustment', -5, 'd'),
    ]);

    expect(result.map((m) => m.balanceAfter)).toEqual([200, 300, 250, 245]);
  });

  it('keeps the input order and movement fields', () => {
    const result = withRunningBalance([
      movement('opening', 10, 'first'),
      movement('deposit', 5, 'second'),
    ]);

    expect(result.map((m) => m.id)).toEqual(['first', 'second']);
    expect(result[1].movementType).toBe('deposit');
  });
});
