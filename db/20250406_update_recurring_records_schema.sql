-- Drop existing columns
ALTER TABLE recurring_records
DROP COLUMN IF EXISTS tipo,
DROP COLUMN IF EXISTS accion,
DROP COLUMN IF EXISTS detalle1,
DROP COLUMN IF EXISTS detalle2,
DROP COLUMN IF EXISTS dia;

-- Add new columns with correct types and no default values
ALTER TABLE recurring_records
ADD COLUMN IF NOT EXISTS accion VARCHAR(20) CHECK (accion IN ('Ingreso', 'Gasto', 'Inversión')) NOT NULL,
ADD COLUMN IF NOT EXISTS tipo VARCHAR(100) NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS detalle1 VARCHAR(255) NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS detalle2 VARCHAR(255) NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS dia SMALLINT CHECK (dia BETWEEN 1 AND 31) NOT NULL DEFAULT 1;

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_recurring_records_accion ON recurring_records(accion);
CREATE INDEX IF NOT EXISTS idx_recurring_records_tipo ON recurring_records(tipo);
CREATE INDEX IF NOT EXISTS idx_recurring_records_detalle1 ON recurring_records(detalle1);
CREATE INDEX IF NOT EXISTS idx_recurring_records_detalle2 ON recurring_records(detalle2);
CREATE INDEX IF NOT EXISTS idx_recurring_records_dia ON recurring_records(dia);

-- Update existing records to ensure they have valid values
UPDATE recurring_records
SET dia = 1
WHERE dia IS NULL;

-- Add a constraint to ensure accion is always one of the valid values
ALTER TABLE recurring_records
ADD CONSTRAINT valid_accion CHECK (accion IN ('Ingreso', 'Gasto', 'Inversión'));
