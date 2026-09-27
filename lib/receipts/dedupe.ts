import { withPool } from '@/lib/db';
import { normalizeMerchantName } from '@/lib/merchants/normalize';

/**
 * Duplicate detection for receipt uploads.
 *
 * Two passes, because the evidence arrives at two different times:
 *
 * 1. `findEntryByContentHash` — before the model call. Identical bytes give
 *    an identical read, so a re-upload can be answered from the database
 *    without spending a model call.
 * 2. `findSimilarReceiptEntry` — after the parse. A re-photographed receipt
 *    is a *different* image with the *same* facts, and only the facts exist
 *    once the model has read them.
 */

export interface ReceiptCandidate {
  /** Local calendar date, YYYY-MM-DD. */
  fecha: string;
  hora: number;
  minuto: number;
  comercio: string;
  cantidad: number;
  plataforma_pago: string;
}

export interface ExistingEntrySummary {
  id: string;
  /** Calendar day, `YYYY-MM-DD`, formatted by SQL — see SUMMARY_COLUMNS. */
  fecha: string;
  tipo: string;
  accion: string;
  que: string;
  plataforma_pago: string;
  cantidad: number;
  detalle1: string | null;
  detalle2: string | null;
  quien: string | null;
}

/**
 * `fecha` is a `timestamptz`, and `pg` — which `@vercel/postgres` wraps —
 * hands a `timestamptz` back as a JavaScript `Date`. Selecting it as-is and
 * casting the row would put a `Date` where this module promises a string, and
 * the first `.split('-')` would throw. So the day is formatted in SQL, where
 * the driver cannot change its mind about the type.
 *
 * `AT TIME ZONE 'UTC'` pins the zone instead of inheriting the server's, and
 * it is the same convention the app already filters with:
 * `lib/entries/repo.ts:137` compares a bare `YYYY-MM-DD` against
 * `($1 || 'T00:00:00.000')::timestamptz`, i.e. it already treats a local
 * calendar day as a UTC day. Being consistent with that is what keeps the
 * dedupe window aligned with the rows `getEntriesByDateRange` would return.
 */
const SUMMARY_COLUMNS = `
  id, to_char(fecha AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS fecha,
  tipo, accion, que, plataforma_pago, cantidad,
  detalle1, detalle2, quien
`;

/** A cent either way is a rounding artefact, not a different purchase. */
const AMOUNT_EPSILON = 0.01;
const MAX_DAY_DIFFERENCE = 1;
const MIN_MERCHANT_SIMILARITY = 0.5;

/**
 * Jaccard-style overlap over normalized merchant-name tokens.
 * `MERCADONA S.A. 1234` normalizes to `mercadona`; `Mercadona` to
 * `mercadona`, so the two score 1. `Lidl` against either scores 0.
 */
function tokenSimilarity(left: string, right: string): number {
  const leftTokens = new Set(left.split(' ').filter(Boolean));
  const rightTokens = new Set(right.split(' ').filter(Boolean));
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;

  let shared = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) shared += 1;
  }
  return shared / Math.max(leftTokens.size, rightTokens.size);
}

/** Days since the epoch for a YYYY-MM-DD string, in UTC. NaN when unparseable. */
function dayNumber(fecha: string): number {
  const [year, month, day] = fecha.split('-');
  if (!year || !month || !day) return Number.NaN;
  const parsed = Date.UTC(Number(year), Number(month) - 1, Number(day));
  return Number.isNaN(parsed) ? Number.NaN : parsed / 86_400_000;
}

export function looksLikeSameReceipt(
  candidate: ReceiptCandidate,
  entry: Pick<ExistingEntrySummary, 'fecha' | 'cantidad' | 'que'>,
): boolean {
  if (Math.abs(candidate.cantidad - entry.cantidad) > AMOUNT_EPSILON) {
    return false;
  }

  const candidateDay = dayNumber(candidate.fecha);
  const entryDay = dayNumber(entry.fecha);
  // NaN on either side makes the comparison false, which is the safe
  // answer: a candidate we cannot place in time is not a confirmed match.
  if (
    Number.isNaN(candidateDay) ||
    Number.isNaN(entryDay) ||
    Math.abs(candidateDay - entryDay) > MAX_DAY_DIFFERENCE
  ) {
    return false;
  }

  const similarity = tokenSimilarity(
    normalizeMerchantName(candidate.comercio),
    normalizeMerchantName(entry.que),
  );
  return similarity >= MIN_MERCHANT_SIMILARITY;
}

export async function findEntryByContentHash(
  contentHash: string,
  userId: string,
): Promise<ExistingEntrySummary | null> {
  return await withPool(async (pool) => {
    const result = await pool.query(
      `SELECT ${SUMMARY_COLUMNS}
         FROM finance_entries
        WHERE user_id = $1
          AND content_hash = $2
        LIMIT 1`,
      [userId, contentHash],
    );
    const rows = result.rows as ExistingEntrySummary[];
    return rows[0] ?? null;
  });
}

export async function findSimilarReceiptEntry(
  candidate: ReceiptCandidate,
  userId: string,
): Promise<{ entry: ExistingEntrySummary; score: number } | null> {
  // Noon UTC centres the window on the candidate's local calendar date, so
  // the two-day span is symmetric around it regardless of the server's offset.
  const anchor = `${candidate.fecha}T12:00:00.000Z`;

  const rows = await withPool(async (pool) => {
    const result = await pool.query(
      `SELECT ${SUMMARY_COLUMNS}
         FROM finance_entries
        WHERE user_id = $1
          AND accion = 'Gasto'
          AND fecha >= $2::timestamptz - INTERVAL '1 day'
          AND fecha <= $2::timestamptz + INTERVAL '1 day'
        ORDER BY fecha DESC
        LIMIT 20`,
      [userId, anchor],
    );
    return result.rows as ExistingEntrySummary[];
  });

  let best: { entry: ExistingEntrySummary; score: number } | null = null;

  for (const row of rows) {
    if (!looksLikeSameReceipt(candidate, row)) continue;
    const score = tokenSimilarity(
      normalizeMerchantName(candidate.comercio),
      normalizeMerchantName(row.que),
    );
    if (best === null || score > best.score) {
      best = { entry: row, score };
    }
  }

  return best;
}
