/*
  # Disable RLS on all public tables

  ## Reason
  Access control is handled at the API layer via API key validation.
  RLS adds no security benefit here and blocks direct Postgres connections
  (DATABASE_URL / postgres role) used by the external query server.
*/

ALTER TABLE applications DISABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_jobs DISABLE ROW LEVEL SECURITY;
ALTER TABLE communication_templates DISABLE ROW LEVEL SECURITY;
ALTER TABLE email_credentials DISABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE embed_credentials DISABLE ROW LEVEL SECURITY;
ALTER TABLE license_plans DISABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_email_usage DISABLE ROW LEVEL SECURITY;
ALTER TABLE pdf_generation_locks DISABLE ROW LEVEL SECURITY;
ALTER TABLE pdf_generation_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE pending_communications DISABLE ROW LEVEL SECURITY;
ALTER TABLE public_pdf_links DISABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_settings DISABLE ROW LEVEL SECURITY;
