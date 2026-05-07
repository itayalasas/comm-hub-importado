/*
  # Create campaign_jobs table

  ## Summary
  Stores async bulk notification campaign jobs. Each job holds the full
  recipients list, processing config, and a running tally of results.
  The `notify` edge function inserts a job record immediately (returning
  a job_id to the caller) and processes all recipients in the background
  via EdgeRuntime.waitUntil.

  ## New Tables

  ### campaign_jobs
  - id              — UUID primary key
  - application_id  — FK to applications, scopes the job to a tenant
  - type            — notification type: 'email' | 'email_pdf' | 'pdf'
  - template_name   — email template name (matches communication_templates.name)
  - pdf_template_name — PDF template name (for email_pdf / pdf types)
  - pdf_filename_pattern — optional filename pattern e.g. "invoice-{{order_id}}.pdf"
  - shared_data     — JSONB data merged into every recipient's data object
  - recipients      — JSONB array of {email, data} objects
  - total           — total number of recipients
  - processed       — how many have been attempted so far
  - sent            — success count
  - failed          — failure count
  - status          — job lifecycle: 'pending' | 'processing' | 'done' | 'cancelled'
  - results         — JSONB array accumulating per-recipient outcomes
  - options         — JSONB bag: stop_on_error, concurrency, etc.
  - error_message   — top-level error if job itself failed to start
  - created_at / updated_at — timestamps

  ## Security
  - RLS enabled; only service role can read/write (jobs are created and
    updated exclusively by edge functions using the service role key).
    Application-level reads are exposed through the edge function response,
    not direct DB access.
*/

CREATE TABLE IF NOT EXISTS campaign_jobs (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id       uuid NOT NULL REFERENCES applications(id),
  type                 text NOT NULL CHECK (type IN ('email', 'email_pdf', 'pdf')),
  template_name        text,
  pdf_template_name    text,
  pdf_filename_pattern text,
  shared_data          jsonb NOT NULL DEFAULT '{}',
  recipients           jsonb NOT NULL DEFAULT '[]',
  total                integer NOT NULL DEFAULT 0,
  processed            integer NOT NULL DEFAULT 0,
  sent                 integer NOT NULL DEFAULT 0,
  failed               integer NOT NULL DEFAULT 0,
  status               text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'done', 'cancelled')),
  results              jsonb NOT NULL DEFAULT '[]',
  options              jsonb NOT NULL DEFAULT '{}',
  error_message        text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE campaign_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role has full access to campaign_jobs"
  ON campaign_jobs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS campaign_jobs_application_id_idx ON campaign_jobs (application_id);
CREATE INDEX IF NOT EXISTS campaign_jobs_status_idx ON campaign_jobs (status);
CREATE INDEX IF NOT EXISTS campaign_jobs_created_at_idx ON campaign_jobs (created_at DESC);
