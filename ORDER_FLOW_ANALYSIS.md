# Análisis del Flujo de Orden con PDF

## 🔄 Dos Escenarios Posibles

### Escenario 1: Orden Normal (pending-communication → generate-pdf)

**Paso 1: Llamada a `pending-communication`**
```bash
POST /functions/v1/pending-communication
{
  "template_name": "invoice_email",
  "recipient_email": "cliente@example.com",
  "order_id": "ORDER-123",
  "wait_for_invoice": true,
  "data": { ... }
}
```

**Resultado:**
- ✅ Crea `email_log` con status `queued` (padre)
- ✅ Crea `pending_communication` con:
  - `status: 'waiting_data'`
  - `order_id: 'ORDER-123'`
  - `parent_log_id: <id_del_log_padre>`
  - `pending_fields: ['invoice_pdf']`
- ✅ Busca si ya existe un PDF con ese `order_id`
- ❌ No encuentra PDF (no ha sido generado aún)
- 📨 Retorna: `{ success: true, status: 'queued', message: 'waiting for invoice PDF' }`

**Paso 2: Llamada a `generate-pdf`**
```bash
POST /functions/v1/generate-pdf
{
  "pdf_template_name": "factura_pdf",
  "order_id": "ORDER-123",
  "data": {
    "response_payload": {
      "qr_code": "https://dgi.gub.uy/validar?id=123"
    },
    ...
  }
}
```

**Resultado:**
- 🔍 Busca `pending_communication` con `order_id: 'ORDER-123'`
- ✅ Lo encuentra (creado en paso 1)
- 📄 Genera el PDF
- 🔗 Convierte QR URL a imagen base64
- 💾 Guarda en `pdf_generation_logs`
- 📝 Actualiza `pending_communication`:
  - `completed_data: { pdf_attachment: {...} }`
  - `status: 'pdf_generated'`
- 📧 Llama automáticamente a `complete-pending-communication`
- ✉️ Envía el email con el PDF adjunto
- 📨 Retorna: `{ success: true, pdf_id: ..., pdf_base64: ... }`

---

### Escenario 2: ⚡ Orden Inversa (generate-pdf → pending-communication)

**Paso 1: Llamada a `generate-pdf`**
```bash
POST /functions/v1/generate-pdf
{
  "pdf_template_name": "factura_pdf",
  "order_id": "ORDER-123",
  "data": { ... }
}
```

**Resultado:**
- 🔍 Busca `pending_communication` con `order_id: 'ORDER-123'`
- ❌ No lo encuentra (aún no se creó)
- ⚠️ Log: "No pending communication found for order_id: ORDER-123"
- 📄 Genera el PDF **igual**
- 💾 Guarda en `pdf_generation_logs`
- 📝 Crea `email_log` con:
  - `communication_type: 'pdf_generation'`
  - `status: 'sent'`
  - `metadata: { order_id: 'ORDER-123', ... }`
- 📨 Retorna: `{ success: true, pdf_id: ..., pdf_base64: ... }`
- ⏸️ El PDF queda "en espera" de que llegue la comunicación

**Paso 2: Llamada a `pending-communication`**
```bash
POST /functions/v1/pending-communication
{
  "template_name": "invoice_email",
  "recipient_email": "cliente@example.com",
  "order_id": "ORDER-123",
  "wait_for_invoice": true,
  "data": { ... }
}
```

**Resultado (CON LA NUEVA LÓGICA):**
- ✅ Crea `email_log` con status `queued` (padre) → **parent_log_id**
- ✅ Crea `pending_communication` con `parent_log_id`
- 🔍 **Busca si ya existe un PDF con `order_id: 'ORDER-123'`**
- ✅ **Lo encuentra!** (generado en paso 1)
- 🔗 **Actualiza el `email_log` del PDF (generado en paso 1):**
  - Vincula con `parent_log_id` del log padre
  - **Ahora el PDF aparece como transacción relacionada en el historial**
