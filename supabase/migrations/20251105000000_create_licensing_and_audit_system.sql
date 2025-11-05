/*
  # Sistema de Licenciamiento y Auditoría

  Este sistema permite gestionar licencias por usuario/organización y auditar el uso de recursos.

  ## 1. Nuevas Tablas

  ### `license_plans`
  Define los planes de licencia disponibles en el sistema
  - `id` (uuid, primary key)
  - `name` (text) - Nombre del plan (ej: Free, Professional, Enterprise)
  - `code` (text, unique) - Código único del plan
  - `max_applications` (integer) - Máximo de aplicaciones permitidas
  - `max_templates_per_app` (integer) - Máximo de templates por aplicación
  - `max_emails_per_month` (integer) - Máximo de emails por mes
  - `max_emails_per_day` (integer) - Máximo de emails por día
  - `max_pdfs_per_month` (integer) - Máximo de PDFs por mes
  - `can_use_smtp` (boolean) - Permite configurar SMTP
  - `can_use_resend` (boolean) - Permite usar Resend
  - `can_use_webhooks` (boolean) - Permite configurar webhooks
  - `can_use_custom_variables` (boolean) - Permite variables personalizadas
  - `max_users_per_org` (integer) - Máximo de usuarios por organización
  - `price_monthly` (numeric) - Precio mensual
  - `price_yearly` (numeric) - Precio anual
  - `is_active` (boolean) - Plan activo
  - `features_json` (jsonb) - Características adicionales en JSON
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### `user_licenses`
  Licencias asignadas a usuarios
  - `id` (uuid, primary key)
  - `user_id` (uuid, foreign key → auth.users)
  - `license_plan_id` (uuid, foreign key → license_plans)
  - `status` (text) - active, suspended, expired, cancelled
  - `starts_at` (timestamptz) - Fecha de inicio
  - `expires_at` (timestamptz) - Fecha de expiración
  - `billing_cycle` (text) - monthly, yearly, lifetime
  - `auto_renew` (boolean) - Renovación automática
  - `custom_limits` (jsonb) - Límites personalizados que sobrescriben el plan
  - `notes` (text) - Notas administrativas
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### `email_provider_audit`
  Auditoría de configuraciones de proveedores de email
  - `id` (uuid, primary key)
  - `application_id` (uuid, foreign key → applications)
  - `user_id` (uuid, foreign key → auth.users)
  - `provider_type` (text) - smtp, resend
  - `action` (text) - created, updated, deleted, tested
  - `config_snapshot` (jsonb) - Snapshot de la configuración (sin credenciales)
  - `success` (boolean) - Si la acción fue exitosa
  - `error_message` (text) - Mensaje de error si aplica
  - `ip_address` (text) - IP del usuario
  - `user_agent` (text) - User agent del navegador
  - `created_at` (timestamptz)

  ### `usage_audit`
  Auditoría de uso de recursos por aplicación
  - `id` (uuid, primary key)
  - `application_id` (uuid, foreign key → applications)
  - `user_id` (uuid, foreign key → auth.users)
  - `resource_type` (text) - email, pdf, template, api_call, webhook
  - `action` (text) - created, sent, generated, called, etc.
  - `resource_id` (uuid) - ID del recurso relacionado
  - `metadata` (jsonb) - Metadatos adicionales
  - `cost_units` (integer) - Unidades de costo (para facturación)
  - `success` (boolean) - Si la operación fue exitosa
  - `error_code` (text) - Código de error si aplica
  - `processing_time_ms` (integer) - Tiempo de procesamiento en ms
  - `created_at` (timestamptz)

  ### `application_limits`
  Límites actuales y uso de cada aplicación
  - `id` (uuid, primary key)
  - `application_id` (uuid, foreign key → applications, unique)
  - `user_id` (uuid, foreign key → auth.users)
  - `emails_sent_today` (integer, default 0)
  - `emails_sent_this_month` (integer, default 0)
  - `pdfs_generated_today` (integer, default 0)
  - `pdfs_generated_this_month` (integer, default 0)
  - `templates_count` (integer, default 0)
  - `api_calls_today` (integer, default 0)
  - `api_calls_this_month` (integer, default 0)
  - `last_reset_daily` (date)
  - `last_reset_monthly` (date)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### `license_audit`
  Auditoría de cambios en licencias
  - `id` (uuid, primary key)
  - `user_license_id` (uuid, foreign key → user_licenses)
  - `user_id` (uuid, foreign key → auth.users)
  - `action` (text) - created, updated, suspended, activated, expired, renewed
  - `previous_status` (text)
  - `new_status` (text)
  - `previous_plan_id` (uuid)
  - `new_plan_id` (uuid)
  - `reason` (text)
  - `performed_by` (uuid) - Usuario que realizó la acción
  - `created_at` (timestamptz)

  ## 2. Seguridad
  - RLS habilitado en todas las tablas
  - Políticas restrictivas basadas en user_id y application_id
  - Solo administradores pueden ver/modificar licencias

  ## 3. Índices
  - Índices en columnas de búsqueda frecuente
  - Índices compuestos para consultas de uso
  - Índices en timestamps para reportes

  ## 4. Funciones Auxiliares
  - Función para verificar límites de licencia
  - Función para resetear contadores diarios/mensuales
  - Función para incrementar uso automáticamente
*/

