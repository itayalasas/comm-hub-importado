/*
  # Add PDF Communication Tracking

  ## Changes

  1. New Columns in `email_logs`
    - `communication_type` (text) - Type: 'email', 'pdf', 'email_with_pdf'
    - `pdf_generated` (boolean) - Whether PDF was generated
    - `pdf_attachment_size` (integer) - Size of PDF in bytes

  2. New Columns in `pending_communications`
    - `communication_type` (text) - Type: 'email', 'pdf', 'email_with_pdf'
    - `pdf_generated` (boolean) - Whether PDF was generated for this communication
    - `pdf_template_id` (uuid) - Reference to PDF template used

  3. Security
    - Existing RLS policies apply automatically to new columns

  4. Indexes
    - Index on communication_type for statistics queries

  ## Important Notes
    - PDFs should remain in 'waiting_data' status until associated email is sent
    - When PDF is generated, it's stored temporarily and attached to email
    - Statistics will show separate counts for email, pdf, and combined communications
*/

-- Add communication_type to email_logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_logs' AND column_name = 'communication_type'
  ) THEN
    ALTER TABLE email_logs ADD COLUMN communication_type text DEFAULT 'email'
      CHECK (communication_type IN ('email', 'pdf', 'email_with_pdf'));
  END IF;
END $$;

-- Add pdf tracking columns to email_logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_logs' AND column_name = 'pdf_generated'
  ) THEN
    ALTER TABLE email_logs ADD COLUMN pdf_generated boolean DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_logs' AND column_name = 'pdf_attachment_size'
  ) THEN
    ALTER TABLE email_logs ADD COLUMN pdf_attachment_size integer;
  END IF;
END $$;

-- Add communication_type to pending_communications
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pending_communications' AND column_name = 'communication_type'
  ) THEN
    ALTER TABLE pending_communications ADD COLUMN communication_type text DEFAULT 'email'
      CHECK (communication_type IN ('email', 'pdf', 'email_with_pdf'));
  END IF;
END $$;

-- Add pdf tracking to pending_communications
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pending_communications' AND column_name = 'pdf_generated'
  ) THEN
    ALTER TABLE pending_communications ADD COLUMN pdf_generated boolean DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pending_communications' AND column_name = 'pdf_template_id'
  ) THEN
    ALTER TABLE pending_communications ADD COLUMN pdf_template_id uuid
      REFERENCES communication_templates(id);
  END IF;
END $$;

-- Create index on communication_type for faster statistics queries
CREATE INDEX IF NOT EXISTS idx_email_logs_communication_type
  ON email_logs(communication_type);

CREATE INDEX IF NOT EXISTS idx_pending_communications_communication_type
  ON pending_communications(communication_type);

-- Create index on pdf_generated for filtering
CREATE INDEX IF NOT EXISTS idx_email_logs_pdf_generated
  ON email_logs(pdf_generated) WHERE pdf_generated = true;

CREATE INDEX IF NOT EXISTS idx_pending_communications_pdf_generated
  ON pending_communications(pdf_generated) WHERE pdf_generated = true;
