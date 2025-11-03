/*
  # Sistema de Menús y Permisos

  ## Nuevas Tablas

  ### 1. menus
  Almacena los menús de la aplicación
  - `id` (uuid, primary key)
  - `name` (text) - Nombre del menú
  - `slug` (text, unique) - Identificador único
  - `description` (text) - Descripción del menú
  - `icon` (text) - Emoji o icono
  - `order` (integer) - Orden de visualización
  - `user_id` (uuid) - Usuario propietario
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 2. roles
  Define los roles de usuario
  - `id` (uuid, primary key)
  - `name` (text, unique) - Nombre del rol (ej: Administrador)
  - `slug` (text, unique) - Identificador del rol
  - `user_id` (uuid) - Usuario propietario
  - `created_at` (timestamptz)

  ### 3. menu_permissions
  Permisos de menús por rol
  - `id` (uuid, primary key)
  - `menu_id` (uuid) - Referencia al menú
  - `role_id` (uuid) - Referencia al rol
  - `can_create` (boolean) - Permiso para crear
  - `can_read` (boolean) - Permiso para ver
  - `can_update` (boolean) - Permiso para actualizar
  - `can_delete` (boolean) - Permiso para eliminar
  - `user_id` (uuid) - Usuario propietario
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ## Seguridad
  - RLS habilitado en todas las tablas
  - Los usuarios solo pueden ver/modificar sus propios datos
*/

-- Tabla de menús
CREATE TABLE IF NOT EXISTS menus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL,
  description text DEFAULT '',
  icon text DEFAULT '',
  "order" integer DEFAULT 0,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, slug)
);

ALTER TABLE menus ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own menus"
  ON menus FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own menus"
  ON menus FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own menus"
  ON menus FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own menus"
  ON menus FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Tabla de roles
CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, slug)
);

ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own roles"
  ON roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own roles"
  ON roles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own roles"
  ON roles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own roles"
  ON roles FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Tabla de permisos de menú por rol
CREATE TABLE IF NOT EXISTS menu_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_id uuid NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  can_create boolean DEFAULT false,
  can_read boolean DEFAULT false,
  can_update boolean DEFAULT false,
  can_delete boolean DEFAULT false,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(menu_id, role_id)
);

ALTER TABLE menu_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own menu permissions"
  ON menu_permissions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own menu permissions"
  ON menu_permissions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own menu permissions"
  ON menu_permissions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own menu permissions"
  ON menu_permissions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_menus_user_id ON menus(user_id);
CREATE INDEX IF NOT EXISTS idx_menus_order ON menus("order");
CREATE INDEX IF NOT EXISTS idx_roles_user_id ON roles(user_id);
CREATE INDEX IF NOT EXISTS idx_menu_permissions_menu_id ON menu_permissions(menu_id);
CREATE INDEX IF NOT EXISTS idx_menu_permissions_role_id ON menu_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_menu_permissions_user_id ON menu_permissions(user_id);

-- Función para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para actualizar updated_at
DROP TRIGGER IF EXISTS update_menus_updated_at ON menus;
CREATE TRIGGER update_menus_updated_at
  BEFORE UPDATE ON menus
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_menu_permissions_updated_at ON menu_permissions;
CREATE TRIGGER update_menu_permissions_updated_at
  BEFORE UPDATE ON menu_permissions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
