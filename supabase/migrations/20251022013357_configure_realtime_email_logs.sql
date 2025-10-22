/*
  # Configure Realtime for Email Logs

  ## Overview
  Configure replica identity for email_logs table to ensure proper realtime updates.

  ## Changes
  1. Set replica identity to full for proper realtime updates with all column data

  ## Security
  - Realtime subscriptions will still respect RLS policies
*/

-- Set replica identity to full to get all columns in realtime updates
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'email_logs') THEN
    ALTER TABLE email_logs REPLICA IDENTITY FULL;
  END IF;
END $$;
