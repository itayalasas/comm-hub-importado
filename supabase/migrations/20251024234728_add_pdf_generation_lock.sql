/*
  # Add PDF Generation Lock System

  1. New Table
    - `pdf_generation_locks` table to prevent duplicate PDF generations
    - Uses order_id as unique constraint
    - Auto-expires locks after 5 minutes

  2. Security
    - Enable RLS
    - Only service role can access
*/

CREATE TABLE IF NOT EXISTS pdf_generation_locks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id text NOT NULL UNIQUE,
  application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  locked_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '5 minutes'),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE pdf_generation_locks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access"
  ON pdf_generation_locks
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_pdf_locks_order_id ON pdf_generation_locks(order_id);
CREATE INDEX IF NOT EXISTS idx_pdf_locks_expires ON pdf_generation_locks(expires_at);

-- Clean up expired locks automatically
CREATE OR REPLACE FUNCTION cleanup_expired_pdf_locks()
RETURNS trigger AS $$
BEGIN
  DELETE FROM pdf_generation_locks
  WHERE expires_at < now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'cleanup_expired_locks_trigger'
  ) THEN
    CREATE TRIGGER cleanup_expired_locks_trigger
      BEFORE INSERT ON pdf_generation_locks
      FOR EACH STATEMENT
      EXECUTE FUNCTION cleanup_expired_pdf_locks();
  END IF;
END $$;