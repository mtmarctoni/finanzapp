-- Add active column to recurring_records table
ALTER TABLE recurring_records
ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_recurring_records_active ON recurring_records(active);
