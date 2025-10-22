# Guía Rápida: PDF Pendiente vs Email con PDF

## El Problema que Resolvimos

**ANTES:**
- Llamabas a `/pending-communication` con template tipo PDF
- El sistema enviaba el email inmediatamente ❌
- No podías esperar datos externos

**AHORA:**
- Llamabas a `/pending-communication` con template tipo PDF
- El sistema **NO envía el email** ✅
- Crea un registro pendiente
- Tú controlas cuándo se envía

---

## Dos Endpoints Nuevos

### 1️⃣ `/functions/v1/pending-communication`

**Propósito:** Crear una comunicación pendiente (PDF que se enviará después)

**Cuándo usarlo:**
- Template es tipo `'pdf'` (como `invoice_email_service`)
- Necesitas esperar datos externos
- Quieres control sobre cuándo se envía

**Qué hace:**
- ✅ Crea registro en `pending_communications`
- ✅ Estado: `waiting_data`
- ❌ **NO envía email**
- ❌ **NO genera PDF todavía**

**Ejemplo:**
```json
POST /functions/v1/pending-communication

{
  "template_name": "invoice_email_service",
  "recipient_email": "payalaortiz@gmail.com",
  "base_data": {
    "numero_cfe": "INV-001",
    "cliente": "Juan Pérez",
    "items": [...]
  },
  "external_reference_id": "INVOICE-12345",
  "external_system": "billing_system"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Pending PDF communication created successfully",
  "pending_communication_id": "abc-123",
  "external_reference_id": "INVOICE-12345",
  "status": "waiting_data",
  "type": "pdf",
  "note": "PDF will be generated and email sent when all pending fields are completed"
}
```

---

### 2️⃣ `/functions/v1/complete-pending-communication`

**Propósito:** Completar los datos y enviar el email con PDF

**Cuándo usarlo:**
- Después de crear la comunicación pendiente
- Cuando tengas todos los datos (ej: DGI aprobó factura)
- Listo para enviar el email

**Qué hace:**
- ✅ Actualiza los datos en `pending_communications`
- ✅ Genera el PDF
- ✅ Envía el email con PDF adjunto
- ✅ Actualiza estado a `sent`

**Ejemplo:**
```json
POST /functions/v1/complete-pending-communication

{
  "external_reference_id": "INVOICE-12345",
  "completed_data": {
    "cae": "12345678901234",
    "qr_code": "https://dgi.gub.uy/...",
    "vencimiento_cae": "2025-10-29",
    "fecha_aprobacion": "2025-10-22"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Communication completed and email sent successfully",
  "pending_communication_id": "abc-123",
  "log_id": "email-log-uuid",
  "features": {
    "has_pdf": true,
    "has_qr": true
  }
}
```

---

## Flujo Completo: Factura con DGI

### Escenario
Tu sistema genera una factura y necesita:
1. Esperar aprobación de DGI
2. Recibir CAE y QR code
3. Enviar email con factura PDF

### Paso a Paso

**1. Cliente hace compra → Creas factura en tu sistema**

```javascript
// Tu sistema interno
const invoice = {
  numero_cfe: "INV-001",
  cliente: "Juan Pérez",
  items: [...],
  total: 1000
};

// Guardas en tu DB
await db.invoices.insert(invoice);
```

---

**2. Envías a DGI y creas comunicación pendiente**

```javascript
// Envías a DGI
const dgiResponse = await enviarADGI(invoice);

// Inmediatamente creas la comunicación pendiente
const response = await fetch('https://your-project.supabase.co/functions/v1/pending-communication', {
  method: 'POST',
  headers: {
    'x-api-key': 'your_api_key',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    template_name: 'invoice_email_service',
    recipient_email: invoice.cliente_email,
    base_data: {
      numero_cfe: invoice.numero_cfe,
      cliente: invoice.cliente,
      items: invoice.items,
      total: invoice.total,
      // Datos que ya tienes
    },
    external_reference_id: `INVOICE-${invoice.id}`,
    external_system: 'billing_system',
  }),
});

const result = await response.json();
// { success: true, pending_communication_id: "...", status: "waiting_data" }
```

**✅ En este momento:**
- Comunicación está pendiente
- **NO se envió ningún email**
- Esperando que completes los datos

---

**3. DGI responde con aprobación (puede ser minutos/horas después)**

