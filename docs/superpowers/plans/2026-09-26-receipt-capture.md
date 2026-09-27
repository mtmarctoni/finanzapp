# Receipt Capture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user photograph or screenshot a receipt, have a vision model extract the transaction, correct it in one tap, and save it — while every correction teaches a per-user merchant→category map that makes the next one accurate and free.

**Architecture:** Two phases in one plan because they are not independent. Phase 0 fixes category drift across all three existing write paths and adds the `merchants` table; Phase 1 adds the multipart `parse-receipt` route on top of it. Phase 0 ships value on its own and is a clean stop point.

The merchant map is a **retrieval + human-label store**, not a model that gets smarter. The vision model extracts only _facts_ (date, amount, merchant name, printed payment method, its own confidence). Classification (`tipo`, `plataforma_pago`) is then decided in deterministic code: the user's own confirmed mapping first, then the `CATEGORY_ALIASES` table, then the model's guess as a last resort. The learn signal is the user's confirmation — confirmed with the same `tipo` → `veces_confirmado++`; confirmed with a different `tipo` → overwrite + `veces_corregido++`. A different `plataforma_pago` alone is never a correction (people pay the same merchant by card one week and Bizum the next), and the confirmation itself is not a new sighting (`recordMerchantSeen` already counted it), so `veces_visto` is not bumped again.

**One honest limitation, stated up front:** a merchant can only be looked up _after_ the image has been read, because reading the image is what reveals the merchant name. There is no separate OCR stage (that would mean `tesseract.js`, a new runtime dependency, and this plan adds none). So a known merchant does **not** skip the model call; it replaces the model's _guess_ with the user's own answer, and removes the two fields most likely to be wrong. The model call that is genuinely saved is the pre-AI **exact-hash dedupe**: re-uploading the same photo costs zero model calls.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5, Vercel AI SDK v6 (`ai@6.0.276`), `@ai-sdk/groq`, `@ai-sdk/openai-compatible`, `@openrouter/ai-sdk-provider`, zod 4.5.4, `@vercel/postgres` (tagged SQL, no ORM), Jest 29 + `next/jest`, Playwright 1.62.

**Spec:** This document. The conversation that produced it is not available to executors; everything they need is written here.

## Global Constraints

These apply to every task. Copy them verbatim; do not re-derive them.

- **Node ≥ 22, pnpm 11.1.3.** Never `npm`. Run scripts via `pnpm <script>`.
- **No new runtime dependencies.** No `sharp`, no `tesseract.js`, no object-storage SDK, no `pg_trgm`, no form-data parser. Image resizing happens in the browser via `<canvas>`; images are held in memory for one request and never persisted.
- **Prettier:** `singleQuote: true`, `trailingComma: 'all'`, `printWidth: 80`, `tabWidth: 2`, `semi: true` (from `prettier.config.mjs`). Default `arrowParens: "always"`. `pnpm format:check` gates CI.
- **Import order** (enforced by `import-x/order`, `eslint.config.mjs:54-68`): three blank-line-separated groups in the order **(1) external packages, (2) relative `./` imports, (3) `@/` aliased imports**. Each group alphabetised by module path. Named members inside `{ }` are NOT sorted.
- **Spanish user-facing strings** in API responses and UI, matching the existing routes (`'No autorizado'`, `'Límite de solicitudes excedido'`).
- **`logger.info` / `logger.warn` / `logger.error` from `@/lib/logger`** for server-side logging. `no-console` is an error except `console.warn` / `console.error`, which the existing routes use for provider-failure reporting — match the surrounding file's convention.
- **ESLint is strict.** `no-non-null-assertion: 'error'`, `no-unnecessary-condition: 'error'`, `array-type: array` (write `T[]`, not `Array<T>`), `promise-function-async: 'error'`. `@typescript-eslint/prefer-nullish-coalescing` needs an inline `// eslint-disable-next-line` _with a reason_ whenever `||` is genuinely wanted. Copy the existing style at `lib/entries/repo.ts:252-263`.
- **dependency-cruiser is fail-closed and gates CI** (`.dependency-cruiser.js`). This plan requires **no edits to it**:
  - `lib/` MUST NOT import from `app/`, `components/`, or `hooks/` (`:149`).
  - Nothing outside `app/` may import from `app/` (`:169`).
  - `app/api/**` MUST NOT import `components/`, `hooks/`, `lib/data.ts`, or `lib/crypto-data.ts` (`:196`).
  - `components/**` and `hooks/**` may import from `lib/` ONLY the allow-list at `.dependency-cruiser.js:128-143`. **The new client code in this plan imports no `lib/` module at all** — `components/ai/imageDownscale.ts` is self-contained by design. If you ever find yourself wanting `lib/merchants/normalize.ts` in a client component, that is a signal the logic is in the wrong layer, not that the allow-list needs widening.
  - `components/ai/` MUST NOT import from `components/crypto/` or any other feature folder (`:10-31`).
- **`knip` fails on any export you add but never consume.** Every new exported symbol must be imported by non-test code somewhere. If a helper is only used by its own module, do not export it.
- **CI gates, all blocking:** `lint`, `format:check`, `tsc --noEmit`, `depcruise`, `security` (trufflehog + `pnpm audit --audit-level=critical`), `build`, `test`, `e2e`. Locally: `pnpm check`, then `pnpm test`, then `pnpm knip`.
- **Route-test convention** (`__tests__/api/v1/entries.test.ts` is the reference): direct-import the `POST` handler, build a `NextRequest`, `jest.mock` the auth and DB modules, assert on the returned `NextResponse`. Declare `/** @jest-environment node */` at the top of any test that touches `Buffer`, `node:crypto`, or form-data parsing, because the repo default is `jest-environment-jsdom` (`jest.config.mjs:9`).
- **Database:** raw tagged SQL only. Use `withClient(cb)` from `@/lib/db` for writes — the callback receives the `VercelClient`, so call `client.sql\`...\``*inside* it, and use`withPool((pool) => pool.query(...))`for reads. Every query MUST filter by`user_id`; ownership is enforced in SQL, not middleware. There is no `middleware.ts`; every route authorizes itself with `getServerSession`.
- **Never commit secrets.** No new environment variables are required by this plan — it reuses `GROQ_API_KEY`, `OPENROUTER_API_KEY`, `OPENCODE_API_KEY`, and the Upstash pair. `trufflehog` gates CI.
- **Migrations:** new file at `db/migrations/YYYYMMDD_snake_case.sql`, using `IF NOT EXISTS` / `IF EXISTS` so it is re-runnable. **The same SQL must also be appended to `db/init.sql`** — CI provisions the E2E database from `init.sql` only (`.github/workflows/ci.yml:139`), never from the individual files. Also reflect the change in `db/schema.sql`, the canonical reference document.

## Review Focus

The five failure modes most likely to bite in real use, most likely first. Each has a test pinned to the task that owns the code, named in that task's steps.

1. **A `.png` renamed to `.jpg`, or an HTML/JS payload labelled as an image.** A client sets `Content-Type` on a `File` freely; it is untrusted input. Reject on magic bytes, never on the declared MIME type. Expect `415`, and expect the bytes never to reach a model.
2. **The same receipt uploaded twice** — the user retakes the photo because the first read looked wrong. Two identical images must not become two entries. The second attempt costs zero model calls and returns the existing entry with `duplicate: true`.
3. **A bank-app screenshot where the amount is somewhere else**, so the parse finds no amount or a wrong one. The route must return `success: false` with a field-level message, never a zero-amount entry. `cantidad` is `z.number().positive()`; a failed parse must not write `0`.
4. **The same merchant named 40 different ways** — `MERCADONA S.A. 1234 MADRID`, `Mercadona`, `MERCADONA*DON`, `Mercad0na`. All must collapse to one `normalized_name`, or the learning table fills with duplicates and stops learning.
5. **The user corrects the category to something that merchant has never been used with.** The correction must overwrite the stored `tipo` and be counted in `veces_corregido`, otherwise the wrong mapping is re-applied to every future purchase there forever.

---

## File Structure

**Created — server**

| Path                                               | Responsibility                                                                                               |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `db/migrations/20260926_add_receipt_ingestion.sql` | `merchants` table + 4 columns on `finance_entries` + indexes                                                 |
| `lib/merchants/normalize.ts`                       | Pure string normalisation: `normalizeMerchantName`, plus the dropped-token set                               |
| `lib/merchants/repo.ts`                            | SQL: lookup, `recordMerchantSeen`, `applyMerchantConfirmation`, list, delete, `isTrustedMerchant`            |
| `lib/entries/normalize.ts`                         | Shared write transforms: `autoCorrectFecha`, `applyTimezoneShift`, `applyJoyntlandaSplit`, `buildEntryFecha` |
| `lib/receipts/image.ts`                            | `MAX_IMAGE_BYTES`, `detectImageType`, `validateImageUpload`, `toDataUrl`, `ReceiptImageError`                |
| `lib/receipts/dedupe.ts`                           | `findEntryByContentHash` (pre-AI) and `findSimilarReceiptEntry` (post-AI)                                    |
| `lib/receipts/resolve.ts`                          | `resolveMerchantClassification` — memory → alias → model                                                     |
| `app/api/ai/parse-receipt/route.ts`                | The multipart endpoint                                                                                       |
| `app/api/merchants/route.ts`                       | `GET` list, `DELETE` one, for the memory card                                                                |

**Created — client**

| Path                                            | Responsibility                                                |
| ----------------------------------------------- | ------------------------------------------------------------- |
| `components/ai/imageDownscale.ts`               | `scaleDimensions` (pure math) + `downscaleImageFile` (canvas) |
| `components/ai/ReceiptUpload.tsx`               | Pick/shoot → downscale → POST → redirect to `/new`            |
| `components/merchants/MerchantMemoryCard.tsx`   | List + forget learned merchants                               |
| `__tests__/components/receipt-upload.test.tsx`  | Widget behaviour                                              |
| `__tests__/components/image-downscale.test.tsx` | Downscale maths + canvas path                                 |
| `e2e/receipt-upload.spec.ts`                    | Deterministic guard coverage, no model call                   |

**Modified**

| Path                                        | Change                                                                                       |
| ------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `db/schema.sql`                             | Mirror the migration                                                                         |
| `db/init.sql`                               | Append the migration SQL                                                                     |
| `lib/api-validation.ts:3,18-110`            | Import the three transforms from `lib/entries/normalize.ts` instead of defining them locally |
| `lib/categories.ts:6,81`                    | Export `STANDARD_CATEGORIES`                                                                 |
| `lib/server-data.ts:247-303`                | Merge standard categories into `tipo` options                                                |
| `lib/ai/fallback.ts:26-63,155-168,194-218`  | `requiresVision` flag, vision filter, reordering                                             |
| `lib/ai/prompts.ts`                         | Add `RECEIPT_PARSE_SYSTEM_PROMPT`                                                            |
| `lib/entries/repo.ts:54-64,234-302`         | `EntryInput` provenance fields; persist them                                                 |
| `lib/actions.ts:55-66`                      | `createEntry` learns from a receipt confirmation                                             |
| `components/finance-form.tsx:63-85,213-245` | Carry the `learning` payload into `createEntry`                                              |
| `app/new/page.tsx:15-51`                    | Parse the learning query params                                                              |
| `app/records/page.tsx:64-66`                | Mount `ReceiptUpload` and `MerchantMemoryCard`                                               |

**Not modified:** `.dependency-cruiser.js` (see Global Constraints), `package.json`, any lockfile.

---

## Task 0: Schema and migration

**Files:**

- Create: `db/migrations/20260926_add_receipt_ingestion.sql`
- Modify: `db/schema.sql`
- Modify: `db/init.sql` (append)
- Test: `__tests__/lib/receipts-schema.test.ts` (added as a deviation — see Step 3)

**Interfaces:**

- Consumes: nothing.
- Produces: table `merchants(id UUID, user_id VARCHAR(255), canonical_name VARCHAR(255), normalized_name VARCHAR(255), tipo VARCHAR(255) NULL, plataforma_pago VARCHAR(255) NULL, veces_visto INT, veces_confirmado INT, veces_corregido INT, created_at, updated_at)`, unique index on `(user_id, normalized_name)`; columns `finance_entries.merchant_id UUID NULL REFERENCES merchants(id) ON DELETE SET NULL`, `content_hash VARCHAR(64) NULL`, `origen VARCHAR(32) NOT NULL DEFAULT 'manual'`, `confianza NUMERIC(3,2) NULL`; unique partial index on `(user_id, content_hash) WHERE content_hash IS NOT NULL`; index on `(user_id, origen, fecha DESC)`.

- [ ] **Step 1: Create the migration file**

`db/migrations/20260926_add_receipt_ingestion.sql`:

```sql
-- Receipt capture: per-user merchant memory + entry provenance/idempotency.
-- Re-runnable: every statement is guarded.

CREATE TABLE IF NOT EXISTS merchants (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         VARCHAR(255) NOT NULL,
  canonical_name  VARCHAR(255) NOT NULL,
  normalized_name VARCHAR(255) NOT NULL,
  tipo            VARCHAR(255),
  plataforma_pago VARCHAR(255),
  veces_visto     INTEGER NOT NULL DEFAULT 0,
  veces_confirmado INTEGER NOT NULL DEFAULT 0,
  veces_corregido  INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS merchants_user_normalized_name_idx
  ON merchants (user_id, normalized_name);

CREATE INDEX IF NOT EXISTS merchants_user_id_idx
  ON merchants (user_id);

ALTER TABLE finance_entries
  ADD COLUMN IF NOT EXISTS merchant_id UUID
    REFERENCES merchants (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS content_hash VARCHAR(64),
  ADD COLUMN IF NOT EXISTS origen VARCHAR(32) NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS confianza NUMERIC(3, 2);

-- Exact-image idempotency. Partial so every manual entry (NULL hash) is
-- unaffected, and per-user so two users' identical screenshots both save.
CREATE UNIQUE INDEX IF NOT EXISTS finance_entries_user_content_hash_idx
  ON finance_entries (user_id, content_hash)
  WHERE content_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS finance_entries_origen_fecha_idx
  ON finance_entries (user_id, origen, fecha DESC);
```

- [ ] **Step 2: Append the same SQL to `db/init.sql`**

Open `db/init.sql`, find the last statement, and append the entire block from Step 1 verbatim, preceded by the same one-line comment. Do not reformat it.

- [ ] **Step 3: Update `db/schema.sql`**

Insert the `merchants` table **before** the `finance_entries` definition, keeping the file's existing comment style:

```sql
-- Table: merchants
-- Merchant memory: one row per (user, normalized merchant name).
-- Written after a receipt parse, updated after the user confirms.
-- Declared before finance_entries because that table references merchants(id).
CREATE TABLE IF NOT EXISTS merchants (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          VARCHAR(255) NOT NULL,
  canonical_name   VARCHAR(255) NOT NULL,
  normalized_name  VARCHAR(255) NOT NULL,
  tipo             VARCHAR(255),
  plataforma_pago  VARCHAR(255),
  veces_visto      INTEGER NOT NULL DEFAULT 0,
  veces_confirmado INTEGER NOT NULL DEFAULT 0,
  veces_corregido  INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS merchants_user_normalized_name_idx
  ON merchants (user_id, normalized_name);

CREATE INDEX IF NOT EXISTS merchants_user_id_idx ON merchants (user_id);
```

Then add to the `finance_entries` column list, after `user_id VARCHAR(255)` — note **no trailing comma** after `confianza`, it is the last column:

```sql
  merchant_id  UUID REFERENCES merchants (id) ON DELETE SET NULL,
  content_hash VARCHAR(64),
  origen       VARCHAR(32) NOT NULL DEFAULT 'manual',
  confianza    NUMERIC(3, 2)
```

And add the two `finance_entries` indexes after the table, mirroring the migration:

```sql
-- Exact-image idempotency. Partial so every manual entry (NULL hash) is
-- unaffected, and per-user so two users' identical screenshots both save.
CREATE UNIQUE INDEX IF NOT EXISTS finance_entries_user_content_hash_idx
  ON finance_entries (user_id, content_hash)
  WHERE content_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS finance_entries_origen_fecha_idx
  ON finance_entries (user_id, origen, fecha DESC);
```

**Deviation from the original plan (Step 3):** the plan said to insert `merchants`
_after_ `finance_entries` and listed no `finance_entries` indexes. Both are wrong.
`db/schema.sql` embeds the `merchant_id REFERENCES merchants(id)` clause inline, so
declaring `merchants` afterwards makes the script fail outright — and `README.md:146`
tells users to run exactly this file as their setup path. (`db/init.sql` is unaffected
because it adds the column via `ALTER TABLE ... ADD COLUMN` _after_ `merchants` already
exists.) The omitted indexes were also missing from the reference document even though the
migration creates them. `__tests__/lib/receipts-schema.test.ts` now guards all three files:
declaration order, both receipt indexes, the `WHERE content_hash IS NOT NULL` predicate,
and migration/`init.sql` agreement. The ordering assertion was confirmed to fail when the
defect is reintroduced.

- [ ] **Step 4: Apply to the scratch database and verify**

Run:

```bash
psql "$DATABASE_URL" -f db/migrations/20260926_add_receipt_ingestion.sql
psql "$DATABASE_URL" -f db/migrations/20260926_add_receipt_ingestion.sql
psql "$DATABASE_URL" -c "\d merchants"
psql "$DATABASE_URL" -c "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name='finance_entries' AND column_name IN ('merchant_id','content_hash','origen','confianza') ORDER BY column_name;"
```

Expected: the second run exits `0` with no error (re-runnable), `\d merchants` lists all 11 columns plus the two indexes, and the `information_schema` query returns exactly four rows — `confianza` / `content_hash` / `merchant_id` nullable, `origen` not nullable with default `manual`.

**Deviation from the original plan (Step 4):** the plan targeted the dev database. The
user chose the existing `TEST_DB_*` Neon database instead, remapped onto `POSTGRES_URL` /
`POSTGRES_URL_NON_POOLING`. The dev database must not be touched.

- [ ] **Step 5: Commit**

```bash
git add db/migrations/20260926_add_receipt_ingestion.sql db/init.sql db/schema.sql __tests__/lib/receipts-schema.test.ts
git commit -m "feat(receipts): add merchants table and entry provenance columns"
```

---

## Task 1: Merchant normalization

**Files:**

- Create: `lib/merchants/normalize.ts`
- Test: `__tests__/lib/merchants-normalize.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces: `normalizeMerchantName(raw: string): string` — returns a lowercase, ASCII-folded, space-joined key. Empty input returns `''`.
- Pins Review Focus #4.

- [ ] **Step 1: Write the failing test**

`__tests__/lib/merchants-normalize.test.ts`:

```ts
import { normalizeMerchantName } from '@/lib/merchants/normalize';

