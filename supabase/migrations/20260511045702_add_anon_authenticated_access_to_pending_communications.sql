/*
  # Allow anon and authenticated access to pending_communications

  ## Problem
  The `pending_communications` table only had a policy for `service_role`,
  blocking all frontend queries (which use `anon`/`authenticated` keys).
  Other tables like `email_logs`, `applications`, and `communication_templates`
  already have an open policy for anon+authenticated — this migration adds
  the same policy to `pending_communications` for consistency.

  ## Changes
  - Add permissive ALL policy for anon and authenticated roles on pending_communications
*/

CREATE POLICY "Allow all operations on pending_communications"
  ON pending_communications
  AS PERMISSIVE
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);
