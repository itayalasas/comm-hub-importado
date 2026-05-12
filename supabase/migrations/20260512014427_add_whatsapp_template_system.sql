/*
  # WhatsApp Template System

  ## Summary
  Adds full WhatsApp Cloud API (Meta) support for managing and sending
  approved Utility Templates via WhatsApp Business.

  ## New Tables

  ### whatsapp_configs
  Stores per-application Meta/WhatsApp Business API credentials:
  - phone_number_id: The WhatsApp Business phone number ID from Meta
  - waba_id: WhatsApp Business Account ID
  - access_token: Meta permanent/system-user access token
  - is_active: Whether this config is currently enabled

  ### whatsapp_templates
  WhatsApp-specific template metadata aligned with Meta's template structure.
  Each row references a communication_templates row (channel = 'whatsapp').
  - meta_template_name: Exact name registered with Meta (snake_case, lowercase)
  - meta_template_id: Template ID returned by Meta after submission
  - language_code: e.g. "es", "es_AR", "en_US"
  - category: UTILITY | MARKETING | AUTHENTICATION
  - status: PENDING | APPROVED | REJECTED | PAUSED | DRAFT
  - components: JSONB array of Meta component objects (HEADER, BODY, FOOTER, BUTTONS)
  - rejection_reason: Populated when Meta rejects the template
  - submitted_at / approved_at: Lifecycle timestamps

  ### whatsapp_logs
  Tracks every WhatsApp message send attempt.
  - wamid: WhatsApp message ID returned by Meta API
  - recipient_phone: Destination phone number (E.164 format)
  - status: queued | sent | delivered | read | failed
  - error_code / error_message: From Meta webhook callbacks
  - template_variables: JSONB of variable values used in the send

  ## Modified Tables
  - communication_templates: channel and template_type CHECK constraints
    extended to include 'whatsapp'

  ## Security
  - RLS enabled on all new tables
  - Policies restrict to users who own the application
    (applications.user_id = auth.uid()::text OR tenant match)
*/

-- Extend channel constraint on communication_templates to allow 'whatsapp'
DO $$
BEGIN
  ALTER TABLE communication_templates DROP CONSTRAINT IF EXISTS communication_templates_channel_check;
  ALTER TABLE communication_templates
    ADD CONSTRAINT communication_templates_channel_check
    CHECK (channel IN ('email', 'sms', 'push', 'whatsapp'));
EXCEPTION WHEN others THEN
  NULL;
END $$;

-- Extend template_type constraint to include 'whatsapp'
DO $$
BEGIN
  ALTER TABLE communication_templates DROP CONSTRAINT IF EXISTS communication_templates_template_type_check;
  ALTER TABLE communication_templates
    ADD CONSTRAINT communication_templates_template_type_check
    CHECK (template_type IN ('email', 'pdf', 'whatsapp'));
EXCEPTION WHEN others THEN
  NULL;
END $$;

-- ── whatsapp_configs ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS whatsapp_configs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id      uuid NOT NULL,
  phone_number_id     text NOT NULL,
  waba_id             text NOT NULL DEFAULT '',
  access_token        text NOT NULL,
  display_name        text NOT NULL DEFAULT '',
  is_active           boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (application_id)
);

ALTER TABLE whatsapp_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own whatsapp_configs"
  ON whatsapp_configs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM applications a
      WHERE a.id = whatsapp_configs.application_id
        AND (
          a.user_id = auth.uid()::text
          OR (a.tenant_id IS NOT NULL AND a.tenant_id IN (
            SELECT tenant_id FROM applications
            WHERE user_id = auth.uid()::text AND tenant_id IS NOT NULL
          ))
        )
    )
  );

CREATE POLICY "Users can insert own whatsapp_configs"
  ON whatsapp_configs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM applications a
      WHERE a.id = whatsapp_configs.application_id
        AND (
          a.user_id = auth.uid()::text
          OR (a.tenant_id IS NOT NULL AND a.tenant_id IN (
            SELECT tenant_id FROM applications
            WHERE user_id = auth.uid()::text AND tenant_id IS NOT NULL
          ))
        )
    )
  );