describe('normalizeMerchantName', () => {
  // Review Focus #4: spelling noise must collapse to one key, but a branch
  // label must survive it. The last two rows are the ones that matter.
  it.each([
    ['Mercadona', 'mercadona'],
    ['MERCADONA', 'mercadona'],
    ['  Mercadona  ', 'mercadona'],
    ['Mercad0na', 'mercadona'],
    ['MERCADONA S.A.', 'mercadona'],
    ['MERCADONA S.A. 1234 MADRID', 'mercadona madrid'],
    ['MERCADONA*DON', 'mercadona don'],
    ['Mercadona SLU', 'mercadona'],
    ['Café Central', 'cafe central'],
    ['CAFE CENTRAL', 'cafe central'],
    ['Restaurante Ñandú', 'restaurante nandu'],
    ['Media-Markt', 'media markt'],
  ])('normalizes %j to %j', (input, expected) => {
    expect(normalizeMerchantName(input)).toBe(expected);
  });

  it('keeps the store label after the chain name', () => {
    // Two branches of one chain are two memory rows, not one.
    expect(normalizeMerchantName('MERCADONA*DON')).toBe('mercadona don');
    expect(normalizeMerchantName('MERCADONA DON')).toBe('mercadona don');
    // Punctuation between the chain and the label is noise...
    expect(normalizeMerchantName('MERCADONA DON')).toBe('mercadona don');
    // ...but the label itself is not.
    expect(normalizeMerchantName('MERCADONA DON')).not.toBe(
      normalizeMerchantName('MERCADONA S.A. 1234 MADRID'),
    );
  });

  it('returns an empty string for empty or whitespace input', () => {
    expect(normalizeMerchantName('')).toBe('');
    expect(normalizeMerchantName('   ')).toBe('');
  });

  it('strips accents and case but keeps non-ascii letters as folded ascii', () => {
    expect(normalizeMerchantName('MÜLLER')).toBe('muller');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test __tests__/lib/merchants-normalize.test.ts`
Expected: FAIL — `Cannot find module '@/lib/merchants/normalize'`.

- [ ] **Step 3: Write the implementation**

`lib/merchants/normalize.ts`:

```ts
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test __tests__/lib/merchants-normalize.test.ts`
Expected: PASS — 15 tests, 0 failures (the 12 `it.each` rows count individually).

- [ ] **Step 5: Commit**

```bash
git add lib/merchants/normalize.ts __tests__/lib/merchants-normalize.test.ts
git commit -m "feat(merchants): normalize merchant names to a stable learning key"
```

---

## Task 2: Merchant repository

**Files:**

- Create: `lib/merchants/repo.ts`
- Test: `__tests__/lib/merchants-repo.test.ts`

**Interfaces:**

- Consumes: `normalizeMerchantName` from Task 1; `withClient` / `withPool` from `@/lib/db`; the `merchants` table from Task 0.
- Produces:
  ```ts
  export interface MerchantRecord {
    id: string;
    canonical_name: string;
    normalized_name: string;
    tipo: string | null;
    plataforma_pago: string | null;
    veces_visto: number;
    veces_confirmado: number;
    veces_corregido: number;
  }
  export function isTrustedMerchant(merchant: MerchantRecord): boolean;
  export async function findMerchantByNormalizedName(
    normalizedName: string,
    userId: string,
  ): Promise<MerchantRecord | null>;
  export async function recordMerchantSeen(
    userId: string,
    comercio: string,
    tipo: string,
    plataformaPago: string,
  ): Promise<MerchantRecord>;
  export async function applyMerchantConfirmation(input: {
    userId: string;
    comercio: string;
    tipo: string;
    plataforma_pago: string;
  }): Promise<void>;
  export async function listMerchants(
    userId: string,
  ): Promise<MerchantRecord[]>;
  export async function deleteMerchantById(
    id: string,
    userId: string,
  ): Promise<void>;
  ```
- Pins Review Focus #5.

- [ ] **Step 1: Write the failing test**

`__tests__/lib/merchants-repo.test.ts`:

```ts
import { withClient, withPool } from '@/lib/db';
import {
  applyMerchantConfirmation,
  deleteMerchantById,
  findMerchantByNormalizedName,
  isTrustedMerchant,
  listMerchants,
  recordMerchantSeen,
  type MerchantRecord,
} from '@/lib/merchants/repo';

jest.mock('@/lib/db', () => ({
  withClient: jest.fn(),
  withPool: jest.fn(),
}));

const withClientMock = withClient as jest.MockedFunction<typeof withClient>;
const withPoolMock = withPool as jest.MockedFunction<typeof withPool>;

const RECORD: MerchantRecord = {
  id: 'm-1',
  canonical_name: 'Mercadona',
  normalized_name: 'mercadona',
  tipo: 'Supermercado',
  plataforma_pago: 'Tarjeta',
  veces_visto: 3,
  veces_confirmado: 2,
  veces_corregido: 0,
};

function mockWrite(rows: unknown[] = []) {
  const sql = jest.fn().mockResolvedValue({ rows, rowCount: rows.length });
  withClientMock.mockImplementation(async (fn) => fn({ sql } as never));
  return sql;
}

function mockRead(rows: unknown[]) {
  const query = jest.fn().mockResolvedValue({ rows, rowCount: rows.length });
  withPoolMock.mockImplementation(async (fn) => fn({ query } as never));
  return query;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('isTrustedMerchant', () => {
  it('is untrusted when neither confirmations nor corrections are recorded', () => {
    expect(
      isTrustedMerchant({ ...RECORD, veces_confirmado: 0, veces_corregido: 0 }),
    ).toBe(false);
  });

  it('is trusted after a single confirmation', () => {
    expect(isTrustedMerchant({ ...RECORD, veces_confirmado: 1 })).toBe(true);
  });

  // Review Focus #5: a correction must not demote the row back to untrusted,
  // or the wrong value keeps being offered and the correction is lost.
  it('stays trusted after a correction', () => {
    expect(
      isTrustedMerchant({
        ...RECORD,
        veces_confirmado: 0,
        veces_corregido: 1,
      }),
    ).toBe(true);
  });
});

describe('findMerchantByNormalizedName', () => {
  it('returns null when there is no row', async () => {
    mockRead([]);
    await expect(
      findMerchantByNormalizedName('mercadona', 'user-1'),
    ).resolves.toBeNull();
  });

  it('scopes the lookup to the user id', async () => {
    const query = mockRead([RECORD]);
    await expect(
      findMerchantByNormalizedName('mercadona', 'user-1'),
    ).resolves.toEqual(RECORD);
    expect(query).toHaveBeenCalledWith(expect.any(String), [
      'mercadona',
      'user-1',
    ]);
  });

  it('does not query at all for an empty normalized name', async () => {
    mockRead([RECORD]);
    await expect(
      findMerchantByNormalizedName('', 'user-1'),
    ).resolves.toBeNull();
    expect(withPoolMock).not.toHaveBeenCalled();
  });
});

describe('recordMerchantSeen', () => {
  it('normalises the raw name before upserting', async () => {
    const sql = mockWrite([RECORD]);
    await recordMerchantSeen(
      'user-1',
      'MERCADONA S.A. 1234',
      'Supermercado',
      'Tarjeta',
    );
    const [query] = sql.mock.calls[0] as [TemplateStringsArray, ...unknown[]];
    const text = query.join('?');
    expect(text).toContain('INSERT INTO merchants');
    expect(text).toContain('ON CONFLICT (user_id, normalized_name)');
    const params = sql.mock.calls[0].slice(1) as unknown[];
    expect(params).toContain('user-1');
    expect(params).toContain('mercadona');
    expect(params).toContain('MERCADONA S.A. 1234');
  });

  it('rejects an unnormalisable merchant name instead of storing an empty key', async () => {
    mockWrite([RECORD]);
    await expect(
      recordMerchantSeen('user-1', '***', 'Supermercado', 'Tarjeta'),
    ).rejects.toThrow('Merchant name is required');
    expect(withClientMock).not.toHaveBeenCalled();
  });
});

describe('applyMerchantConfirmation', () => {
  // Review Focus #5: the SQL itself must overwrite the stored tipo and count
  // the correction, atomically, in one statement.
  it('increments veces_corregido and overwrites tipo when the value differs', async () => {
    const sql = mockWrite([]);
    await applyMerchantConfirmation({
      userId: 'user-1',
      comercio: 'Mercadona',
      tipo: 'Supermercado',
      plataforma_pago: 'Tarjeta',
    });
    const [query] = sql.mock.calls[0] as [TemplateStringsArray, ...unknown[]];
    const text = query.join('?').replace(/\s+/g, ' ');
    expect(text).toContain('THEN merchants.veces_corregido + 1');
    expect(text).toContain('ELSE merchants.veces_confirmado + 1');
    expect(text).toContain('tipo = EXCLUDED.tipo');
    expect(text).toContain('plataforma_pago = EXCLUDED.plataforma_pago');
  });

  it('counts only a category change as a correction, never the payment method', async () => {
    // Paying the same merchant by card one week and Bizum the next is not a
    // correction; the CASE must compare tipo alone.
    const sql = mockWrite([]);
    await applyMerchantConfirmation({
      userId: 'user-1',
      comercio: 'Mercadona',
      tipo: 'Supermercado',
      plataforma_pago: 'Bizum',
    });
    const [query] = sql.mock.calls[0] as [TemplateStringsArray, ...unknown[]];
    const text = query.join('?').replace(/\s+/g, ' ');
    expect(text).toContain('merchants.tipo IS DISTINCT FROM EXCLUDED.tipo');
    expect(text).not.toContain('plataforma_pago IS DISTINCT');
  });

  it('does not count the confirmation itself as a new sighting', async () => {
    // recordMerchantSeen already counted this receipt at parse time; if the
    // confirm bumped veces_visto again, one receipt would read as two.
    const sql = mockWrite([]);
    await applyMerchantConfirmation({
      userId: 'user-1',
      comercio: 'Mercadona',
      tipo: 'Supermercado',
      plataforma_pago: 'Tarjeta',
    });
    const [query] = sql.mock.calls[0] as [TemplateStringsArray, ...unknown[]];
    expect(query.join('?').replace(/\s+/g, ' ')).not.toContain(
      'veces_visto = merchants.veces_visto + 1',
    );
  });

  it('rejects an unnormalisable merchant name', async () => {
    mockWrite([]);
    await expect(
      applyMerchantConfirmation({
        userId: 'user-1',
        comercio: '',
        tipo: 'Supermercado',
        plataforma_pago: 'Tarjeta',
      }),
    ).rejects.toThrow('Merchant name is required');
    expect(withClientMock).not.toHaveBeenCalled();
  });
});

describe('listMerchants and deleteMerchantById', () => {
  it('lists newest sightings first, scoped to the user', async () => {
    const query = mockRead([RECORD]);
    await expect(listMerchants('user-1')).resolves.toEqual([RECORD]);
    const [text, params] = query.mock.calls[0] as [string, string[]];
    expect(text).toContain('ORDER BY veces_visto DESC');
    expect(params).toEqual(['user-1']);
  });

  it('deletes by id and user id together', async () => {
    const sql = mockWrite([]);
    await deleteMerchantById('m-1', 'user-1');
    const [query, ...params] = sql.mock.calls[0] as [
      TemplateStringsArray,
      ...unknown[],
    ];
    expect(query.join('?')).toContain('DELETE FROM merchants');
    expect(query.join('?')).toContain('AND user_id =');
    expect(params).toEqual(['m-1', 'user-1']);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test __tests__/lib/merchants-repo.test.ts`
Expected: FAIL — `Cannot find module '@/lib/merchants/repo'`.

- [ ] **Step 3: Write the implementation**

`lib/merchants/repo.ts`:

```ts
import { withClient, withPool } from '@/lib/db';
import { normalizeMerchantName } from '@/lib/merchants/normalize';

/**
 * Database access for the `merchants` table — the per-user merchant memory.
 *
 * Same split as `lib/entries/repo.ts`: this is plain server-side TypeScript
 * with no `"use server"` directive, reached from client components only
 * through `lib/actions.ts` or an authenticated API route.
 *
 * Trust model. A row is *trusted* when the user has confirmed it at least
 * once (`veces_confirmado > 0`) or corrected it at least once
 * (`veces_corregido > 0`). A row created by a parse and never confirmed
 * holds the model's guess and is deliberately not trusted.
 */

const MERCHANT_COLUMNS = `
  id, canonical_name, normalized_name, tipo, plataforma_pago,
  veces_visto, veces_confirmado, veces_corregido
`;

/**
 * `@vercel/postgres` types its query generic as `QueryResultRow`, i.e.
 * `Record<string, any>`, and TypeScript does not give an `interface` an
 * implicit index signature. So pass no generic and cast the rows instead —
 * this is the same pattern as `lib/server-data.ts:236`.
 */

export interface MerchantRecord {
  id: string;
  canonical_name: string;
  normalized_name: string;
  tipo: string | null;
  plataforma_pago: string | null;
  veces_visto: number;
  veces_confirmado: number;
  veces_corregido: number;
}

export function isTrustedMerchant(merchant: MerchantRecord): boolean {
  return merchant.veces_confirmado > 0 || merchant.veces_corregido > 0;
}

function requireNormalizedName(raw: string): string {
  const normalized = normalizeMerchantName(raw);
  if (!normalized) {
    throw new Error('Merchant name is required');
  }
  return normalized;
}

export async function findMerchantByNormalizedName(
  normalizedName: string,
  userId: string,
): Promise<MerchantRecord | null> {
  if (!normalizedName) return null;

  return withPool(async (pool) => {
    const result = await pool.query(
      `SELECT ${MERCHANT_COLUMNS}
         FROM merchants
        WHERE user_id = $2 AND normalized_name = $1
        LIMIT 1`,
      [normalizedName, userId],
    );
    return (result.rows[0] as MerchantRecord | undefined) ?? null;
  });
}

/**
 * Record that a receipt was parsed for this merchant. Increments
 * `veces_visto` on repeat sightings. Never overwrites `canonical_name`:
 * the first spelling the user saw is the stable display value.
 */
export async function recordMerchantSeen(
  userId: string,
  comercio: string,
  tipo: string,
  plataformaPago: string,
): Promise<MerchantRecord> {
  const normalizedName = requireNormalizedName(comercio);

  return withClient(async (client) => {
    const result = await client.sql`
      INSERT INTO merchants (
        user_id, canonical_name, normalized_name, tipo,
        plataforma_pago, veces_visto
      ) VALUES (
        ${userId}, ${comercio}, ${normalizedName}, ${tipo},
        ${plataformaPago}, 1
      )
      ON CONFLICT (user_id, normalized_name) DO UPDATE
         SET veces_visto = merchants.veces_visto + 1,
             updated_at  = NOW()
      RETURNING id, canonical_name, normalized_name, tipo,
                plataforma_pago, veces_visto, veces_confirmado,
                veces_corregido
    `;
    return result.rows[0] as MerchantRecord;
  });
}

/**
 * Apply the user's confirmation. This is the only write that teaches.
 *
 * Done in a single statement so a concurrent confirmation cannot
 * interleave: the `veces_confirmado` / `veces_corregido` decision is made
 * by comparing the stored value to the incoming one inside the upsert,
 * rather than by reading and then writing.
 *
 * Only `tipo` decides confirm-vs-correct. `plataforma_pago` is still
 * overwritten with the latest value (memory only ever fills gaps the
 * receipt did not print), but paying the same merchant by card one week
 * and Bizum the next is not a correction, and counting it as one would
 * inflate `veces_corregido` with noise.
 *
 * `veces_visto` is deliberately untouched here: the confirmation is the
 * same sighting `recordMerchantSeen` already counted at parse time, not a
 * new one. The INSERT path still starts at 1 for a merchant first met on
 * this save.
 */
export async function applyMerchantConfirmation(input: {
  userId: string;
  comercio: string;
  tipo: string;
  plataforma_pago: string;
}): Promise<void> {
  const normalizedName = requireNormalizedName(input.comercio);

  await withClient(async (client) => {
    await client.sql`
      INSERT INTO merchants (
        user_id, canonical_name, normalized_name, tipo,
        plataforma_pago, veces_visto, veces_confirmado
      ) VALUES (
        ${input.userId}, ${input.comercio}, ${normalizedName}, ${input.tipo},
        ${input.plataforma_pago}, 1, 1
      )
      ON CONFLICT (user_id, normalized_name) DO UPDATE
         SET veces_confirmado = CASE
               WHEN merchants.tipo IS DISTINCT FROM EXCLUDED.tipo
               THEN merchants.veces_confirmado
               ELSE merchants.veces_confirmado + 1
             END,
             veces_corregido = CASE
               WHEN merchants.tipo IS DISTINCT FROM EXCLUDED.tipo
               THEN merchants.veces_corregido + 1
               ELSE merchants.veces_corregido
             END,
             tipo            = EXCLUDED.tipo,
             plataforma_pago = EXCLUDED.plataforma_pago,
             updated_at      = NOW()
    `;
  });
}

export async function listMerchants(userId: string): Promise<MerchantRecord[]> {
  return withPool(async (pool) => {
    const result = await pool.query(
      `SELECT ${MERCHANT_COLUMNS}
         FROM merchants
        WHERE user_id = $1
        ORDER BY veces_visto DESC, canonical_name ASC`,
      [userId],
    );
    return result.rows as MerchantRecord[];
  });
}

/**
 * Forget one merchant. Past entries keep their data; their `merchant_id`
 * is set to NULL by the table's `ON DELETE SET NULL`.
 */
export async function deleteMerchantById(
  id: string,
  userId: string,
): Promise<void> {
  await withClient(async (client) => {
    await client.sql`
      DELETE FROM merchants
       WHERE id = ${id}
         AND user_id = ${userId}
    `;
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test __tests__/lib/merchants-repo.test.ts`
Expected: PASS — 14 tests, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add lib/merchants/repo.ts __tests__/lib/merchants-repo.test.ts
git commit -m "feat(merchants): add per-user merchant memory repository"
```

---

## Task 3: Shared entry write transforms

**Files:**

- Create: `lib/entries/normalize.ts`
- Modify: `lib/api-validation.ts:3,18-110`
- Test: `__tests__/lib/entries-normalize.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces:

  ```ts
  export function autoCorrectFecha(dateString: string): string;
  export function applyTimezoneShift(dateString: string): string;
  export function applyJoyntlandaSplit(data: {
    plataforma_pago: string;
    cantidad: number;
  }): number;
  export function buildEntryFecha(
    fecha: string,
    hora: number,
    minuto: number,
  ): string;
  ```

  `lib/api-validation.ts` loses the three private transform definitions and imports them from the new module instead, so every call site in the app keeps working against the same behaviour with no changes outside this file.

- [ ] **Step 1: Write the failing test**

`__tests__/lib/entries-normalize.test.ts`:

```ts
import {
  applyJoyntlandaSplit,
  applyTimezoneShift,
  autoCorrectFecha,
  buildEntryFecha,
} from '@/lib/entries/normalize';

describe('autoCorrectFecha', () => {
  it('leaves a recent date alone', () => {
    const recent = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    expect(autoCorrectFecha(recent)).toBe(recent);
  });

  it('rewrites the year of a stale OCR date to the current year', () => {
    const result = autoCorrectFecha('2019-03-15T10:00:00.000Z');
    expect(new Date(result).getFullYear()).toBe(new Date().getFullYear());
  });

  it('returns unparseable input unchanged so zod can report it', () => {
    expect(autoCorrectFecha('not-a-date')).toBe('not-a-date');
  });
});

describe('applyTimezoneShift', () => {
  it('treats a Z-suffixed string as local wall-clock time', () => {
    const result = applyTimezoneShift('2026-04-26T16:47:00.000Z');
    expect(result).toBe(new Date('2026-04-26T16:47:00').toISOString());
  });

  it('preserves the wall-clock reading while re-expressing it as a UTC instant', () => {
    const result = applyTimezoneShift('2026-04-26T16:47:00.000Z');
    const local = new Date(result);
    expect(local.getFullYear()).toBe(2026);
    expect(local.getMonth()).toBe(3);
    expect(local.getDate()).toBe(26);
    expect(local.getHours()).toBe(16);
    expect(local.getMinutes()).toBe(47);
  });

  it('returns input unchanged when the components cannot be read', () => {
    expect(applyTimezoneShift('26/04/2026')).toBe('26/04/2026');
  });
});

describe('applyJoyntlandaSplit', () => {
  it('halves the amount for joyntlanda, case-insensitively', () => {
    expect(
      applyJoyntlandaSplit({ plataforma_pago: ' Joyntlanda ', cantidad: 10 }),
    ).toBe(5);
  });

  it('rounds the half to two decimals', () => {
    expect(
      applyJoyntlandaSplit({ plataforma_pago: 'joyntlanda', cantidad: 9.99 }),
    ).toBe(5);
  });

  it('leaves every other payment method untouched', () => {
    expect(
      applyJoyntlandaSplit({ plataforma_pago: 'Tarjeta', cantidad: 10 }),
    ).toBe(10);
  });
});

describe('buildEntryFecha', () => {
  it('combines a plain date and a local wall-clock time', () => {
    expect(buildEntryFecha('2026-03-15', 16, 47)).toBe(
      new Date('2026-03-15T16:47:00').toISOString(),
    );
  });

  it('zero-pads single-digit hours and minutes', () => {
    expect(buildEntryFecha('2026-03-15', 9, 5)).toBe(
      new Date('2026-03-15T09:05:00').toISOString(),
    );
  });

  it('keeps the calendar day the caller asked for, whatever the timezone', () => {
    const result = buildEntryFecha('2026-01-01', 0, 0);
    expect(new Date(result).getFullYear()).toBe(2026);
    expect(new Date(result).getMonth()).toBe(0);
    expect(new Date(result).getDate()).toBe(1);
  });

  it('rejects an unparseable date instead of returning an Invalid Date', () => {
    expect(() => buildEntryFecha('15/03/2026', 10, 0)).toThrow(
      'Invalid entry date',
    );
  });
});
```

**Deviation from the original plan (Step 1, `applyTimezoneShift`):** the plan originally
asserted `applyTimezoneShift` was idempotent. That assertion is unsatisfiable outside
`UTC`, so the plan was internally inconsistent — it mandated this implementation and that
test together. The shift is a local-wall-clock to UTC reinterpretation, and nothing in the
string marks a value as already shifted, so a stateless converter cannot be idempotent.
Making it idempotent would also break the local-time semantics `buildEntryFecha` and
`components/finance-form.tsx:215-216` depend on. Production applies the transform exactly
once, in the `CreateEntrySchema` transform on the inbound create path only
(`app/api/v1/entries/route.ts:176,188`); stored rows are never re-validated. The
implementation is unchanged and the assertion is replaced by a strictly stronger,
timezone-independent property: the shift must preserve the wall-clock reading. Verified
green in `UTC`, `Europe/Madrid`, `America/New_York`, `Asia/Tokyo`, `Australia/Sydney` and
`Pacific/Kiritimati`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test __tests__/lib/entries-normalize.test.ts`
Expected: FAIL — `Cannot find module '@/lib/entries/normalize'`.

- [ ] **Step 3: Move the implementations**

`lib/entries/normalize.ts`:

```ts
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
```

Now rewrite `lib/api-validation.ts`. Replace the import block at the top of the file with (relative `./` group before the `@/` group, `@/lib/entries/normalize` before `@/lib/logger` alphabetically — `import-x/order` enforces both):

```ts
import { z } from 'zod';

import { normalizeCategory } from './categories';

import {
  applyJoyntlandaSplit,
  applyTimezoneShift,
  autoCorrectFecha,
} from '@/lib/entries/normalize';
import { logger } from '@/lib/logger';
```

Do **not** re-export them. They were module-private before this task, nothing imports them from `api-validation`, and adding re-exports would create exports `knip` then flags as unused. Leave `AccionEnum` and its JSDoc, delete the `autoCorrectFecha` (18-38), `applyTimezoneShift` (56-91) and `applyJoyntlandaSplit` (98-110) definitions with their JSDoc blocks. `CreateEntrySchema` and everything below it are unchanged.

- [ ] **Step 4: Run both the new test and the existing API test**

Run: `pnpm test __tests__/lib/entries-normalize.test.ts __tests__/api/v1/entries.test.ts`
Expected: PASS — 13 + existing tests, 0 failures. The API suite is the regression net for this move.

- [ ] **Step 5: Commit**

```bash
git add lib/entries/normalize.ts lib/api-validation.ts __tests__/lib/entries-normalize.test.ts
git commit -m "refactor(entries): share write transforms between API and receipt paths"
```

---

## Task 4: Category consolidation

**Files:**

- Modify: `lib/categories.ts:6`
- Modify: `lib/server-data.ts:247-303`
- Test: `__tests__/lib/categories-merge.test.ts`

**Interfaces:**

- Consumes: `STANDARD_CATEGORIES` (currently module-private at `lib/categories.ts:6`).
- Produces: `export const STANDARD_CATEGORIES` and `export function mergeCategoryOptions(historical: string[]): string[]`.

- [ ] **Step 1: Write the failing test**

`__tests__/lib/categories-merge.test.ts`:

```ts
import { STANDARD_CATEGORIES, mergeCategoryOptions } from '@/lib/categories';

describe('mergeCategoryOptions', () => {
  it('keeps the historical order first, then appends missing standard categories', () => {
    const result = mergeCategoryOptions(['Comida', 'Ocio']);
    expect(result.slice(0, 2)).toEqual(['Comida', 'Ocio']);
    expect(result).toContain('Farmacia');
    expect(result.length).toBe(
      2 +
        STANDARD_CATEGORIES.filter((c) => !['Comida', 'Ocio'].includes(c))
          .length,
    );
  });

  it('does not duplicate a standard category the user already uses', () => {
    const result = mergeCategoryOptions(['Supermercado', 'Gasolina']);
    expect(result.filter((c) => c === 'Supermercado')).toHaveLength(1);
    expect(result.filter((c) => c === 'Gasolina')).toHaveLength(1);
  });

  it('keeps the historical spelling when it only differs by case', () => {
    const result = mergeCategoryOptions(['farmacia']);
    expect(result[0]).toBe('farmacia');
    expect(result.filter((c) => c.toLowerCase() === 'farmacia')).toHaveLength(
      1,
    );
  });

  it('drops empty and whitespace-only entries', () => {
    const result = mergeCategoryOptions(['Cine', '', '   ']);
    expect(result).toContain('Cine');
    expect(result).not.toContain('');
    expect(result).not.toContain('   ');
  });

  it('returns every standard category for a user with no history', () => {
    expect(mergeCategoryOptions([])).toEqual([...STANDARD_CATEGORIES]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test __tests__/lib/categories-merge.test.ts`
Expected: FAIL — `mergeCategoryOptions` is not exported from `@/lib/categories`.

- [ ] **Step 3: Export the list and add the merge**

In `lib/categories.ts`, change line 6 from `const STANDARD_CATEGORIES = [` to `export const STANDARD_CATEGORIES = [`, and append after `normalizeCategory`:

```ts
/**
 * Build the `tipo` dropdown options for the finance form.
 *
 * The dropdown used to be built only from values already in
 * `finance_entries`, so a brand-new user got an empty category picker and
 * a first-time category had to be typed by hand. Standard categories are
 * appended, in their declared order, so the picker is always complete.
 *
 * The historical spelling wins over the standard one, and the comparison is
 * case-insensitive so `farmacia` does not appear next to `Farmacia`.
 */
export function mergeCategoryOptions(historical: string[]): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];

  for (const raw of historical) {
    // `tipo` is NOT NULL, so the value is a plain string; `?.` here would be
    // flagged by @typescript-eslint/no-unnecessary-condition, which is an error
    // in this repo. An empty string is the only empty case worth guarding.
    const value = raw.trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(value);
  }

  for (const standard of STANDARD_CATEGORIES) {
    const key = standard.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(standard);
  }

  return merged;
}
```

- [ ] **Step 4: Wire it into `getFormOptions`**

In `lib/server-data.ts`, add `import { mergeCategoryOptions } from '@/lib/categories';` alongside the existing `@/lib/db` import (alphabetically before it inside the `@/` group), then change only the `tipo` line of the returned object:

```ts
      tipo: mergeCategoryOptions(
        tipoResult.rows.map((row) => row.value as string),
      ),
```

Leave `que`, `plataforma_pago` and `quien` exactly as they are — they are free text, not a closed list.

- [ ] **Step 5: Run the tests**

Run: `pnpm test __tests__/lib/categories-merge.test.ts __tests__/lib/server-data.test.ts`
Expected: PASS — the new suite plus the existing `getFormOptions` suite. The existing suite may assert an exact `tipo` array built from the database; if it does, update the expectation to `mergeCategoryOptions([...])` so the test keeps asserting the real contract rather than the old one.

- [ ] **Step 6: Commit**

```bash
git add lib/categories.ts lib/server-data.ts __tests__/lib/categories-merge.test.ts __tests__/lib/categories.test.ts
git commit -m "feat(categories): always offer the standard category list in the form"
```

**Deviation from the original plan (Steps 1 and 6):** the pre-existing
`__tests__/lib/categories.test.ts` is not listed in the plan's `git add` but genuinely has
to change — its `getFormOptions` fallback test asserted `tipo: []` when the `categories`
table is missing, and this task makes that path return the standard list instead. The plan's
Step 1 code block also referenced a `tipoResult` binding that does not exist in the real
`lib/server-data.ts`; the block was written against a stale copy and was adapted to the
actual function.

---

## Task 5: Vision-capable free model race

**Files:**

- Modify: `lib/ai/fallback.ts:26-63,155-168,194-218`
- Test: `__tests__/lib/ai-fallback-vision.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces:
  ```ts
  export function selectFreeModels(visionOnly: boolean): typeof FREE_MODELS;
  export function raceFreeProviders<T>(
    operation: (
      model: LanguageModel,
      config: FreeModelConfig,
    ) => Promise<{
      result: T;
      usage?: { inputTokens?: number; outputTokens?: number };
    }>,
    options: {
      timeoutMs?: number;
      endpoint?: string;
      visionOnly?: boolean;
    } = {},
  ): Promise<Success | Failure>;
  ```
  `FREE_MODELS` gains an optional `requiresVision?: boolean` per entry. `visionOnly: true` excludes every entry without it.

**Two facts this task depends on. First, priority:** `raceFreeProviders` builds all promises, awaits `Promise.all`, then returns `results.find((r) => r !== null)` — so the **array order is the tie-break order**, and the first entry that succeeds wins even if a later one finished first. Reordering the array is therefore the whole of "make model X the first option". Second, modality: `big-pickle` is listed in `~/.cache/opencode/models.json` with `input: ["text"]` — it cannot accept an image. The `requiresVision` flag is what keeps it out of receipt parsing while keeping it first for text.

- [ ] **Step 1: Write the failing test**

`__tests__/lib/ai-fallback-vision.test.ts`:

```ts
/** @jest-environment node */

describe('free model selection', () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    jest.resetModules();
    // Only Opencode is configured, so the visible list is exactly the
    // opencode entries and the assertions below cannot be perturbed by
    // a developer who happens to have Groq or OpenRouter keys set.
    process.env.OPENCODE_API_KEY = 'test-key';
    delete process.env.GROQ_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('lists big-pickle as the very first free model', async () => {
    const { FREE_MODELS } = await import('@/lib/ai/fallback');
    expect(FREE_MODELS[0].modelId).toBe('big-pickle');
  });

  it('never marks big-pickle as vision capable', async () => {
    const { FREE_MODELS } = await import('@/lib/ai/fallback');
    const bigPickle = FREE_MODELS.find((m) => m.modelId === 'big-pickle');
    expect(bigPickle?.requiresVision).toBeUndefined();
  });

  it('excludes every text-only model from a vision race', async () => {
    const { selectFreeModels } = await import('@/lib/ai/fallback');
    const vision = selectFreeModels(true);
    expect(vision.length).toBeGreaterThan(0);
    expect(vision.every((m) => m.requiresVision === true)).toBe(true);
    expect(vision.map((m) => m.modelId)).not.toContain('big-pickle');
  });

  it('puts the first free vision model ahead of the other vision models', async () => {
    const { selectFreeModels } = await import('@/lib/ai/fallback');
    expect(selectFreeModels(true)[0].modelId).toBe('mimo-v2.5-free');
  });

  it('keeps every text model available for a text race', async () => {
    const { selectFreeModels } = await import('@/lib/ai/fallback');
    const ids = selectFreeModels(false).map((m) => m.modelId);
    expect(ids).toContain('big-pickle');
    expect(ids).toContain('llama-3.3-70b-versatile');
    expect(ids).toContain('gemma2-9b-it');
    expect(ids).toContain('google/gemma-3-27b-it:free');
    expect(ids).toContain('openrouter/free');
  });

  it('returns the first configured model even when a later one answers first', async () => {
    const { raceFreeProviders } = await import('@/lib/ai/fallback');
    const result = await raceFreeProviders(
      async (_model, config) => {
        // Everyone except the preferred model answers instantly.
        const delay = config.modelId === 'big-pickle' ? 20 : 0;
        await new Promise((resolve) => setTimeout(resolve, delay));
        return { result: config.modelId };
      },
      { endpoint: 'test' },
    );

    expect(result.success).toBe(true);
    expect(result.success && result.model).toBe('big-pickle');
  });

  it('does not call big-pickle for a vision race', async () => {
    const { raceFreeProviders } = await import('@/lib/ai/fallback');
    const seen: string[] = [];

    const result = await raceFreeProviders(
      async (_model, config) => {
        seen.push(config.modelId);
        return { result: config.modelId };
      },
      { endpoint: 'test', visionOnly: true },
    );

    expect(seen).not.toContain('big-pickle');
    expect(result.success && result.model).toBe('mimo-v2.5-free');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test __tests__/lib/ai-fallback-vision.test.ts`
Expected: FAIL — `selectFreeModels` is not exported, and `FREE_MODELS[0].modelId` is `'llama-3.3-70b-versatile'`.

- [ ] **Step 3: Rewrite `FREE_MODELS`**

Replace `lib/ai/fallback.ts:26-63` with:

```ts
export interface FreeModelConfig {
  provider: 'groq' | 'openrouter' | 'opencode';
  modelId: string;
  name: string;
  timeoutMs: number;
  /**
   * True when the model accepts image parts. Verified against
   * `~/.cache/opencode/models.json` `modalities.input` for the opencode
   * entries and against each provider's model card for the others.
   *
   * `big-pickle` is deliberately first — it is the preferred free model —
   * and deliberately NOT flagged: it is text-only, so it can never be
   * selected for a receipt.
   */
  requiresVision?: boolean;
}

/**
 * Free model configurations, in preference order.
 *
 * `raceFreeProviders` awaits every model and then takes the first success in
 * this order, so index 0 is the preferred model for text work and the first
 * `requiresVision` entry is preferred for images. Vision timeouts are larger
 * because a model has to encode the image before it can answer.
 */
export const FREE_MODELS: FreeModelConfig[] = [
  {
    provider: 'opencode',
    modelId: 'big-pickle',
    name: 'Big Pickle (Opencode Zen Free)',
    timeoutMs: 10000,
  },
  {
    provider: 'opencode',
    modelId: 'mimo-v2.5-free',
    name: 'MiMo V2.5 (Opencode Zen Free Vision)',
    timeoutMs: 25000,
    requiresVision: true,
  },
  {
    provider: 'groq',
    modelId: 'llama-3.3-70b-versatile',
    name: 'Llama 3.3 70B (Groq)',
    timeoutMs: 8000,
  },
  {
    provider: 'groq',
    modelId: 'gemma2-9b-it',
    name: 'Gemma 2 9B (Groq)',
    timeoutMs: 6000,
  },
  {
    provider: 'groq',
    modelId: 'meta-llama/llama-4-scout-17b-16e-instruct',
    name: 'Llama 4 Scout 17B (Groq Vision)',
    timeoutMs: 25000,
    requiresVision: true,
  },
  {
    provider: 'openrouter',
    modelId: 'meta-llama/llama-3.3-70b-instruct:free',
    name: 'Llama 3.3 70B (OpenRouter Free)',
    timeoutMs: 10000,
  },
  {
    provider: 'openrouter',
    modelId: 'google/gemma-3-27b-it:free',
    name: 'Gemma 3 27B (OpenRouter Free)',
    timeoutMs: 8000,
  },
  {
    provider: 'openrouter',
    modelId: 'openrouter/free',
    name: 'Auto-Router (OpenRouter Free)',
    timeoutMs: 25000,
    requiresVision: true,
  },
];
```

No model is removed. `big-pickle` keeps its entry and moves to the front; `mimo-v2.5-free` and Groq's `meta-llama/llama-4-scout-17b-16e-instruct` are new vision-capable additions.

- [ ] **Step 4: Add the vision filter**

Replace `getAvailableFreeModels` (155-168) with:

```ts
/**
 * The models eligible for a request, before the "is this provider
 * configured" filter. Pure, so the modality rules are testable without
 * any API keys present.
 */
export function selectFreeModels(visionOnly: boolean): FreeModelConfig[] {
  if (!visionOnly) return FREE_MODELS;
  return FREE_MODELS.filter((config) => config.requiresVision === true);
}

// Get available free models based on configured providers
function getAvailableFreeModels(visionOnly: boolean): FreeModelConfig[] {
  return selectFreeModels(visionOnly).filter((config) => {
    switch (config.provider) {
      case 'groq':
        return groq !== null;
      case 'openrouter':
        return openrouter !== null;
      case 'opencode':
        return opencode !== null;
      default:
        return false;
    }
  });
}
```

Then in `raceFreeProviders`, add `visionOnly?: boolean` to the `options` parameter and change the call site:

```ts
  options: {
    timeoutMs?: number;
    endpoint?: string;
    visionOnly?: boolean;
  } = {},
```

```ts
const availableModels = getAvailableFreeModels(options.visionOnly === true);
```

Also change `createModel`'s first parameter from
`(typeof FREE_MODELS)[number]['provider']` to `FreeModelConfig['provider']`, since `FREE_MODELS` is now explicitly typed.

**Fix the leaked timeout timer while you are in `raceFreeProviders`.** The current code arms `setTimeout(config.timeoutMs)` per model and never clears it, so a model that answers in 200ms leaves a 6–25s handle behind — in production it needlessly holds the event loop, and under Jest it prints `Jest did not exit one second after the test run has completed` (the new vision suite races 25s models, so the warning shows up loudly here for the first time). Replace the timeout-promise block with:

```ts
// Create timeout promise. The handle is kept so the timer can be
// cancelled as soon as the race settles: a fast model must not leave
// an armed timer behind (Jest would then warn about open handles and
// the process would linger for the full timeout).
let timer: ReturnType<typeof setTimeout> | undefined;
const timeoutPromise = new Promise<never>((_, reject) => {
  timer = setTimeout(() => {
    reject(
      new Error(`Tiempo de espera agotado después de ${config.timeoutMs}ms`),
    );
  }, config.timeoutMs);
});

// Race between operation and timeout
const { result, usage } = await Promise.race([
  operation(model, config),
  timeoutPromise,
]).finally(() => {
  if (timer !== undefined) clearTimeout(timer);
});
```

This is behaviour-preserving for callers; only the handle lifecycle changes.

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm test __tests__/lib/ai-fallback-vision.test.ts`
Expected: PASS — 7 tests, 0 failures.

- [ ] **Step 6: Verify the text path did not regress**

Run: `pnpm test __tests__/lib/ai-tools.test.ts __tests__/api/v1/entries.test.ts && pnpm typecheck`
Expected: PASS on both. `parse-for-form` and the chat route call `raceFreeProviders` without `visionOnly`, so they see the full list with `big-pickle` first.

- [ ] **Step 7: Commit**

```bash
git add lib/ai/fallback.ts __tests__/lib/ai-fallback-vision.test.ts
git commit -m "feat(ai): prefer big-pickle for text and race vision models for images"
```

---

## Task 6: Receipt parsing prompt

**Files:**

- Modify: `lib/ai/prompts.ts` (append)
- Test: `__tests__/lib/receipt-prompt.test.ts`

**Interfaces:**

- Consumes: `STANDARD_CATEGORIES` from `@/lib/categories` (exported by Task 4).
- Produces: `export const RECEIPT_PARSE_SYSTEM_PROMPT: string`.

The zod schema for the model's answer lives in the route (`receiptFactsSchema`), matching how `app/api/ai/parse-for-form/route.ts:17-30` keeps its own `parsedEntrySchema`. This module stays prompt-only.

- [ ] **Step 1: Write the failing test**

`__tests__/lib/receipt-prompt.test.ts`:

```ts
import { RECEIPT_PARSE_SYSTEM_PROMPT } from '@/lib/ai/prompts';
import { STANDARD_CATEGORIES } from '@/lib/categories';

describe('RECEIPT_PARSE_SYSTEM_PROMPT', () => {
  it('tells the model the exact date format it must return', () => {
    expect(RECEIPT_PARSE_SYSTEM_PROMPT).toContain('YYYY-MM-DD');
  });

  it('grounds relative dates in today', () => {
    expect(RECEIPT_PARSE_SYSTEM_PROMPT).toContain(
      new Date().toISOString().split('T')[0] ?? '',
    );
  });

  it('names every field the schema requires', () => {
    for (const field of [
      'fecha',
      'cantidad',
      'comercio',
      'tipo',
      'plataforma_pago',
      'detalle1',
      'confianza',
    ]) {
      expect(RECEIPT_PARSE_SYSTEM_PROMPT).toContain(field);
    }
  });

  it('lists every standard category so the answer is normalizable', () => {
    for (const category of STANDARD_CATEGORIES) {
      expect(RECEIPT_PARSE_SYSTEM_PROMPT).toContain(category);
    }
  });

  it('forbids inventing a category outside the list', () => {
    expect(RECEIPT_PARSE_SYSTEM_PROMPT).toContain('No inventes categorías');
  });

  it('has no unresolved template placeholder', () => {
    expect(RECEIPT_PARSE_SYSTEM_PROMPT).not.toContain('${');
  });

  it('never asks for accion, which the route fixes to Gasto', () => {
    expect(RECEIPT_PARSE_SYSTEM_PROMPT).not.toContain('accion');
  });

  it('renders the field code spans instead of closing the literal', () => {
    // A raw backtick inside the template literal would truncate the string
    // and break compilation, so every code span must be escaped as \`field\`.
    for (const field of ['cantidad', 'detalle1', 'confianza']) {
      expect(RECEIPT_PARSE_SYSTEM_PROMPT).toContain(`\`${field}\``);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test __tests__/lib/receipt-prompt.test.ts`
Expected: FAIL — `RECEIPT_PARSE_SYSTEM_PROMPT` is not exported.

- [ ] **Step 3: Write the prompt**

Append to `lib/ai/prompts.ts`, and add `import { STANDARD_CATEGORIES } from '@/lib/categories';` as the very first line of the file. `lib/ai/prompts.ts` currently has **no imports at all** — its opening `/** System prompts for AI features. */` header sits on line 1 — so the import goes above that comment, matching how `lib/entries/repo.ts` puts imports before its header JSDoc. This is the file's only import, so there is no group separation to write:

```ts
/**
 * System prompt for reading a receipt image.
 *
 * The model returns FACTS plus a `tipo` *proposal*. `tipo` is not the final
 * answer: the server runs it through the user's own merchant memory first
 * (see `resolveMerchantClassification`) and through `CATEGORY_ALIASES`
 * before ever trusting the model, and the user confirms the form anyway.
 * The closed category list below exists so that proposal is always
 * normalizable. `accion` is not asked for at all — a receipt is an expense,
 * and the route sets it.
 *
 * The `SCHEMA_CONTEXT` block is intentionally not reused here: its example
 * categories ("Comida", "Sueldo") contradict `STANDARD_CATEGORIES` and would
 * pull the model off the closed list.
 */
export const RECEIPT_PARSE_SYSTEM_PROMPT = `
Eres un asistente que lee recibos de compra para una app de finanzas
personales llamada FinanzApp. Hoy es ${new Date().toISOString().split('T')[0]}.

## Tu tarea

Extrae únicamente HECHOS visibles en la imagen. No decides la categoría
final: eso lo hace la app con las correcciones del usuario.

## Campos que debes devolver

- **fecha**: la fecha de la compra en formato YYYY-MM-DD.
  Si el recibo muestra "15/03/2026" devuelve "2026-03-15".
  Si solo muestra una fecha sin año, usa el año actual.
  Si no hay fecha legible, devuelve la fecha de hoy.
- **cantidad**: el importe total pagado, SIEMPRE como número positivo
  (12.5, no "12,50 €"). Si el recibo muestra varios importes,
  usa el TOTAL. No devuelvas 0 si no puedes leerlo.
- **comercio**: el nombre del comercio tal y como aparece escrito.
- **tipo**: la categoría de gasto, elegida de la lista cerrada de abajo.
  No decides la categoría final — la app luego consulta lo que el usuario
  ya corrigió para ese comercio — pero sí debes proponer una.
- **plataforma_pago**: el método de pago IMPRESO en el recibo
  (Visa, Mastercard, Bizum, Efectivo...). Si el recibo no lo menciona,
  devuelve "".
- **detalle1**: una descripción corta de lo comprado. Si no se puede leer,
  devuelve "".
- **confianza**: tu confianza entre 0 y 1 en la lectura de **cantidad**
  (1.0 = el total está clarísimo; 0.4 = hay varios importes y dudas).

## Categorías permitidas para inferir el tipo de gasto

${STANDARD_CATEGORIES.join(', ')}

No inventes categorías fuera de esta lista. Si el comercio no encaja en
ninguna, elige la más cercana.

## Casos especiales

- **Farmacia, parking, gasolinera, restaurante, peluquería**: elige la
  categoría más específica de la lista, no la más genérica.
- **Una compra con varios artículos**: \`cantidad\` es la suma total, y
  \`detalle1\` describe el artículo principal.
- **Recibo de una suscripción o cuota recurrente**: \`detalle1\` debe
  contener el nombre del servicio.
- **Una captura de una app bancaria en vez de un recibo**: extrae igualmente
  el concepto y el importe si aparecen.
- **Texto ilegible**: devuelve tu mejor lectura y baja \`confianza\` en
  proporción. No inventes datos que no están.

Responde solo con el JSON del esquema. Sin explicaciones.
`.trim();
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test __tests__/lib/receipt-prompt.test.ts`
Expected: PASS — 8 tests, 0 failures.

If the "no unresolved placeholder" test fails, you have a stray `${` in the literal — usually a nested template that was meant to be escaped. Fix the literal, do not weaken the test.

- [ ] **Step 5: Commit**

```bash
git add lib/ai/prompts.ts __tests__/lib/receipt-prompt.test.ts
git commit -m "feat(ai): add a fact-only receipt vision prompt"
```

---

## Task 7: Image guards and content hashing

**Files:**

- Create: `lib/receipts/image.ts`
- Test: `__tests__/lib/receipts-image.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces:
  ```ts
  export const MAX_IMAGE_BYTES = 4_194_304;
  export const ACCEPTED_IMAGE_TYPES: readonly [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
  ];
  export type AcceptedImageType = (typeof ACCEPTED_IMAGE_TYPES)[number];
  export class ReceiptImageError extends Error {
    readonly statusCode: number;
  }
  export interface GuardedImage {
    bytes: Buffer;
    mediaType: AcceptedImageType;
    contentHash: string;
    byteLength: number;
  }
  export function detectImageType(bytes: Buffer): AcceptedImageType | null;
  export async function validateImageUpload(file: File): Promise<GuardedImage>;
  export function toDataUrl(image: GuardedImage): string;
  ```
- Pins Review Focus #1.

- [ ] **Step 1: Write the failing test**

`__tests__/lib/receipts-image.test.ts`:

```ts
/** @jest-environment node */

import {
  ACCEPTED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  ReceiptImageError,
  detectImageType,
  toDataUrl,
  validateImageUpload,
} from '@/lib/receipts/image';

const JPEG = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46,
]);
const PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01, 0x02, 0x03,
]);
const WEBP = Buffer.concat([
  Buffer.from('RIFF', 'ascii'),
  Buffer.from([0x1a, 0x00, 0x00, 0x00]),
  Buffer.from('WEBP', 'ascii'),
  Buffer.from([0x00, 0x01]),
]);
const HEIC = Buffer.concat([
  Buffer.from([0x00, 0x00, 0x00, 0x18]),
  Buffer.from('ftypheic', 'ascii'),
]);
const HEIF = Buffer.concat([
  Buffer.from([0x00, 0x00, 0x00, 0x18]),
  Buffer.from('ftypmif1', 'ascii'),
]);
const HTML = Buffer.from('<!doctype html><script>alert(1)</script>', 'utf8');

function makeFile(bytes: Buffer, type: string, name = 'receipt'): File {
  return new File([new Uint8Array(bytes)], name, { type });
}

describe('detectImageType', () => {
  it.each([
    [JPEG, 'image/jpeg'],
    [PNG, 'image/png'],
    [WEBP, 'image/webp'],
    [HEIC, 'image/heic'],
    [HEIF, 'image/heif'],
  ])('detects %#', (bytes, expected) => {
    expect(detectImageType(bytes)).toBe(expected);
  });

  it('rejects an HTML payload', () => {
    expect(detectImageType(HTML)).toBeNull();
  });

  it('rejects a truncated image', () => {
    expect(detectImageType(Buffer.from([0xff, 0xd8]))).toBeNull();
    expect(detectImageType(Buffer.alloc(0))).toBeNull();
  });

  it('rejects an unknown ISO-BMFF brand', () => {
    const mp4 = Buffer.concat([
      Buffer.from([0x00, 0x00, 0x00, 0x18]),
      Buffer.from('ftypmp42', 'ascii'),
    ]);
    expect(detectImageType(mp4)).toBeNull();
  });
});

describe('validateImageUpload', () => {
  it('accepts every advertised type', async () => {
    for (const [bytes, expected] of [
      [JPEG, 'image/jpeg'],
      [PNG, 'image/png'],
      [WEBP, 'image/webp'],
      [HEIC, 'image/heic'],
      [HEIF, 'image/heif'],
    ] as const) {
      const guarded = await validateImageUpload(makeFile(bytes, expected));
      expect(guarded.mediaType).toBe(expected);
      expect(ACCEPTED_IMAGE_TYPES).toContain(guarded.mediaType);
    }
  });

  // Review Focus #1: the declared Content-Type is attacker-controlled.
  it('trusts the magic bytes, not the declared MIME type', async () => {
    const guarded = await validateImageUpload(
      makeFile(PNG, 'image/jpeg', 'totally-a-png.jpg'),
    );
    expect(guarded.mediaType).toBe('image/png');
  });

  it('rejects a non-image even when it claims to be a PNG', async () => {
    await expect(
      validateImageUpload(makeFile(HTML, 'image/png', 'evil.png')),
    ).rejects.toMatchObject({ statusCode: 415 });
  });

  it('rejects an empty file with 400', async () => {
    await expect(
      validateImageUpload(makeFile(Buffer.alloc(0), 'image/png')),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('rejects a file over the size cap with 413', async () => {
    const oversized = Buffer.concat([PNG, Buffer.alloc(MAX_IMAGE_BYTES, 0x41)]);
    await expect(
      validateImageUpload(makeFile(oversized, 'image/png')),
    ).rejects.toMatchObject({ statusCode: 413 });
  });

  it('throws ReceiptImageError, so the route can reuse the status code', async () => {
    await expect(
      validateImageUpload(makeFile(HTML, 'image/png')),
    ).rejects.toBeInstanceOf(ReceiptImageError);
  });

  it('returns a 64-character hex content hash', async () => {
    const guarded = await validateImageUpload(makeFile(PNG, 'image/png'));
    expect(guarded.contentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(guarded.byteLength).toBe(PNG.byteLength);
    expect(guarded.bytes).toEqual(PNG);
  });

  it('hashes the same bytes identically and different bytes differently', async () => {
    const first = await validateImageUpload(makeFile(PNG, 'image/png', 'a'));
    const again = await validateImageUpload(makeFile(PNG, 'image/png', 'b'));
    const other = await validateImageUpload(
      makeFile(Buffer.concat([PNG, Buffer.from([0x99])]), 'image/png'),
    );
    expect(again.contentHash).toBe(first.contentHash);
    expect(other.contentHash).not.toBe(first.contentHash);
  });
});

describe('toDataUrl', () => {
  it('round-trips the exact bytes with the detected media type', async () => {
    const guarded = await validateImageUpload(makeFile(PNG, 'image/png'));
    const dataUrl = toDataUrl(guarded);
    expect(dataUrl.startsWith('data:image/png;base64,')).toBe(true);
    const base64 = dataUrl.split(',')[1] ?? '';
    expect(Buffer.from(base64, 'base64')).toEqual(PNG);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test __tests__/lib/receipts-image.test.ts`
Expected: FAIL — `Cannot find module '@/lib/receipts/image'`.

- [ ] **Step 3: Write the implementation**

`lib/receipts/image.ts`:

```ts
import { createHash } from 'node:crypto';

/**
 * Upload guards for the receipt endpoint.
 *
 * The bytes are read once, validated once, hashed once, and handed to the
 * model as a data URL. They are never written to disk or to object storage.
 */

/** 4 MiB. A 1600px JPEG from a phone camera is well under this. */
export const MAX_IMAGE_BYTES = 4_194_304;

export const ACCEPTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
] as const;

export type AcceptedImageType = (typeof ACCEPTED_IMAGE_TYPES)[number];

/** ISO-BMFF brands that mean "HEIF-family image", mapped to their MIME type. */
const HEIF_BRANDS: Record<string, AcceptedImageType> = {
  heic: 'image/heic',
  heix: 'image/heic',
  hevc: 'image/heic',
  hevx: 'image/heic',
  mif1: 'image/heif',
  msf1: 'image/heif',
};

export class ReceiptImageError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'ReceiptImageError';
    this.statusCode = statusCode;
  }
}

export interface GuardedImage {
  bytes: Buffer;
  mediaType: AcceptedImageType;
  contentHash: string;
  byteLength: number;
}

/**
 * Identify an image from its magic bytes.
 *
 * Deliberately ignores any declared MIME type: a client sets `File.type`
 * freely, so an HTML or JavaScript payload can arrive labelled
 * `image/png`. Returns `null` for anything unrecognised, including a
 * truncated header.
 */
export function detectImageType(bytes: Buffer): AcceptedImageType | null {
  // JPEG: SOI marker FF D8 followed by any marker byte.
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return 'image/jpeg';
  }

  // PNG: the full 8-byte signature.
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png';
  }

  // WebP: RIFF container whose form type is WEBP.
  if (
    bytes.length >= 12 &&
    bytes.toString('ascii', 0, 4) === 'RIFF' &&
    bytes.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }

  // HEIF/HEIC: ISO-BMFF box whose first child is `ftyp` with a known brand.
  if (bytes.length >= 12 && bytes.toString('ascii', 4, 8) === 'ftyp') {
    const brand = bytes.toString('ascii', 8, 12).toLowerCase();
    return HEIF_BRANDS[brand] ?? null;
  }

  return null;
}

export async function validateImageUpload(file: File): Promise<GuardedImage> {
  if (file.size === 0) {
    throw new ReceiptImageError('El archivo está vacío.', 400);
  }

  if (file.size > MAX_IMAGE_BYTES) {
    throw new ReceiptImageError(
      `El archivo es demasiado grande. Máximo ${MAX_IMAGE_BYTES} bytes.`,
      413,
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  // Re-check after reading: `File.size` is metadata, not a guarantee.
  if (bytes.byteLength > MAX_IMAGE_BYTES) {
    throw new ReceiptImageError(
      `El archivo es demasiado grande. Máximo ${MAX_IMAGE_BYTES} bytes.`,
      413,
    );
  }

  const mediaType = detectImageType(bytes);
  if (!mediaType) {
    throw new ReceiptImageError(
      'El archivo no es una imagen válida. Se aceptan JPEG, PNG, WebP, HEIC y HEIF.',
      415,
    );
  }

  return {
    bytes,
    mediaType,
    contentHash: createHash('sha256').update(bytes).digest('hex'),
    byteLength: bytes.byteLength,
  };
}

/** Data URL for the AI SDK `ImagePart`. */
export function toDataUrl(image: GuardedImage): string {
  return `data:${image.mediaType};base64,${image.bytes.toString('base64')}`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test __tests__/lib/receipts-image.test.ts`
Expected: PASS — 17 tests, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add lib/receipts/image.ts __tests__/lib/receipts-image.test.ts
git commit -m "feat(receipts): validate uploads on magic bytes and hash the content"
```

---

## Task 8: Receipt deduplication

**Files:**

- Create: `lib/receipts/dedupe.ts`
- Test: `__tests__/lib/receipts-dedupe.test.ts`

**Interfaces:**

- Consumes: `withPool` from `@/lib/db`; `normalizeMerchantName` from `@/lib/merchants/normalize`.
- Produces:
  ```ts
  export interface ReceiptCandidate {
    fecha: string; // YYYY-MM-DD, local
    hora: number;
    minuto: number;
    comercio: string;
    cantidad: number;
    plataforma_pago: string;
  }
  export interface ExistingEntrySummary {
    id: string;
    /** Calendar day, `YYYY-MM-DD`, formatted by SQL — see the note on the columns below. */
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
  export function looksLikeSameReceipt(
    candidate: ReceiptCandidate,
    entry: Pick<ExistingEntrySummary, 'fecha' | 'cantidad' | 'que'>,
  ): boolean;
  export async function findEntryByContentHash(
    contentHash: string,
    userId: string,
  ): Promise<ExistingEntrySummary | null>;
  export async function findSimilarReceiptEntry(
    candidate: ReceiptCandidate,
    userId: string,
  ): Promise<{ entry: ExistingEntrySummary; score: number } | null>;
  ```
- Pins Review Focus #2.

**Why both functions.** `findEntryByContentHash` runs **before** the model call: identical bytes mean an identical read, so the second upload costs nothing and returns the entry the user already has. `findSimilarReceiptEntry` runs **after** the parse, because a re-photographed receipt is a different image with the same facts, and only the facts are known once the model has read it.

**Why ±1 day and a 50 % token overlap.** The stored `fecha` is a `timestamptz` and the candidate is a local calendar date, so the same purchase can differ by one day between the two representations. Token overlap rather than equality is needed because the same shop prints its name differently on two tickets. Both thresholds are deliberately loose — a false positive asks the user to confirm an entry that is already there, which is cheap, while a false negative silently creates a duplicate.

- [ ] **Step 1: Write the failing test**

`__tests__/lib/receipts-dedupe.test.ts`:

```ts
/** @jest-environment node */

import { withPool } from '@/lib/db';
import {
  findEntryByContentHash,
  findSimilarReceiptEntry,
  looksLikeSameReceipt,
  type ExistingEntrySummary,
  type ReceiptCandidate,
} from '@/lib/receipts/dedupe';

jest.mock('@/lib/db', () => ({ withPool: jest.fn() }));

const withPoolMock = withPool as jest.MockedFunction<typeof withPool>;

function mockRead(rows: unknown[]) {
  const query = jest.fn().mockResolvedValue({ rows, rowCount: rows.length });
  withPoolMock.mockImplementation(async (fn) => fn({ query } as never));
  return query;
}

const CANDIDATE: ReceiptCandidate = {
  fecha: '2026-09-26',
  hora: 12,
  minuto: 30,
  comercio: 'MERCADONA S.A. 1234',
  cantidad: 43.2,
  plataforma_pago: 'Visa',
};

function entry(
  overrides: Partial<ExistingEntrySummary> = {},
): ExistingEntrySummary {
  return {
    id: 'e-1',
    fecha: '2026-09-26',
    tipo: 'Supermercado',
    accion: 'Gasto',
    que: 'Mercadona',
    plataforma_pago: 'Visa',
    cantidad: 43.2,
    detalle1: 'Leche',
    detalle2: null,
    quien: 'Yo',
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('looksLikeSameReceipt', () => {
  // Review Focus #2
  it('matches the same purchase', () => {
    expect(looksLikeSameReceipt(CANDIDATE, entry())).toBe(true);
  });

  it('matches when the merchant is spelled differently on the ticket', () => {
    expect(
      looksLikeSameReceipt(CANDIDATE, entry({ que: 'MERCADONA*DON' })),
    ).toBe(true);
  });

  it('matches across one day, to absorb the local/UTC date difference', () => {
    expect(
      looksLikeSameReceipt(CANDIDATE, entry({ fecha: '2026-09-27' })),
    ).toBe(true);
  });

  it('tolerates a one-cent rounding difference', () => {
    expect(
      looksLikeSameReceipt(
        { ...CANDIDATE, cantidad: 43.2 },
        entry({ cantidad: 43.21 }),
      ),
    ).toBe(true);
  });

  it('rejects a different amount at the same shop', () => {
    expect(looksLikeSameReceipt(CANDIDATE, entry({ cantidad: 18.55 }))).toBe(
      false,
    );
  });

  it('rejects the same amount at a different shop', () => {
    expect(looksLikeSameReceipt(CANDIDATE, entry({ que: 'Lidl' }))).toBe(false);
  });

  it('rejects the same shop and amount two days apart', () => {
    expect(
      looksLikeSameReceipt(CANDIDATE, entry({ fecha: '2026-09-28' })),
    ).toBe(false);
  });

  it('rejects a malformed candidate date instead of matching everything', () => {
    expect(
      looksLikeSameReceipt(
        { ...CANDIDATE, fecha: 'no-date' },
        entry({ fecha: 'also-not-a-date' }),
      ),
    ).toBe(false);
  });
});

describe('findEntryByContentHash', () => {
  it('returns null when nothing matches', async () => {
    mockRead([]);
    await expect(
      findEntryByContentHash('a'.repeat(64), 'user-1'),
    ).resolves.toBeNull();
  });

  it('scopes the lookup to the user and the hash', async () => {
    const query = mockRead([entry()]);
    const found = await findEntryByContentHash('a'.repeat(64), 'user-1');

    expect(found?.id).toBe('e-1');
    const [sql, params] = query.mock.calls[0] ?? [];
    expect(sql).toContain('user_id = $1');
    expect(sql).toContain('content_hash = $2');
    expect(params).toEqual(['user-1', 'a'.repeat(64)]);
  });

  // `pg` returns a timestamptz as a `Date`, so selecting the column raw would
  // put a Date in a field this module types as `YYYY-MM-DD`.
  it('formats the day in SQL instead of casting the row', () => {
    const query = mockRead([entry()]);
    void findEntryByContentHash('a'.repeat(64), 'user-1');
    const [sql] = query.mock.calls[0] ?? [];
    expect(sql).toContain("to_char(fecha AT TIME ZONE 'UTC', 'YYYY-MM-DD')");
  });
});

describe('findSimilarReceiptEntry', () => {
  it('returns null when the window holds nothing', async () => {
    mockRead([]);
    await expect(
      findSimilarReceiptEntry(CANDIDATE, 'user-1'),
    ).resolves.toBeNull();
  });

  it('returns the best-scoring match, not the first row', async () => {
    mockRead([
      entry({ id: 'e-weak', que: 'Lidl' }),
      entry({ id: 'e-strong', que: 'Mercadona S.A.' }),
      entry({ id: 'e-exact', que: 'Mercadona' }),
    ]);
    const found = await findSimilarReceiptEntry(CANDIDATE, 'user-1');
    expect(found?.entry.id).toBe('e-strong');
    expect(found?.score).toBeGreaterThan(0.5);
  });

  it('returns null when the rows in the window are all different purchases', async () => {
    mockRead([entry({ id: 'e-1', que: 'Lidl', cantidad: 12 })]);
    await expect(
      findSimilarReceiptEntry(CANDIDATE, 'user-1'),
    ).resolves.toBeNull();
  });

  it('asks only for the user own expenses around that date', async () => {
    const query = mockRead([]);
    await findSimilarReceiptEntry(CANDIDATE, 'user-1');
    const [sql, params] = query.mock.calls[0] ?? [];
    expect(sql).toContain('user_id = $1');
    expect(sql).toContain("accion = 'Gasto'");
    expect(sql).toContain("INTERVAL '1 day'");
    // Noon UTC anchors the window on the local calendar date.
    expect(params?.[1]).toBe('2026-09-26T12:00:00.000Z');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test __tests__/lib/receipts-dedupe.test.ts`
Expected: FAIL — `Cannot find module '@/lib/receipts/dedupe'`.

- [ ] **Step 3: Write the implementation**

`lib/receipts/dedupe.ts`:

```ts
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test __tests__/lib/receipts-dedupe.test.ts`
Expected: PASS — 15 tests, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add lib/receipts/dedupe.ts __tests__/lib/receipts-dedupe.test.ts
git commit -m "feat(receipts): detect exact and re-photographed duplicates"
```

---

## Task 9: Merchant classification resolution

**Files:**

- Create: `lib/receipts/resolve.ts`
- Test: `__tests__/lib/receipts-resolve.test.ts`

**Interfaces:**

- Consumes: `normalizeCategory` from `@/lib/categories`; `normalizeMerchantName` from `@/lib/merchants/normalize`; `findMerchantByNormalizedName`, `isTrustedMerchant`, `MerchantRecord` from `@/lib/merchants/repo` (Task 2).
- Produces:
  ```ts
  export interface ClassificationInput {
    userId: string;
    comercio: string;
    modelTipo: string;
    modelPlataformaPago: string;
  }
  export interface Classification {
    tipo: string;
    plataforma_pago: string;
    source: 'memory' | 'alias' | 'model' | 'seen_guess' | 'default';
    merchantId: string | null;
    trusted: boolean;
  }
  export async function resolveMerchantClassification(
    input: ClassificationInput,
  ): Promise<Classification>;
  ```

**The asymmetry that makes this trustworthy.** Category and payment method come from opposite sources of truth. A category is a _user preference_ — if the user has corrected Mercadona to `Supermercado` twice, that outranks whatever the model guesses today. A payment method is a _fact of the ticket in front of us_ — if this receipt says `Visa`, memory is stale by definition. So memory wins `tipo`, the model wins `plataforma_pago`, and memory only fills the gap.

- [ ] **Step 1: Write the failing test**

`__tests__/lib/receipts-resolve.test.ts`:

```ts
/** @jest-environment node */

import {
  findMerchantByNormalizedName,
  type MerchantRecord,
} from '@/lib/merchants/repo';
import { resolveMerchantClassification } from '@/lib/receipts/resolve';

jest.mock('@/lib/merchants/repo', () => ({
  findMerchantByNormalizedName: jest.fn(),
  isTrustedMerchant: (m: MerchantRecord) =>
    m.veces_confirmado > 0 || m.veces_corregido > 0,
}));

const findMock = findMerchantByNormalizedName as jest.MockedFunction<
  typeof findMerchantByNormalizedName
>;

function merchant(overrides: Partial<MerchantRecord> = {}): MerchantRecord {
  return {
    id: 'm-1',
    canonical_name: 'Mercadona',
    normalized_name: 'mercadona',
    tipo: 'Supermercado',
    plataforma_pago: 'Tarjeta',
    veces_visto: 3,
    veces_confirmado: 2,
    veces_corregido: 0,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  findMock.mockResolvedValue(null);
  // The "outside the standard list" cases make `normalizeCategory` warn on
  // purpose; keep the suite output clean without hiding anything else.
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('resolveMerchantClassification', () => {
  it('lets a trusted merchant override the model', async () => {
    findMock.mockResolvedValue(
      merchant({ tipo: 'Limpieza', veces_confirmado: 4 }),
    );
    const result = await resolveMerchantClassification({
      userId: 'u-1',
      comercio: 'MERCADONA S.A. 1234',
      modelTipo: 'Supermercado',
      modelPlataformaPago: 'Visa',
    });
    expect(result.tipo).toBe('Limpieza');
    expect(result.source).toBe('memory');
    expect(result.merchantId).toBe('m-1');
    expect(result.trusted).toBe(true);
  });

  it('looks the merchant up by its normalized name', async () => {
    await resolveMerchantClassification({
      userId: 'u-1',
      comercio: 'MERCADONA S.A. 1234 MADRID',
      modelTipo: 'Supermercado',
      modelPlataformaPago: '',
    });
    expect(findMock).toHaveBeenCalledWith('mercadona madrid', 'u-1');
  });

  it('lets the model beat a merchant the user never confirmed', async () => {
    findMock.mockResolvedValue(
      merchant({ tipo: 'Limpieza', veces_confirmado: 0, veces_corregido: 0 }),
    );
    const result = await resolveMerchantClassification({
      userId: 'u-1',
      comercio: 'Mercadona',
      modelTipo: 'Supermercado',
      modelPlataformaPago: '',
    });
    expect(result.tipo).toBe('Supermercado');
    expect(result.source).toBe('model');
    expect(result.trusted).toBe(false);
  });

  it('uses an unconfirmed merchant only when the model said nothing', async () => {
    findMock.mockResolvedValue(
      merchant({ tipo: 'Limpieza', veces_confirmado: 0 }),
    );
    const result = await resolveMerchantClassification({
      userId: 'u-1',
      comercio: 'Mercadona',
      modelTipo: '',
      modelPlataformaPago: '',
    });
    expect(result.tipo).toBe('Limpieza');
    expect(result.source).toBe('seen_guess');
  });

  it('normalizes the model answer through the category aliases', async () => {
    const result = await resolveMerchantClassification({
      userId: 'u-1',
      comercio: 'Corner Store',
      modelTipo: 'groceries',
      modelPlataformaPago: '',
    });
    expect(result.tipo).toBe('Supermercado');
    expect(result.source).toBe('alias');
  });

  // `normalizeCategory` is a normalizer, not a validator: an input it does
  // not recognise comes back **unchanged** (`lib/categories.ts` logs a warning
  // and returns the raw string). So "the model said something" is not proof of
  // "the model said a valid category" — see the gate in the implementation.
  it('refuses a model category that is outside the standard list', async () => {
    const result = await resolveMerchantClassification({
      userId: 'u-1',
      comercio: 'Corner Store',
      modelTipo: 'grocery',
      modelPlataformaPago: '',
    });
    expect(result.tipo).toBe('Otros gastos');
    expect(result.source).toBe('default');
  });

  it('prefers the seen guess over a model category outside the list', async () => {
    findMock.mockResolvedValue(
      merchant({ tipo: 'Limpieza', veces_confirmado: 0 }),
    );
    const result = await resolveMerchantClassification({
      userId: 'u-1',
      comercio: 'Mercadona',
      modelTipo: 'grocery',
      modelPlataformaPago: '',
    });
    expect(result.tipo).toBe('Limpieza');
    expect(result.source).toBe('seen_guess');
  });

  it('falls back to Otros gastos when nothing is known', async () => {
    const result = await resolveMerchantClassification({
      userId: 'u-1',
      comercio: '???',
      modelTipo: '',
      modelPlataformaPago: '',
    });
    expect(result.tipo).toBe('Otros gastos');
    expect(result.source).toBe('default');
    expect(result.merchantId).toBeNull();
  });

  it('does not query the database for an unreadable merchant name', async () => {
    await resolveMerchantClassification({
      userId: 'u-1',
      comercio: '   ',
      modelTipo: 'Supermercado',
      modelPlataformaPago: '',
    });
    expect(findMock).not.toHaveBeenCalled();
  });

  // The asymmetry: the ticket beats memory for the payment method.
  it('keeps the payment method the model read from this receipt', async () => {
    findMock.mockResolvedValue(merchant({ plataforma_pago: 'Tarjeta' }));
    const result = await resolveMerchantClassification({
      userId: 'u-1',
      comercio: 'Mercadona',
      modelTipo: 'Supermercado',
      modelPlataformaPago: 'Visa',
    });
    expect(result.plataforma_pago).toBe('Visa');
  });

  it('falls back to the remembered payment method when the receipt omits it', async () => {
    findMock.mockResolvedValue(merchant({ plataforma_pago: 'Tarjeta' }));
    const result = await resolveMerchantClassification({
      userId: 'u-1',
      comercio: 'Mercadona',
      modelTipo: 'Supermercado',
      modelPlataformaPago: '   ',
    });
    expect(result.plataforma_pago).toBe('Tarjeta');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test __tests__/lib/receipts-resolve.test.ts`
Expected: FAIL — `Cannot find module '@/lib/receipts/resolve'`.

- [ ] **Step 3: Write the implementation**

`lib/receipts/resolve.ts`:

```ts
import { STANDARD_CATEGORIES, normalizeCategory } from '@/lib/categories';
import { normalizeMerchantName } from '@/lib/merchants/normalize';
import {
  findMerchantByNormalizedName,
  isTrustedMerchant,
  type MerchantRecord,
} from '@/lib/merchants/repo';

/**
 * Decide the `tipo` of a parsed receipt.
 *
 * Order of authority:
 *   1. `memory`     — the user confirmed or corrected this merchant before.
 *   2. `alias`      — the model's answer is a known synonym.
 *   3. `model`      — the model's answer is already a standard category.
 *   4. `seen_guess` — the model said nothing usable, but the merchant was seen.
 *   5. `default`    — nothing known.
 *
 * Only `model` and `alias` require the answer to survive the
 * `STANDARD_CATEGORIES` gate; memory and `seen_guess` come from the user's own
 * ledger, and `default` is a literal.
 *
 * `memory` and `seen_guess` are deliberately separated. A merchant the user
 * has never confirmed may still contribute a guess, but only where the model
 * has nothing to offer: an unverified guess must never outrank a fresh read.
 */

export interface ClassificationInput {
  userId: string;
  comercio: string;
  modelTipo: string;
  modelPlataformaPago: string;
}

export interface Classification {
  tipo: string;
  plataforma_pago: string;
  source: 'memory' | 'alias' | 'model' | 'seen_guess' | 'default';
  merchantId: string | null;
  trusted: boolean;
}

export async function resolveMerchantClassification(
  input: ClassificationInput,
): Promise<Classification> {
  const normalizedName = normalizeMerchantName(input.comercio);

  const merchant: MerchantRecord | null = normalizedName
    ? await findMerchantByNormalizedName(normalizedName, input.userId)
    : null;

  const trusted = merchant !== null && isTrustedMerchant(merchant);
  const modelTipo = input.modelTipo.trim();

  // `normalizeCategory` cannot tell us whether it recognised the input: for an
  // unknown category it logs a warning and returns the string unchanged, so a
  // truthy result only proves the model said *something*. Gate the answer on
  // membership of `STANDARD_CATEGORIES` — without this gate a hallucinated
  // "grocery" would be written to the ledger as a `tipo`, would leave the
  // `/new` form with nothing selected (its list is fixed), and would then be
  // learned as merchant memory and re-applied to every future receipt.
  const normalizedModelTipo = modelTipo ? normalizeCategory(modelTipo) : '';
  const standardModelTipo = STANDARD_CATEGORIES.find(
    (category) => category.toLowerCase() === normalizedModelTipo.toLowerCase(),
  );

  let tipo: string;
  let source: Classification['source'];

  // `merchant !== null` is spelled out because `trusted` alone does not
  // narrow the type, and `merchant.tipo` may not be nullable-safe without it.
  if (merchant !== null && trusted && merchant.tipo) {
    tipo = merchant.tipo;
    source = 'memory';
  } else if (standardModelTipo) {
    tipo = standardModelTipo;
    // Unchanged by `normalizeCategory` means the model already answered with a
    // standard category; changed means we had to map a synonym onto one.
    source =
      standardModelTipo.toLowerCase() === modelTipo.toLowerCase()
        ? 'model'
        : 'alias';
  } else if (merchant?.tipo) {
    tipo = merchant.tipo;
    source = 'seen_guess';
  } else {
    tipo = 'Otros gastos';
    source = 'default';
  }

  const printed = input.modelPlataformaPago.trim();
  const remembered = merchant?.plataforma_pago ?? '';

  return {
    tipo,
    // The receipt in front of us is the authority on how it was paid, and an
    // empty string counts as "not printed on the receipt", so `||` and not
    // `??` is the operator we want here.
    plataforma_pago: printed || remembered || '',
    source,
    merchantId: merchant?.id ?? null,
    trusted,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test __tests__/lib/receipts-resolve.test.ts`
Expected: PASS — 11 tests, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add lib/receipts/resolve.ts __tests__/lib/receipts-resolve.test.ts
git commit -m "feat(receipts): resolve the category from user memory before the model"
```

---

## Task 10: The receipt endpoint

**Files:**

- Create: `app/api/ai/parse-receipt/route.ts`
- Test: `__tests__/api/parse-receipt.test.ts`

**Interfaces:**

- Consumes: `authOptions` from `@/app/api/auth/[...nextauth]/route`; `raceFreeProviders` from `@/lib/ai/fallback` (with `visionOnly: true`, Task 5); `RECEIPT_PARSE_SYSTEM_PROMPT` from `@/lib/ai/prompts` (Task 6); `checkRateLimit` / `getRateLimitHeaders` from `@/lib/ai/rate-limit`; `recordMerchantSeen` from `@/lib/merchants/repo` (Task 2); `findEntryByContentHash` / `findSimilarReceiptEntry` from `@/lib/receipts/dedupe` (Task 8); `validateImageUpload` / `toDataUrl` / `ReceiptImageError` from `@/lib/receipts/image` (Task 7); `resolveMerchantClassification` from `@/lib/receipts/resolve` (Task 9).
- Produces:
  ```ts
  export const receiptFactsSchema: z.ZodObject<{
    fecha: z.ZodString;
    cantidad: z.ZodNumber; // .nonnegative() — the route enforces > 0
    comercio: z.ZodString;
    tipo: z.ZodString; // a *proposal*; memory and aliases outrank it
    plataforma_pago: z.ZodString;
    detalle1: z.ZodString;
    confianza: z.ZodNumber; // .min(0).max(1)
  }>;
  export async function POST(request: NextRequest): Promise<NextResponse>;
  ```
  Responses:
  - `200` `{ success: true, duplicate: false, contentHash, parsedData, receipt, providerUsed, modelUsed }` — a fresh read.
  - `200` `{ success: true, duplicate: true, duplicateKind: 'exact' | 'similar', entry }` — already in the ledger.
  - `422` `{ success: false, field, error, message }` — the image was read but a required fact was not; `field` is `'cantidad'` or `'comercio'`.
  - `400` / `401` / `413` / `415` / `429` `{ error, message?, retryAfter? }` — the request never reached a model. **No `success` key**: clients must treat a missing `success` as a failure, not read `body.success === true`.
  - `503` `{ success: false, error, message, modelErrors }` — every free vision model failed.
- Pins Review Focus #1, #2 and #3.

**The guard order matters and is not arbitrary.** Authentication and rate limiting come first so an unauthenticated caller cannot make the server parse a 4 MiB body. The size and magic-byte checks come before the content hash, because hashing bytes you are going to reject is wasted work. The exact-duplicate lookup comes before the model call, because that is the whole point of hashing first. Everything expensive is last.

**No paid fallback here.** `parse-for-form` offers a paid model on failure; a receipt would send an image, and the app has no consent flow for that. When every free vision model fails, this endpoint returns `503` and says so. Adding a paid image path is a separate decision, not a detail of this task.

- [ ] **Step 1: Write the failing test**

`__tests__/api/parse-receipt.test.ts`:

```ts
/** @jest-environment node */

import { generateObject } from 'ai';
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';

import { POST } from '@/app/api/ai/parse-receipt/route';
import { raceFreeProviders } from '@/lib/ai/fallback';
import { checkRateLimit } from '@/lib/ai/rate-limit';
import { recordMerchantSeen } from '@/lib/merchants/repo';
import {
  findEntryByContentHash,
  findSimilarReceiptEntry,
} from '@/lib/receipts/dedupe';
import { resolveMerchantClassification } from '@/lib/receipts/resolve';

// `jest.mock('next-auth')` is a bare automock on purpose, and the auth route
// module is deliberately NOT mocked:
//
// - A factory returning only `getServerSession` deletes the module's default
//   export, and `@/app/api/auth/[...nextauth]/route` calls `NextAuth(...)` at
//   module scope while this route imports `authOptions` from it. The suite dies
//   with "(0 , _nextauth.default) is not a function".
// - `jest.config.mjs` maps `@/components`, `@/hooks` and `@/lib` but has no
//   `^@/app/*` entry, so a `jest.mock('@/app/api/auth/[...nextauth]/route')`
//   argument cannot be resolved at all — SWC rewrites *import specifiers*,
//   never `jest.mock()` path strings. Loading the real module works because the
//   specifier inside `route.ts` is rewritten. Same approach as
//   `__tests__/api/api-keys.test.ts`.
jest.mock('next-auth');
jest.mock('ai', () => ({ generateObject: jest.fn() }));
jest.mock('@/lib/ai/fallback', () => ({ raceFreeProviders: jest.fn() }));
jest.mock('@/lib/ai/rate-limit', () => ({
  checkRateLimit: jest.fn(),
  getRateLimitHeaders: jest.fn(() => ({ 'X-RateLimit-Limit': '3' })),
}));
jest.mock('@/lib/merchants/repo', () => ({ recordMerchantSeen: jest.fn() }));
jest.mock('@/lib/receipts/dedupe', () => ({
  findEntryByContentHash: jest.fn(),
  findSimilarReceiptEntry: jest.fn(),
}));
jest.mock('@/lib/receipts/resolve', () => ({
  resolveMerchantClassification: jest.fn(),
}));
jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const sessionMock = getServerSession as jest.MockedFunction<
  typeof getServerSession
>;
const raceMock = raceFreeProviders as jest.MockedFunction<
  typeof raceFreeProviders
>;
const rateLimitMock = checkRateLimit as jest.MockedFunction<
  typeof checkRateLimit
>;
const recordSeenMock = recordMerchantSeen as jest.MockedFunction<
  typeof recordMerchantSeen
>;
const exactMock = findEntryByContentHash as jest.MockedFunction<
  typeof findEntryByContentHash
>;
const similarMock = findSimilarReceiptEntry as jest.MockedFunction<
  typeof findSimilarReceiptEntry
>;
const resolveMock = resolveMerchantClassification as jest.MockedFunction<
  typeof resolveMerchantClassification
>;
const generateMock = generateObject as jest.MockedFunction<
  typeof generateObject
>;

const PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01, 0x02, 0x03, 0x04,
]);
const HTML = Buffer.from('<!doctype html><script>alert(1)</script>');

const FACTS = {
  fecha: '2026-09-20',
  cantidad: 43.2,
  comercio: 'Mercadona',
  tipo: 'Supermercado',
  plataforma_pago: 'Visa',
  detalle1: 'Leche y pan',
  confianza: 0.92,
};

function imageFile(bytes: Buffer = PNG, type = 'image/png'): File {
  return new File([new Uint8Array(bytes)], 'receipt.png', { type });
}

function multipartRequest(
  body: FormData | null = null,
  headers: Record<string, string> = {},
): NextRequest {
  const form = body ?? new FormData();
  return new NextRequest('http://localhost/api/ai/parse-receipt', {
    method: 'POST',
    body: form,
    headers,
  });
}

function withImage(bytes: Buffer = PNG, type = 'image/png'): FormData {
  const form = new FormData();
  form.set('image', imageFile(bytes, type));
  return form;
}

function succeedWith(facts: Record<string, unknown> = FACTS) {
  generateMock.mockResolvedValue({
    object: facts,
    usage: { inputTokens: 100, outputTokens: 20 },
  } as never);

  // The real race returns a { success, result, provider, model, ... } wrapper,
  // not the operation's own payload. Reproduce that, or every success path in
  // this file would fall through to the 503 branch.
  raceMock.mockImplementation(async (operation) => {
    const outcome = await operation({} as never, {
      provider: 'opencode',
      modelId: 'mimo-v2.5-free',
      name: 'MiMo V2.5 Free',
      timeoutMs: 1,
    });

    return {
      success: true,
      result: outcome.result,
      provider: 'opencode',
      model: 'mimo-v2.5-free',
      costUsd: 0,
      inputTokens: outcome.usage?.inputTokens ?? 0,
      outputTokens: outcome.usage?.outputTokens ?? 0,
    };
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  sessionMock.mockResolvedValue({
    user: { id: 'user-1' },
  } as never);
  rateLimitMock.mockResolvedValue({
    allowed: true,
    remaining: 2,
    reset: Date.now() + 60_000,
    retryAfter: 60,
  } as never);
  exactMock.mockResolvedValue(null);
  similarMock.mockResolvedValue(null);
  resolveMock.mockResolvedValue({
    tipo: 'Supermercado',
    plataforma_pago: 'Visa',
    source: 'model',
    merchantId: null,
    trusted: false,
  });
  // The real upsert returns the row it touched, and the route stores its id as
  // the entry's merchant_id. A default is required here: a mock resolving to
  // `undefined` would make every success test fail on `seen.id`.
  recordSeenMock.mockResolvedValue({
    id: 'm-1',
    canonical_name: 'Mercadona',
    normalized_name: 'mercadona',
    tipo: 'Supermercado',
    plataforma_pago: 'Visa',
    veces_visto: 1,
    veces_confirmado: 0,
    veces_corregido: 0,
  });
  succeedWith();
});

describe('POST /api/ai/parse-receipt', () => {
  it('rejects an unauthenticated caller', async () => {
    sessionMock.mockResolvedValue(null);
    const res = await POST(multipartRequest(withImage()));
    expect(res.status).toBe(401);
    expect(raceMock).not.toHaveBeenCalled();
  });

  it('rate limits before touching the body', async () => {
    rateLimitMock.mockResolvedValue({
      allowed: false,
      remaining: 0,
      reset: Date.now() + 60_000,
      retryAfter: 42,
    } as never);
    const res = await POST(multipartRequest(withImage()));
    expect(res.status).toBe(429);
    expect(generateMock).not.toHaveBeenCalled();
    // The client reads the remaining budget from these headers, on the
    // rejection path as much as on the success path.
    expect(res.headers.get('X-RateLimit-Limit')).toBe('3');
  });

  it('requires a multipart body', async () => {
    const res = await POST(
      new NextRequest('http://localhost/api/ai/parse-receipt', {
        method: 'POST',
        body: JSON.stringify({ image: 'nope' }),
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    expect(res.status).toBe(415);
  });

  it('requires an image field', async () => {
    const res = await POST(multipartRequest(new FormData()));
    expect(res.status).toBe(400);
  });

  // Review Focus #1
  it('rejects an HTML payload that claims to be a PNG', async () => {
    const res = await POST(multipartRequest(withImage(HTML, 'image/png')));
    expect(res.status).toBe(415);
    expect(generateMock).not.toHaveBeenCalled();
  });

  it('rejects an oversized upload with 413', async () => {
    const big = Buffer.concat([PNG, Buffer.alloc(4_194_304, 0x41)]);
    const res = await POST(multipartRequest(withImage(big)));
    expect(res.status).toBe(413);
    expect(generateMock).not.toHaveBeenCalled();
  });

  // Review Focus #2
  it('answers an identical re-upload from the hash, without a model call', async () => {
    exactMock.mockResolvedValue({
      id: 'e-1',
      fecha: '2026-09-20',
      tipo: 'Supermercado',
      accion: 'Gasto',
      que: 'Mercadona',
      plataforma_pago: 'Visa',
      cantidad: 43.2,
      detalle1: 'Leche',
      detalle2: null,
      quien: 'Yo',
    });

    const res = await POST(multipartRequest(withImage()));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.duplicate).toBe(true);
    expect(body.duplicateKind).toBe('exact');
    expect(body.entry.id).toBe('e-1');
    expect(generateMock).not.toHaveBeenCalled();
  });

  it('races vision models only', async () => {
    await POST(multipartRequest(withImage()));
    expect(raceMock).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ visionOnly: true }),
    );
  });

  it('sends the image as a data URL with the detected media type', async () => {
    await POST(multipartRequest(withImage()));
    const call = generateMock.mock.calls[0]?.[0] as {
      messages: {
        content: { type: string; image?: string; mediaType?: string }[];
      }[];
    };
    const parts = call.messages[0]?.content ?? [];
    expect(parts[0]).toEqual({
      type: 'text',
      text: expect.any(String),
    });
    expect(parts[1]?.type).toBe('image');
    expect(parts[1]?.mediaType).toBe('image/png');
    expect(parts[1]?.image).toMatch(/^data:image\/png;base64,/);
  });

  it('returns prefilled form data with the action fixed to Gasto', async () => {
    const res = await POST(multipartRequest(withImage()));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.duplicate).toBe(false);
    expect(body.parsedData).toMatchObject({
      fecha: '2026-09-20',
      tipo: 'Supermercado',
      accion: 'Gasto',
      que: 'Mercadona',
      plataforma_pago: 'Visa',
      cantidad: 43.2,
      detalle1: 'Leche y pan',
    });
    expect(body.receipt.confianza).toBe(0.92);
    expect(body.receipt.contentHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('flags a low-confidence read for review without failing', async () => {
    succeedWith({ ...FACTS, confianza: 0.4 });
    const res = await POST(multipartRequest(withImage()));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.receipt.needsReview).toBe(true);
  });

  // Review Focus #3
  it('refuses to return a zero amount', async () => {
    succeedWith({ ...FACTS, cantidad: 0 });
    const res = await POST(multipartRequest(withImage()));
    const body = await res.json();
    expect(res.status).toBe(422);
    expect(body.success).toBe(false);
    expect(body.field).toBe('cantidad');
  });

  it('refuses to return an unreadable merchant', async () => {
    succeedWith({ ...FACTS, comercio: '   ' });
    const res = await POST(multipartRequest(withImage()));
    const body = await res.json();
    expect(res.status).toBe(422);
    expect(body.field).toBe('comercio');
  });

  it('reports a re-photographed receipt as a similar duplicate', async () => {
    similarMock.mockResolvedValue({
      entry: {
        id: 'e-9',
        fecha: '2026-09-20',
        tipo: 'Supermercado',
        accion: 'Gasto',
        que: 'Mercadona',
        plataforma_pago: 'Visa',
        cantidad: 43.2,
        detalle1: null,
        detalle2: null,
        quien: 'Yo',
      },
      score: 1,
    });

    const res = await POST(multipartRequest(withImage()));
    const body = await res.json();
    expect(body.duplicate).toBe(true);
    expect(body.duplicateKind).toBe('similar');
    expect(body.entry.id).toBe('e-9');
  });

  it('resolves the category in the scope of the authenticated user', async () => {
    await POST(multipartRequest(withImage()));
    expect(resolveMock).toHaveBeenCalledWith({
      userId: 'user-1',
      comercio: 'Mercadona',
      modelTipo: 'Supermercado',
      modelPlataformaPago: 'Visa',
    });
  });

  it('remembers the merchant so the next upload benefits', async () => {
    await POST(multipartRequest(withImage()));
    expect(recordSeenMock).toHaveBeenCalledWith(
      'user-1',
      'Mercadona',
      'Supermercado',
      'Visa',
    );
  });

  // The classification ran before the row existed, so its merchantId is null
  // on a first sighting. The saved entry must still point at the row the
  // upsert created, or provenance is lost exactly when a shop is new.
  it('hands the created merchant id to the form', async () => {
    resolveMock.mockResolvedValue({
      tipo: 'Supermercado',
      plataforma_pago: 'Visa',
      source: 'model',
      merchantId: null,
      trusted: false,
    } as never);

    const body = await (await POST(multipartRequest(withImage()))).json();

    expect(body.parsedData.merchant_id).toBe('m-1');
    expect(body.receipt.merchantId).toBe('m-1');
  });

  it('keeps the already trusted id when the upsert fails', async () => {
    resolveMock.mockResolvedValue({
      tipo: 'Supermercado',
      plataforma_pago: 'Visa',
      source: 'memory',
      merchantId: 'm-9',
      trusted: true,
    } as never);
    recordSeenMock.mockRejectedValue(new Error('db down'));

    const body = await (await POST(multipartRequest(withImage()))).json();

    expect(body.parsedData.merchant_id).toBe('m-9');
  });

  // `finance_entries.plataforma_pago` is NOT NULL and the form's zod schema
  // requires `min(1)`, so an unreadable platform still has to prefill
  // *something*. This is a form placeholder, not a claim about the ticket —
  // which is why the honest value is reported separately in `receipt`.
  it('prefills a placeholder platform when the ticket and memory are both silent', async () => {
    resolveMock.mockResolvedValue({
      tipo: 'Supermercado',
      plataforma_pago: '',
      source: 'model',
      merchantId: null,
      trusted: false,
    } as never);

    const body = await (await POST(multipartRequest(withImage()))).json();

    expect(body.parsedData.plataforma_pago).toBe('Efectivo');
    expect(body.receipt.plataforma_pago).toBe('');
  });

  it('omits merchant_id when there is no merchant at all', async () => {
    recordSeenMock.mockRejectedValue(new Error('db down'));
    const body = await (await POST(multipartRequest(withImage()))).json();
    expect(body.parsedData.merchant_id).toBeUndefined();
  });

  it('still returns the parse when the merchant write fails', async () => {
    recordSeenMock.mockRejectedValue(new Error('db down'));
    const res = await POST(multipartRequest(withImage()));
    expect(res.status).toBe(200);
  });

  it('reports 503 when every vision model fails', async () => {
    raceMock.mockResolvedValue({
      success: false,
      error: 'all failed',
      attempts: ['mimo-v2.5-free: timeout'],
    } as never);
    const res = await POST(multipartRequest(withImage()));
    const body = await res.json();
    expect(res.status).toBe(503);
    expect(body.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test __tests__/api/parse-receipt.test.ts`
Expected: FAIL — `Cannot find module '@/app/api/ai/parse-receipt/route'`.

- [ ] **Step 3: Write the route**

`app/api/ai/parse-receipt/route.ts`:

```ts
import { generateObject } from 'ai';
import { type NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';

import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { raceFreeProviders } from '@/lib/ai/fallback';
import { RECEIPT_PARSE_SYSTEM_PROMPT } from '@/lib/ai/prompts';
import { checkRateLimit, getRateLimitHeaders } from '@/lib/ai/rate-limit';
import { logger } from '@/lib/logger';
import { recordMerchantSeen } from '@/lib/merchants/repo';
import {
  findEntryByContentHash,
  findSimilarReceiptEntry,
  type ReceiptCandidate,
} from '@/lib/receipts/dedupe';
import {
  ReceiptImageError,
  toDataUrl,
  validateImageUpload,
} from '@/lib/receipts/image';
import { resolveMerchantClassification } from '@/lib/receipts/resolve';

/**
 * The facts read off a receipt image. Nothing else: no category decision, no
 * `accion` (a receipt is an expense), no `que` (the merchant name is that).
 *
 * `cantidad` is `nonnegative` rather than `positive` so that an unreadable
 * total comes back as a *successful read of a zero* and the route can answer
 * with a field-level error, instead of every model throwing and the whole
 * request degrading to `503`.
 */
export const receiptFactsSchema = z.object({
  fecha: z.string().describe('Fecha de la compra en formato YYYY-MM-DD'),
  cantidad: z
    .number()
    .nonnegative()
    .describe('Importe total pagado, siempre positivo (12.5)'),
  comercio: z.string().describe('Nombre del comercio tal como aparece'),
  tipo: z
    .string()
    .describe(
      'Categoría de gasto propuesta, de la lista del prompt. El servidor la normaliza y la memoria del usuario tiene prioridad.',
    ),
  plataforma_pago: z
    .string()
    .describe('Método de pago impreso; cadena vacía si no aparece'),
  detalle1: z
    .string()
    .describe('Descripción corta de lo comprado; cadena vacía si no se lee'),
  confianza: z
    .number()
    .min(0)
    .max(1)
    .describe('Confianza entre 0 y 1 en la lectura del importe'),
});

/** Images cost more than text, so the budget is tighter than parse-for-form. */
const RATE_LIMIT_CONFIG = { maxRequests: 3, windowMs: 60 * 1000 };

/** Below this the form is pre-filled but flagged for the user to check. */
const LOW_CONFIDENCE = 0.5;

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  const session = await getServerSession(authOptions);
  if (!session?.user.id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  const userId = session.user.id;

  const rateLimitResult = await checkRateLimit(
    `parse-receipt:${userId}`,
    RATE_LIMIT_CONFIG,
  );
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      {
        error: 'Límite de solicitudes excedido',
        message: `Demasiadas imágenes. Inténtalo de nuevo en ${rateLimitResult.retryAfter} segundos.`,
        retryAfter: rateLimitResult.retryAfter,
      },
      {
        status: 429,
        headers: getRateLimitHeaders(rateLimitResult),
      },
    );
  }

  const headers = getRateLimitHeaders(rateLimitResult);
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('multipart/form-data')) {
    return NextResponse.json(
      { error: 'Se requiere un envío multipart/form-data con el campo image.' },
      { status: 415, headers },
    );
  }

  let image: Awaited<ReturnType<typeof validateImageUpload>>;
  try {
    const formData = await request.formData();
    const field = formData.get('image');
    if (!(field instanceof File)) {
      return NextResponse.json(
        { error: "Se requiere un archivo en el campo 'image'." },
        { status: 400, headers },
      );
    }
    image = await validateImageUpload(field);
  } catch (error) {
    if (error instanceof ReceiptImageError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode, headers },
      );
    }
    logger.error(`[Parse Receipt] Guard error ${requestId}`, {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json(
      { error: 'No se pudo leer el archivo.' },
      { status: 400, headers },
    );
  }

  // The cheapest possible answer: this exact image is already stored.
  const exact = await findEntryByContentHash(image.contentHash, userId);
  if (exact) {
    logger.info(`[Parse Receipt] Exact duplicate ${requestId}`, {
      userId,
      entryId: exact.id,
    });
    return NextResponse.json(
      { success: true, duplicate: true, duplicateKind: 'exact', entry: exact },
      { headers },
    );
  }

  logger.info(`[Parse Receipt Start] ${requestId}`, {
    userId,
    mediaType: image.mediaType,
    bytes: image.byteLength,
  });

  const freeResult = await raceFreeProviders(
    async (model) => {
      const result = await generateObject({
        model,
        schema: receiptFactsSchema,
        system: RECEIPT_PARSE_SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Extrae los datos de este recibo.',
              },
              {
                type: 'image',
                image: toDataUrl(image),
                mediaType: image.mediaType,
              },
            ],
          },
        ],
        maxRetries: 1,
      });

      return {
        result: { facts: result.object },
        usage: {
          inputTokens: result.usage.inputTokens ?? 0,
          outputTokens: result.usage.outputTokens ?? 0,
        },
      };
    },
    { endpoint: '/api/ai/parse-receipt', visionOnly: true },
  );

  if (!freeResult.success) {
    logger.warn(`[Parse Receipt] All vision models failed ${requestId}`, {
      userId,
      attempts: freeResult.attempts,
    });
    return NextResponse.json(
      {
        success: false,
        error: 'No hemos podido leer la imagen con ningún modelo disponible.',
        message: 'Prueba con una foto más nítida o escribe la entrada a mano.',
        modelErrors: freeResult.attempts,
      },
      { status: 503, headers },
    );
  }

  const facts = freeResult.result.facts;

  // A successful read is not a usable read. An unreadable total must never
  // reach the form, where it would be saved as a 0 expense.
  if (!Number.isFinite(facts.cantidad) || facts.cantidad <= 0) {
    return NextResponse.json(
      {
        success: false,
        field: 'cantidad',
        error: 'No se ha podido leer el importe.',
        message:
          'Haz una foto más cerca del total, o con mejor luz, e inténtalo de nuevo.',
      },
      { status: 422, headers },
    );
  }

  const comercio = facts.comercio.trim();
  if (!comercio) {
    return NextResponse.json(
      {
        success: false,
        field: 'comercio',
        error: 'No se ha podido leer el comercio.',
        message:
          'Haz una foto donde se vea el nombre del comercio, e inténtalo de nuevo.',
      },
      { status: 422, headers },
    );
  }

  const now = new Date();
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(facts.fecha.trim())
    ? facts.fecha.trim()
    : now.toISOString().split('T')[0];

  const candidate: ReceiptCandidate = {
    fecha,
    hora: now.getHours(),
    minuto: now.getMinutes(),
    comercio,
    cantidad: facts.cantidad,
    plataforma_pago: facts.plataforma_pago.trim(),
  };

  const similar = await findSimilarReceiptEntry(candidate, userId);
  if (similar) {
    logger.info(`[Parse Receipt] Similar duplicate ${requestId}`, {
      userId,
      entryId: similar.entry.id,
      score: similar.score,
    });
    return NextResponse.json(
      {
        success: true,
        duplicate: true,
        duplicateKind: 'similar',
        entry: similar.entry,
      },
      { headers },
    );
  }

  const classification = await resolveMerchantClassification({
    userId,
    comercio,
    modelTipo: facts.tipo,
    modelPlataformaPago: facts.plataforma_pago,
  });

  // Best-effort: a failed write must not cost the user their parse. When it
  // does succeed, its id is what the saved entry points at — the classification
  // could not know it, because on a first sighting the row did not exist yet.
  let merchantId = classification.merchantId;
  try {
    const seen = await recordMerchantSeen(
      userId,
      comercio,
      classification.tipo,
      classification.plataforma_pago,
    );
    merchantId = seen.id;
  } catch (error) {
    logger.warn(`[Parse Receipt] Merchant write failed ${requestId}`, {
      userId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  const confianza = Math.min(1, Math.max(0, facts.confianza));

  logger.info(`[Parse Receipt Success] ${requestId}`, {
    userId,
    provider: freeResult.provider,
    model: freeResult.model,
    categorySource: classification.source,
    durationMs: Date.now() - startTime,
  });

  return NextResponse.json(
    {
      success: true,
      duplicate: false,
      contentHash: image.contentHash,
      parsedData: {
        fecha,
        hora: now.getHours(),
        minuto: now.getMinutes(),
        tipo: classification.tipo,
        accion: 'Gasto',
        que: comercio,
        // Placeholder only. The column is NOT NULL and the form requires a
        // value, so the prefill cannot stay empty — but the truth is reported
        // in `receipt.plataforma_pago` so the UI can say it was not read.
        plataforma_pago: classification.plataforma_pago || 'Efectivo',
        cantidad: facts.cantidad,
        detalle1: facts.detalle1.trim(),
        detalle2: '',
        merchant_id: merchantId ?? undefined,
      },
      receipt: {
        contentHash: image.contentHash,
        confianza,
        needsReview: confianza < LOW_CONFIDENCE,
        comercio,
        categorySource: classification.source,
        merchantId,
        /** What was actually known — `''` when neither ticket nor memory had it. */
        plataforma_pago: classification.plataforma_pago,
      },
      providerUsed: freeResult.provider,
      modelUsed: freeResult.model,
    },
    {
      headers: {
        ...headers,
        'X-Provider-Used': freeResult.provider,
        'X-Model-Used': freeResult.model,
      },
    },
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test __tests__/api/parse-receipt.test.ts`
Expected: PASS — 22 tests, 0 failures.

If the "sends the image as a data URL" test fails on the text part, the AI SDK expects `messages[].content` parts in the order the model expects; keep the instruction text first.

- [ ] **Step 5: Check the route does not break the existing AI routes**

Run: `pnpm test __tests__/api __tests__/lib/ai-tools.test.ts && pnpm typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/api/ai/parse-receipt/route.ts __tests__/api/parse-receipt.test.ts
git commit -m "feat(receipts): add the receipt parse endpoint with hash dedupe"
```

---

## Task 11: Provenance on write, and learning on confirm

**Files:**

- Modify: `lib/entries/repo.ts:54-64,234-269`
- Modify: `lib/actions.ts:55-66`
- Test: `__tests__/lib/entries-repo-provenance.test.ts`
- Test: `__tests__/lib/actions-learning.test.ts`

**Interfaces:**

- Consumes: `applyMerchantConfirmation` from `@/lib/merchants/repo` (Task 2).
- Produces:
  ```ts
  // lib/entries/repo.ts — added to the existing EntryInput
  export interface EntryInput {
    // ...unchanged fields...
    merchant_id?: string;
    content_hash?: string;
    origen?: string; // defaults to 'manual'
    confianza?: number;
  }

  // lib/actions.ts
  export async function createEntry(
    formData: EntryInput,
    session: { user: { id: string } },
    learning?: {
      comercio: string;
      /** The prefill the form was opened with. Recorded for debugging only. */
      categoriaPrefill: string;
    },
  ): Promise<void>;
  ```
- Pins Review Focus #5.

**Where the authority is.** The learning step reads `formData.tipo` — the category the user actually saved — and never `learning.categoriaPrefill`. The prefill is a guess; the saved value is the decision. Reading the prefill would make the wrong guess permanent after a single confirmation, which is the exact failure this feature exists to avoid.

- [ ] **Step 1: Write the failing repo test**

`__tests__/lib/entries-repo-provenance.test.ts`:

```ts
/** @jest-environment node */

import { createClient } from '@vercel/postgres';

import { insertEntry, type EntryInput } from '@/lib/entries/repo';

jest.mock('@vercel/postgres');
jest.mock('uuid', () => ({ v4: () => 'entry-id' }));

const mockedCreateClient = createClient as jest.MockedFunction<
  typeof createClient
>;

const sql = jest.fn();
const connect = jest.fn();
const end = jest.fn();

const BASE: EntryInput = {
  fecha: '2026-09-20T12:00:00.000Z',
  tipo: 'Supermercado',
  accion: 'Gasto',
  que: 'Mercadona',
  plataforma_pago: 'Visa',
  cantidad: 43.2,
  detalle1: 'Leche',
  quien: 'Yo',
};

function lastCall(): [TemplateStringsArray, ...unknown[]] {
  const call = sql.mock.calls.at(-1) ?? [];
  return call as [TemplateStringsArray, ...unknown[]];
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedCreateClient.mockReturnValue({
    connect,
    sql,
    query: jest.fn(),
    end,
  } as unknown as ReturnType<typeof createClient>);
  connect.mockResolvedValue(undefined);
  end.mockResolvedValue(undefined);
  sql.mockResolvedValue({ rows: [], rowCount: 1 });
});

describe('insertEntry provenance', () => {
  it('stores manual defaults when nothing is known about a receipt', async () => {
    await insertEntry(BASE, 'user-1');
    const [strings, ...values] = lastCall();
    expect(strings.join(' ')).toContain('origen');
    expect(values).toContain('manual');
    expect(values).toContain('user-1');
  });

  it('stores the receipt provenance when the form supplies it', async () => {
    await insertEntry(
      {
        ...BASE,
        merchant_id: 'm-1',
        content_hash: 'a'.repeat(64),
        origen: 'receipt',
        confianza: 0.92,
      },
      'user-1',
    );
    const [strings, ...values] = lastCall();
    const sqlText = strings.join(' ');
    expect(sqlText).toContain('merchant_id');
    expect(sqlText).toContain('content_hash');
    expect(sqlText).toContain('confianza');
    expect(values).toContain('m-1');
    expect(values).toContain('a'.repeat(64));
    expect(values).toContain('receipt');
    expect(values).toContain(0.92);
  });

  it('writes provenance as NULL rather than an empty string', async () => {
    await insertEntry({ ...BASE, content_hash: '', merchant_id: '' }, 'user-1');
    const [, ...values] = lastCall();
    expect(values).toContain(null);
    expect(values).not.toContain('');
  });
});
```

- [ ] **Step 2: Write the failing actions test**

`__tests__/lib/actions-learning.test.ts`:

```ts
/** @jest-environment node */

import { revalidatePath } from 'next/cache';

import { createEntry } from '@/lib/actions';
import { insertEntry, type EntryInput } from '@/lib/entries/repo';
import { applyMerchantConfirmation } from '@/lib/merchants/repo';

jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));
jest.mock('@/lib/entries/repo', () => ({
  insertEntry: jest.fn(),
  // The real predicate, not a `jest.fn()`: this suite is what decides whether
  // a duplicate save is swallowed, so stubbing the decision would make the
  // duplicate tests assert nothing. Every other export of the module is mocked
  // away, so this has to be a faithful copy of the implementation.
  isUniqueViolation: (error: unknown) =>
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === '23505',
  updateEntryById: jest.fn(),
  deleteEntryById: jest.fn(),
  deleteEntriesByIds: jest.fn(),
  exportEntries: jest.fn(),
  findEntries: jest.fn(),
}));
jest.mock('@/lib/users/repo', () => ({
  findUserByEmail: jest.fn(),
  insertUser: jest.fn(),
}));
jest.mock('@/lib/merchants/repo', () => ({
  applyMerchantConfirmation: jest.fn(),
}));

const insertMock = insertEntry as jest.MockedFunction<typeof insertEntry>;
const learningMock = applyMerchantConfirmation as jest.MockedFunction<
  typeof applyMerchantConfirmation
>;
const revalidateMock = revalidatePath as jest.MockedFunction<
  typeof revalidatePath
>;

const SESSION = { user: { id: 'user-1' } };

const RECEIPT: EntryInput = {
  fecha: '2026-09-20T12:00:00.000Z',
  tipo: 'Limpieza',
  accion: 'Gasto',
  que: 'Mercadona',
  plataforma_pago: 'Visa',
  cantidad: 43.2,
  origen: 'receipt',
  content_hash: 'a'.repeat(64),
  merchant_id: 'm-1',
  confianza: 0.92,
};

beforeEach(() => {
  jest.clearAllMocks();
  insertMock.mockResolvedValue('entry-id');
  learningMock.mockResolvedValue(undefined);
});

describe('createEntry', () => {
  it('persists the entry as before', async () => {
    await createEntry(RECEIPT, SESSION);
    expect(insertMock).toHaveBeenCalledWith(RECEIPT, 'user-1');
    expect(revalidateMock).toHaveBeenCalledWith('/');
  });

  // Review Focus #5: the saved category is the authority, not the prefill.
  it('learns the category the user actually saved, not the prefill', async () => {
    await createEntry(RECEIPT, SESSION, {
      comercio: 'Mercadona',
      categoriaPrefill: 'Supermercado',
    });
    expect(learningMock).toHaveBeenCalledWith({
      userId: 'user-1',
      comercio: 'Mercadona',
      tipo: 'Limpieza',
      plataforma_pago: 'Visa',
    });
  });

  it('does not touch merchant memory for a manual entry', async () => {
    await createEntry({ ...RECEIPT, origen: 'manual' }, SESSION, {
      comercio: 'Mercadona',
      categoriaPrefill: 'Supermercado',
    });
    expect(learningMock).not.toHaveBeenCalled();
  });

  it('does not touch merchant memory without learning context', async () => {
    await createEntry(RECEIPT, SESSION);
    expect(learningMock).not.toHaveBeenCalled();
  });

  // The unique index is the last line of defence against a double save.
  it('treats a unique violation as an already-saved receipt, not a failure', async () => {
    insertMock.mockRejectedValue(
      Object.assign(new Error('duplicate key value'), { code: '23505' }),
    );

    await expect(
      createEntry(RECEIPT, SESSION, {
        comercio: 'Mercadona',
        categoriaPrefill: 'Supermercado',
      }),
    ).resolves.toBeUndefined();

    expect(revalidateMock).toHaveBeenCalledWith('/');
  });

  // Counting the same confirmation twice would inflate `veces_confirmado`,
  // which is exactly the number that marks a merchant as trusted.
  it('does not learn twice when the save was a duplicate', async () => {
    insertMock.mockRejectedValue(
      Object.assign(new Error('duplicate key value'), { code: '23505' }),
    );

    await createEntry(RECEIPT, SESSION, {
      comercio: 'Mercadona',
      categoriaPrefill: 'Supermercado',
    });

    expect(learningMock).not.toHaveBeenCalled();
  });

  it('keeps the entry even when the learning write fails', async () => {
    learningMock.mockRejectedValue(new Error('learning boom'));
    await expect(
      createEntry(RECEIPT, SESSION, {
        comercio: 'Mercadona',
        categoriaPrefill: 'Supermercado',
      }),
    ).resolves.toBeUndefined();
    expect(insertMock).toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run both tests to verify they fail**

Run: `pnpm test __tests__/lib/entries-repo-provenance.test.ts __tests__/lib/actions-learning.test.ts`
Expected: FAIL — the SQL does not mention `merchant_id`, and `createEntry` ignores its third argument.

- [ ] **Step 4: Extend `EntryInput`**

In `lib/entries/repo.ts`, extend the interface at 54-64:

```ts
export interface EntryInput {
  fecha: string;
  tipo: string;
  accion: string;
  que: string;
  plataforma_pago: string;
  cantidad: number;
  detalle1?: string;
  detalle2?: string;
  quien?: string;
  /**
   * Receipt provenance. Every field is optional and every existing caller
   * omits them: a manual entry has no merchant, no hash, and an `origen` of
   * 'manual'.
   */
  merchant_id?: string;
  content_hash?: string;
  origen?: string;
  confianza?: number;
}
```

- [ ] **Step 5: Persist it in `insertEntry`**

Replace the `INSERT` at 234-269 with:

```ts
export async function insertEntry(
  data: EntryInput,
  userId: string,
): Promise<string> {
  const entryId = uuidv4();
  await withClient(async (client) => {
    await client.sql`
      INSERT INTO finance_entries (
        id, fecha, tipo, accion, que, plataforma_pago, cantidad,
        detalle1, detalle2, quien, user_id,
        merchant_id, content_hash, origen, confianza
      ) VALUES (
        ${entryId},
        ${data.fecha}::timestamptz,
        ${data.tipo},
        ${data.accion},
        ${data.que},
        ${data.plataforma_pago},
        ${data.cantidad},
        ${
          /* eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- empty string must be stored as NULL, not '' */
          data.detalle1 || null
        },
        ${
          /* eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- empty string must be stored as NULL, not '' */
          data.detalle2 || null
        },
        ${
          /* eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- empty string must fall back to 'Yo', not be stored as '' */
          data.quien || 'Yo'
        },
        ${userId},
        ${
          /* eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- empty string must become NULL; '' is not a valid UUID */
          data.merchant_id || null
        },
        ${
          /* eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- empty string must become NULL; '' would never match the unique index */
          data.content_hash || null
        },
        ${
          /* eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- an absent origen is a manual entry, not an empty one */
          data.origen || 'manual'
        },
        ${data.confianza ?? null}::numeric
      )
    `;
  });
  return entryId;
}
```

`??` versus `||` here is deliberate: an empty `content_hash` or `merchant_id` must become `NULL` (the column is nullable, and `''` would break the duplicate lookup and the foreign key), but `confianza: 0` is a legitimate value that `||` would destroy. The three `||` uses carry the same `eslint-disable-next-line` the existing `detalle1`/`detalle2`/`quien` lines already use, because the rule is enabled in `eslint.config.mjs`.

Do not touch `updateEntryById`. Editing an existing entry should not rewrite the provenance of how it was first mockCaptured.

Add this helper directly after `insertEntry` in the same file — Task 11's next step needs it, and it belongs with the code that can raise the error:

```ts
/**
 * Postgres `unique_violation` (SQLSTATE 23505).
 *
 * `@vercel/postgres` rethrows the driver's error object untouched, so `code`
 * is on it. Duck-typed rather than imported as a driver type because the
 * repository layer is not supposed to depend on the driver.
 */
export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === '23505'
  );
}
```

- [ ] **Step 6: Teach `createEntry` to learn**

Extend the existing `@/lib/entries/repo` import block in `lib/actions.ts` (it already imports nine names from there — add `isUniqueViolation` in alphabetical position, after `insertEntry`), and add the second import, keeping the `@/` group alphabetical:

```ts
import {
  deleteEntriesByIds,
  deleteEntryById,
  exportEntries,
  findEntries,
  insertEntry,
  isUniqueViolation,
  updateEntryById,
  type EntryFilter,
  type EntryInput,
  type PaginatedEntries,
} from '@/lib/entries/repo';
import { applyMerchantConfirmation } from '@/lib/merchants/repo';
```

(`@/lib/entries/repo` then `@/lib/merchants/repo` then `@/lib/users/repo`.)

Replace `createEntry` at 55-66 with:

```ts
export async function createEntry(
  formData: EntryInput,
  session: { user: { id: string } },
  learning?: {
    /** Merchant as the user saw it on the receipt. */
    comercio: string;
    /** The value the form was pre-filled with. Never used to learn. */
    categoriaPrefill: string;
  },
) {
  try {
    await insertEntry(formData, session.user.id);
  } catch (error) {
    // The unique partial index on `(user_id, content_hash)` is the last line
    // of defence against a double save: two tabs opened from the same
    // `/new?rcpt=1&content_hash=…` URL, or a retry after a dropped response.
    // The entry the user just reviewed *is* in the ledger, so this is a
    // success, not a failure — throwing would turn a saved receipt into a
    // dead end, and the form's submit handler has no error UI, so the user
    // would just see nothing happen. Learning is deliberately skipped: the
    // first save already incremented `veces_confirmado` for this merchant,
    // and doing it twice would inflate the trust signal.
    if (isUniqueViolation(error)) {
      console.warn('Duplicate receipt save ignored:', error);
      revalidatePath('/');
      return;
    }
    console.error('Database Error:', error);
    throw new Error('Failed to create entry.');
  }

  // The entry is saved; a failed learning write must not undo that.
  if (learning && formData.origen === 'receipt') {
    try {
      await applyMerchantConfirmation({
        userId: session.user.id,
        comercio: learning.comercio,
        // The category the user saved, which outranks the prefill.
        tipo: formData.tipo,
        plataforma_pago: formData.plataforma_pago,
      });
    } catch (error) {
      console.error('Merchant learning error:', error);
    }
  }

  revalidatePath('/');
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `pnpm test __tests__/lib/entries-repo-provenance.test.ts __tests__/lib/actions-learning.test.ts __tests__/api/v1/entries.test.ts`
Expected: PASS — 28 tests: 3 new `insertEntry` provenance cases, 7 new
learning cases, and the 18 pre-existing v1 entry cases as the regression
net. The v1 suite must stay at 18; a change there means the shared
`createEntry` path moved.

- [ ] **Step 8: Commit**

```bash
git add lib/entries/repo.ts lib/actions.ts __tests__/lib/entries-repo-provenance.test.ts __tests__/lib/actions-learning.test.ts
git commit -m "feat(receipts): store entry provenance and learn from confirmations"
```

---

## Task 12: Carry the receipt through to the form

**Files:**

- Modify: `app/new/page.tsx:12,15-51`
- Modify: `components/finance-form.tsx:63-85,213-252`
- Create: `components/ai/receiptSubmitContext.ts`
- Test: `__tests__/app/new-page-receipt-params.test.tsx`
- Test: `__tests__/components/receipt-submit-context.test.ts`

**Interfaces:**

- Consumes: `createEntry` from `@/lib/actions` (Task 11).
- Produces: new query parameters on `/new`, understood by both files:
  | Param            | Meaning                                                                             |
  | ---------------- | ----------------------------------------------------------------------------------- |
  | `rcpt=1`         | The prefill came from a receipt. Also the signal that this is _not_ a manual visit. |
  | `content_hash`   | The SHA-256 of the uploaded image.                                                  |
  | `confianza`      | The model's confidence in the amount, `0`–`1`.                                      |
  | `needs_review=1` | Confidence below the low-confidence threshold.                                      |
  | `comercio`       | The merchant as read, used only to target the learning write.                       |
  | `merchant_id`    | The remembered merchant row, when there was one.                                    |

**Why `comercio` travels through the URL at all.** The user may change the category before saving. `comercio` is the only thing needed to attribute that decision to the right merchant row; it is never used as the category. Keeping it out of the form's editable fields is deliberate — the merchant name is a fact of the receipt, not something to edit here.

- [ ] **Step 1: Write the failing test**

`__tests__/app/new-page-receipt-params.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { useSearchParams } from 'next/navigation';

import NewEntryPage from '@/app/new/page';

jest.mock('next/navigation', () => ({
  useSearchParams: jest.fn(),
  useRouter: jest.fn(),
}));

/**
 * The `mock` prefix is required, not decorative: `jest.mock` factories are
 * hoisted above the imports, and jest-plugin only lets a factory reference
 * out-of-scope variables whose names begin with `mock`. A plain `captured`
 * would fail the transform with "Invalid variable access: captured".
 */
const mockCaptured: { parsedData?: Record<string, unknown> } = {};

jest.mock('@/components/finance-form', () => ({
  FinanceForm: ({ parsedData }: { parsedData?: Record<string, unknown> }) => {
    mockCaptured.parsedData = parsedData;
    return <div data-testid="finance-form" />;
  },
}));

const params = new Map<string, string>();

beforeEach(() => {
  mockCaptured.parsedData = undefined;
  params.clear();
  (useSearchParams as jest.Mock).mockReturnValue({
    get: (key: string) => params.get(key) ?? null,
    has: (key: string) => params.has(key),
  });
});

describe('/new with a receipt prefill', () => {
  it('passes nothing for a plain manual visit', () => {
    render(<NewEntryPage />);
    expect(mockCaptured.parsedData).toBeUndefined();
    expect(screen.getByText('Añadir Nueva Entrada')).toBeInTheDocument();
  });

  it('recognises rcpt as an AI prefill', () => {
    params.set('rcpt', '1');
    params.set('fecha', '2026-09-20');
    params.set('tipo', 'Supermercado');
    params.set('accion', 'Gasto');
    params.set('que', 'Mercadona');
    params.set('plataforma_pago', 'Visa');
    params.set('cantidad', '43.2');
    params.set('content_hash', 'a'.repeat(64));
    params.set('confianza', '0.92');
    params.set('comercio', 'Mercadona');

    render(<NewEntryPage />);

    expect(screen.getByText('Revisar Entrada (IA)')).toBeInTheDocument();
    expect(mockCaptured.parsedData).toMatchObject({
      fecha: '2026-09-20',
      tipo: 'Supermercado',
      accion: 'Gasto',
      que: 'Mercadona',
      plataforma_pago: 'Visa',
      cantidad: 43.2,
      rcpt: '1',
      content_hash: 'a'.repeat(64),
      confianza: 0.92,
      comercio: 'Mercadona',
      needs_review: false,
    });
  });

  it('flags a low-confidence read', () => {
    params.set('rcpt', '1');
    params.set('confianza', '0.4');
    params.set('needs_review', '1');
    render(<NewEntryPage />);
    expect(mockCaptured.parsedData).toMatchObject({
      confianza: 0.4,
      needs_review: true,
    });
  });

  it('still handles a text-parsing prefill', () => {
    params.set('ai_text', 'gasto 20 euros en mercadona');
    params.set('cantidad', '20');
    render(<NewEntryPage />);
    expect(mockCaptured.parsedData).toMatchObject({
      ai_text: 'gasto 20 euros en mercadona',
      cantidad: 20,
    });
    // `rcpt` is present-but-undefined for a text parse, and that is fine: the
    // form's gate is `rcpt === '1'`, so what must not happen is a `'1'` here.
    expect(mockCaptured.parsedData?.rcpt).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test __tests__/app/new-page-receipt-params.test.tsx`
Expected: FAIL — `rcpt=1` is not recognised, so `parsedData` is `undefined` and the heading is wrong.

- [ ] **Step 3: Teach the page the receipt params**

In `app/new/page.tsx`, add one line above the `parsedData` literal (next to
`hasAiData`), because `confianza` is the only number parsed out of the URL that
reaches the database unfiltered — the form's zod schema validates everything it
knows about, but `confianza` is merged in _after_ that parse, so a hand-edited
`?confianza=abc` would otherwise be stored as `NaN` (which `numeric` happily
accepts):

```ts
// `NaN` is the one value that would survive into the ledger.
const confianzaParam = parseFloat(searchParams.get('confianza') ?? '');
```

Then replace line 12:

```ts
// AI-parsed data, from either a text prompt or a receipt upload.
const hasAiData = searchParams.has('ai_text') || searchParams.has('rcpt');
```

Then append these five entries to the `parsedData` object literal, after `ai_paid` on line 49:

```ts
        // Receipt provenance. `rcpt` is the marker that turns a plain visit
        // into a confirmation flow, and `comercio` is the only input the
        // learning write needs; the category always comes from the form.
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- empty query params must normalize to undefined
        rcpt: searchParams.get('rcpt') || undefined,
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- empty query params must normalize to undefined
        content_hash: searchParams.get('content_hash') || undefined,
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- empty query params must normalize to undefined
        merchant_id: searchParams.get('merchant_id') || undefined,
        confianza: Number.isFinite(confianzaParam)
          ? confianzaParam
          : undefined,
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- empty query params must normalize to undefined
        comercio: searchParams.get('comercio') || undefined,
        needs_review: searchParams.get('needs_review') === '1',
```

Leave `accion` alone: the route already sends `accion=Gasto`, and this file passes it straight through.

- [ ] **Step 4: Extend `ParsedData` and the submit handler**

In `components/finance-form.tsx`, add to the `ParsedData` interface after `ai_paid`:

```ts
  // Receipt provenance, from `/new?rcpt=1`
  rcpt?: string;
  content_hash?: string;
  merchant_id?: string;
  confianza?: number;
  comercio?: string;
  needs_review?: boolean;
```

In `onSubmit` (213-252), replace the final `if (entry) { ... } else { ... }` block with:

```ts
const { provenance, learning } = buildReceiptSubmitContext(parsedData);

if (entry) {
  // Provenance is write-once at insert. `updateEntryById` does not store
  // it (Task 11 leaves it untouched), and an edit months later is not a
  // statement about the receipt that produced the entry.
  await updateEntry(entry.id, formattedValues, {
    user: { id: session.user.id },
  });
} else {
  await createEntry(
    { ...formattedValues, ...provenance },
    { user: { id: session.user.id } },
    learning,
  );
}
```

Add the import to `components/finance-form.tsx` directly above
`import { Badge } from '@/components/ui/badge';` — `@/components/ai` sorts before
`@/components/ui`, and `import-x/order` is enforced:

```ts
import { buildReceiptSubmitContext } from '@/components/ai/receiptSubmitContext';
import { Badge } from '@/components/ui/badge';
```

`updateEntry` deliberately does not learn either: editing an entry months later
is not a statement about the receipt that produced it.

**Put the decision in a helper, not in the JSX.** The two facts that make this
feature work — that a receipt save carries provenance, and that it carries the
`learning` context `createEntry` needs — live in an event handler that no test
can reach without mounting the whole form (session, options fetch, Radix
selects). Extracting them makes the one silent failure impossible: if the third
`createEntry` argument were ever dropped, learning would stop for every user and
_every other test in the plan would still pass_.

Create `components/ai/receiptSubmitContext.ts` — a sibling of the `imageDownscale`
helper from Task 13, for the same reason and with the same shape:

- **It cannot live in `lib/`.** `.dependency-cruiser.js` fails closed on
  `components/ -> lib/`: only an explicit allow-list (`lib/actions.ts`,
  `lib/utils.ts`, `lib/categories.ts`, …) may cross that boundary, so
  `@/lib/receipts/*` would fail `pnpm check`.
- **It cannot live in `finance-form.tsx` either.** Importing the component to
  test one pure function drags in `next/navigation`, `next-auth/react`, every
  Radix primitive and — through `lib/actions.ts` — `next/cache`, which in jsdom
  dies on `ReferenceError: Request is not defined`. A separate module imports
  nothing, so the test needs no DOM and no mocks.

The module declares the fields it actually reads, so the form's wider
`ParsedData` satisfies it structurally with no cast:

```ts
export interface ReceiptPrefill {
  rcpt?: string;
  tipo?: string;
  comercio?: string;
  content_hash?: string;
  merchant_id?: string;
  confianza?: number;
}

export interface ReceiptSubmitContext {
  // Every field is optional because a manual entry contributes `{}`, and
  // `origen` is what turns that `{}` into a receipt row. A required `origen`
  // here would force a cast at the one call site that must not have one.
  provenance: {
    origen?: 'receipt';
    content_hash?: string;
    merchant_id?: string;
    confianza?: number;
  };
  learning?: { comercio: string; categoriaPrefill: string };
}

/**
 * What a submit has to carry, decided from the query params alone.
 *
 * `categoriaPrefill` is recorded for debugging only. `createEntry` learns
 * `formData.tipo` — the category the user actually saved — so a wrong guess
 * cannot become permanent after a single confirmation.
 */
export function buildReceiptSubmitContext(
  parsedData: ReceiptPrefill | undefined,
): ReceiptSubmitContext {
  if (parsedData?.rcpt !== '1') {
    return { provenance: {} };
  }

  return {
    provenance: {
      origen: 'receipt',
      content_hash: parsedData.content_hash,
      merchant_id: parsedData.merchant_id,
      confianza: parsedData.confianza,
    },
    learning: parsedData.comercio
      ? {
          comercio: parsedData.comercio,
          categoriaPrefill: parsedData.tipo ?? '',
        }
      : undefined,
  };
}
```

- [ ] **Step 5: Write the failing submit-decision test**

`__tests__/components/receipt-submit-context.test.ts`:

```ts
import { buildReceiptSubmitContext } from '@/components/ai/receiptSubmitContext';

const RECEIPT = {
  rcpt: '1',
  fecha: '2026-09-20',
  tipo: 'Supermercado',
  accion: 'Gasto',
  que: 'Mercadona',
  plataforma_pago: 'Visa',
  cantidad: 43.2,
  content_hash: 'a'.repeat(64),
  merchant_id: 'm-1',
  confianza: 0.92,
  comercio: 'Mercadona',
  needs_review: false,
};

describe('buildReceiptSubmitContext', () => {
  it('sends nothing extra for a manual entry', () => {
    expect(buildReceiptSubmitContext(undefined)).toEqual({ provenance: {} });
    expect(buildReceiptSubmitContext({ tipo: 'Supermercado' })).toEqual({
      provenance: {},
    });
  });

  // `rcpt` is the only marker; anything else is a hand-edited URL and must not
  // be able to fake a receipt confirmation.
  it('ignores an rcpt value that is not exactly "1"', () => {
    expect(buildReceiptSubmitContext({ ...RECEIPT, rcpt: '0' })).toEqual({
      provenance: {},
    });
  });

  it('carries the provenance so the row can be traced to the image', () => {
    expect(buildReceiptSubmitContext(RECEIPT).provenance).toEqual({
      origen: 'receipt',
      content_hash: 'a'.repeat(64),
      merchant_id: 'm-1',
      confianza: 0.92,
    });
  });

  // Without this the feature still *looks* fine — the entry saves, the category
  // shows up — and only the merchant memory quietly stops improving.
  it('carries the learning context `createEntry` needs', () => {
    expect(buildReceiptSubmitContext(RECEIPT).learning).toEqual({
      comercio: 'Mercadona',
      categoriaPrefill: 'Supermercado',
    });
  });

  it('has no learning context without a readable merchant', () => {
    const result = buildReceiptSubmitContext({ ...RECEIPT, comercio: '' });
    expect(result.learning).toBeUndefined();
    expect(result.provenance.origen).toBe('receipt');
  });
});
```

- [ ] **Step 6: Run it to verify it fails, then passes**

Run: `pnpm test __tests__/components/receipt-submit-context.test.ts`
Expected: FAIL — `buildReceiptSubmitContext` is not exported yet; PASS after the helper is added.

- [ ] **Step 7: Warn on a low-confidence read**

Add this inside the existing AI banner in `components/finance-form.tsx`, directly after the `<p>` that shows `parsedData.ai_text`, so a receipt with a fuzzy amount is visibly different from a clean read:

```tsx
{
  parsedData.needs_review && (
    <p className="text-sm text-amber-700 dark:text-amber-300">
      La IA no estaba segura del importe. Revísalo antes de guardar.
    </p>
  );
}
```

- [ ] **Step 8: Run the checks**

Run: `pnpm test __tests__/app/new-page-receipt-params.test.tsx __tests__/components/receipt-submit-context.test.ts && pnpm typecheck`
Expected: PASS — 4 page cases and 5 submit-decision cases — and `pnpm typecheck` clean.

If `provenance` widens the `fecha` type and `createEntry` complains, annotate the call as `satisfies EntryInput` rather than casting.

- [ ] **Step 9: Commit**

```bash
git add app/new/page.tsx components/finance-form.tsx components/ai/receiptSubmitContext.ts __tests__/app/new-page-receipt-params.test.tsx __tests__/components/receipt-submit-context.test.ts
git commit -m "feat(receipts): carry receipt provenance into the confirmation form"
```

---

## Task 13: Client downscaling and the upload widget

**Files:**

- Create: `components/ai/imageDownscale.ts`
- Create: `components/ai/ReceiptUpload.tsx`
- Test: `__tests__/components/image-downscale.test.tsx`
- Test: `__tests__/components/receipt-upload.test.tsx`

**Interfaces:**

- Consumes: nothing (client only; imports no `lib/` module).
- Produces:
  ```ts
  // components/ai/imageDownscale.ts
  export const MAX_DIMENSION = 1600;
  export const TARGET_BYTES = 1_500_000;
  export function scaleDimensions(
    width: number,
    height: number,
    maxDimension?: number,
  ): { width: number; height: number };
  export async function downscaleImageFile(
    file: File,
    maxDimension?: number,
  ): Promise<File>;

  // components/ai/ReceiptUpload.tsx
  export function ReceiptUpload(): JSX.Element;
  ```

**Why the browser does the resizing.** No `sharp`, no `sharp`-in-a-worker, no upload-then-resize roundtrip. A 12 MP phone photo is several megabytes and most of that is invisible detail; 1600 px on the long edge is what the vision model actually needs. The client already has the bytes and a canvas, so resizing there costs nothing and the server keeps its 4 MiB ceiling as a real guard rather than as the primary defence.

**Why "return the original file" is load-bearing.** `HEIC` from an iPhone cannot be decoded by every browser, and a `createImageBitmap` failure must not block the upload — the server accepts HEIC bytes and the model may well read them. So any failure on the resize path returns the input unchanged. There is no canvas in jsdom, so the unit tests cover the math and both fallback paths, and the happy canvas path is covered by the manual verification in Task 15. This is why the fallbacks are branches with tests rather than a `catch` nobody reads.

- [ ] **Step 1: Write the failing downscale test**

`__tests__/components/image-downscale.test.tsx`:

```tsx
import {
  MAX_DIMENSION,
  TARGET_BYTES,
  downscaleImageFile,
  scaleDimensions,
} from '@/components/ai/imageDownscale';

function fileOf(size: number, type = 'image/jpeg'): File {
  return new File([new Uint8Array(size)], 'receipt.jpg', { type });
}

describe('scaleDimensions', () => {
  it('leaves an image that already fits', () => {
    expect(scaleDimensions(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it('scales the long edge down and keeps the aspect ratio', () => {
    expect(scaleDimensions(4000, 3000)).toEqual({ width: 1600, height: 1200 });
  });

  it('scales a portrait image by the same rule', () => {
    expect(scaleDimensions(3000, 4000)).toEqual({ width: 1200, height: 1600 });
  });

  it('never upscales', () => {
    expect(scaleDimensions(100, 50, 4000)).toEqual({ width: 100, height: 50 });
  });

  it('never rounds a dimension down to zero', () => {
    const result = scaleDimensions(20000, 3);
    expect(result.width).toBe(MAX_DIMENSION);
    expect(result.height).toBeGreaterThanOrEqual(1);
  });

  it('honours a custom maximum', () => {
    expect(scaleDimensions(1000, 500, 500)).toEqual({
      width: 500,
      height: 250,
    });
  });
});

describe('downscaleImageFile', () => {
  it('returns a small file untouched, without touching the DOM', async () => {
    const small = fileOf(200_000);
    await expect(downscaleImageFile(small)).resolves.toBe(small);
  });

  // jsdom has no canvas, so this is exactly the "cannot decode" path.
  it('returns the original when the runtime cannot decode images', async () => {
    const big = fileOf(TARGET_BYTES + 1);
    await expect(downscaleImageFile(big)).resolves.toBe(big);
  });

  it('returns the original when decoding throws', async () => {
    const original = globalThis.createImageBitmap;
    // `createImageBitmap` is already declared by lib.dom, so this assignment
    // needs no cast — and an unnecessary `@ts-expect-error` fails `tsc` with
    // TS2578, which is why the directive must not be here.
    globalThis.createImageBitmap = jest
      .fn()
      .mockRejectedValue(new Error('unsupported format'));
    try {
      const big = fileOf(TARGET_BYTES + 1);
      await expect(downscaleImageFile(big)).resolves.toBe(big);
    } finally {
      globalThis.createImageBitmap = original;
    }
  });
});
```

- [ ] **Step 2: Write the failing widget test**

`__tests__/components/receipt-upload.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

import { ReceiptUpload } from '@/components/ai/ReceiptUpload';
import { downscaleImageFile } from '@/components/ai/imageDownscale';

jest.mock('next/navigation', () => ({ useRouter: jest.fn() }));
jest.mock('next-auth/react', () => ({ useSession: jest.fn() }));
jest.mock('@/components/ai/imageDownscale', () => ({
  ...jest.requireActual('@/components/ai/imageDownscale'),
  downscaleImageFile: jest.fn(),
}));

const push = jest.fn();
const downscaleMock = downscaleImageFile as jest.MockedFunction<
  typeof downscaleImageFile
>;

const RECEIPT = new File([new Uint8Array([0xff, 0xd8, 0xff])], 'r.jpg', {
  type: 'image/jpeg',
});

function mockFetch(payload: unknown, status = 200) {
  const fetchMock = jest.fn().mockResolvedValue({
    ok: status < 400,
    status,
    json: async () => payload,
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

function pick() {
  fireEvent.change(screen.getByLabelText(/recibo/i), {
    target: { files: [RECEIPT] },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  (useRouter as jest.Mock).mockReturnValue({ push });
  (useSession as jest.Mock).mockReturnValue({
    status: 'authenticated',
    data: { user: { id: 'user-1' } },
  });
  downscaleMock.mockResolvedValue(RECEIPT);
});

describe('ReceiptUpload', () => {
  it('stays hidden for an anonymous visitor', () => {
    (useSession as jest.Mock).mockReturnValue({ status: 'loading' });
    render(<ReceiptUpload />);
    expect(screen.queryByLabelText(/recibo/i)).not.toBeInTheDocument();
  });

  it('sends the downscaled file and redirects to the prefilled form', async () => {
    const fetchMock = mockFetch({
      success: true,
      duplicate: false,
      parsedData: {
        fecha: '2026-09-20',
        tipo: 'Supermercado',
        accion: 'Gasto',
        que: 'Mercadona',
        plataforma_pago: 'Visa',
        cantidad: 43.2,
      },
      receipt: { contentHash: 'abc', confianza: 0.9, comercio: 'Mercadona' },
      providerUsed: 'opencode',
      modelUsed: 'mimo-v2.5-free',
    });

    render(<ReceiptUpload />);
    pick();
    fireEvent.click(screen.getByRole('button', { name: /analizar/i }));

    await waitFor(() => expect(push).toHaveBeenCalled());

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('/api/ai/parse-receipt');
    expect((init as RequestInit).method).toBe('POST');
    const body = (init as RequestInit).body as FormData;
    expect(body.get('image')).toBe(RECEIPT);
    expect(downscaleMock).toHaveBeenCalledWith(RECEIPT);

    const target = String(push.mock.calls[0]?.[0] ?? '');
    expect(target.startsWith('/new?')).toBe(true);
    expect(target).toContain('rcpt=1');
    expect(target).toContain('tipo=Supermercado');
    expect(target).toContain('content_hash=abc');
    expect(target).toContain('comercio=Mercadona');
  });

  it('marks a low-confidence read for review', async () => {
    mockFetch({
      success: true,
      duplicate: false,
      parsedData: { fecha: '2026-09-20', cantidad: 12 },
      receipt: { contentHash: 'abc', confianza: 0.4, needsReview: true },
    });
    render(<ReceiptUpload />);
    pick();
    fireEvent.click(screen.getByRole('button', { name: /analizar/i }));
    await waitFor(() => expect(push).toHaveBeenCalled());
    expect(String(push.mock.calls[0]?.[0] ?? '')).toContain('needs_review=1');
  });

  it('tells the user the receipt is already saved instead of redirecting', async () => {
    mockFetch({
      success: true,
      duplicate: true,
      duplicateKind: 'exact',
      entry: { id: 'e-1', que: 'Mercadona', cantidad: 43.2 },
    });
    render(<ReceiptUpload />);
    pick();
    fireEvent.click(screen.getByRole('button', { name: /analizar/i }));

    expect(
      await screen.findByText(/ya tienes esta entrada/i),
    ).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it('shows the field-level message when the amount cannot be read', async () => {
    mockFetch(
      {
        success: false,
        field: 'cantidad',
        message: 'Haz una foto más cerca del total.',
      },
      422,
    );
    render(<ReceiptUpload />);
    pick();
    fireEvent.click(screen.getByRole('button', { name: /analizar/i }));
    expect(
      await screen.findByText('Haz una foto más cerca del total.'),
    ).toBeInTheDocument();
  });

  it('explains a 503 without pretending the receipt was saved', async () => {
    mockFetch(
      { success: false, message: 'Prueba con una foto más nítida.' },
      503,
    );
    render(<ReceiptUpload />);
    pick();
    fireEvent.click(screen.getByRole('button', { name: /analizar/i }));
    expect(
      await screen.findByText('Prueba con una foto más nítida.'),
    ).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it('does nothing without a file', () => {
    mockFetch({});
    render(<ReceiptUpload />);
    fireEvent.click(screen.getByRole('button', { name: /analizar/i }));
    expect(global.fetch).not.toHaveBeenCalled();
  });

  // The magic-byte guard answers with `error` and no `message`, because the
  // model was never reached. If the component only reads `message`, the user
  // gets the generic string and no idea what to fix.
  it('surfaces the guard error, which arrives without a message', async () => {
    mockFetch(
      {
        success: false,
        error:
          'El archivo no es una imagen válida. Se aceptan JPEG, PNG, WebP, HEIC y HEIF.',
      },
      415,
    );
    render(<ReceiptUpload />);
    pick();
    fireEvent.click(screen.getByRole('button', { name: /analizar/i }));
    expect(
      await screen.findByText(/no es una imagen válida/i),
    ).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run both tests to verify they fail**

Run: `pnpm test __tests__/components/image-downscale.test.tsx __tests__/components/receipt-upload.test.tsx`
Expected: FAIL — both modules are missing.

- [ ] **Step 4: Write `imageDownscale.ts`**

`components/ai/imageDownscale.ts`:

```ts
'use client';

/**
 * Client-side image downscaling for receipt uploads.
 *
 * The server accepts up to 4 MiB; this module aims well below that so a
 * modern phone photo never hits the ceiling. No dependency is added: the
 * browser already has `createImageBitmap`, a canvas and `toBlob`.
 *
 * Every failure path returns the input file unchanged. An undecodable image
 * (notably HEIC in some browsers) must still reach the server, which
 * validates magic bytes and hands the bytes to the model as-is.
 */

/** Long edge, in pixels, after scaling. */
export const MAX_DIMENSION = 1600;

/** Files at or below this are uploaded untouched. */
export const TARGET_BYTES = 1_500_000;

/** Re-encode below this so the canvas output is small. */
const REENCODE_QUALITY = 0.82;

export function scaleDimensions(
  width: number,
  height: number,
  maxDimension: number = MAX_DIMENSION,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxDimension) return { width, height };

  const ratio = maxDimension / longest;
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
}

export async function downscaleImageFile(
  file: File,
  maxDimension: number = MAX_DIMENSION,
): Promise<File> {
  if (file.size <= TARGET_BYTES) return file;
  if (typeof createImageBitmap !== 'function') return file;

  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file);
    const { width, height } = scaleDimensions(
      bitmap.width,
      bitmap.height,
      maxDimension,
    );
    if (width === bitmap.width && height === bitmap.height) return file;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    if (!context) return file;

    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', REENCODE_QUALITY);
    });
    if (!blob || blob.size >= file.size) return file;

    return new File([blob], file.name, { type: 'image/jpeg' });
  } catch {
    return file;
  } finally {
    bitmap?.close();
  }
}
```

`bitmap.close()` is called on both the success path and in `finally`. `close()` twice is a no-op per spec, but keeping the `finally` is what guarantees the decoded bitmap is released when `drawImage` throws.

- [ ] **Step 5: Write `ReceiptUpload.tsx`**

`components/ai/ReceiptUpload.tsx`:

```tsx
'use client';

import { Camera, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useState } from 'react';

import { downscaleImageFile } from '@/components/ai/imageDownscale';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

type UploadStatus = 'idle' | 'working' | 'error' | 'duplicate';

interface ReceiptPayload {
  success: boolean;
  duplicate?: boolean;
  duplicateKind?: 'exact' | 'similar';
  entry?: { id: string; que: string; cantidad: number };
  parsedData?: Record<string, unknown>;
  receipt?: {
    contentHash: string;
    confianza: number;
    needsReview?: boolean;
    comercio: string;
    categorySource?: string;
    merchantId?: string | null;
  };
  providerUsed?: string;
  modelUsed?: string;
  /** Set by the parse failures. */
  message?: string;
  /** Always set, including by the guard failures that have no `message`. */
  error?: string;
}

export function ReceiptUpload() {
  const router = useRouter();
  const { status } = useSession();
  const [file, setFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle');
  const [message, setMessage] = useState('');

  if (status !== 'authenticated') return null;

  async function handleAnalyze() {
    if (!file) return;

    setUploadStatus('working');
    setMessage('');

    try {
      const downscaled = await downscaleImageFile(file);
      const formData = new FormData();
      formData.set('image', downscaled);

      const response = await fetch('/api/ai/parse-receipt', {
        method: 'POST',
        body: formData,
      });
      const data = (await response.json()) as ReceiptPayload;

      if (data.duplicate && data.entry) {
        setUploadStatus('duplicate');
        setMessage(
          `Ya tienes esta entrada: ${data.entry.que}, ${data.entry.cantidad}.`,
        );
        return;
      }

      if (!response.ok || !data.success || !data.parsedData) {
        setUploadStatus('error');
        // The guard failures (415 wrong type, 413 too large, 400 no field,
        // 429 rate limited) answer with `error` only, because they are not
        // parse failures. Falling back only to a generic string would swallow
        // the one message that tells the user what to change.
        setMessage(
          data.message ??
            data.error ??
            'No hemos podido leer el recibo. Inténtalo de nuevo.',
        );
        return;
      }

      const query = new URLSearchParams();
      for (const [key, value] of Object.entries(data.parsedData)) {
        if (value !== undefined && value !== null && value !== '') {
          query.set(key, String(value));
        }
      }
      query.set('rcpt', '1');
      if (data.receipt) {
        query.set('content_hash', data.receipt.contentHash);
        query.set('confianza', String(data.receipt.confianza));
        query.set('comercio', data.receipt.comercio);
        if (data.receipt.needsReview) query.set('needs_review', '1');
      }

      router.push(`/new?${query.toString()}`);
    } catch {
      setUploadStatus('error');
      setMessage('No se ha podido subir la imagen. Inténtalo de nuevo.');
    }
  }

  return (
    <Card>
      <CardContent className="pt-6 flex flex-wrap items-center gap-3">
        <div>
          <label
            htmlFor="receipt-image"
            className="text-sm font-medium block mb-1"
          >
            Sube una foto de un recibo
          </label>
          <input
            id="receipt-image"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setUploadStatus('idle');
              setMessage('');
            }}
            className="text-sm"
          />
        </div>

        <Button
          onClick={handleAnalyze}
          disabled={!file || uploadStatus === 'working'}
          className="mt-5"
        >
          {uploadStatus === 'working' ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Camera className="mr-2 h-4 w-4" />
          )}
          Analizar recibo
        </Button>

        {message && (
          <p
            role="status"
            className={
              uploadStatus === 'error'
                ? 'w-full text-sm text-destructive'
                : 'w-full text-sm text-muted-foreground'
            }
          >
            {message}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm test __tests__/components/image-downscale.test.tsx __tests__/components/receipt-upload.test.tsx`
Expected: PASS — 17 tests, 0 failures.

- [ ] **Step 7: Commit**

```bash
git add components/ai/imageDownscale.ts components/ai/ReceiptUpload.tsx __tests__/components/image-downscale.test.tsx __tests__/components/receipt-upload.test.tsx
git commit -m "feat(receipts): add client downscaling and the receipt upload widget"
```

---

## Task 14: Merchant memory management

**Files:**

- Create: `app/api/merchants/route.ts`
- Create: `components/merchants/MerchantMemoryCard.tsx`
- Modify: `app/records/page.tsx:64-70`
- Test: `__tests__/api/merchants.test.ts`
- Test: `__tests__/components/merchant-memory-card.test.tsx`

**Interfaces:**

- Consumes: `listMerchants`, `deleteMerchantById` from `@/lib/merchants/repo` (Task 2); `authOptions`.
- Produces:
  ```ts
  // app/api/merchants/route.ts
  export async function GET(): Promise<NextResponse>; // { merchants: [...] }
  export async function DELETE(request: NextRequest): Promise<NextResponse>; // ?id=<uuid>

  // components/merchants/MerchantMemoryCard.tsx
  export function MerchantMemoryCard(): JSX.Element;
  ```

**Why this surface is read-write and nothing more.** A wrong learned category is the one thing in this feature the user cannot fix from the receipt form alone — they can correct the _next_ entry, but the row that is already trusted keeps winning. `DELETE` is the escape hatch, and it is deliberately the only mutation: the app decides what a confirmation means, the user decides whether the app remembers at all.

- [ ] **Step 1: Write the failing route test**

`__tests__/api/merchants.test.ts`:

```ts
/** @jest-environment node */

import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';

import { DELETE, GET } from '@/app/api/merchants/route';
import { deleteMerchantById, listMerchants } from '@/lib/merchants/repo';

// Automock, not a hand-written factory: `next-auth`'s barrel also exports
// `default`, and a partial factory would leave the real auth route — which
// imports that default — without one. There is no `^@/app/*` entry in
// `jest.config.mjs`, so `@/app/api/auth/[...nextauth]/route` cannot be mocked
// by path at all; the real `authOptions` object is harmless here.
jest.mock('next-auth');
jest.mock('@/lib/merchants/repo', () => ({
  listMerchants: jest.fn(),
  deleteMerchantById: jest.fn(),
}));

const sessionMock = getServerSession as jest.MockedFunction<
  typeof getServerSession
>;
const listMock = listMerchants as jest.MockedFunction<typeof listMerchants>;
const deleteMock = deleteMerchantById as jest.MockedFunction<
  typeof deleteMerchantById
>;

const MERCHANT = {
  id: 'm-1',
  canonical_name: 'Mercadona',
  normalized_name: 'mercadona',
  tipo: 'Supermercado',
  plataforma_pago: 'Visa',
  veces_visto: 5,
  veces_confirmado: 3,
  veces_corregido: 1,
};

beforeEach(() => {
  jest.clearAllMocks();
  sessionMock.mockResolvedValue({ user: { id: 'user-1' } } as never);
  listMock.mockResolvedValue([MERCHANT]);
  deleteMock.mockResolvedValue(undefined);
});

describe('GET /api/merchants', () => {
  it('returns 401 without a session', async () => {
    sessionMock.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
    expect(listMock).not.toHaveBeenCalled();
  });

  it('lists only the current user own merchants', async () => {
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(listMock).toHaveBeenCalledWith('user-1');
    expect(body.merchants).toEqual([MERCHANT]);
  });

  it('returns an empty list without error', async () => {
    listMock.mockResolvedValue([]);
    const body = await (await GET()).json();
    expect(body.merchants).toEqual([]);
  });
});

describe('DELETE /api/merchants', () => {
  function request(query: string) {
    return new NextRequest(`http://localhost/api/merchants${query}`, {
      method: 'DELETE',
    });
  }

  it('returns 401 without a session', async () => {
    sessionMock.mockResolvedValue(null);
    const res = await DELETE(request('?id=m-1'));
    expect(res.status).toBe(401);
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it('requires an id', async () => {
    expect((await DELETE(request(''))).status).toBe(400);
  });

  it('scopes the delete to the user', async () => {
    const res = await DELETE(request('?id=m-1'));
    expect(res.status).toBe(200);
    expect(deleteMock).toHaveBeenCalledWith('m-1', 'user-1');
  });
});
```

- [ ] **Step 2: Write the failing card test**

`__tests__/components/merchant-memory-card.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { MerchantMemoryCard } from '@/components/merchants/MerchantMemoryCard';

function mockFetch(sequence: unknown[]) {
  const calls: RequestInit[] = [];
  let index = 0;
  // `async`, not `() => Promise.resolve(...)`:
  // `@typescript-eslint/promise-function-async` rejects the explicit form.
  const fetchMock = jest
    .fn()
    .mockImplementation(async (_url: string, init: RequestInit) => {
      calls.push(init);
      const payload = sequence[Math.min(index, sequence.length - 1)];
      index += 1;
      return {
        ok: true,
        status: 200,
        json: async () => payload,
      };
    });
  global.fetch = fetchMock as unknown as typeof fetch;
  return { fetchMock, calls };
}

const MERCHANT = {
  id: 'm-1',
  canonical_name: 'Mercadona',
  normalized_name: 'mercadona',
  tipo: 'Supermercado',
  plataforma_pago: 'Visa',
  veces_visto: 5,
  veces_confirmado: 3,
  veces_corregido: 1,
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('MerchantMemoryCard', () => {
  it('lists what the app has remembered', async () => {
    mockFetch([{ merchants: [MERCHANT] }]);
    render(<MerchantMemoryCard />);
    expect(await screen.findByText('Mercadona')).toBeInTheDocument();
    expect(screen.getByText('Supermercado')).toBeInTheDocument();
  });

  it('says when there is nothing remembered yet', async () => {
    mockFetch([{ merchants: [] }]);
    render(<MerchantMemoryCard />);
    expect(
      await screen.findByText(/todavía no hemos aprendido/i),
    ).toBeInTheDocument();
  });

  // "1 compras" is the kind of thing that ships unnoticed: nothing breaks,
  // and the counters only reach 1 on a brand-new merchant.
  it('agrees with the count in Spanish', async () => {
    mockFetch([
      {
        merchants: [
          {
            ...MERCHANT,
            veces_visto: 1,
            veces_confirmado: 1,
            veces_corregido: 0,
          },
        ],
      },
    ]);
    render(<MerchantMemoryCard />);
    expect(
      await screen.findByText('1 compra · 1 confirmada'),
    ).toBeInTheDocument();
  });

  it('forgets a merchant and reloads the list', async () => {
    const { fetchMock, calls } = mockFetch([
      { merchants: [MERCHANT] },
      { success: true },
      { merchants: [] },
    ]);
    render(<MerchantMemoryCard />);
    await screen.findByText('Mercadona');

    fireEvent.click(screen.getByRole('button', { name: /olvidar/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(calls[1]?.method).toBe('DELETE');
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/merchants?id=m-1');
    expect(
      await screen.findByText(/todavía no hemos aprendido/i),
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run both tests to verify they fail**

Run: `pnpm test __tests__/api/merchants.test.ts __tests__/components/merchant-memory-card.test.tsx`
Expected: FAIL — both modules are missing.

- [ ] **Step 4: Write the route**

`app/api/merchants/route.ts`:

```ts
import { type NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { logger } from '@/lib/logger';
import { deleteMerchantById, listMerchants } from '@/lib/merchants/repo';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user.id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const merchants = await listMerchants(session.user.id);
  return NextResponse.json({ merchants });
}

export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user.id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const id = request.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json(
      { error: "Se requiere el parámetro 'id'." },
      { status: 400 },
    );
  }

  await deleteMerchantById(id, session.user.id);
  logger.info(`[Merchants] Forgot merchant ${id}`);

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 5: Write the card**

`components/merchants/MerchantMemoryCard.tsx`:

```tsx
'use client';

import { Brain, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

/** Spanish needs the noun to agree with the count: "1 compra", "2 compras". */
function plural(count: number, singular: string, many: string): string {
  return `${count} ${count === 1 ? singular : many}`;
}

interface MerchantSummary {
  id: string;
  canonical_name: string;
  tipo: string | null;
  veces_visto: number;
  veces_confirmado: number;
  veces_corregido: number;
}

/**
 * What the app has learned about the user's merchants, and the only control
 * over it: "Olvidar" deletes the row, and the next receipt at that shop
 * starts learning from scratch.
 */
export function MerchantMemoryCard() {
  const [merchants, setMerchants] = useState<MerchantSummary[] | null>(null);

  const load = useCallback(async () => {
    const response = await fetch('/api/merchants');
    if (!response.ok) return;
    const data = (await response.json()) as { merchants: MerchantSummary[] };
    setMerchants(data.merchants);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one initial read from an API route; there is no external system to subscribe to
    void load();
  }, [load]);

  async function forget(id: string) {
    await fetch(`/api/merchants?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    await load();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Brain className="h-4 w-4" />
          Comercios aprendidos
        </CardTitle>
        <CardDescription>
          Confirmamos o corregimos la categoría de cada compra a partir de lo
          que ya sabes de ese comercio.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {merchants === null ? null : merchants.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Todavía no hemos aprendido nada. Sube un recibo para empezar.
          </p>
        ) : (
          <ul className="space-y-2">
            {merchants.map((merchant) => (
              <li
                key={merchant.id}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{merchant.canonical_name}</span>
                  <Badge variant="secondary">
                    {merchant.tipo ?? 'Sin categoría'}
                  </Badge>
                  <span className="text-muted-foreground">
                    {plural(merchant.veces_visto, 'compra', 'compras')}
                    {merchant.veces_confirmado > 0 &&
                      ` · ${plural(
                        merchant.veces_confirmado,
                        'confirmada',
                        'confirmadas',
                      )}`}
                    {merchant.veces_corregido > 0 &&
                      ` · ${plural(
                        merchant.veces_corregido,
                        'corregida',
                        'corregidas',
                      )}`}
                  </span>
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Olvidar ${merchant.canonical_name}`}
                  onClick={async () => await forget(merchant.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 6: Mount both on the records page**

In `app/records/page.tsx`, replace the current import block (1-12) with:

```ts
import { PlusCircle, FileDown } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';

import { QuickEntryBar } from '@/components/ai/QuickEntryBar';
import { ReceiptUpload } from '@/components/ai/ReceiptUpload';
import FinanceTable from '@/components/finance-table';
import { MerchantMemoryCard } from '@/components/merchants/MerchantMemoryCard';
import { SearchFilter } from '@/components/search-filter';
import { TableSkeleton } from '@/components/table-skeleton';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { DEFAULT_ACCION_FILTER, ITEMS_PER_PAGE } from '@/config';
```

`@/components/ai/QuickEntryBar` sorts before `@/components/ai/ReceiptUpload` (`Q` before `R`), and `@/components/merchants/...` slots between `finance-table` and `search-filter`.

Then insert, between the `QuickEntryBar` block (64-66) and the search block:

```tsx
      <Suspense fallback={<Skeleton className="h-24 w-full rounded-lg" />}>
        <ReceiptUpload />
      </Suspense>

      <Suspense fallback={<Skeleton className="h-32 w-full rounded-lg" />}>
        <MerchantMemoryCard />
      </Suspense>
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `pnpm test __tests__/api/merchants.test.ts __tests__/components/merchant-memory-card.test.tsx __tests__/app/new-page-receipt-params.test.tsx`
Expected: PASS — 14 tests, 0 failures: 6 route, 4 card, and the 4 `/new`
cases as a regression check that the records-page work did not disturb the
receipt prefill. Note that `/records` itself has no unit test — mounting
`MerchantMemoryCard` there is covered end to end by the Task 15 spec.

- [ ] **Step 8: Commit**

```bash
git add app/api/merchants/route.ts components/merchants/MerchantMemoryCard.tsx app/records/page.tsx __tests__/api/merchants.test.ts __tests__/components/merchant-memory-card.test.tsx
git commit -m "feat(receipts): let users review and forget learned merchants"
```

---

## Task 15: End-to-end coverage, docs, and the full gate

**Files:**

- Create: `e2e/receipt-upload.spec.ts`
- Modify: `README.md` (Features, Database Schema, and a new Receipt capture section)
- Test: `__tests__/lib/entries-normalize.test.ts` (unchanged; re-run only)

**Interfaces:**

- Consumes: everything from Tasks 0–14.
- Produces: nothing new. This task is the proof that the previous fourteen fit together.

**Why the e2e stubs the model.** A test that calls a free vision model is slow, flaky, and dependent on someone else's uptime. What actually needs proving end to end is the part this feature owns: the prefill reaches the form, a **user correction** outranks the prefill, the correction is stored, and the next receipt at that shop is prefilled from memory. All of that is ours. The model's contribution is one field in a JSON response, and that is covered by the route unit test. So the spec intercepts `/api/ai/parse-receipt` and returns a canned parse.

- [ ] **Step 1: Write the e2e spec**

`e2e/receipt-upload.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

import { signInAsTestUser } from './utils/auth';

/** Smallest byte sequence the server accepts as a JPEG (SOI + marker). */
const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

const CANNED_PARSE = {
  success: true,
  duplicate: false,
  parsedData: {
    fecha: '2026-09-20',
    hora: 12,
    minuto: 30,
    tipo: 'Supermercado',
    accion: 'Gasto',
    que: 'Mercadona E2E',
    plataforma_pago: 'Visa',
    cantidad: 43.2,
    detalle1: 'Leche y pan',
    detalle2: '',
  },
  receipt: {
    contentHash: 'a'.repeat(64),
    confianza: 0.9,
    needsReview: false,
    comercio: 'Mercadona E2E',
    categorySource: 'model',
  },
  providerUsed: 'opencode',
  modelUsed: 'mimo-v2.5-free',
};

test.describe('Receipt upload', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsTestUser(page);
  });

  test('prefills the form, and a correction is what gets remembered', async ({
    page,
  }) => {
    await page.route('**/api/ai/parse-receipt', async (route) => {
      await route.fulfill({ status: 200, json: CANNED_PARSE });
    });

    await page.goto('/records');
    await page.getByLabel('Sube una foto de un recibo').setInputFiles({
      name: 'recibo.jpg',
      mimeType: 'image/jpeg',
      buffer: JPEG_BYTES,
    });
    await page.getByRole('button', { name: 'Analizar recibo' }).click();

    await expect(page).toHaveURL(/\/new\?/);
    await expect(page).toHaveURL(/rcpt=1/);
    await expect(
      page.getByRole('heading', { name: 'Revisar Entrada (IA)' }),
    ).toBeVisible();

    // The form options load asynchronously; wait before touching a combobox.
    await page.waitForResponse('/api/options');

    // The user disagrees with the prefill.
    await page.getByText('Selecciona un tipo').click();
    await page.getByRole('option', { name: 'Limpieza' }).click();

    await page.getByText('Seleccionar qué...').click();
    await page.getByPlaceholder('Buscar...').last().fill('Mercadona E2E');
    await page.keyboard.press('Enter');

    await page.getByRole('button', { name: 'Guardar' }).click();
    await page.waitForURL(/\/records/, { timeout: 30000 });

    // The remembered category is the saved one, not the prefill. The merchant
    // did not exist before this save, so `applyMerchantConfirmation` inserts
    // it with veces_confirmado = 1 and veces_corregido = 0 — the category the
    // user typed is what the memory holds.
    const row = page.getByRole('listitem').filter({ hasText: 'Mercadona E2E' });
    await expect(row).toContainText('Limpieza');
    await expect(row).not.toContainText('Supermercado');
    // `1 confirmada` and `3 confirmadas` both have to satisfy this.
    await expect(row).toContainText(/confirmada/);
  });

  test('rejects a non-image before the model is reached', async ({ page }) => {
    // Deliberately not stubbed: the point is the server's own magic-byte guard.
    await page.goto('/records');
    await page.getByLabel('Sube una foto de un recibo').setInputFiles({
      name: 'recibo.png',
      mimeType: 'image/png',
      buffer: Buffer.from('<!doctype html><script>alert(1)</script>'),
    });
    await page.getByRole('button', { name: 'Analizar recibo' }).click();

    // 415 from validateImageUpload, with a message that tells the user what
    // the accepted formats are.
    await expect(
      page.getByRole('status').filter({ hasText: 'no es una imagen válida' }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/records/);
  });

  test('says so when the receipt is already saved', async ({ page }) => {
    await page.route('**/api/ai/parse-receipt', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          success: true,
          duplicate: true,
          duplicateKind: 'exact',
          entry: { id: 'e-1', que: 'Mercadona E2E', cantidad: 43.2 },
        },
      });
    });

    await page.goto('/records');
    await page.getByLabel('Sube una foto de un recibo').setInputFiles({
      name: 'recibo.jpg',
      mimeType: 'image/jpeg',
      buffer: JPEG_BYTES,
    });
    await page.getByRole('button', { name: 'Analizar recibo' }).click();

    await expect(
      page.getByRole('status').filter({ hasText: 'Ya tienes esta entrada' }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/records/);
  });
});
```

- [ ] **Step 2: Run the e2e spec**

Run, with the app and a dev database up:

```bash
pnpm test:e2e e2e/receipt-upload.spec.ts
```

Expected: 3 passed. If the combobox interaction differs from `create-edit.spec.ts`, copy that file's exact selector sequence — it is the known-good path through these components.

- [ ] **Step 3: Document the feature**

In `README.md`:

1. Add a bullet to **Features**:
   ```md
   - **Receipt Capture**: Upload a receipt photo or screenshot; a vision model reads it, prefills the form, and remembers the category for that shop.
   ```
2. Add the four provenance columns to the **`finance_entries`** list, after `quien`/before `created_at`:
   ```md
   - `merchant_id` - Learned merchant this entry came from (nullable)
   - `content_hash` - SHA-256 of the uploaded image, for duplicate detection (nullable)
   - `origen` - How the entry was created: `manual`, `ai_text` or `receipt`
   - `confianza` - Model confidence in a parsed amount, 0–1 (nullable)
   ```
3. Add a **`merchants`** subsection after `api_keys`:
   ```md
   ### `merchants`

   - `id` - Unique identifier (UUID)
   - `user_id` - Owner of the memory
   - `canonical_name` - Merchant name as first read
   - `normalized_name` - Folded key used to match the same shop (unique per user)
   - `tipo` - Category learned for this merchant
   - `plataforma_pago` - Payment method last seen here
   - `veces_visto`, `veces_confirmado`, `veces_corregido` - Counters that decide whether the memory is trusted
   - `created_at`, `updated_at` - Timestamps
   ```
4. Add a **Receipt capture** section after **Public API** explaining the order of operations, and stating the two things a reader needs to know:

   ```md
   ### Receipt capture

   `POST /api/ai/parse-receipt` takes `multipart/form-data` with a single
   `image` field (JPEG, PNG, WebP, HEIC or HEIF, up to 4 MiB) and **never
   writes the bytes anywhere**: the image is hashed, checked for a previous
   identical upload, read by a vision model, and discarded. The response
   prefills `/new`; nothing is saved until the user confirms the form.

   The order matters: the file is validated on its magic bytes before
   anything else, an identical re-upload is answered from the SHA-256 without
   spending a model call, and only then is the image read. Receipts use
   vision-capable free models only, so an unreadable amount or merchant
   returns a field-level error instead of a zero-value entry.

   Merchant memory is what makes the second receipt cheaper than the first:
   a category the user has confirmed or corrected for that merchant outranks
   whatever the model proposes, and it is never applied to other users.
   ```

- [ ] **Step 4: Run the full gate**

```bash
pnpm check
pnpm test
pnpm knip
pnpm audit
pnpm build
```

Expected: all clean. `pnpm check` covers typecheck, eslint, dependency-cruiser and Prettier.

Two gates are the likely to trip, and both are the point of running them here:

- **`knip`** flags any new export nothing imports. Every export in this plan is consumed by a route, a component or a test; if knip still complains, the culprit is a helper that only the test uses — either wire it into the real path or stop exporting it.
- **`depcruise`** fails if a client component reaches into `lib/`. `ReceiptUpload` imports only from `components/`.

- [ ] **Step 5: Verify the vision providers by hand**

The unit tests prove the race _excludes_ text-only models and _prefers_ the first vision model. They cannot prove that a provider accepts an image. Check it once, on a real request:

```bash
pnpm dev
```

Then, signed in as a test user, upload a real receipt photo on `/records` and read the response headers in the browser network tab:

- `X-Model-Used` is the model that actually read the image.
- `200` with `parsedData.cantidad > 0` means the provider works.
- `503` with `modelErrors` in the body means every configured vision model refused. The two realistic causes are (a) the model list is text-only in practice, and (b) the free tier is rate-limited.

If (a) or (b) happens, the fix is not in the code: reorder `FREE_MODELS` so a working vision model is first, or drop the `requiresVision` entries that do not work. The endpoint is already written to fall through, so the app degrades to a clear `503` rather than to a wrong entry.

Also confirm by hand what no test can: that a photo taken with `scaleDimensions` at 1600 px is still legible enough to read a total. If not, raise `MAX_DIMENSION` in `components/ai/imageDownscale.ts` — not the server's 4 MiB cap.

- [ ] **Step 6: Commit**

```bash
git add e2e/receipt-upload.spec.ts README.md
git commit -m "test(receipts): cover the receipt flow end to end and document it"
```

---

## Definition of done

- [ ] `pnpm check`, `pnpm test`, `pnpm knip`, `pnpm audit`, `pnpm build` and `pnpm test:e2e` all pass.
- [ ] Uploading a non-image returns `415` and no model is called.
- [ ] Uploading the same image twice creates one entry and calls the model once.
- [ ] A photo whose total cannot be read returns `422` with `field: 'cantidad'` and saves nothing.
- [ ] Correcting the category on a receipt form updates that merchant's memory, and the next receipt at the same shop arrives prefilled with the corrected category.
- [ ] Every query in `lib/merchants/repo.ts` and `lib/receipts/*` filters by `user_id`.
- [ ] The receipt bytes exist only in the request handler's memory.
