/*
  # Agregar jerarquía de transacciones a email_logs

  1. Cambios
    - Agrega columna `parent_log_id` para crear relaciones padre-hijo entre transacciones
    - Permite rastrear qué transacciones generaron otras (ej: PDF generado -> Email enviado con PDF)
  
  2. Estructura
    - parent_log_id: Referencia al email_log padre (null si es transacción raíz)
    - Permite crear un árbol de transacciones relacionadas
  
  3. Ejemplo de uso
    - Transacción 1: PDF generado (parent_log_id = null)
    - Transacción 2: Email enviado con ese PDF (parent_log_id = id de Transacción 1)
*/

-- Agregar columna parent_log_id a email_logs
ALTER TABLE email_logs
ADD COLUMN IF NOT EXISTS parent_log_id uuid REFERENCES email_logs(id) ON DELETE SET NULL;

-- Crear índice para mejorar las consultas de jerarquía
CREATE INDEX IF NOT EXISTS idx_email_logs_parent_log_id ON email_logs(parent_log_id);

-- Comentario en la columna
COMMENT ON COLUMN email_logs.parent_log_id IS 'ID del log padre para crear jerarquía de transacciones relacionadas';