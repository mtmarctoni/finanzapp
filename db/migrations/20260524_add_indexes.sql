-- Migration: Add performance indexes for finance_entries and recurring_records
-- Created: 2026-05-24

CREATE INDEX IF NOT EXISTS idx_finance_entries_user_id ON finance_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_finance_entries_user_fecha ON finance_entries(user_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_finance_entries_user_accion ON finance_entries(user_id, accion);
CREATE INDEX IF NOT EXISTS idx_finance_entries_user_tipo ON finance_entries(user_id, tipo);
CREATE INDEX IF NOT EXISTS idx_recurring_records_user_id ON recurring_records(user_id);
