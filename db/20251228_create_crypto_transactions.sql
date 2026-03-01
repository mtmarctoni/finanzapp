-- Table: crypto_transactions
-- Tracks crypto-specific transactions like wallet transfers, exchanges between cryptos
-- Linked to finance_entries for investment records (tipo = "Cripto D" or "Cripto W")

CREATE TABLE IF NOT EXISTS crypto_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Link to finance_entries for investment/withdrawal records (nullable for wallet-only transactions)
  record_id VARCHAR(255) REFERENCES finance_entries(id) ON DELETE SET NULL,
  
  -- Transaction type: deposit, withdrawal, wallet_transfer, exchange, staking, etc.
  transaction_type VARCHAR(50) NOT NULL,
  
  -- Crypto details
  crypto_symbol VARCHAR(20) NOT NULL,           -- e.g., BTC, ETH, USDT
  amount NUMERIC NOT NULL,                       -- Amount of crypto
  price_at_transaction NUMERIC,                  -- Price in fiat at time of transaction (optional)
  
  -- For exchanges between cryptos
  to_crypto_symbol VARCHAR(20),                  -- Target crypto for exchanges
  to_amount NUMERIC,                             -- Amount received in target crypto
  
  -- Wallet information
  from_wallet VARCHAR(100),                      -- Source wallet (e.g., "Binance", "Ledger", "MetaMask")
  to_wallet VARCHAR(100),                        -- Destination wallet
  
  -- Additional details
  fee NUMERIC DEFAULT 0,                         -- Transaction fee
  fee_crypto VARCHAR(20),                        -- Crypto used for fee payment
  notes TEXT,                                    -- Additional notes
  
  -- Transaction metadata
  transaction_date TIMESTAMP WITH TIME ZONE NOT NULL,
  external_tx_id VARCHAR(255),                   -- Blockchain transaction ID or exchange order ID
  
  -- Audit fields
  user_id VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_crypto_transactions_user_id ON crypto_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_crypto_transactions_record_id ON crypto_transactions(record_id);
CREATE INDEX IF NOT EXISTS idx_crypto_transactions_crypto_symbol ON crypto_transactions(crypto_symbol);
CREATE INDEX IF NOT EXISTS idx_crypto_transactions_transaction_date ON crypto_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_crypto_transactions_transaction_type ON crypto_transactions(transaction_type);

-- Table: crypto_wallets
-- Tracks user's crypto wallets for easy selection
CREATE TABLE IF NOT EXISTS crypto_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,                    -- Wallet name (e.g., "My Binance", "Cold Storage")
  wallet_type VARCHAR(50) NOT NULL,              -- exchange, hardware, software, paper
  address VARCHAR(255),                          -- Optional wallet address
  notes TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_crypto_wallets_user_id ON crypto_wallets(user_id);
