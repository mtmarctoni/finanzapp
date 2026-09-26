-- CI database initialization
-- Combines schema + all migrations in order

-- Table: users
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: finance_entries
CREATE TABLE IF NOT EXISTS finance_entries (
  id VARCHAR(255) PRIMARY KEY,
  fecha TIMESTAMP WITH TIME ZONE NOT NULL,
  tipo VARCHAR(255) NOT NULL,
  accion VARCHAR(255) NOT NULL,
  que VARCHAR(255) NOT NULL,
  plataforma_pago VARCHAR(255) NOT NULL,
  cantidad NUMERIC NOT NULL,
  detalle1 VARCHAR(255),
  detalle2 VARCHAR(255),
  quien VARCHAR(255) NOT NULL DEFAULT 'Yo',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  user_id VARCHAR(255)
);

-- Table: recurring_records
CREATE TABLE IF NOT EXISTS recurring_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  amount NUMERIC NOT NULL,
  frequency VARCHAR(20) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  last_generated DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  plataforma_pago VARCHAR(50) NOT NULL DEFAULT 'any',
  accion VARCHAR(20) NOT NULL DEFAULT 'Gasto',
  tipo VARCHAR(100) NOT NULL DEFAULT '',
  detalle1 VARCHAR(255) NOT NULL DEFAULT '',
  detalle2 VARCHAR(255) NOT NULL DEFAULT '',
  quien VARCHAR(255) NOT NULL DEFAULT 'Yo',
  dia SMALLINT NOT NULL DEFAULT 1,
  user_id VARCHAR(255)
);

-- Table: api_keys
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_used_at TIMESTAMP WITH TIME ZONE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);

-- Migration: 20250420_add_quien_field
ALTER TABLE finance_entries ADD COLUMN IF NOT EXISTS quien VARCHAR(255) NOT NULL DEFAULT 'Yo';
ALTER TABLE recurring_records ADD COLUMN IF NOT EXISTS quien VARCHAR(255) NOT NULL DEFAULT 'Yo';
CREATE INDEX IF NOT EXISTS idx_finance_entries_quien ON finance_entries(quien);
CREATE INDEX IF NOT EXISTS idx_recurring_records_quien ON recurring_records(quien);
UPDATE finance_entries SET quien = 'Yo' WHERE quien IS NULL;
UPDATE recurring_records SET quien = 'Yo' WHERE quien IS NULL;

-- Migration: 20260524_add_indexes
CREATE INDEX IF NOT EXISTS idx_finance_entries_user_id ON finance_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_finance_entries_user_fecha ON finance_entries(user_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_finance_entries_user_accion ON finance_entries(user_id, accion);
CREATE INDEX IF NOT EXISTS idx_finance_entries_user_tipo ON finance_entries(user_id, tipo);
CREATE INDEX IF NOT EXISTS idx_recurring_records_user_id ON recurring_records(user_id);

-- Migration: 20260926_create_categories
-- Canonical list for the "categoria" dropdown, shared by /records and
-- /recurring. The backfills below are no-ops on a fresh database (no users or
-- records yet); they matter when this file is replayed over a populated one.
--
-- user_id intentionally has no REFERENCES clause, matching finance_entries and
-- recurring_records: credentials sign-ins set the session id from the allowlist
-- while `insertUser` mints a random users.id, so `session.user.id` is not
-- guaranteed to exist in `users`.
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

-- TRIM is required, not cosmetic: the Combobox create path can persist untrimmed
-- tipo values, and ensureCategory() matches case-insensitively but not
-- whitespace-insensitively, so an untrimmed backfill row would sit beside the
-- tidy version as a second dropdown entry. See the migration for full rationale.
INSERT INTO categories (user_id, name)
SELECT DISTINCT user_id, TRIM(tipo)
  FROM finance_entries
 WHERE tipo IS NOT NULL AND TRIM(tipo) <> '' AND user_id IS NOT NULL
UNION
SELECT DISTINCT user_id, TRIM(tipo)
  FROM recurring_records
 WHERE tipo IS NOT NULL AND TRIM(tipo) <> '' AND user_id IS NOT NULL
ON CONFLICT (user_id, name) DO NOTHING;

-- The categories that used to be hardcoded in types/categories.ts, so nobody
-- loses one they can currently select. WHERE true keeps the parser from
-- attributing the trailing ON CONFLICT to an inner join.
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
