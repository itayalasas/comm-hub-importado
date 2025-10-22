/*
  # Add Order ID Support to Pending Communications

  ## Changes
  
  1. Schema Changes
    - Add `order_id` column to `pending_communications` for easier order/invoice matching
    - Add index on `order_id` for fast lookups by order
  
  ## Purpose
  
  This allows external systems (like Dogcatify) to:
  1. Create a pending email with an `order_id` when order is created
  2. Later, when invoice is generated, match by `order_id` to complete and send the email
  
  ## Example Flow
  
  1. Order created → Call `/send-email` with `order_id: "12345"`
  2. Email marked as pending, waiting for invoice PDF
  3. Invoice generated → Call `/generate-pdf` with `order_id: "12345"`
  4. System finds pending email, generates PDF, sends email automatically
  
  ## Important Notes
  
  - `order_id` is optional for backwards compatibility
  - `external_reference_id` remains unique and required
  - Both can be used for matching, but `order_id` is more semantic
*/

-- Add order_id column to pending_communications
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pending_communications' AND column_name = 'order_id'
  ) THEN
    ALTER TABLE pending_communications ADD COLUMN order_id text;
  END IF;
END $$;

-- Create index on order_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_pending_communications_order_id 
  ON pending_communications(order_id) 
  WHERE order_id IS NOT NULL;

-- Create composite index for application + order_id lookups
CREATE INDEX IF NOT EXISTS idx_pending_communications_app_order 
  ON pending_communications(application_id, order_id) 
  WHERE order_id IS NOT NULL;
