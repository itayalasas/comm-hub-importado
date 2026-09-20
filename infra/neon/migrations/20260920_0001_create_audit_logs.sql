CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  application_id uuid,
  actor_user_id text,
  actor_email text,
  actor_name text,
  action text NOT NULL CHECK (btrim(action) <> ''),
  entity_type text NOT NULL,
  entity_id text,
  entity_label text,
  ip_address text,
  user_agent text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id
  ON audit_logs (tenant_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
  ON audit_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action
  ON audit_logs (action);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type
  ON audit_logs (entity_type);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_email
  ON audit_logs (actor_email);

COMMENT ON TABLE audit_logs IS 'Unified audit trail for the audit_logs plan feature: security events (login/logout/impersonation) mirrored from the auth service, plus business-data create/update/delete events, scoped by tenant_id.';
COMMENT ON COLUMN audit_logs.action IS 'login | logout | create | update | delete | impersonation_start | impersonation_end';
COMMENT ON COLUMN audit_logs.entity_type IS 'session | account_access | application | template | whatsapp_template | email_credentials | embed_credential | whatsapp_config | automation_program';
COMMENT ON COLUMN audit_logs.tenant_id IS 'For impersonation_start/impersonation_end rows, this is the TARGET tenant (the customer being accessed), not the admin, so the customer can see the access in their own audit trail.';
