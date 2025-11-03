/*
  # Add Email Provider Type Support

  1. Changes
    - Add `provider_type` column to `email_credentials` table
      - Options: 'smtp' or 'resend'
      - Default: 'smtp' (for backward compatibility)
    - Add `resend_api_key` column for Resend configuration
    - Make SMTP fields nullable (since Resend doesn't need them)
  
  2. Notes
    - Only one configuration can be active per application_id at a time
    - SMTP requires: smtp_host, smtp_port, smtp_user, smtp_password, from_email, from_name
    - Resend requires: resend_api_key, from_email, from_name
*/

-- Add new columns to email_credentials
DO $$
BEGIN
  -- Add provider_type column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_credentials' AND column_name = 'provider_type'
  ) THEN
    ALTER TABLE email_credentials 
    ADD COLUMN provider_type text DEFAULT 'smtp' CHECK (provider_type IN ('smtp', 'resend'));
  END IF;

  -- Add resend_api_key column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_credentials' AND column_name = 'resend_api_key'
  ) THEN
    ALTER TABLE email_credentials 
    ADD COLUMN resend_api_key text;
  END IF;

  -- Make SMTP fields nullable (for Resend)
  ALTER TABLE email_credentials 
  ALTER COLUMN smtp_host DROP NOT NULL,
  ALTER COLUMN smtp_port DROP NOT NULL,
  ALTER COLUMN smtp_user DROP NOT NULL,
  ALTER COLUMN smtp_password DROP NOT NULL;

END $$;

-- Set existing configurations as SMTP type
UPDATE email_credentials 
SET provider_type = 'smtp'
WHERE provider_type IS NULL;

-- Create index for faster queries on active configurations
CREATE INDEX IF NOT EXISTS idx_email_credentials_active 
ON email_credentials(application_id, is_active) 
WHERE is_active = true;

-- Add comments for documentation
COMMENT ON COLUMN email_credentials.provider_type IS 'Email provider: smtp or resend';
COMMENT ON COLUMN email_credentials.resend_api_key IS 'API key for Resend service (only needed when provider_type is resend)';
