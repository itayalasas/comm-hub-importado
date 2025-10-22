/*
  # Agregar estado 'pdf_generated' a pending_communications

  1. Cambios
    - Modifica el constraint de status en pending_communications para incluir 'pdf_generated'
    - Este estado indica que el PDF ha sido generado y está listo para ser enviado por email
  
  2. Estados permitidos actualizados
    - waiting_data: Esperando datos para completar
    - data_received: Datos recibidos, listo para procesar
    - pdf_generated: PDF generado, listo para enviar
    - sent: Comunicación enviada exitosamente
    - failed: Comunicación fallida
    - cancelled: Comunicación cancelada
*/

-- Eliminar el constraint existente
ALTER TABLE pending_communications 
DROP CONSTRAINT IF EXISTS pending_communications_status_check;

-- Crear el constraint actualizado con el nuevo estado
ALTER TABLE pending_communications 
ADD CONSTRAINT pending_communications_status_check 
CHECK (status = ANY (ARRAY['waiting_data'::text, 'data_received'::text, 'pdf_generated'::text, 'sent'::text, 'failed'::text, 'cancelled'::text]));