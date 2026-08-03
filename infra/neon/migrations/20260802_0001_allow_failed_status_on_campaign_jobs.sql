ALTER TABLE campaign_jobs DROP CONSTRAINT campaign_jobs_status_check;

ALTER TABLE campaign_jobs ADD CONSTRAINT campaign_jobs_status_check
  CHECK (status = ANY (ARRAY['pending'::text, 'processing'::text, 'done'::text, 'failed'::text, 'cancelled'::text]));
