-- Índices para los listados y las estadísticas del panel (Fase 4).
-- Todas las pantallas filtran por aplicación y ordenan por fecha descendente.
--
-- CONCURRENTLY no bloquea las escrituras mientras se crea el índice, pero no puede
-- ir dentro de una transacción: correr este archivo con psql tal cual, sin BEGIN.
-- Si un índice queda INVALID por un corte, borrarlo y volver a correr la línea.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_logs_application_created_at
  ON email_logs (application_id, created_at DESC);

-- Detalle de un envío: sus registros hijos.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_logs_parent_log_id
  ON email_logs (parent_log_id)
  WHERE parent_log_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_whatsapp_logs_application_created_at
  ON whatsapp_logs (application_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pending_communications_application_created_at
  ON pending_communications (application_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_tenant_created_at
  ON audit_logs (tenant_id, created_at DESC);
