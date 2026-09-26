-- Migration: Create the canonical `categories` table
-- Created: 2026-09-26
--
-- Why: the "categoria" (tipo) dropdown had two independent sources, so neither
-- form could show every category:
--   * /recurring rendered a hardcoded array in types/categories.ts
--   * /records queried DISTINCT tipo from finance_entries only
-- Any category that lived only in recurring_records was unselectable on
-- /records, and anything outside the hardcoded array was unselectable on
-- /recurring. This table becomes the single source of truth for both.
--
-- Note on `accion`: intentionally omitted. Scoping categories by transaction
-- type would re-introduce the original bug (a category valid for one accion
-- would go missing from the other), so every active category is offered
-- everywhere and accion is validated at write time instead.
--
-- Note on the missing foreign key: user_id deliberately has no REFERENCES
-- clause, matching finance_entries and recurring_records. The credentials
-- sign-in path sets the session id from the allowlist entry while
-- `insertUser` mints a random `users.id`, so `session.user.id` does not
-- reliably exist in `users` and a foreign key would reject every category
-- write for those users.

CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_categories_user_active ON categories(user_id, active);

-- Backfill from every distinct tipo already stored on either table.
-- Both source tables are nullable on user_id, so rows without an owner are
-- skipped rather than creating an orphan category.
--
-- TRIM is required, not cosmetic. The Combobox create path passes the raw input
-- through to `tipo`, so untrimmed values like '  Comida  ' can exist in the
-- data. ensureCategory() trims before writing, but it matches existing names
-- case-insensitively rather than whitespace-insensitively, so without TRIM here
-- the backfill would seed '  Comida  ' and the next tidy 'Comida' the user types
-- would land beside it as a second dropdown entry. DISTINCT then collapses the
-- duplicates that trimming creates within this statement.
INSERT INTO categories (user_id, name)
SELECT DISTINCT user_id, TRIM(tipo)
  FROM finance_entries
 WHERE tipo IS NOT NULL AND TRIM(tipo) <> '' AND user_id IS NOT NULL
UNION
SELECT DISTINCT user_id, TRIM(tipo)
  FROM recurring_records
 WHERE tipo IS NOT NULL AND TRIM(tipo) <> '' AND user_id IS NOT NULL
ON CONFLICT (user_id, name) DO NOTHING;

-- Backfill the categories that were hardcoded in types/categories.ts. They were
-- the only source the /recurring form had, so they are in real use but may
-- never have been written to either table; without this they would silently
-- disappear from the dropdown.
--
-- Owner ids come from the union of `users` and every user_id already present on
-- the data tables. `users` alone is not sufficient: credentials sign-ins set the
-- session id from the allowlist while `insertUser` mints a random `users.id`,
-- so a credentials user owns records without appearing in `users`.
--
-- WHERE true is required: Postgres cannot otherwise tell whether a trailing
-- ON CONFLICT belongs to this SELECT or to an inner join.
INSERT INTO categories (user_id, name)
SELECT owners.user_id, c.name
  FROM (
    SELECT id AS user_id FROM users
    UNION
    SELECT user_id FROM finance_entries WHERE user_id IS NOT NULL
    UNION
    SELECT user_id FROM recurring_records WHERE user_id IS NOT NULL
  ) AS owners
 CROSS JOIN (
    VALUES
      ('QFI'), ('Comida'), ('Otros Gastos'), ('Viajes/ Transporte'),
      ('Tools'), ('Formación'), ('Cripto W'), ('Hobby'), ('Cripto D'),
      ('Empleo'), ('Alquiler'), ('Café'), ('Ads'), ('Otros Ingresos'),
      ('Piso JB38'), ('MasTrafico'), ('Salud'), ('Autónomo')
  ) AS c(name)
 WHERE true
ON CONFLICT (user_id, name) DO NOTHING;
