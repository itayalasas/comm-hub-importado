CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS tenant_webchat_widget_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_key text NOT NULL UNIQUE,
  tenant_id text,
  subscription_id text,
  scope_key text NOT NULL,
  tenant_name text NOT NULL,
  subdomain text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  ai_enabled boolean NOT NULL DEFAULT true,
  handoff_enabled boolean NOT NULL DEFAULT true,
  crm_url text,
  support_email text,
  widget_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'active',
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenant_webchat_widget_configs_tenant_key_not_blank CHECK (btrim(tenant_key) <> ''),
  CONSTRAINT tenant_webchat_widget_configs_scope_key_not_blank CHECK (btrim(scope_key) <> ''),
  CONSTRAINT tenant_webchat_widget_configs_tenant_name_not_blank CHECK (btrim(tenant_name) <> ''),
  CONSTRAINT tenant_webchat_widget_configs_subdomain_not_blank CHECK (btrim(subdomain) <> ''),
  CONSTRAINT tenant_webchat_widget_configs_status_not_blank CHECK (btrim(status) <> '')
);

CREATE INDEX IF NOT EXISTS idx_tenant_webchat_widget_configs_tenant_id
  ON tenant_webchat_widget_configs (tenant_id);

CREATE INDEX IF NOT EXISTS idx_tenant_webchat_widget_configs_subscription_id
  ON tenant_webchat_widget_configs (subscription_id);

CREATE INDEX IF NOT EXISTS idx_tenant_webchat_widget_configs_scope_key
  ON tenant_webchat_widget_configs (scope_key);

CREATE INDEX IF NOT EXISTS idx_tenant_webchat_widget_configs_updated_at
  ON tenant_webchat_widget_configs (updated_at DESC);

CREATE OR REPLACE FUNCTION set_tenant_webchat_widget_configs_updated_at()
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
    WHERE t.tgname = 'trg_tenant_webchat_widget_configs_updated_at'
      AND c.relname = 'tenant_webchat_widget_configs'
  ) THEN
    EXECUTE 'DROP TRIGGER trg_tenant_webchat_widget_configs_updated_at ON tenant_webchat_widget_configs';
  END IF;
END
$$;

CREATE TRIGGER trg_tenant_webchat_widget_configs_updated_at
BEFORE UPDATE ON tenant_webchat_widget_configs
FOR EACH ROW
EXECUTE FUNCTION set_tenant_webchat_widget_configs_updated_at();

COMMENT ON TABLE tenant_webchat_widget_configs IS 'Central registry for tenant webchat widget configuration and CRM handoff settings.';
COMMENT ON COLUMN tenant_webchat_widget_configs.tenant_key IS 'Stable lookup key derived from tenant_id, subscription_id, or the current tenant scope.';
COMMENT ON COLUMN tenant_webchat_widget_configs.scope_key IS 'Current tenant scope used by the CRM and as a fallback lookup.';
