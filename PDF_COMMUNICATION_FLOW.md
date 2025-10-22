# Sistema de Comunicaciones con PDF

## Descripción General

El sistema ahora soporta generación y envío de PDFs como parte de las comunicaciones. Los PDFs pueden:
- Generarse standalone (solo PDF)
- Adjuntarse automáticamente a emails
- Rastrearse independientemente en las estadísticas

## Tipos de Comunicación

### 1. `email` - Email Simple
Email sin adjuntos PDF.

### 2. `pdf` - Solo PDF
PDF generado que queda pendiente hasta que se asocie a un email.

### 3. `email_with_pdf` - Email con PDF Adjunto
Email que incluye un PDF generado automáticamente.

## Flujo de Trabajo

### Caso 1: Email con PDF Adjunto

```
1. Request → /functions/v1/send-email
   {
     "template_name": "invoice_email",
     "recipient_email": "cliente@example.com",
     "data": { ... }
   }

2. Sistema detecta que template tiene pdf_template_id

3. Crea pending_communication:
   - status: 'waiting_data'
   - communication_type: 'pdf'
   - pdf_template_id: [id del template PDF]

4. Llama a /functions/v1/generate-pdf

5. PDF se genera y guarda en pending_communication.completed_data

6. Sistema recupera el PDF

7. Crea email_log:
   - communication_type: 'email_with_pdf'
   - pdf_generated: true
   - pdf_attachment_size: [tamaño en bytes]

8. Envía email con PDF adjunto

9. Actualiza pending_communication:
   - status: 'sent'
   - sent_at: [timestamp]
   - sent_log_id: [id del email_log]
   - pdf_generated: true

10. Email enviado exitosamente
```

### Caso 2: Email Simple (sin PDF)

```
1. Request → /functions/v1/send-email
   {
     "template_name": "welcome_email",
     "recipient_email": "user@example.com",
     "data": { ... }
   }

2. Sistema detecta que NO tiene pdf_template_id

3. Crea email_log:
   - communication_type: 'email'
   - pdf_generated: false

4. Envía email

5. Email enviado exitosamente
```

## Esquema de Base de Datos

### Nuevas Columnas en `email_logs`

```sql
communication_type text DEFAULT 'email'
  CHECK (communication_type IN ('email', 'pdf', 'email_with_pdf'))

pdf_generated boolean DEFAULT false

pdf_attachment_size integer
  -- Tamaño del PDF en bytes
```

### Nuevas Columnas en `pending_communications`

```sql
communication_type text DEFAULT 'email'
  CHECK (communication_type IN ('email', 'pdf', 'email_with_pdf'))

pdf_generated boolean DEFAULT false

pdf_template_id uuid REFERENCES communication_templates(id)
  -- Template PDF usado para generar el documento
```

## Estadísticas

Las estadísticas ahora incluyen:

### Métricas Generales
- **Enviados**: Total de comunicaciones enviadas
- **Fallidos**: Total de comunicaciones fallidas
- **Pendientes**: Total de comunicaciones en espera
- **Abiertos**: Emails que fueron abiertos
- **Clics**: Links dentro de emails que fueron clickeados

### Métricas de PDF (Nuevas)
- **PDFs Generados**: Total de PDFs creados
- **Emails con PDF**: Total de emails que incluyen adjuntos PDF

## Ejemplos de Uso

### 1. Enviar Email con Factura PDF

**Request:**
```json
POST /functions/v1/send-email
Headers:
  x-api-key: your_api_key
  Content-Type: application/json

Body:
{
  "template_name": "invoice_email_service",
  "recipient_email": "cliente@example.com",
  "data": {
    "numero_cfe": "INV-001",
    "cliente": "Juan Pérez",
    "items": [
      {
        "descripcion": "Producto A",
        "cantidad": 2,
        "precio": 100
      }
    ],
    "total": 200
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Email sent successfully",
  "log_id": "uuid-here",
  "features": {
    "has_attachment": false,
    "has_logo": true,
    "has_qr": false,
    "has_pdf": true
  },
  "pdf_attachment": {
    "filename": "factura_INV-001.pdf",
    "size_bytes": 45632
  },
  "processing_time_ms": 3542
}
```

