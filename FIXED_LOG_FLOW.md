# Flujo de Logs Corregido - Sin Duplicación

## Problema Anterior
- Se creaban **2 logs** en cada envío de email con PDF
- El log del PDF no estaba asociado al log del email (faltaba `parent_log_id`)

## Solución Implementada

### 1. `generate-pdf` crea UN SOLO log en `email_logs`

```typescript
// generate-pdf/index.ts línea 495-517
const { data: emailLog } = await supabase
  .from('email_logs')
  .insert({
    application_id: application.id,
    template_id: pdfTemplate.id,
    recipient_email: 'pdf_generation@system.local',
    subject: `PDF Generated: ${filename}`,
    status: 'sent',
    communication_type: 'pdf_generation',  // ← Identifica como generación de PDF
    pdf_generated: true,
    metadata: {
      endpoint: 'generate-pdf',
      filename,
      size_bytes: sizeBytes,
      order_id,
      action: 'pdf_generated',
    },
  })
  .select()
  .single();
```

### 2. `generate-pdf` también guarda en `pdf_generation_logs`

```typescript
// generate-pdf/index.ts línea 523-535
const { data: pdfLog } = await supabase
  .from('pdf_generation_logs')
  .insert({
    application_id: application.id,
    pdf_template_id: pdfTemplate.id,
    data,
    pdf_base64: pdfBase64,  // ← Se guarda el PDF completo
    filename,
    size_bytes: sizeBytes,
    email_log_id: emailLog?.id,  // ← Referencia al log de email_logs
  })
```

### 3. `generate-pdf` guarda el `email_log.id` en `pending_communications`

```typescript
// generate-pdf/index.ts línea 581-595
await supabase
  .from('pending_communications')
  .update({
    completed_data: {
      pdf_attachment: pdfAttachment,
      pdf_log_id: emailLog?.id,  // ← Este es el log de email_logs
      pdf_generation_log_id: pdfLog.id,  // ← Este es el log de pdf_generation_logs
      pdf_template_id: pdfTemplate.id,
      pdf_filename: filename,
      pdf_size_bytes: sizeBytes,
    },
    status: 'pdf_generated',
  })
  .eq('id', targetPendingId);
```

### 4. `complete-pending-communication` pasa `_pdf_info` a `send-email`

```typescript
// complete-pending-communication/index.ts línea 154-161
const requestBody: any = {
  template_name: pendingComm.template_name,
  recipient_email: pendingComm.recipient_email,
  data: mergedData,
  _skip_pdf_generation: !!pdfAttachment,
  _pdf_attachment: pdfAttachment,
  _pdf_info: pdfInfo,  // ← Contiene pdf_log_id del email_logs
  _pending_communication_id: pendingComm.id,
};
```

### 5. `send-email` crea el log del email Y actualiza el log del PDF

```typescript
// send-email/index.ts línea 515-542
// Paso A: Crear log principal del email
const { data: logData } = await supabase
  .from('email_logs')
  .insert(emailLog)  // communication_type: 'email_with_pdf'
  .select()
  .single();

logEntry = logData;

// Paso B: Actualizar el log del PDF con parent_log_id
if (pdfAttachment && _pdf_info?.pdf_log_id) {
  await supabase
    .from('email_logs')
    .update({
      parent_log_id: logEntry.id,  // ← AQUÍ se establece la jerarquía
      updated_at: new Date().toISOString(),
    })
    .eq('id', _pdf_info.pdf_log_id);
}
```

## Resultado Final: Jerarquía Clara

```
Dashboard → email_logs:
├─ [A] Email: "Booking Confirmation"
│      status: sent
│      communication_type: email_with_pdf
│      parent_log_id: NULL
│
└─ [B] PDF: "invoice_123.pdf"
       status: sent
       communication_type: pdf_generation
       parent_log_id: A  ← Conectado al email principal

       └─ pdf_generation_logs:
          [C] pdf_base64: "JVBERi0xLjQK..."
              email_log_id: B  ← Conectado al log del PDF
```

## Query para Verificar

```sql
-- Ver la jerarquía de logs
SELECT
  id,
  subject,
  communication_type,
  parent_log_id,
  status,
  created_at
FROM email_logs
WHERE parent_log_id IS NULL
   OR id IN (
     SELECT parent_log_id
     FROM email_logs
     WHERE parent_log_id IS NOT NULL
   )
ORDER BY created_at DESC, parent_log_id NULLS FIRST;
```

## Almacenamiento de PDFs

### ✅ Se Guarda el Base64 en DB
- **Tabla**: `pdf_generation_logs.pdf_base64`
- **Ventaja**: Auditoría completa, re-envío sin regenerar
- **Consideración**: Para volúmenes >1000 PDFs/día, considerar Supabase Storage

### ⏱️ Temporal en `pending_communications`
- Se guarda en `completed_data.pdf_attachment` solo hasta el envío
- Se limpia automáticamente cuando el status cambia a `sent`

## Puntos Clave

1. ✅ **Un solo log por operación**: No hay duplicación
2. ✅ **Jerarquía clara**: PDF es hijo del Email
3. ✅ **Trazabilidad completa**:
   - `email_logs` → log de negocio
   - `pdf_generation_logs` → almacenamiento del PDF
4. ✅ **Base64 guardado**: Para auditoría y re-envío