```javascript
// Tu webhook que recibe respuesta de DGI
app.post('/webhook/dgi', async (req, res) => {
  const dgiData = req.body;

  // Guardas datos de DGI en tu sistema
  await db.invoices.update(dgiData.reference, {
    cae: dgiData.cae,
    qr_code: dgiData.qr_code,
    dgi_approved: true,
  });

  // AHORA sí, completas y envías el email
  const response = await fetch('https://your-project.supabase.co/functions/v1/complete-pending-communication', {
    method: 'POST',
    headers: {
      'x-api-key': 'your_api_key',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      external_reference_id: `INVOICE-${dgiData.invoice_id}`,
      completed_data: {
        cae: dgiData.cae,
        qr_code: dgiData.qr_code,
        vencimiento_cae: dgiData.vencimiento,
        fecha_aprobacion: new Date().toISOString(),
        dgi_mensaje: dgiData.mensaje,
      },
    }),
  });

  const result = await response.json();
  // { success: true, message: "Email sent successfully", log_id: "..." }

  res.json({ success: true });
});
```

**✅ En este momento:**
- Se genera el PDF con **todos** los datos (incluyendo CAE y QR)
- Se envía el email al cliente
- Estado cambia a `sent`

---

## Comparación Visual

### Flujo Antiguo (Incorrecto) ❌

```
Tu Sistema → pending-communication → ❌ Email enviado SIN CAE
                                     ❌ PDF generado incompleto
                                     ❌ No puedes esperar DGI
```

### Flujo Nuevo (Correcto) ✅

```
Tu Sistema → pending-communication → ✅ Registro creado
                                     ✅ Estado: waiting_data
                                     ❌ NO se envía email

DGI Aprueba → complete-pending     → ✅ PDF generado con CAE
                                     ✅ Email enviado
                                     ✅ Estado: sent
```

---

## Estados de Pending Communications

### `waiting_data`
- Comunicación creada
- Esperando que completes los datos
- Email NO enviado

### `data_received`
- Datos completados
- PDF generado
- Email NO enviado todavía

### `sent`
- Todo completo
- PDF generado
- Email enviado exitosamente

### `failed`
- Algo falló
- Revisa `error_message` en el registro

---

## Consultas Útiles

### Ver comunicaciones pendientes

```sql
SELECT
  id,
  template_name,
  recipient_email,
  external_reference_id,
  status,
  created_at,
  base_data
FROM pending_communications
WHERE status = 'waiting_data'
ORDER BY created_at DESC;
```

### Ver comunicaciones enviadas

```sql
SELECT
  pc.external_reference_id,
  pc.recipient_email,
  pc.status,
  pc.created_at,
  pc.sent_at,
  el.subject,
  el.pdf_attachment_size
FROM pending_communications pc
LEFT JOIN email_logs el ON el.id = pc.sent_log_id
WHERE pc.status = 'sent'
ORDER BY pc.sent_at DESC;
```

### Ver comunicaciones fallidas

```sql
SELECT
  id,
  external_reference_id,
  recipient_email,
  error_message,
  created_at
FROM pending_communications
WHERE status = 'failed'
ORDER BY created_at DESC;
```

---

## Troubleshooting

### Email se envía inmediatamente cuando no debería

**Causa:** Template está configurado como `'email'` en vez de `'pdf'`

**Solución:**
```sql
-- Verificar tipo de template
SELECT name, template_type FROM communication_templates
WHERE name = 'invoice_email_service';

-- Si es 'email', cambiar a 'pdf'
UPDATE communication_templates
SET template_type = 'pdf'
WHERE name = 'invoice_email_service';
```

### No encuentro la comunicación pendiente

**Causa:** `external_reference_id` no coincide

**Solución:**
```sql
-- Buscar por email
SELECT * FROM pending_communications
WHERE recipient_email = 'payalaortiz@gmail.com'
ORDER BY created_at DESC
LIMIT 5;
```

### Email no se envía al completar

**Causa:** Estado no es `waiting_data`

**Solución:**
```sql
-- Ver estado actual
SELECT id, external_reference_id, status, error_message
FROM pending_communications
WHERE external_reference_id = 'INVOICE-12345';

-- Si está en 'failed', revisar error_message
-- Si está en 'sent', ya se envió
```

---

## Resumen

| Acción | Endpoint | Template Tipo | Email se envía? |
|--------|----------|---------------|-----------------|
| Crear pendiente | `/pending-communication` | `pdf` | ❌ NO |
| Completar y enviar | `/complete-pending-communication` | `pdf` | ✅ SÍ |
| Envío inmediato | `/send-email` | `email` | ✅ SÍ |

**Recomendación:** Para facturas con DGI, usa siempre template tipo `'pdf'` y el flujo de 2 pasos.
