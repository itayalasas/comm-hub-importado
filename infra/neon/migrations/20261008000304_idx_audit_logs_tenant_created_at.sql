-- migrate:up transaction:false
-- Fase 4: audit_logs: auditoría por tenant y fecha.
-- CONCURRENTLY no bloquea las escrituras, pero tiene que ir solo y fuera de una
-- transacción; por eso cada índice está en su propio archivo.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_tenant_created_at
  ON audit_logs (tenant_id, created_at DESC);

-- migrate:down transaction:false
DROP INDEX CONCURRENTLY IF EXISTS idx_audit_logs_tenant_created_at;
