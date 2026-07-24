CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS tenant_webchat_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_key text NOT NULL,
  tenant_id text,
  subscription_id text,
  scope_key text NOT NULL,
  session_id text NOT NULL,
  conversation_id text NOT NULL UNIQUE,
  source_domain text NOT NULL,
  page_url text,
  visitor_name text,
  visitor_email text,
  visitor_phone text,
  status text NOT NULL DEFAULT 'open',
  assigned_user_id text,
  assigned_user_name text,
  assigned_at timestamptz,
  closed_at timestamptz,
  last_message_at timestamptz,
  last_user_message text,
  last_ai_reply text,
  handoff_requested boolean NOT NULL DEFAULT false,
  handoff_reason text,
  cause text,
  cause_custom text,
  result text,
  result_notes text,
  source_channel text,
  source_detail text,
  client_id text,
  opportunity_id text,
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  queued_messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenant_webchat_conversations_tenant_key_not_blank CHECK (btrim(tenant_key) <> ''),
  CONSTRAINT tenant_webchat_conversations_scope_key_not_blank CHECK (btrim(scope_key) <> ''),
  CONSTRAINT tenant_webchat_conversations_session_id_not_blank CHECK (btrim(session_id) <> ''),
  CONSTRAINT tenant_webchat_conversations_conversation_id_not_blank CHECK (btrim(conversation_id) <> ''),
  CONSTRAINT tenant_webchat_conversations_source_domain_not_blank CHECK (btrim(source_domain) <> ''),
  CONSTRAINT tenant_webchat_conversations_status_not_blank CHECK (btrim(status) <> '')
);

CREATE INDEX IF NOT EXISTS idx_tenant_webchat_conversations_tenant_id
  ON tenant_webchat_conversations (tenant_id);

CREATE INDEX IF NOT EXISTS idx_tenant_webchat_conversations_subscription_id
  ON tenant_webchat_conversations (subscription_id);

CREATE INDEX IF NOT EXISTS idx_tenant_webchat_conversations_scope_key
  ON tenant_webchat_conversations (scope_key);

CREATE INDEX IF NOT EXISTS idx_tenant_webchat_conversations_session_id
  ON tenant_webchat_conversations (session_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_webchat_conversations_tenant_session
  ON tenant_webchat_conversations (tenant_key, session_id);

CREATE INDEX IF NOT EXISTS idx_tenant_webchat_conversations_status
  ON tenant_webchat_conversations (status);

CREATE INDEX IF NOT EXISTS idx_tenant_webchat_conversations_updated_at
  ON tenant_webchat_conversations (updated_at DESC);

CREATE OR REPLACE FUNCTION set_tenant_webchat_conversations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE t.tgname = 'trg_tenant_webchat_conversations_updated_at'
      AND c.relname = 'tenant_webchat_conversations'
  ) THEN
    EXECUTE 'DROP TRIGGER trg_tenant_webchat_conversations_updated_at ON tenant_webchat_conversations';
  END IF;
END
$$;

CREATE TRIGGER trg_tenant_webchat_conversations_updated_at
BEFORE UPDATE ON tenant_webchat_conversations
FOR EACH ROW
EXECUTE FUNCTION set_tenant_webchat_conversations_updated_at();

COMMENT ON TABLE tenant_webchat_conversations IS 'Central registry for tenant webchat conversations, AI replies, and CRM handoff state.';
COMMENT ON COLUMN tenant_webchat_conversations.tenant_key IS 'Stable lookup key derived from tenant_id, subscription_id, or the current tenant scope.';
COMMENT ON COLUMN tenant_webchat_conversations.scope_key IS 'Current tenant scope used by the CRM and as a fallback lookup.';
