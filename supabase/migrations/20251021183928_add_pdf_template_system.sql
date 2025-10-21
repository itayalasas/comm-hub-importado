/*
  # PDF Template System

  ## Overview
  Sistema para gestionar templates de PDF y su relación con templates de email.
  Permite crear templates que generan PDFs (facturas, recibos) y templates de email
  que esperan esos PDFs antes de enviarse.

  ## Changes to Existing Tables
  
  ### `communication_templates`
    - `template_type` (text) - 'email' o 'pdf'
    - `pdf_template_id` (uuid, nullable) - Referencia al template de PDF que genera el adjunto
    - `generates_pdf` (boolean) - Si este template genera un PDF
    - `pdf_filename_pattern` (text, nullable) - Patrón para nombre del PDF (ej: "invoice_{{invoice_number}}.pdf")

  ## New Tables
  
  ### `pdf_generation_logs`
    - `id` (uuid, primary key)
    - `application_id` (uuid, foreign key)
    - `pdf_template_id` (uuid, foreign key) - Template usado para generar el PDF
    - `data` (jsonb) - Datos usados para generar el PDF
    - `pdf_base64` (text) - PDF generado en base64
    - `filename` (text) - Nombre del archivo
    - `size_bytes` (integer) - Tamaño del PDF
    - `external_reference_id` (text, nullable) - Referencia externa
    - `created_at` (timestamptz)

  ## Important Notes
    1. Template de tipo 'pdf' genera PDFs usando HTML
    2. Template de tipo 'email' con pdf_template_id espera el PDF antes de enviar
    3. El sistema genera el PDF automáticamente cuando se crea una pending communication
    4. El PDF se adjunta automáticamente al email cuando se completa
*/

-- Add new columns to communication_templates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'communication_templates' AND column_name = 'template_type'
  ) THEN
    ALTER TABLE communication_templates ADD COLUMN template_type text DEFAULT 'email' CHECK (template_type IN ('email', 'pdf'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'communication_templates' AND column_name = 'pdf_template_id'
  ) THEN
    ALTER TABLE communication_templates ADD COLUMN pdf_template_id uuid REFERENCES communication_templates(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'communication_templates' AND column_name = 'generates_pdf'
  ) THEN
    ALTER TABLE communication_templates ADD COLUMN generates_pdf boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'communication_templates' AND column_name = 'pdf_filename_pattern'
  ) THEN
    ALTER TABLE communication_templates ADD COLUMN pdf_filename_pattern text;
  END IF;
END $$;

-- Create pdf_generation_logs table
CREATE TABLE IF NOT EXISTS pdf_generation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  pdf_template_id uuid NOT NULL REFERENCES communication_templates(id) ON DELETE CASCADE,
  data jsonb DEFAULT '{}'::jsonb,
  pdf_base64 text NOT NULL,
  filename text NOT NULL,
  size_bytes integer NOT NULL,
  external_reference_id text,
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_pdf_generation_logs_application 
  ON pdf_generation_logs(application_id);

CREATE INDEX IF NOT EXISTS idx_pdf_generation_logs_template 
  ON pdf_generation_logs(pdf_template_id);

CREATE INDEX IF NOT EXISTS idx_pdf_generation_logs_external_ref 
  ON pdf_generation_logs(external_reference_id) 
  WHERE external_reference_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_communication_templates_pdf_template 
  ON communication_templates(pdf_template_id) 
  WHERE pdf_template_id IS NOT NULL;

-- Enable RLS
ALTER TABLE pdf_generation_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Service role has full access
CREATE POLICY "Service role has full access to pdf_generation_logs"
  ON pdf_generation_logs FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Add comment to clarify the relationship
COMMENT ON COLUMN communication_templates.pdf_template_id IS 
  'ID del template de PDF que debe generarse y adjuntarse al email. El template referenciado debe ser de tipo "pdf".';

COMMENT ON COLUMN communication_templates.template_type IS 
  'Tipo de template: "email" para emails HTML, "pdf" para generar PDFs que se adjuntan a emails.';

COMMENT ON COLUMN communication_templates.generates_pdf IS 
  'Si true, este template se usa para generar PDFs que se adjuntan a otros emails.';

COMMENT ON COLUMN communication_templates.pdf_filename_pattern IS 
  'Patrón para el nombre del archivo PDF. Soporta variables como: "invoice_{{invoice_number}}.pdf"';
