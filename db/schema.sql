-- Table: users
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

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
  user_id VARCHAR(255),
  merchant_id  UUID REFERENCES merchants (id) ON DELETE SET NULL,
  content_hash VARCHAR(64),
  origen       VARCHAR(32) NOT NULL DEFAULT 'manual',
  confianza    NUMERIC(3, 2)
);

-- Exact-image idempotency. Partial so every manual entry (NULL hash) is
-- unaffected, and per-user so two users' identical screenshots both save.
CREATE UNIQUE INDEX IF NOT EXISTS finance_entries_user_content_hash_idx
  ON finance_entries (user_id, content_hash)
  WHERE content_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS finance_entries_origen_fecha_idx
  ON finance_entries (user_id, origen, fecha DESC);

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

-- Table: categories
-- Canonical list for the "categoria" dropdown, shared by /records and
-- /recurring. See db/migrations/20260926_create_categories.sql for the
-- rationale and the backfill.
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
