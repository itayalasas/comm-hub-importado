-- migrate:up transaction:false
-- Fase 4: whatsapp_logs: listado por aplicación y fecha.
-- CONCURRENTLY no bloquea las escrituras, pero tiene que ir solo y fuera de una
-- transacción; por eso cada índice está en su propio archivo.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_whatsapp_logs_application_created_at
  ON whatsapp_logs (application_id, created_at DESC);

-- migrate:down transaction:false
DROP INDEX CONCURRENTLY IF EXISTS idx_whatsapp_logs_application_created_at;
