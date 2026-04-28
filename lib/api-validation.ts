import { z } from "zod";
import { normalizeCategory } from "./categories";

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
    console.log(`[API Validation] Auto-corrected year: ${dateString} -> ${corrected.toISOString()}`);
    return corrected.toISOString();
  }

  return dateString;
}

/**
 * Convert an AI-extracted datetime to local-time-based UTC storage.
 *
 * The finance form builds the datetime from local date + local hour/minute,
 * then calls toISOString() which shifts to UTC. We must do the same here.
 *
 * Problem: the AI may send "2026-04-26T16:47:00.000Z" or "2026-04-26T16:47:00".
 * We can't use Date.getUTCHours() because it behaves differently with/without Z.
 *
 * Fix: extract raw numeric components from the string with regex, then rebuild
 * as a LOCAL time Date. Same as finance form: new Date("YYYY-MM-DDTHH:mm:00").
 *
 * Example: AI sends "2026-04-26T16:47:00.000Z" meaning 16:47 local Spain time.
 * Extract 2026, 04, 26, 16, 47. Rebuild local Date("2026-04-26T16:47:00").
 * toISOString() -> "2026-04-26T14:47:00.000Z" (UTC+2). Displays as 16:47 locally.
 */
function applyTimezoneShift(dateString: string): string {
  // Extract YYYY-MM-DDTHH:mm directly from the string, ignore any Z or ms
  const match = dateString.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/
  );

  if (!match) {
    console.warn(`[API Validation] Could not parse datetime components from: ${dateString}`);
    return dateString;
  }

  const [, year, month, day, hours, minutes] = match;

  // Rebuild as LOCAL time (no Z suffix = interpreted in local timezone)
  // This matches exactly what the finance form does
  const localDate = new Date(`${year}-${month}-${day}T${hours}:${minutes}:00`);

  if (Number.isNaN(localDate.getTime())) {
    console.warn(`[API Validation] Invalid local date rebuilt from: ${dateString}`);
    return dateString;
  }

  const shifted = localDate.toISOString();

  if (shifted !== dateString) {
    console.log(
      `[API Validation] Timezone shift: ${dateString} -> ${shifted} (treated as local time)`
    );
  }

  return shifted;
}

/**
 * Business rule: Joyntlanda expenses are split 50/50.
 * When plataforma_pago matches "joyntlanda" (case-insensitive),
 * store only the user's half.
 */
function applyJoyntlandaSplit(data: {
  plataforma_pago: string;
  cantidad: number;
}): number {
  if (data.plataforma_pago.trim().toLowerCase() === "joyntlanda") {
    const halved = Number((data.cantidad / 2).toFixed(2));
    console.log(
      `[API Validation] Joyntlanda split: ${data.cantidad} -> ${halved} (50%)`
    );
    return halved;
  }
  return data.cantidad;
}

/**
 * Schema for creating a finance entry via the public API.
 */
export const CreateEntrySchema = z
  .object({
    fecha: z
      .string()
      .datetime({ message: "fecha must be a valid ISO 8601 datetime string" })
      .transform((val) => applyTimezoneShift(autoCorrectFecha(val))),
    tipo: z
      .string()
      .min(1)
      .max(255)
      .transform((val) => {
        const normalized = normalizeCategory(val);
        if (normalized !== val) {
          console.log(`[API Validation] Normalized category: "${val}" -> "${normalized}"`);
        }
        return normalized;
      }),
    accion: AccionEnum,
    que: z.string().min(1).max(255),
    plataforma_pago: z.string().min(1).max(255),
    cantidad: z.number().positive("cantidad must be a positive number"),
    detalle1: z.string().max(255).optional().nullable(),
    detalle2: z.string().max(255).optional().nullable(),
    quien: z.string().min(1).max(255).optional().default("Yo"),
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
    .min(1, "At least one entry is required")
    .max(100, "Maximum 100 entries per batch"),
});

export type BatchCreateEntryInput = z.infer<typeof BatchCreateEntrySchema>;

export const CreateApiKeySchema = z.object({
  name: z.string().trim().min(1, "name is required").max(255),
});

export type CreateApiKeyInput = z.infer<typeof CreateApiKeySchema>;
