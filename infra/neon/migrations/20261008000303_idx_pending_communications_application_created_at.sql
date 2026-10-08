-- migrate:up transaction:false
-- Fase 4: pending_communications: listado por aplicación y fecha.
-- CONCURRENTLY no bloquea las escrituras, pero tiene que ir solo y fuera de una
-- transacción; por eso cada índice está en su propio archivo.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pending_communications_application_created_at
  ON pending_communications (application_id, created_at DESC);

-- migrate:down transaction:false
DROP INDEX CONCURRENTLY IF EXISTS idx_pending_communications_application_created_at;
