import { z } from "zod";

/**
 * Valid values for accion field
 */
export const AccionEnum = z.enum(["Ingreso", "Gasto", "Inversión"]);

/**
 * Auto-correct stale years in dates.
 * If the date is more than 30 days in the past, assume the year is wrong
 * and replace it with the current year. This handles OCR/AI errors where
 * old years (e.g. 2023) are extracted from screenshots.
 */
function autoCorrectFecha(dateString: string): string {
  const inputDate = new Date(dateString);
  if (Number.isNaN(inputDate.getTime())) {
    return dateString; // Let Zod catch invalid dates
  }

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  if (inputDate < thirtyDaysAgo) {
    // Date is stale: replace year with current year
    const corrected = new Date(inputDate);
    corrected.setFullYear(now.getFullYear());
    console.log(`[API Validation] Auto-corrected year: ${dateString} → ${corrected.toISOString()}`);
    return corrected.toISOString();
  }

  return dateString;
}

/**
 * Schema for creating a finance entry via the public API.
 */
export const CreateEntrySchema = z.object({
  fecha: z
    .string()
    .datetime({ message: "fecha must be a valid ISO 8601 datetime string" })
    .transform((val) => autoCorrectFecha(val)),
  tipo: z.string().min(1).max(255),
  accion: AccionEnum,
  que: z.string().min(1).max(255),
  plataforma_pago: z.string().min(1).max(255),
  cantidad: z.number().positive("cantidad must be a positive number"),
  detalle1: z.string().max(255).optional().nullable(),
  detalle2: z.string().max(255).optional().nullable(),
  quien: z.string().min(1).max(255).optional().default("Yo"),
});

export type CreateEntryInput = z.infer<typeof CreateEntrySchema>;

/**
 * Schema for batch creating multiple entries.
 */
export const BatchCreateEntrySchema = z.object({
  entries: z
    .array(CreateEntrySchema)
    .min(1, "At least one entry is required")
    .max(100, "Maximum 100 entries per batch"),
});

export type BatchCreateEntryInput = z.infer<typeof BatchCreateEntrySchema>;

export const CreateApiKeySchema = z.object({
  name: z.string().trim().min(1, "name is required").max(255),
});

export type CreateApiKeyInput = z.infer<typeof CreateApiKeySchema>;
