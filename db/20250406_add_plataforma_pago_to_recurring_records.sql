-- Add plataforma_pago column to recurring_records table
ALTER TABLE recurring_records
ADD COLUMN IF NOT EXISTS plataforma_pago VARCHAR(50) NOT NULL DEFAULT 'any';

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_recurring_records_plataforma_pago ON recurring_records(plataforma_pago);
