/*
  # Add Resend Webhook Tracking

  ## Overview
  Adds columns to track detailed email delivery status from Resend webhooks.
  This allows precise tracking of email lifecycle: sent, delivered, bounced, complained, etc.

  ## Changes to email_logs table
  1. New Columns
    - `resend_email_id` (text) - Unique ID from Resend API
    - `delivery_status` (text) - Detailed delivery status from Resend
      Values: 'sent', 'delivered', 'delivery_delayed', 'bounced', 'complained'
    - `bounce_type` (text) - Type of bounce if applicable ('hard', 'soft', 'spam')
    - `bounce_reason` (text) - Detailed reason for bounce
    - `delivered_at` (timestamptz) - When email was actually delivered
    - `bounced_at` (timestamptz) - When email bounced
    - `complained_at` (timestamptz) - When marked as spam

  2. Indexes
    - Index on `resend_email_id` for webhook lookups
    - Index on `delivery_status` for filtering

  ## Changes to pending_communications table
  1. New Columns
    - `bounce_count` (integer) - Number of bounce attempts
    - `last_bounce_reason` (text) - Last bounce reason for retry logic

  ## Important Notes
    1. Resend webhooks will update these fields in real-time
    2. `delivery_status` provides accurate tracking vs assumed 'sent' status
    3. Bounce detection allows automatic retry logic or permanent failure marking
    4. Statistics dashboard will show real delivery metrics
*/

-- Add Resend tracking columns to email_logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_logs' AND column_name = 'resend_email_id'
  ) THEN
    ALTER TABLE email_logs ADD COLUMN resend_email_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_logs' AND column_name = 'delivery_status'
  ) THEN
    ALTER TABLE email_logs ADD COLUMN delivery_status text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_logs' AND column_name = 'bounce_type'
  ) THEN
    ALTER TABLE email_logs ADD COLUMN bounce_type text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_logs' AND column_name = 'bounce_reason'
  ) THEN
    ALTER TABLE email_logs ADD COLUMN bounce_reason text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_logs' AND column_name = 'delivered_at'
  ) THEN
    ALTER TABLE email_logs ADD COLUMN delivered_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_logs' AND column_name = 'bounced_at'
  ) THEN
    ALTER TABLE email_logs ADD COLUMN bounced_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_logs' AND column_name = 'complained_at'
  ) THEN
    ALTER TABLE email_logs ADD COLUMN complained_at timestamptz;
  END IF;
END $$;

-- Add bounce tracking to pending_communications
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pending_communications' AND column_name = 'bounce_count'
  ) THEN
    ALTER TABLE pending_communications ADD COLUMN bounce_count integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pending_communications' AND column_name = 'last_bounce_reason'
  ) THEN
    ALTER TABLE pending_communications ADD COLUMN last_bounce_reason text;
  END IF;
END $$;

-- Create indexes for efficient webhook lookups
CREATE INDEX IF NOT EXISTS idx_email_logs_resend_email_id 
  ON email_logs(resend_email_id) 
  WHERE resend_email_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_email_logs_delivery_status 
  ON email_logs(delivery_status) 
  WHERE delivery_status IS NOT NULL;

-- Add constraint for delivery_status values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'email_logs_delivery_status_check'
  ) THEN
    ALTER TABLE email_logs 
    ADD CONSTRAINT email_logs_delivery_status_check 
    CHECK (delivery_status IN ('sent', 'delivered', 'delivery_delayed', 'bounced', 'complained'));
  END IF;
END $$;

-- Add constraint for bounce_type values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'email_logs_bounce_type_check'
  ) THEN
    ALTER TABLE email_logs 
    ADD CONSTRAINT email_logs_bounce_type_check 
    CHECK (bounce_type IN ('hard', 'soft', 'spam'));
  END IF;
END $$;