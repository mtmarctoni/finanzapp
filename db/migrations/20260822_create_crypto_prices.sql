-- Table: crypto_prices
-- Global cache of current crypto prices in EUR, refreshed from CoinGecko.
-- Market-wide data shared by all users, hence intentionally not user-scoped.

CREATE TABLE IF NOT EXISTS crypto_prices (
  symbol VARCHAR(20) PRIMARY KEY,
  price_eur NUMERIC NOT NULL,
  fetched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_crypto_prices_fetched_at ON crypto_prices(fetched_at);
