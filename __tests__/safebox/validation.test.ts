import { CreateSafeboxMovementSchema } from '@/lib/safebox/validation';

const VALID_DATE = '2026-10-11T10:00:00.000Z';

function input(overrides: Record<string, unknown> = {}) {
  return {
    movementType: 'deposit',
    amount: 50,
    movementDate: VALID_DATE,
    ...overrides,
  };
}

function parse(overrides: Record<string, unknown> = {}) {
  return CreateSafeboxMovementSchema.safeParse(input(overrides));
}

describe('CreateSafeboxMovementSchema', () => {
  describe('magnitudes (opening / deposit / withdrawal)', () => {
    it.each(['opening', 'deposit', 'withdrawal'] as const)(
      'accepts a positive %s amount',
      (movementType) => {
        const result = parse({ movementType, amount: 19.99 });
        expect(result.success).toBe(true);
        if (result.success) expect(result.data.amount).toBe(19.99);
      },
    );

    it('rejects zero and negative amounts', () => {
      expect(parse({ amount: 0 }).success).toBe(false);
      expect(parse({ amount: -10 }).success).toBe(false);
    });

    it('rejects more than two decimals', () => {
      expect(parse({ amount: 10.001 }).success).toBe(false);
    });

    it('accepts cent amounts that binary floats mishandle', () => {
      // 19.99 * 100 is 1998.9999999999998 in IEEE 754; it is still 19,99 €.
      const result = parse({ amount: 19.99 });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.amount).toBe(19.99);
    });
  });

  describe('adjustments', () => {
    it('accepts a signed amount with a note', () => {
      const result = parse({
        movementType: 'adjustment',
        amount: -5,
        note: 'Faltan 5 €',
      });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.amount).toBe(-5);
    });

    it('requires a note explaining the difference', () => {
      expect(parse({ movementType: 'adjustment', amount: -5 }).success).toBe(
        false,
      );
      expect(
        parse({ movementType: 'adjustment', amount: -5, note: '   ' }).success,
      ).toBe(false);
    });

    it('rejects a zero adjustment', () => {
      expect(
        parse({ movementType: 'adjustment', amount: 0, note: 'Nada' }).success,
      ).toBe(false);
    });
  });

  describe('shared fields', () => {
    it('rejects an invalid movement date', () => {
      expect(parse({ movementDate: 'ayer por la tarde' }).success).toBe(false);
    });

    it('rejects notes longer than 255 characters', () => {
      expect(parse({ note: 'x'.repeat(256) }).success).toBe(false);
    });

    it('trims the note and allows omitting it', () => {
      const withNote = parse({ note: '  del cajero  ' });
      expect(withNote.success).toBe(true);
      if (withNote.success) expect(withNote.data.note).toBe('del cajero');

      const without = parse();
      expect(without.success).toBe(true);
      if (without.success) expect(without.data.note).toBeUndefined();
    });
  });
});