### 2. Consultar Estadísticas

Las estadísticas se actualizan automáticamente en el dashboard y muestran:

```javascript
{
  totalSent: 150,
  totalFailed: 5,
  totalPending: 2,
  totalOpened: 120,
  totalClicked: 45,
  totalPdfs: 85,           // ← NUEVO
  totalEmailsWithPdf: 80   // ← NUEVO
}
```

## Estados de Pending Communications con PDF

### `waiting_data`
PDF está siendo generado. Sistema está esperando que `generate-pdf` complete.

### `data_received`
PDF generado exitosamente y datos guardados en `completed_data.pdf_attachment`.

### `sent`
Email con PDF adjunto fue enviado exitosamente.
- `sent_at` tiene timestamp
- `sent_log_id` referencia al email_log
- `pdf_generated` = true

### `failed`
Error al generar PDF o al enviar email.
- `error_message` contiene detalles del error

## Consultas Útiles

### Ver todos los emails con PDF

```sql
SELECT
  id,
  recipient_email,
  subject,
  communication_type,
  pdf_generated,
  pdf_attachment_size,
  sent_at
FROM email_logs
WHERE communication_type = 'email_with_pdf'
  OR pdf_generated = true
ORDER BY created_at DESC;
```

### Ver PDFs pendientes

```sql
SELECT
  id,
  template_name,
  recipient_email,
  status,
  communication_type,
  pdf_generated,
  created_at,
  error_message
FROM pending_communications
WHERE communication_type = 'pdf'
  AND status IN ('waiting_data', 'data_received')
ORDER BY created_at DESC;
```

### Estadísticas de PDFs por aplicación

```sql
SELECT
  application_id,
  COUNT(*) FILTER (WHERE pdf_generated = true) as total_pdfs,
  COUNT(*) FILTER (WHERE communication_type = 'email_with_pdf') as emails_with_pdf,
  AVG(pdf_attachment_size) FILTER (WHERE pdf_attachment_size IS NOT NULL) as avg_pdf_size
FROM email_logs
GROUP BY application_id;
```

## Mejoras Implementadas

### 1. ✅ Tracking Completo de PDFs
- Cada PDF generado se registra
- Se guarda el tamaño del adjunto
- Se marca el tipo de comunicación

### 2. ✅ Estados Claros
- Estados específicos para PDFs
- Fácil identificar qué está pendiente
- Fácil identificar qué falló

### 3. ✅ Estadísticas Detalladas
- Métricas separadas para PDFs
- Fácil ver adopción de PDFs
- Monitoreo de tamaños de archivos

### 4. ✅ Registro de Errores
- Todos los errores se registran (incluso JSON inválido)
- Detalles completos en metadata
- Fácil debugging

## Troubleshooting

### PDF no se adjunta al email

**Posibles causas:**
1. Template de email no tiene `pdf_template_id` configurado
2. Template PDF no existe o está inactivo
3. Error en generación de PDF (revisar pending_communications)

**Solución:**
```sql
-- Verificar template de email
SELECT id, name, pdf_template_id
FROM communication_templates
WHERE name = 'tu_template_email'
  AND is_active = true;

-- Verificar template PDF existe
SELECT id, name, template_type
FROM communication_templates
WHERE template_type = 'pdf'
  AND is_active = true;

-- Verificar pending communications fallidas
SELECT *
FROM pending_communications
WHERE status = 'failed'
ORDER BY created_at DESC
LIMIT 10;
```

### Estadísticas de PDF no aparecen

**Causa:**
Datos antiguos no tienen `communication_type` y `pdf_generated`.

**Solución:**
Aplicar migración `20251022040000_add_pdf_communication_tracking.sql` para agregar las columnas.

## Resumen

El sistema ahora:
- ✅ Rastrea PDFs independientemente
- ✅ Marca emails con PDF adjunto
- ✅ Muestra estadísticas de PDFs
- ✅ Mantiene estado de pending communications con PDF
- ✅ Registra tamaño de adjuntos
- ✅ Proporciona métricas detalladas en el dashboard
