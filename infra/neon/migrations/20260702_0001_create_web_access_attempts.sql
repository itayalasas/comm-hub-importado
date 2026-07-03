CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS web_access_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id text NOT NULL UNIQUE CHECK (btrim(attempt_id) <> ''),
  event_type text NOT NULL CHECK (btrim(event_type) <> ''),
  status text GENERATED ALWAYS AS (event_type) STORED,
  email text,
  path text,
  referrer text,
  error_message text,
  user_agent text,
  ip_address text,
  country_code text,
  country_name text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_web_access_attempts_created_at
  ON web_access_attempts (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_web_access_attempts_event_type
  ON web_access_attempts (event_type);

CREATE INDEX IF NOT EXISTS idx_web_access_attempts_country_code
  ON web_access_attempts (country_code);

CREATE INDEX IF NOT EXISTS idx_web_access_attempts_email
  ON web_access_attempts (email);

CREATE INDEX IF NOT EXISTS idx_web_access_attempts_updated_at
  ON web_access_attempts (updated_at DESC);

CREATE OR REPLACE FUNCTION set_web_access_attempts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE t.tgname = 'trg_web_access_attempts_updated_at'
      AND c.relname = 'web_access_attempts'
  ) THEN
    EXECUTE 'DROP TRIGGER trg_web_access_attempts_updated_at ON web_access_attempts';
  END IF;
END
$$;

CREATE TRIGGER trg_web_access_attempts_updated_at
BEFORE UPDATE ON web_access_attempts
FOR EACH ROW
EXECUTE FUNCTION set_web_access_attempts_updated_at();

COMMENT ON TABLE web_access_attempts IS 'Consolidated access analytics table: one row per attempt, updated by attempt_id.';
COMMENT ON COLUMN web_access_attempts.attempt_id IS 'Stable attempt identifier generated on the client.';
COMMENT ON COLUMN web_access_attempts.event_type IS 'Latest attempt state, usually login_started, login_success or login_failed.';
COMMENT ON COLUMN web_access_attempts.status IS 'Generated mirror of event_type for dashboard compatibility.';