CREATE POLICY "Users can update own whatsapp_configs"
  ON whatsapp_configs FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM applications a
      WHERE a.id = whatsapp_configs.application_id
        AND a.user_id = auth.uid()::text
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM applications a
      WHERE a.id = whatsapp_configs.application_id
        AND a.user_id = auth.uid()::text
    )
  );

CREATE POLICY "Users can delete own whatsapp_configs"
  ON whatsapp_configs FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM applications a
      WHERE a.id = whatsapp_configs.application_id
        AND a.user_id = auth.uid()::text
    )
  );

-- ── whatsapp_templates ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS whatsapp_templates (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id      uuid NOT NULL,
  template_id         uuid,
  meta_template_name  text NOT NULL,
  meta_template_id    text,
  language_code       text NOT NULL DEFAULT 'es',
  category            text NOT NULL DEFAULT 'UTILITY'
                        CHECK (category IN ('UTILITY', 'MARKETING', 'AUTHENTICATION')),
  status              text NOT NULL DEFAULT 'DRAFT'
                        CHECK (status IN ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'PAUSED')),
  components          jsonb NOT NULL DEFAULT '[]'::jsonb,
  rejection_reason    text,
  submitted_at        timestamptz,
  approved_at         timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE whatsapp_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own whatsapp_templates"
  ON whatsapp_templates FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM applications a
      WHERE a.id = whatsapp_templates.application_id
        AND (
          a.user_id = auth.uid()::text
          OR (a.tenant_id IS NOT NULL AND a.tenant_id IN (
            SELECT tenant_id FROM applications
            WHERE user_id = auth.uid()::text AND tenant_id IS NOT NULL
          ))
        )
    )
  );

CREATE POLICY "Users can insert own whatsapp_templates"
  ON whatsapp_templates FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM applications a
      WHERE a.id = whatsapp_templates.application_id
        AND a.user_id = auth.uid()::text
    )
  );

CREATE POLICY "Users can update own whatsapp_templates"
  ON whatsapp_templates FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM applications a
      WHERE a.id = whatsapp_templates.application_id
        AND a.user_id = auth.uid()::text
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM applications a
      WHERE a.id = whatsapp_templates.application_id
        AND a.user_id = auth.uid()::text
    )
  );

CREATE POLICY "Users can delete own whatsapp_templates"
  ON whatsapp_templates FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM applications a
      WHERE a.id = whatsapp_templates.application_id
        AND a.user_id = auth.uid()::text
    )
  );

-- ── whatsapp_logs ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS whatsapp_logs (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id        uuid NOT NULL,
  whatsapp_template_id  uuid,
  wamid                 text,
  recipient_phone       text NOT NULL,
  status                text NOT NULL DEFAULT 'queued'
                          CHECK (status IN ('queued', 'sent', 'delivered', 'read', 'failed')),
  error_code            text,
  error_message         text,
  template_variables    jsonb DEFAULT '{}'::jsonb,
  external_reference_id text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE whatsapp_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own whatsapp_logs"
  ON whatsapp_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM applications a
      WHERE a.id = whatsapp_logs.application_id
        AND (
          a.user_id = auth.uid()::text
          OR (a.tenant_id IS NOT NULL AND a.tenant_id IN (
            SELECT tenant_id FROM applications
            WHERE user_id = auth.uid()::text AND tenant_id IS NOT NULL
          ))
        )
    )
  );

CREATE POLICY "Users can insert own whatsapp_logs"
  ON whatsapp_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM applications a
      WHERE a.id = whatsapp_logs.application_id
        AND a.user_id = auth.uid()::text
    )
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_app_id ON whatsapp_templates(application_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_status ON whatsapp_templates(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_app_id ON whatsapp_logs(application_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_status ON whatsapp_logs(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_wamid ON whatsapp_logs(wamid);
