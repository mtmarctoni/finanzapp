-- Migration: Add quien (payer) field to finance_entries and recurring_records
-- Created: 2025-04-20

-- Add quien column to finance_entries with default 'Yo'
ALTER TABLE finance_entries 
ADD COLUMN IF NOT EXISTS quien VARCHAR(255) NOT NULL DEFAULT 'Yo';

-- Add quien column to recurring_records with default 'Yo'
ALTER TABLE recurring_records 
ADD COLUMN IF NOT EXISTS quien VARCHAR(255) NOT NULL DEFAULT 'Yo';

-- Create index for efficient filtering and sorting by payer
CREATE INDEX IF NOT EXISTS idx_finance_entries_quien ON finance_entries(quien);

-- Create index for recurring records as well
CREATE INDEX IF NOT EXISTS idx_recurring_records_quien ON recurring_records(quien);

-- Update any existing NULL values (safety check)
UPDATE finance_entries SET quien = 'Yo' WHERE quien IS NULL;
UPDATE recurring_records SET quien = 'Yo' WHERE quien IS NULL;
