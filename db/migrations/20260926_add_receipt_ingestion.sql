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
