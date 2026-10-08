-- migrate:up
-- Etapa 1 del hash de API keys de clientes.
--
-- Agrega el hash SHA-256 (hex) y un prefijo visible de cada key. Un trigger
-- los mantiene al día cuando se inserta o cambia la key, así que el panel
-- puede seguir creando aplicaciones sin cambios. Las funciones validan por
-- `api_key_hash`.
--
-- La columna en claro (`api_key`) sigue existiendo hasta la etapa 2, cuando el
-- panel y el scheduler dejen de leerla. Correr ANTES de desplegar las
-- funciones de este cambio. Se puede correr más de una vez.

ALTER TABLE applications ADD COLUMN IF NOT EXISTS api_key_hash text;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS api_key_prefix text;

CREATE OR REPLACE FUNCTION applications_hash_api_key() RETURNS trigger AS $$
BEGIN
  IF NEW.api_key IS NULL OR NEW.api_key = '' THEN
    NEW.api_key_hash := NULL;
    NEW.api_key_prefix := NULL;
  ELSE
    NEW.api_key_hash := encode(sha256(convert_to(NEW.api_key, 'UTF8')), 'hex');
    NEW.api_key_prefix := left(NEW.api_key, 12);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_applications_hash_api_key ON applications;
CREATE TRIGGER trg_applications_hash_api_key
  BEFORE INSERT OR UPDATE OF api_key ON applications
  FOR EACH ROW EXECUTE FUNCTION applications_hash_api_key();

UPDATE applications
   SET api_key_hash = encode(sha256(convert_to(api_key, 'UTF8')), 'hex'),
       api_key_prefix = left(api_key, 12)
 WHERE api_key IS NOT NULL
   AND api_key <> ''
   AND (api_key_hash IS NULL OR api_key_hash <> encode(sha256(convert_to(api_key, 'UTF8')), 'hex'));

CREATE INDEX IF NOT EXISTS idx_applications_api_key_hash ON applications (api_key_hash);

-- migrate:down
