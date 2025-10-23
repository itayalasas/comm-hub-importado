/*
  # Fix communication_type constraint to allow pdf_generation

  ## Changes
    - Update CHECK constraint on email_logs.communication_type to include 'pdf_generation'
    - Update CHECK constraint on pending_communications.communication_type to include 'pdf_generation'

  ## Reason
    - The send-email function creates child logs with communication_type='pdf_generation'
    - Current constraint only allows: 'email', 'pdf', 'email_with_pdf'
    - This causes INSERT failures with error code 23514 (CHECK constraint violation)

  ## Solution
    - Drop existing constraints
    - Add new constraints with 'pdf_generation' included
*/

-- Drop existing constraint on email_logs if exists
ALTER TABLE email_logs DROP CONSTRAINT IF EXISTS email_logs_communication_type_check;

-- Add updated constraint with pdf_generation
ALTER TABLE email_logs ADD CONSTRAINT email_logs_communication_type_check
  CHECK (communication_type IN ('email', 'pdf', 'email_with_pdf', 'pdf_generation'));

-- Drop existing constraint on pending_communications if exists
ALTER TABLE pending_communications DROP CONSTRAINT IF EXISTS pending_communications_communication_type_check;

-- Add updated constraint with pdf_generation
ALTER TABLE pending_communications ADD CONSTRAINT pending_communications_communication_type_check
  CHECK (communication_type IN ('email', 'pdf', 'email_with_pdf', 'pdf_generation'));
