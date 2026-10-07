-- Etapa 2 del hash de API keys: dejar de guardar las keys en texto plano.
--
-- NO correr hasta que se cumpla todo esto:
--   1. La migración 0002 ya corrió y las funciones validan por api_key_hash.
--   2. Están desplegadas las funciones de la etapa 2 (aceptan la sesión del
--      panel y la clave interna) y el panel nuevo.
--   3. FUNCTIONS_INTERNAL_KEY está configurada, con el mismo valor, en
--      automation-scheduler, notify, send-email, send-email-with-pdf,
--      generate-pdf, pending-communication, complete-pending-communication,
--      automation-programs y automation-monitoring.
--   4. whatsapp-template-submit (fuera de este repo) ya no valida con
--      `WHERE api_key = ...`.
--
-- Después de correrla, quien no haya guardado su key tiene que regenerarla
-- desde Configuración. No se puede deshacer: las keys en texto plano se
-- borran. Se puede correr más de una vez.

-- El trigger sigue calculando hash y prefijo, pero ya no guarda la key.
-- Si una fila se actualiza sin key nueva, conserva el hash que tenía.
CREATE OR REPLACE FUNCTION applications_hash_api_key() RETURNS trigger AS $$
BEGIN
  IF NEW.api_key IS NOT NULL AND NEW.api_key <> '' THEN
    NEW.api_key_hash := encode(sha256(convert_to(NEW.api_key, 'UTF8')), 'hex');
    NEW.api_key_prefix := left(NEW.api_key, 12);
  END IF;
  NEW.api_key := NULL;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

ALTER TABLE applications ALTER COLUMN api_key DROP NOT NULL;

-- Por si alguna fila quedó sin hash (no debería después de 0002).
UPDATE applications
   SET api_key_hash = encode(sha256(convert_to(api_key, 'UTF8')), 'hex'),
       api_key_prefix = left(api_key, 12)
 WHERE api_key IS NOT NULL AND api_key <> '' AND api_key_hash IS NULL;

UPDATE applications SET api_key = NULL WHERE api_key IS NOT NULL;

-- La tabla api_keys guardaba la key completa en `key` y también en
-- `key_hash`. Se deja solo la vista previa y un hash real.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = current_schema() AND table_name = 'api_keys' AND column_name = 'key_hash'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = current_schema() AND table_name = 'api_keys' AND column_name = 'key'
  ) THEN
    UPDATE api_keys
       SET key_hash = encode(sha256(convert_to(key_hash, 'UTF8')), 'hex')
     WHERE key_hash IS NOT NULL AND key_hash = key;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = current_schema() AND table_name = 'api_keys' AND column_name = 'key_preview'
    ) THEN
      UPDATE api_keys
         SET key = COALESCE(key_preview, left(key, 12))
       WHERE key IS NOT NULL AND key <> COALESCE(key_preview, left(key, 12));
    ELSE
      UPDATE api_keys SET key = left(key, 12) WHERE key IS NOT NULL AND length(key) > 12;
    END IF;
  END IF;
END $$;
