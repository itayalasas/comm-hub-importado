-- migrate:up transaction:false
-- Fase 4: email_logs: listados y estadísticas por aplicación y fecha.
-- CONCURRENTLY no bloquea las escrituras, pero tiene que ir solo y fuera de una
-- transacción; por eso cada índice está en su propio archivo.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_logs_application_created_at
  ON email_logs (application_id, created_at DESC);

-- migrate:down transaction:false
DROP INDEX CONCURRENTLY IF EXISTS idx_email_logs_application_created_at;
