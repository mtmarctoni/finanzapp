import { logger } from '@/lib/logger';

/**
 * Write-time transforms shared by every path that creates a
 * `finance_entries` row: the public API (`lib/api-validation.ts`), the
 * server actions (`lib/actions.ts`), and the receipt route.
 *
 * These used to live inside `lib/api-validation.ts`, which meant only the
 * public API got them. Extracting them here is what lets the receipt route
 * apply exactly the same rules instead of a lookalike copy.
 */

/**
 * Auto-correct stale years in dates.
 * If the date is more than 30 days in the past, assume the year is wrong
 * and replace it with the current year. This handles OCR/AI errors where
 * old years (e.g. 2023) are extracted from screenshots.
 */
export function autoCorrectFecha(dateString: string): string {
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
    logger.info(
      `[Entry Normalize] Auto-corrected year: ${dateString} -> ${corrected.toISOString()}`,
    );
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
 * as a LOCAL time Date.
 */
export function applyTimezoneShift(dateString: string): string {
  // Extract YYYY-MM-DDTHH:mm directly from the string, ignore any Z or ms
  const match = dateString.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/,
  );

  if (!match) {
    console.warn(
      `[Entry Normalize] Could not parse datetime components from: ${dateString}`,
    );
    return dateString;
  }

  const [, year, month, day, hours, minutes] = match;

  // Rebuild as LOCAL time (no Z suffix = interpreted in local timezone)
  const localDate = new Date(`${year}-${month}-${day}T${hours}:${minutes}:00`);

  if (Number.isNaN(localDate.getTime())) {
    console.warn(
      `[Entry Normalize] Invalid local date rebuilt from: ${dateString}`,
    );
    return dateString;
  }

  const shifted = localDate.toISOString();

  if (shifted !== dateString) {
    logger.info(
      `[Entry Normalize] Timezone shift: ${dateString} -> ${shifted} (treated as local time)`,
    );
  }

  return shifted;
}

/**
 * Business rule: Joyntlanda expenses are split 50/50.
 * When plataforma_pago matches "joyntlanda" (case-insensitive),
 * store only the user's half.
 */
export function applyJoyntlandaSplit(data: {
  plataforma_pago: string;
  cantidad: number;
}): number {
  if (data.plataforma_pago.trim().toLowerCase() === 'joyntlanda') {
    const halved = Number((data.cantidad / 2).toFixed(2));
    logger.info(
      `[Entry Normalize] Joyntlanda split: ${data.cantidad} -> ${halved} (50%)`,
    );
    return halved;
  }
  return data.cantidad;
}

function padTwo(value: number): string {
  return value.toString().padStart(2, '0');
}

/**
 * Build the `fecha` value stored for an entry from the three inputs the
 * finance form works with: a plain `YYYY-MM-DD` day, an hour and a minute.
 *
 * Deliberately different from `components/finance-form.tsx:215-216`, which
 * does `new Date(fecha)` then `setHours(...)`. `new Date('2026-03-15')` is
 * parsed as UTC midnight, so `setHours` reinterprets it in local time and
 * the stored day can slip backwards in negative-offset timezones. Building
 * the local string first — the same thing `applyTimezoneShift` does — keeps
 * the calendar day the user picked.
 */
export function buildEntryFecha(
  fecha: string,
  hora: number,
  minuto: number,
): string {
  const localDate = new Date(`${fecha}T${padTwo(hora)}:${padTwo(minuto)}:00`);

  if (Number.isNaN(localDate.getTime())) {
    throw new Error(`Invalid entry date: ${fecha}`);
  }

  return localDate.toISOString();
}
