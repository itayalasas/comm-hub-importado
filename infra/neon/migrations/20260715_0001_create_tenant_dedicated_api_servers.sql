CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS tenant_dedicated_api_servers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_key text NOT NULL UNIQUE,
  tenant_id text,
  subscription_id text,
  scope_key text NOT NULL,
  tenant_name text NOT NULL,
  subdomain text NOT NULL,
  base_url text NOT NULL,
  public_hostname text NOT NULL,
  status text NOT NULL DEFAULT 'provisioned',
  project jsonb NOT NULL DEFAULT '{}'::jsonb,
  deployment jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenant_dedicated_api_servers_tenant_key_not_blank CHECK (btrim(tenant_key) <> ''),
  CONSTRAINT tenant_dedicated_api_servers_scope_key_not_blank CHECK (btrim(scope_key) <> ''),
  CONSTRAINT tenant_dedicated_api_servers_tenant_name_not_blank CHECK (btrim(tenant_name) <> ''),
  CONSTRAINT tenant_dedicated_api_servers_subdomain_not_blank CHECK (btrim(subdomain) <> ''),
  CONSTRAINT tenant_dedicated_api_servers_base_url_not_blank CHECK (btrim(base_url) <> ''),
  CONSTRAINT tenant_dedicated_api_servers_public_hostname_not_blank CHECK (btrim(public_hostname) <> ''),
  CONSTRAINT tenant_dedicated_api_servers_status_not_blank CHECK (btrim(status) <> '')
);

CREATE INDEX IF NOT EXISTS idx_tenant_dedicated_api_servers_tenant_id
  ON tenant_dedicated_api_servers (tenant_id);

CREATE INDEX IF NOT EXISTS idx_tenant_dedicated_api_servers_subscription_id
  ON tenant_dedicated_api_servers (subscription_id);

CREATE INDEX IF NOT EXISTS idx_tenant_dedicated_api_servers_scope_key
  ON tenant_dedicated_api_servers (scope_key);

CREATE INDEX IF NOT EXISTS idx_tenant_dedicated_api_servers_updated_at
  ON tenant_dedicated_api_servers (updated_at DESC);

CREATE OR REPLACE FUNCTION set_tenant_dedicated_api_servers_updated_at()
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
    WHERE t.tgname = 'trg_tenant_dedicated_api_servers_updated_at'
      AND c.relname = 'tenant_dedicated_api_servers'
  ) THEN
    EXECUTE 'DROP TRIGGER trg_tenant_dedicated_api_servers_updated_at ON tenant_dedicated_api_servers';
  END IF;
END
$$;

CREATE TRIGGER trg_tenant_dedicated_api_servers_updated_at
BEFORE UPDATE ON tenant_dedicated_api_servers
FOR EACH ROW
EXECUTE FUNCTION set_tenant_dedicated_api_servers_updated_at();

COMMENT ON TABLE tenant_dedicated_api_servers IS 'Central registry for tenant dedicated API servers. One row per tenant_key, used to reuse the same dedicated base URL across devices.';
COMMENT ON COLUMN tenant_dedicated_api_servers.tenant_key IS 'Stable lookup key derived from tenant_id, subscription_id, or the current tenant scope.';
COMMENT ON COLUMN tenant_dedicated_api_servers.scope_key IS 'Current tenant scope used by the client cache and as a fallback lookup.';
