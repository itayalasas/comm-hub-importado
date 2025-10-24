/*
  # Public PDF Access System

  1. New Tables
    - `public_pdf_links`
      - `id` (uuid, primary key)
      - `application_id` (uuid, references applications)
      - `pdf_generation_log_id` (uuid, references pdf_generation_logs)
      - `order_id` (text, optional reference)
      - `access_token` (text, unique secure token for public access)
      - `filename` (text)
      - `expires_at` (timestamptz, optional expiration)
      - `view_count` (integer, tracks how many times accessed)
      - `last_viewed_at` (timestamptz)
      - `is_active` (boolean, to disable access)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `public_pdf_links` table
    - Public can read active non-expired links by access_token
    - Only authenticated users with proper permissions can create/manage links

  3. Notes
    - Access tokens are cryptographically secure random strings
    - Links can optionally expire after a certain date
    - View count helps track usage
    - Links can be deactivated without deleting the record
*/

-- Create public_pdf_links table
CREATE TABLE IF NOT EXISTS public_pdf_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid REFERENCES applications(id) ON DELETE CASCADE NOT NULL,
  pdf_generation_log_id uuid REFERENCES pdf_generation_logs(id) ON DELETE CASCADE NOT NULL,
  order_id text,
  access_token text UNIQUE NOT NULL,
  filename text NOT NULL,
  expires_at timestamptz,
  view_count integer DEFAULT 0 NOT NULL,
  last_viewed_at timestamptz,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Create index for fast token lookups
CREATE INDEX IF NOT EXISTS idx_public_pdf_links_access_token ON public_pdf_links(access_token) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_public_pdf_links_order_id ON public_pdf_links(order_id) WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_public_pdf_links_pdf_log ON public_pdf_links(pdf_generation_log_id);

-- Enable RLS
ALTER TABLE public_pdf_links ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can view active, non-expired links by access_token
CREATE POLICY "Public can access active PDF links"
  ON public_pdf_links
  FOR SELECT
  USING (
    is_active = true 
    AND (expires_at IS NULL OR expires_at > now())
  );

-- Policy: Service role can manage all links
CREATE POLICY "Service role can manage PDF links"
  ON public_pdf_links
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Add metadata column to pdf_generation_logs to store public URL info
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pdf_generation_logs' AND column_name = 'public_url'
  ) THEN
    ALTER TABLE pdf_generation_logs ADD COLUMN public_url text;
  END IF;
END $$;