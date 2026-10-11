-- Table: safebox_movements
-- Ledger of physical cash movements in and out of the user's safe: one
-- opening count, deposits, withdrawals and signed count adjustments. The
-- safebox balance is always derived from these rows, never stored, so the
-- total and its history can never diverge.
--
-- Moving cash into the wallet is a withdrawal from the safe, NOT an
-- expense; later wallet spending is recorded as ordinary finance_entries
-- and never touches this table.

CREATE TABLE IF NOT EXISTS safebox_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  movement_type VARCHAR(20) NOT NULL,
  -- opening / deposit / withdrawal store positive magnitudes; adjustment is
  -- signed (counted minus expected cash) and can never be zero.
  amount NUMERIC(14, 2) NOT NULL,
  note VARCHAR(255),
  movement_date TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT safebox_movements_type_check
    CHECK (movement_type IN ('opening', 'deposit', 'withdrawal', 'adjustment')),
  CONSTRAINT safebox_movements_amount_check
    CHECK (
      (movement_type = 'adjustment' AND amount <> 0)
      OR (movement_type <> 'adjustment' AND amount > 0)
    )
);

CREATE INDEX IF NOT EXISTS idx_safebox_movements_user_date
  ON safebox_movements (user_id, movement_date);