-- =============================================
-- 1. TABLA: license_plans
-- =============================================
CREATE TABLE IF NOT EXISTS license_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE NOT NULL,
  max_applications integer NOT NULL DEFAULT 1,
  max_templates_per_app integer NOT NULL DEFAULT 10,
  max_emails_per_month integer NOT NULL DEFAULT 1000,
  max_emails_per_day integer NOT NULL DEFAULT 50,
  max_pdfs_per_month integer NOT NULL DEFAULT 100,
  can_use_smtp boolean DEFAULT true,
  can_use_resend boolean DEFAULT false,
  can_use_webhooks boolean DEFAULT false,
  can_use_custom_variables boolean DEFAULT true,
  max_users_per_org integer DEFAULT 1,
  price_monthly numeric(10, 2) DEFAULT 0,
  price_yearly numeric(10, 2) DEFAULT 0,
  is_active boolean DEFAULT true,
  features_json jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- =============================================
-- 2. TABLA: user_licenses
-- =============================================
CREATE TABLE IF NOT EXISTS user_licenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  license_plan_id uuid NOT NULL REFERENCES license_plans(id),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'expired', 'cancelled')),
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  billing_cycle text DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'yearly', 'lifetime')),
  auto_renew boolean DEFAULT false,
  custom_limits jsonb DEFAULT '{}',
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- =============================================
-- 3. TABLA: email_provider_audit
-- =============================================
CREATE TABLE IF NOT EXISTS email_provider_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_type text NOT NULL CHECK (provider_type IN ('smtp', 'resend')),
  action text NOT NULL CHECK (action IN ('created', 'updated', 'deleted', 'tested')),
  config_snapshot jsonb DEFAULT '{}',
  success boolean DEFAULT true,
  error_message text,
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

-- =============================================
-- 4. TABLA: usage_audit
-- =============================================
CREATE TABLE IF NOT EXISTS usage_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  resource_type text NOT NULL CHECK (resource_type IN ('email', 'pdf', 'template', 'api_call', 'webhook')),
  action text NOT NULL,
  resource_id uuid,
  metadata jsonb DEFAULT '{}',
  cost_units integer DEFAULT 1,
  success boolean DEFAULT true,
  error_code text,
  processing_time_ms integer,
  created_at timestamptz DEFAULT now()
);

-- =============================================
-- 5. TABLA: application_limits
-- =============================================
CREATE TABLE IF NOT EXISTS application_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid UNIQUE NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emails_sent_today integer DEFAULT 0,
  emails_sent_this_month integer DEFAULT 0,
  pdfs_generated_today integer DEFAULT 0,
  pdfs_generated_this_month integer DEFAULT 0,
  templates_count integer DEFAULT 0,
  api_calls_today integer DEFAULT 0,
  api_calls_this_month integer DEFAULT 0,
  last_reset_daily date DEFAULT CURRENT_DATE,
  last_reset_monthly date DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- =============================================
