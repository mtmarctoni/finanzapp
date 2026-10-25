-- Demo write budgets live alongside demo data, without a Redis dependency.
CREATE TABLE IF NOT EXISTS preview_mutation_budgets (
  bucket TEXT PRIMARY KEY,
  units INTEGER NOT NULL CHECK (units >= 0),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS preview_mutation_budgets_expiry_idx
  ON preview_mutation_budgets (expires_at);

-- One statement/transaction checks all four policies before changing counters.
-- The shared advisory lock serializes reservations, including first-use inserts.
CREATE OR REPLACE FUNCTION reserve_preview_mutation(visitor TEXT, weight INTEGER)
RETURNS DOUBLE PRECISION
LANGUAGE plpgsql
SET search_path = public, pg_temp
SET lock_timeout = '3s'
AS $$
DECLARE
  keys TEXT[] := ARRAY['visitor:' || visitor || ':minute',
                       'visitor:' || visitor || ':day',
                       'aggregate:minute', 'aggregate:day'];
  ceilings INTEGER[] := ARRAY[60, 1000, 300, 5000];
  windows INTERVAL[] := ARRAY[INTERVAL '60 seconds', INTERVAL '24 hours',
                              INTERVAL '60 seconds', INTERVAL '24 hours'];
  budget_now TIMESTAMPTZ;
  retry_ms DOUBLE PRECISION := 0;
  spent INTEGER;
  expiry TIMESTAMPTZ;
  i INTEGER;
BEGIN
  IF visitor IS NULL OR visitor !~ '^[a-f0-9]{64}$'
     OR weight IS NULL OR weight < 1 OR weight > 60 THEN
    RAISE EXCEPTION 'Invalid preview reservation';
  END IF;

  PERFORM pg_advisory_xact_lock(138139, 1);
  budget_now := clock_timestamp(); -- take time after waiting for the lock

  FOR i IN 1..4 LOOP
    SELECT units, expires_at INTO spent, expiry
      FROM preview_mutation_budgets WHERE bucket = keys[i];
    IF expiry > budget_now AND spent + weight > ceilings[i] THEN
      retry_ms := GREATEST(retry_ms,
        EXTRACT(EPOCH FROM (expiry - budget_now)) * 1000);
    END IF;
  END LOOP;
  IF retry_ms > 0 THEN RETURN retry_ms; END IF;

  -- Bounded, indexed cleanup: no scheduled service needed after inactivity.
  DELETE FROM preview_mutation_budgets WHERE bucket IN (
    SELECT bucket FROM preview_mutation_budgets
      WHERE expires_at <= budget_now ORDER BY expires_at LIMIT 100
  );

  FOR i IN 1..4 LOOP
    INSERT INTO preview_mutation_budgets (bucket, units, expires_at)
      VALUES (keys[i], weight, budget_now + windows[i])
    ON CONFLICT (bucket) DO UPDATE SET
      units = CASE WHEN preview_mutation_budgets.expires_at <= budget_now
                   THEN weight ELSE preview_mutation_budgets.units + weight END,
      expires_at = CASE WHEN preview_mutation_budgets.expires_at <= budget_now
                       THEN budget_now + windows[i]
                       ELSE preview_mutation_budgets.expires_at END;
  END LOOP;
  RETURN 0;
END;
$$;
