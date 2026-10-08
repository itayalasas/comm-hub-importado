-- migrate:up transaction:false
-- Fase 4: email_logs: detalle de un envío con sus registros hijos.
-- CONCURRENTLY no bloquea las escrituras, pero tiene que ir solo y fuera de una
-- transacción; por eso cada índice está en su propio archivo.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_logs_parent_log_id
  ON email_logs (parent_log_id)
  WHERE parent_log_id IS NOT NULL;

-- migrate:down transaction:false
DROP INDEX CONCURRENTLY IF EXISTS idx_email_logs_parent_log_id;