-- 6. TABLA: license_audit
-- =============================================
CREATE TABLE IF NOT EXISTS license_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_license_id uuid NOT NULL REFERENCES user_licenses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('created', 'updated', 'suspended', 'activated', 'expired', 'renewed')),
  previous_status text,
  new_status text,
  previous_plan_id uuid REFERENCES license_plans(id),
  new_plan_id uuid REFERENCES license_plans(id),
  reason text,
  performed_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

-- =============================================
-- 7. ÍNDICES PARA OPTIMIZACIÓN
-- =============================================

-- Índices en license_plans
CREATE INDEX IF NOT EXISTS idx_license_plans_code ON license_plans(code);
CREATE INDEX IF NOT EXISTS idx_license_plans_active ON license_plans(is_active);

-- Índices en user_licenses
CREATE INDEX IF NOT EXISTS idx_user_licenses_user_id ON user_licenses(user_id);
CREATE INDEX IF NOT EXISTS idx_user_licenses_status ON user_licenses(status);
CREATE INDEX IF NOT EXISTS idx_user_licenses_expires ON user_licenses(expires_at);

-- Índices en email_provider_audit
CREATE INDEX IF NOT EXISTS idx_email_provider_audit_app ON email_provider_audit(application_id);
CREATE INDEX IF NOT EXISTS idx_email_provider_audit_user ON email_provider_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_email_provider_audit_created ON email_provider_audit(created_at DESC);

