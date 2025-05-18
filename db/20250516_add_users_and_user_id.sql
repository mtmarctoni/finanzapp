-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add user_id to finance_entries table
ALTER TABLE finance_entries ADD COLUMN IF NOT EXISTS user_id VARCHAR(255) REFERENCES users(id);

-- Add user_id to other tables as needed (you can add more ALTER TABLE statements here)

-- Insert initial users with UUIDs
INSERT INTO users (id, name, email) VALUES
('e5d4d8a0-7f61-41d2-9b1a-1234567890ab', 'Landa', 'landa@example.com'),
('f7a8b9c0-1e2f-3d45-6a7b-1234567890cd', 'Test', 'test@example.com'),
('1', 'MTM', 'marctonimas@protonmail.com');

-- Update existing finance_entries to link them to your user
UPDATE finance_entries
SET user_id = '1'
WHERE user_id IS NULL;
