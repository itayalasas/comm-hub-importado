ALTER TABLE campaign_jobs ADD COLUMN IF NOT EXISTS program_id uuid;
CREATE INDEX IF NOT EXISTS idx_campaign_jobs_program_id ON campaign_jobs (program_id);

ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS program_id uuid;
CREATE INDEX IF NOT EXISTS idx_email_logs_program_id ON email_logs (program_id);

COMMENT ON COLUMN campaign_jobs.program_id IS 'automation_programs.id that originated this job, when sent through /notify from an automation program. Null for ad-hoc /notify calls.';
COMMENT ON COLUMN email_logs.program_id IS 'automation_programs.id that originated this email, when sent through the automation program chain. Null for ad-hoc sends.';