-- Índices en usage_audit
CREATE INDEX IF NOT EXISTS idx_usage_audit_app ON usage_audit(application_id);
CREATE INDEX IF NOT EXISTS idx_usage_audit_user ON usage_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_audit_type ON usage_audit(resource_type);
CREATE INDEX IF NOT EXISTS idx_usage_audit_created ON usage_audit(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_audit_app_type_created ON usage_audit(application_id, resource_type, created_at DESC);

-- Índices en application_limits
CREATE INDEX IF NOT EXISTS idx_application_limits_app ON application_limits(application_id);
CREATE INDEX IF NOT EXISTS idx_application_limits_user ON application_limits(user_id);

-- Índices en license_audit
CREATE INDEX IF NOT EXISTS idx_license_audit_license ON license_audit(user_license_id);
CREATE INDEX IF NOT EXISTS idx_license_audit_user ON license_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_license_audit_created ON license_audit(created_at DESC);

-- =============================================
-- 8. ROW LEVEL SECURITY (RLS)
-- =============================================

-- Habilitar RLS en todas las tablas
ALTER TABLE license_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_provider_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE license_audit ENABLE ROW LEVEL SECURITY;

-- Políticas para license_plans (todos pueden leer planes activos)
CREATE POLICY "Anyone can view active license plans"
  ON license_plans FOR SELECT
  USING (is_active = true);

-- Políticas para user_licenses
CREATE POLICY "Users can view own licenses"
  ON user_licenses FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own licenses"
  ON user_licenses FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own licenses"
  ON user_licenses FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Políticas para email_provider_audit
CREATE POLICY "Users can view own provider audit"
  ON email_provider_audit FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own provider audit"
  ON email_provider_audit FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Políticas para usage_audit
CREATE POLICY "Users can view own usage audit"
  ON usage_audit FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own usage audit"
  ON usage_audit FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Políticas para application_limits
CREATE POLICY "Users can view own application limits"
  ON application_limits FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own application limits"
  ON application_limits FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own application limits"
  ON application_limits FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Políticas para license_audit
CREATE POLICY "Users can view own license audit"
  ON license_audit FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own license audit"
  ON license_audit FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- =============================================
-- 9. FUNCIONES AUXILIARES
-- =============================================

-- Función para verificar límites de licencia
CREATE OR REPLACE FUNCTION check_license_limit(
  p_user_id uuid,
  p_application_id uuid,
  p_resource_type text
) RETURNS boolean AS $$
DECLARE
  v_license record;
  v_limits record;
  v_plan record;
BEGIN
  -- Obtener licencia activa del usuario
  SELECT ul.*, lp.*
  INTO v_license
  FROM user_licenses ul
  JOIN license_plans lp ON ul.license_plan_id = lp.id
  WHERE ul.user_id = p_user_id
    AND ul.status = 'active'
    AND (ul.expires_at IS NULL OR ul.expires_at > now())
  ORDER BY ul.created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Obtener límites de uso de la aplicación
  SELECT * INTO v_limits
  FROM application_limits
  WHERE application_id = p_application_id;

  IF NOT FOUND THEN
    RETURN true;
  END IF;

  -- Verificar límites según el tipo de recurso
  CASE p_resource_type
    WHEN 'email' THEN
      IF v_limits.emails_sent_today >= v_license.max_emails_per_day THEN
        RETURN false;
      END IF;
      IF v_limits.emails_sent_this_month >= v_license.max_emails_per_month THEN
        RETURN false;
      END IF;
    WHEN 'pdf' THEN
      IF v_limits.pdfs_generated_this_month >= v_license.max_pdfs_per_month THEN
        RETURN false;
      END IF;
    WHEN 'template' THEN
      IF v_limits.templates_count >= v_license.max_templates_per_app THEN
        RETURN false;
      END IF;
  END CASE;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para incrementar uso de recursos
CREATE OR REPLACE FUNCTION increment_resource_usage(
  p_application_id uuid,
  p_user_id uuid,
  p_resource_type text
) RETURNS void AS $$
DECLARE
  v_today date := CURRENT_DATE;
BEGIN
  -- Insertar o actualizar límites de aplicación
  INSERT INTO application_limits (
    application_id,
    user_id,
    emails_sent_today,
    emails_sent_this_month,
    pdfs_generated_today,
    pdfs_generated_this_month,
    api_calls_today,
    api_calls_this_month,
    last_reset_daily,
    last_reset_monthly
  ) VALUES (
    p_application_id,
    p_user_id,
    CASE WHEN p_resource_type = 'email' THEN 1 ELSE 0 END,
    CASE WHEN p_resource_type = 'email' THEN 1 ELSE 0 END,
    CASE WHEN p_resource_type = 'pdf' THEN 1 ELSE 0 END,
    CASE WHEN p_resource_type = 'pdf' THEN 1 ELSE 0 END,
    CASE WHEN p_resource_type = 'api_call' THEN 1 ELSE 0 END,
    CASE WHEN p_resource_type = 'api_call' THEN 1 ELSE 0 END,
    v_today,
    v_today
  )
  ON CONFLICT (application_id) DO UPDATE SET
    -- Resetear contadores diarios si cambió el día
    emails_sent_today = CASE
      WHEN application_limits.last_reset_daily < v_today THEN
        CASE WHEN p_resource_type = 'email' THEN 1 ELSE 0 END
      ELSE
        application_limits.emails_sent_today + CASE WHEN p_resource_type = 'email' THEN 1 ELSE 0 END
    END,
    pdfs_generated_today = CASE
      WHEN application_limits.last_reset_daily < v_today THEN
        CASE WHEN p_resource_type = 'pdf' THEN 1 ELSE 0 END
      ELSE
        application_limits.pdfs_generated_today + CASE WHEN p_resource_type = 'pdf' THEN 1 ELSE 0 END
    END,
    api_calls_today = CASE
      WHEN application_limits.last_reset_daily < v_today THEN
        CASE WHEN p_resource_type = 'api_call' THEN 1 ELSE 0 END
      ELSE
        application_limits.api_calls_today + CASE WHEN p_resource_type = 'api_call' THEN 1 ELSE 0 END
    END,
    -- Resetear contadores mensuales si cambió el mes
    emails_sent_this_month = CASE
      WHEN date_trunc('month', application_limits.last_reset_monthly) < date_trunc('month', v_today) THEN
        CASE WHEN p_resource_type = 'email' THEN 1 ELSE 0 END
      ELSE
        application_limits.emails_sent_this_month + CASE WHEN p_resource_type = 'email' THEN 1 ELSE 0 END
    END,
    pdfs_generated_this_month = CASE
      WHEN date_trunc('month', application_limits.last_reset_monthly) < date_trunc('month', v_today) THEN
        CASE WHEN p_resource_type = 'pdf' THEN 1 ELSE 0 END
      ELSE
        application_limits.pdfs_generated_this_month + CASE WHEN p_resource_type = 'pdf' THEN 1 ELSE 0 END
    END,
    api_calls_this_month = CASE
      WHEN date_trunc('month', application_limits.last_reset_monthly) < date_trunc('month', v_today) THEN
        CASE WHEN p_resource_type = 'api_call' THEN 1 ELSE 0 END
      ELSE
        application_limits.api_calls_this_month + CASE WHEN p_resource_type = 'api_call' THEN 1 ELSE 0 END
    END,
    last_reset_daily = v_today,
    last_reset_monthly = CASE
      WHEN date_trunc('month', application_limits.last_reset_monthly) < date_trunc('month', v_today) THEN v_today
      ELSE application_limits.last_reset_monthly
    END,
    updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 10. PLANES DE LICENCIA POR DEFECTO
-- =============================================

INSERT INTO license_plans (
  name,
  code,
  max_applications,
  max_templates_per_app,
  max_emails_per_month,
  max_emails_per_day,
  max_pdfs_per_month,
  can_use_smtp,
  can_use_resend,
  can_use_webhooks,
  can_use_custom_variables,
  max_users_per_org,
  price_monthly,
  price_yearly,
  is_active,
  features_json
) VALUES
  -- Plan Free
  (
    'Free',
    'FREE',
    1,
    5,
    500,
    25,
    50,
    true,
    false,
    false,
    false,
    1,
    0,
    0,
    true,
    '{"support": "community", "analytics": false}'::jsonb
  ),
  -- Plan Professional
  (
    'Professional',
    'PRO',
    3,
    50,
    10000,
    500,
    1000,
    true,
    true,
    true,
    true,
    5,
    29.99,
    299.99,
    true,
    '{"support": "email", "analytics": true, "custom_domain": true}'::jsonb
  ),
  -- Plan Enterprise
  (
    'Enterprise',
    'ENTERPRISE',
    999999,
    999999,
    999999,
    999999,
    999999,
    true,
    true,
    true,
    true,
    999999,
    99.99,
    999.99,
    true,
    '{"support": "priority", "analytics": true, "custom_domain": true, "dedicated_support": true, "sla": true}'::jsonb
  )
ON CONFLICT (code) DO NOTHING;

-- =============================================
-- 11. TRIGGER PARA AUDITORÍA DE LICENCIAS
-- =============================================

CREATE OR REPLACE FUNCTION log_license_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO license_audit (
      user_license_id,
      user_id,
      action,
      new_status,
      new_plan_id,
      performed_by
    ) VALUES (
      NEW.id,
      NEW.user_id,
      'created',
      NEW.status,
      NEW.license_plan_id,
      auth.uid()
    );
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status != NEW.status OR OLD.license_plan_id != NEW.license_plan_id THEN
      INSERT INTO license_audit (
        user_license_id,
        user_id,
        action,
        previous_status,
        new_status,
        previous_plan_id,
        new_plan_id,
        performed_by
      ) VALUES (
        NEW.id,
        NEW.user_id,
        'updated',
        OLD.status,
        NEW.status,
        OLD.license_plan_id,
        NEW.license_plan_id,
        auth.uid()
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_license_audit
  AFTER INSERT OR UPDATE ON user_licenses
  FOR EACH ROW
  EXECUTE FUNCTION log_license_change();

-- =============================================
-- 12. ASIGNAR LICENCIA FREE A USUARIOS EXISTENTES
-- =============================================

DO $$
DECLARE
  v_free_plan_id uuid;
BEGIN
  -- Obtener el ID del plan Free
  SELECT id INTO v_free_plan_id
  FROM license_plans
  WHERE code = 'FREE'
  LIMIT 1;

  -- Asignar licencia Free a todos los usuarios que no tienen licencia
  INSERT INTO user_licenses (user_id, license_plan_id, status, billing_cycle)
  SELECT
    id,
    v_free_plan_id,
    'active',
    'lifetime'
  FROM auth.users
  WHERE id NOT IN (SELECT user_id FROM user_licenses WHERE status = 'active')
  ON CONFLICT DO NOTHING;
END $$;
