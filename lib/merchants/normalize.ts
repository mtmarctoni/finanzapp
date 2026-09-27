/**
 * Merchant-name normalisation.
 *
 * A receipt prints the merchant however the till happens to render it:
 * `MERCADONA S.A. 1234 MADRID`, `Mercadona`, `MERCADONA*DON`. The learning
 * table is keyed on `(user_id, normalized_name)`, so spelling noise has to
 * collapse or the table fills with near-duplicates that never learn.
 *
 * Only the noise collapses. A store or branch label is load-bearing and is
 * kept: `MERCADONA S.A. 1234 MADRID` -> `mercadona madrid` and
 * `MERCADONA*DON` -> `mercadona don` are two different shops, and merging
 * them would let a confirmation at one branch overwrite the other.
 *
 * Pure and dependency-free on purpose: it is unit-testable without a
 * database, and it never throws.
 */

/**
 * Tokens dropped anywhere in the name: Spanish legal forms (the
 * `MERCADONA S.A.` case). A dotted legal form arrives here as several
 * one-letter tokens (`S.A.` -> `['s', 'a']`) because `.` splits like any
 * other punctuation; the token pass below merges adjacent single letters
 * before consulting this set, so both `SA` and `S.A.` are recognised.
 */
const DROPPED_TOKENS = new Set([
  'sa',
  'sau',
  'sas',
  'srl',
  'sl',
  'slu',
  'sll',
  'scl',
  'sae',
  'sc',
  'cb',
  'coop',
  'cooperativa',
]);

/**
 * Digit lookalikes folded back to letters (`Mercad0na` -> `mercadona`).
 * Applied per token AFTER all-digit tokens are dropped, so the store number
 * in `MERCADONA S.A. 1234 MADRID` never becomes a word.
 */
const LEET: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
};

function foldToAscii(input: string): string {
  return (
    input
      .normalize('NFKD')
      // Strip the combining marks NFKD split off, e.g. `n` + U+0303 -> `n`
      .replace(/[\u0300-\u036f]/g, '')
  );
}

function isAllDigits(token: string): boolean {
  return token.length > 0 && /^\d+$/.test(token);
}

function unleet(token: string): string {
  return token.replace(/[013457]/g, (digit) => LEET[digit] ?? digit);
}

/**
 * Collapse a raw merchant string to its learning key.
 *
 * - Unicode-fold accents away (`Ñandú` -> `nandu`)
 * - Lowercase
 * - Replace every run of non-alphanumeric characters with a single space
 * - Drop bare numeric tokens (store numbers)
 * - Merge runs of single letters and drop Spanish legal forms
 * - Fold digit lookalikes back to letters (`Mercad0na` -> `mercadona`)
 *
 * An input with no usable characters returns `''`; callers must treat
 * that as "merchant unknown" rather than indexing on an empty key.
 */
export function normalizeMerchantName(raw: string): string {
  if (!raw || typeof raw !== 'string') return '';

  const folded = foldToAscii(raw)
    .toLowerCase()
    // Every non-alphanumeric run (including `*`, `.`, `/`, `-`) -> one space
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  if (!folded) return '';

  const tokens = folded
    .split(' ')
    .filter((token) => token.length > 0 && !isAllDigits(token));

  const kept: string[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    // A run of single letters may be a dotted legal form. Merge the run and
    // consult DROPPED_TOKENS once for the whole run (`s a` -> `sa`). A run
    // that is not a legal form stays merged — `H & M` -> `hm` — which is
    // fine because it is the same key every time.
    if (token.length === 1) {
      let end = i;
      let merged = '';
      while (end < tokens.length && tokens[end].length === 1) {
        merged += tokens[end];
        end++;
      }
      if (merged.length > 1) {
        if (!DROPPED_TOKENS.has(merged)) kept.push(unleet(merged));
        i = end - 1;
        continue;
      }
    }

    if (!DROPPED_TOKENS.has(token)) kept.push(unleet(token));
  }

  return kept.join(' ');
}
