/*
  # Eliminar todas las dependencias de auth.users

  Este proyecto usa autenticación externa (no Supabase Auth).
  auth.uid() siempre retorna NULL con auth externo, por lo que:
  - Las FK a auth.users(id) impiden insertar datos reales
  - Las políticas RLS con auth.uid() bloquean todo acceso

  ## Cambios realizados

  ### 1. Eliminar FK constraints a auth.users
  - user_licenses.user_id
  - email_provider_audit.user_id
  - usage_audit.user_id
  - application_limits.user_id
  - license_audit.user_id
  - license_audit.performed_by
  - menus.user_id
  - roles.user_id
  - menu_permissions.user_id

  ### 2. Eliminar políticas RLS que usan auth.uid()
  Tablas afectadas: menus, roles, menu_permissions,
  user_licenses, email_provider_audit, usage_audit,
  application_limits, license_audit

  ### 3. Deshabilitar RLS en las tablas afectadas
  El acceso se controla desde la capa de aplicación
  usando el auth externo, no desde RLS de Supabase.

  ### 4. Actualizar trigger log_license_change
  Reemplaza auth.uid() con NULL en performed_by
  ya que no hay sesión Supabase activa.

  ### Notas
  - Las columnas user_id se mantienen, solo se quitan las FK
  - Los datos existentes no se modifican
  - license_plans mantiene su política de lectura pública (no usa auth.uid())
*/

-- =============================================
-- 1. ELIMINAR FK CONSTRAINTS a auth.users
-- =============================================

-- user_licenses
ALTER TABLE user_licenses
  DROP CONSTRAINT IF EXISTS user_licenses_user_id_fkey;

-- email_provider_audit
ALTER TABLE email_provider_audit
  DROP CONSTRAINT IF EXISTS email_provider_audit_user_id_fkey;

-- usage_audit
ALTER TABLE usage_audit
  DROP CONSTRAINT IF EXISTS usage_audit_user_id_fkey;

-- application_limits
ALTER TABLE application_limits
  DROP CONSTRAINT IF EXISTS application_limits_user_id_fkey;

-- license_audit (dos FK: user_id y performed_by)
ALTER TABLE license_audit
  DROP CONSTRAINT IF EXISTS license_audit_user_id_fkey;

ALTER TABLE license_audit
  DROP CONSTRAINT IF EXISTS license_audit_performed_by_fkey;

-- menus
ALTER TABLE menus
  DROP CONSTRAINT IF EXISTS menus_user_id_fkey;

-- roles
ALTER TABLE roles
  DROP CONSTRAINT IF EXISTS roles_user_id_fkey;

-- menu_permissions
ALTER TABLE menu_permissions
  DROP CONSTRAINT IF EXISTS menu_permissions_user_id_fkey;

-- =============================================
-- 2. ELIMINAR POLÍTICAS RLS CON auth.uid()
-- =============================================

-- menus
DROP POLICY IF EXISTS "Users can view own menus" ON menus;
DROP POLICY IF EXISTS "Users can create own menus" ON menus;
DROP POLICY IF EXISTS "Users can update own menus" ON menus;
DROP POLICY IF EXISTS "Users can delete own menus" ON menus;

-- roles
DROP POLICY IF EXISTS "Users can view own roles" ON roles;
DROP POLICY IF EXISTS "Users can create own roles" ON roles;
DROP POLICY IF EXISTS "Users can update own roles" ON roles;
DROP POLICY IF EXISTS "Users can delete own roles" ON roles;

-- menu_permissions
DROP POLICY IF EXISTS "Users can view own menu permissions" ON menu_permissions;
DROP POLICY IF EXISTS "Users can create own menu permissions" ON menu_permissions;
DROP POLICY IF EXISTS "Users can update own menu permissions" ON menu_permissions;
DROP POLICY IF EXISTS "Users can delete own menu permissions" ON menu_permissions;

-- user_licenses
DROP POLICY IF EXISTS "Users can view own licenses" ON user_licenses;
DROP POLICY IF EXISTS "Users can insert own licenses" ON user_licenses;
DROP POLICY IF EXISTS "Users can update own licenses" ON user_licenses;

-- email_provider_audit
DROP POLICY IF EXISTS "Users can view own provider audit" ON email_provider_audit;
DROP POLICY IF EXISTS "Users can insert own provider audit" ON email_provider_audit;

-- usage_audit
DROP POLICY IF EXISTS "Users can view own usage audit" ON usage_audit;
DROP POLICY IF EXISTS "Users can insert own usage audit" ON usage_audit;

-- application_limits
DROP POLICY IF EXISTS "Users can view own application limits" ON application_limits;
DROP POLICY IF EXISTS "Users can insert own application limits" ON application_limits;
DROP POLICY IF EXISTS "Users can update own application limits" ON application_limits;

-- license_audit
DROP POLICY IF EXISTS "Users can view own license audit" ON license_audit;
DROP POLICY IF EXISTS "Users can insert own license audit" ON license_audit;

-- =============================================
-- 3. DESHABILITAR RLS EN TABLAS AFECTADAS
-- =============================================

ALTER TABLE menus DISABLE ROW LEVEL SECURITY;
ALTER TABLE roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE menu_permissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_licenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE email_provider_audit DISABLE ROW LEVEL SECURITY;
ALTER TABLE usage_audit DISABLE ROW LEVEL SECURITY;
ALTER TABLE application_limits DISABLE ROW LEVEL SECURITY;
ALTER TABLE license_audit DISABLE ROW LEVEL SECURITY;

-- =============================================
-- 4. ACTUALIZAR TRIGGER DE AUDITORÍA
-- Reemplaza auth.uid() con NULL (no hay sesión Supabase)
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
      NULL
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
        NULL
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
