-- Columnas e índices que usa el aislamiento por tenant de la función `query`
-- (apis-functions/query/tenant-scope.ts). Es idempotente: si la columna o el
-- índice ya existen no cambia nada, y omite las tablas que no existan.
--
-- Si una tabla no tenía `application_id`, la columna se crea vacía. Esas filas
-- no serán visibles para los usuarios hasta que se complete el valor.

DO $$
DECLARE
  app_id_type text;
  scoped_table text;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod)
    INTO app_id_type
    FROM pg_attribute a
   WHERE a.attrelid = 'applications'::regclass
     AND a.attname = 'id'
     AND NOT a.attisdropped;

  FOREACH scoped_table IN ARRAY ARRAY[
    'api_keys',
    'branding_configs',
    'email_credentials',
    'communication_templates',
    'email_logs',
    'environments',
    'pdf_generation_logs',
    'predefined_variables',
    'pending_communications',
    'whatsapp_configs',
    'whatsapp_templates',
    'whatsapp_logs'
  ]
  LOOP
    IF to_regclass(scoped_table) IS NULL THEN
      RAISE NOTICE 'Tabla % no existe, se omite', scoped_table;
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS application_id %s', scoped_table, app_id_type);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (application_id)', 'idx_' || scoped_table || '_application_id', scoped_table);
  END LOOP;
END $$;

-- La subconsulta de alcance busca aplicaciones por dueño o por tenant.
CREATE INDEX IF NOT EXISTS idx_applications_user_id ON applications (user_id);
CREATE INDEX IF NOT EXISTS idx_applications_tenant_id ON applications (tenant_id);

-- Las tablas por usuario se filtran por user_id.
DO $$
BEGIN
  IF to_regclass('user_preferences') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences (user_id);
  END IF;
END $$;
