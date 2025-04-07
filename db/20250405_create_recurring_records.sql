-- Create recurring_records table
CREATE TABLE IF NOT EXISTS recurring_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('Ingreso', 'Gasto', 'Inversión')),
    frequency VARCHAR(20) NOT NULL CHECK (frequency IN ('monthly', 'weekly', 'biweekly', 'yearly')),
    active BOOLEAN NOT NULL DEFAULT true,
    last_generated DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_recurring_records_active ON recurring_records(active);
CREATE INDEX IF NOT EXISTS idx_recurring_records_last_generated ON recurring_records(last_generated);