- 📝 **Actualiza inmediatamente** el `pending_communication`:
  - `completed_data: { pdf_attachment: {...} }`
  - `status: 'pdf_generated'`
- 📧 **Llama automáticamente a `complete-pending-communication`**
- ✉️ **Envía el email inmediatamente** con el PDF adjunto
- 📨 Retorna: `{ success: true, status: 'sent', pdf_was_ready: true }`

---

## 📊 Tabla Comparativa

| Aspecto | Escenario 1 (Normal) | Escenario 2 (Inverso) |
|---------|---------------------|----------------------|
| **Primera llamada** | `pending-communication` | `generate-pdf` |
| **Segunda llamada** | `generate-pdf` | `pending-communication` |
| **PDF se genera** | En paso 2 | En paso 1 |
| **Email se envía** | Después de generar PDF | Inmediatamente (PDF ya existe) |
| **Estado final** | `sent` | `sent` |
| **Tiempo total** | ~5-10 segundos | ~5-10 segundos |
| **Diferencia visible** | Espera entre llamadas | Se completa instantáneamente en paso 2 |

---

## ✅ Comportamiento Garantizado

### Ambos Escenarios Funcionan Correctamente

1. **El PDF siempre se genera** (sin importar el orden)
2. **El email siempre se envía con el PDF adjunto**
3. **No se pierden datos**
4. **No hay duplicados**

### Protecciones Implementadas

1. ✅ Si llega primero `generate-pdf`: El PDF se guarda y queda esperando
2. ✅ Si llega primero `pending-communication`: Crea la comunicación pendiente
3. ✅ La segunda llamada **siempre** completa el flujo
4. ✅ Si se llama dos veces con el mismo `order_id`: Reutiliza la existente

---

## 🔧 Logs para Debug

### Escenario Normal
```
[pending-communication] Creating parent log and pending communication
[pending-communication] Checking if PDF already exists for order_id: ORDER-123
[pending-communication] No existing PDF found
[pending-communication] Email queued successfully, waiting for invoice PDF

[generate-pdf] Looking for pending communication with order_id: ORDER-123
[generate-pdf] Found pending communication for order ORDER-123: <uuid>
[generate-pdf] Generating QR code from text/URL
[generate-pdf] PDF generated successfully
[generate-pdf] Updating pending communication with PDF attachment
[generate-pdf] Triggering email send for pending_communication_id
[complete-pending-communication] Email sent successfully
```

### Escenario Inverso
```
[generate-pdf] Looking for pending communication with order_id: ORDER-123
[generate-pdf] No pending communication found for order_id: ORDER-123
[generate-pdf] Generating QR code from text/URL
[generate-pdf] PDF generated successfully
[generate-pdf] Created email_log with id: <pdf_log_id> (sin parent_log_id aún)

[pending-communication] Creating parent log and pending communication
[pending-communication] Checking if PDF already exists for order_id: ORDER-123
[pending-communication] Found PDF log for order_id: ORDER-123, log_id: <pdf_log_id>
[pending-communication] Found existing PDF! Attaching to pending communication
[pending-communication] Updating PDF email_log to link with parent_log_id: <parent_log_id>
[pending-communication] PDF attached, triggering email send
[complete-pending-communication] Email sent successfully
[pending-communication] Email sent successfully with existing PDF
```

---

## 🎯 Conclusión

**El sistema ahora maneja ambos escenarios correctamente:**

- ✅ Sin perder datos
- ✅ Sin errores
- ✅ Sin requerir cambios en la integración existente
- ✅ Con logging claro para debug
- ✅ El orden de las llamadas no importa

**Diferencias clave en el escenario inverso:**
1. El segundo endpoint retorna `pdf_was_ready: true` para indicar que el PDF ya existía
2. El `email_log` del PDF se actualiza retroactivamente con el `parent_log_id` para mantener la jerarquía de transacciones
3. En el historial de comunicaciones, ambas transacciones (PDF + Email) aparecen relacionadas correctamente
