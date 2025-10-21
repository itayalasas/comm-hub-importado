/*
  # Pending Communications System

  ## Overview
  System to handle communications that depend on external data (e.g., PDF from billing system)
  before being sent. Communications can be created in "pending_data" status and completed later.

  ## New Tables
  
  ### `pending_communications`
    - `id` (uuid, primary key) - Unique identifier
    - `application_id` (uuid, foreign key) - Links to application
    - `template_name` (text) - Name of the template to use
    - `recipient_email` (text) - Email recipient
    - `base_data` (jsonb) - Initial data provided (e.g., client_name, appointment_date)
    - `pending_fields` (jsonb) - Fields waiting for external data (e.g., ["invoice_pdf", "invoice_number"])
    - `external_reference_id` (text, unique) - Unique ID to identify this communication from external systems
    - `external_system` (text) - Name of external system (e.g., "billing", "crm")
    - `status` (text) - Status: 'waiting_data', 'data_received', 'sent', 'failed', 'cancelled'
    - `webhook_url` (text, nullable) - Optional webhook to notify when sent
    - `expires_at` (timestamptz, nullable) - Optional expiration date
    - `completed_data` (jsonb, nullable) - Data received from external system
    - `sent_log_id` (uuid, nullable) - Reference to email_logs after sending
    - `error_message` (text, nullable) - Error if failed
    - `created_at` (timestamptz) - When created
    - `updated_at` (timestamptz) - Last update
    - `completed_at` (timestamptz, nullable) - When data was completed
    - `sent_at` (timestamptz, nullable) - When email was sent

  ## Security
    - Enable RLS on all tables
    - Policies for authenticated access via API key

  ## Indexes
    - Index on external_reference_id for fast lookups
    - Index on application_id for filtering
    - Index on status for queue processing
    - Index on expires_at for cleanup jobs

  ## Important Notes
    1. External systems use external_reference_id to complete communications
    2. System automatically sends email when all pending_fields are filled
    3. Expired communications can be cleaned up periodically
    4. Supports webhooks to notify external systems when sent
*/

-- Create pending_communications table
CREATE TABLE IF NOT EXISTS pending_communications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  template_name text NOT NULL,
  recipient_email text NOT NULL,
  base_data jsonb DEFAULT '{}'::jsonb,
  pending_fields jsonb DEFAULT '[]'::jsonb,
  external_reference_id text UNIQUE NOT NULL,
  external_system text NOT NULL,
  status text NOT NULL DEFAULT 'waiting_data' CHECK (status IN ('waiting_data', 'data_received', 'sent', 'failed', 'cancelled')),
  webhook_url text,
  expires_at timestamptz,
  completed_data jsonb DEFAULT '{}'::jsonb,
  sent_log_id uuid REFERENCES email_logs(id),
  error_message text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  sent_at timestamptz
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_pending_communications_external_ref 
  ON pending_communications(external_reference_id);

CREATE INDEX IF NOT EXISTS idx_pending_communications_application 
  ON pending_communications(application_id);

CREATE INDEX IF NOT EXISTS idx_pending_communications_status 
  ON pending_communications(status);

CREATE INDEX IF NOT EXISTS idx_pending_communications_expires 
  ON pending_communications(expires_at) 
  WHERE expires_at IS NOT NULL;

-- Enable RLS
ALTER TABLE pending_communications ENABLE ROW LEVEL SECURITY;

-- Policy: Service role can access all (for edge functions)
CREATE POLICY "Service role has full access to pending communications"
  ON pending_communications FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_pending_communications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS set_pending_communications_updated_at ON pending_communications;
CREATE TRIGGER set_pending_communications_updated_at
  BEFORE UPDATE ON pending_communications
  FOR EACH ROW
  EXECUTE FUNCTION update_pending_communications_updated_at();
