import { z } from 'zod';

import { normalizeCategory } from './categories';

import {
  applyJoyntlandaSplit,
  applyTimezoneShift,
  autoCorrectFecha,
} from '@/lib/entries/normalize';
import { logger } from '@/lib/logger';

/**
 * Valid values for accion field
 */
const AccionEnum = z.enum(['Ingreso', 'Gasto', 'Inversión']);

/**
 * Schema for creating a finance entry via the public API.
 */
export const CreateEntrySchema = z
  .object({
    fecha: z
      .string()
      .datetime({ message: 'fecha must be a valid ISO 8601 datetime string' })
      .transform((val) => applyTimezoneShift(autoCorrectFecha(val))),
    tipo: z
      .string()
      .min(1)
      .max(255)
      .transform((val) => {
        const normalized = normalizeCategory(val);
        if (normalized !== val) {
          logger.info(
            `[API Validation] Normalized category: "${val}" -> "${normalized}"`,
          );
        }
        return normalized;
      }),
    accion: AccionEnum,
    que: z.string().min(1).max(255),
    plataforma_pago: z.string().min(1).max(255),
    cantidad: z.number().positive('cantidad must be a positive number'),
    detalle1: z.string().max(255).optional().nullable(),
    detalle2: z.string().max(255).optional().nullable(),
    quien: z.string().min(1).max(255).optional().default('Yo'),
  })
  .transform((data) => ({
    ...data,
    cantidad: applyJoyntlandaSplit(data),
  }));

export type CreateEntryInput = z.infer<typeof CreateEntrySchema>;

/**
 * Schema for batch creating multiple entries.
 */
export const BatchCreateEntrySchema = z.object({
  entries: z
    .array(CreateEntrySchema)
    .min(1, 'At least one entry is required')
    .max(100, 'Maximum 100 entries per batch'),
});

export const CreateApiKeySchema = z.object({
  name: z.string().trim().min(1, 'name is required').max(255),
});
