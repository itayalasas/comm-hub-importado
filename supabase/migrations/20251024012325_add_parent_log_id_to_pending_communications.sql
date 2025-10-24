/*
  # Add parent_log_id to pending_communications

  1. Changes
    - Add `parent_log_id` column to `pending_communications` table to track parent email logs
    - This enables the parent-child relationship for email transactions with pending invoices
  
  2. Notes
    - Uses IF NOT EXISTS to prevent errors on re-run
    - Column is nullable as not all pending communications have a parent log
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pending_communications' AND column_name = 'parent_log_id'
  ) THEN
    ALTER TABLE pending_communications ADD COLUMN parent_log_id uuid REFERENCES email_logs(id) ON DELETE SET NULL;
  END IF;
END $$;