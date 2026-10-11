import { z } from 'zod';

/**
 * Server-side contract for recording safebox movements. Amounts are euros
 * with exact-cent precision: opening/deposit/withdrawal carry a positive
 * magnitude, adjustments are signed and never zero, and every adjustment
 * needs a note explaining where the difference came from.
 */

const MAX_AMOUNT = 999_999_999.99;

/** Exact-cent check tolerant of binary floating-point noise (19.99 * 100). */
function hasCentPrecision(value: number): boolean {
  return Math.abs(value * 100 - Math.round(value * 100)) < 1e-6;
}

/** Snap a validated euro amount to its exact cent value. */
function roundToCents(value: number): number {
  return Math.round(value * 100) / 100;
}

export const CreateSafeboxMovementSchema = z
  .object({
    movementType: z.enum(['opening', 'deposit', 'withdrawal', 'adjustment']),
    amount: z
      .number()
      .finite('amount must be a finite number')
      .refine(hasCentPrecision, 'amount must have at most 2 decimals')
      .transform(roundToCents),
    note: z
      .string()
      .trim()
      .max(255, 'note must be at most 255 characters')
      .optional()
      .nullable(),
    movementDate: z
      .string()
      .datetime({ message: 'movementDate must be a valid ISO 8601 datetime' }),
  })
  .superRefine((data, ctx) => {
    if (data.movementType === 'adjustment') {
      if (data.amount === 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['amount'],
          message: 'adjustment amount must not be zero',
        });
      }
      if (Math.abs(data.amount) > MAX_AMOUNT) {
        ctx.addIssue({
          code: 'custom',
          path: ['amount'],
          message: `amount must not exceed ${MAX_AMOUNT}`,
        });
      }
      if (!data.note) {
        ctx.addIssue({
          code: 'custom',
          path: ['note'],
          message: 'adjustments require a note explaining the difference',
        });
      }
    } else {
      if (data.amount <= 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['amount'],
          message: 'amount must be greater than 0',
        });
      }
      if (data.amount > MAX_AMOUNT) {
        ctx.addIssue({
          code: 'custom',
          path: ['amount'],
          message: `amount must not exceed ${MAX_AMOUNT}`,
        });
      }
    }
  });
