/*
  # Add postgres role access to pending_communications and pdf_generation_logs

  ## Problem
  The external query server connects to the database using DATABASE_URL which
  runs as the `postgres` role. RLS is enabled on all tables, but `postgres`
  is not included in any policy for `pending_communications` or
  `pdf_generation_logs`, causing QUERY_ERROR on those tables while other
  tables (applications, email_logs, etc.) work fine because their policies
  cover `anon` and `authenticated` roles which postgres inherits through
  Supabase's role configuration.

  The fix is to explicitly allow the `postgres` role on these two tables,
  matching the same open pattern used by the other working tables.

  ## Changes
  - Add permissive ALL policy for postgres role on pending_communications
  - Add permissive ALL policy for postgres role on pdf_generation_logs
*/

CREATE POLICY "Postgres role has full access to pending_communications"
  ON pending_communications
  AS PERMISSIVE
  FOR ALL
  TO postgres
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Postgres role has full access to pdf_generation_logs"
  ON pdf_generation_logs
  AS PERMISSIVE
  FOR ALL
  TO postgres
  USING (true)
  WITH CHECK (true);
