# API de Comunicaciones para Partners

## Endpoint
```
POST https://drhbcmithlrldtjlhnee.supabase.co/functions/v1/pending-communication
```

## Headers Requeridos
```
x-api-key: TU_API_KEY
Content-Type: application/json
```

## Uso

Esta API permite enviar comunicaciones a partners con dos flujos:

1. **Envío directo**: El email se envía inmediatamente
2. **Espera por PDF**: El email espera a que se genere un PDF antes de enviarse

## Flujo con Espera de PDF

Cuando `wait_for_invoice: true`, el sistema:

1. Crea un registro de comunicación pendiente
2. Espera a recibir el PDF desde la API `generate-pdf`
3. Una vez recibido el PDF, adjunta el archivo al email
4. Envía el email completo con el PDF adjunto

### Validación de Invoice

El sistema valida que el `invoice_id` (o `order_id`) del email coincida con el `order_id` del PDF generado. Ambos deben ser idénticos para que el sistema los vincule correctamente.

## Casos de Uso

### 1. Factura de Comisiones a Partner

**Template**: `partner_commission_invoice`

Este template se usa para enviar facturas de comisiones que el marketplace cobra al partner.

```json
{
  "template_name": "partner_commission_invoice",
  "recipient_email": "partner@email.com",
  "invoice_id": "a3f9c1e2-7b44-4c10-9a6d-112233445566",
  "wait_for_invoice": true,
  "data": {
    "partner_name": "Veterinaria Patitas",
    "invoice_number": "COM-000154",
    "invoice_date": "04/02/2026",
    "period_from": "01/01/2026",
    "period_to": "31/01/2026",
    "total_sales_amount": "45,320.00",
    "marketplace_commission_percentage": "12%",
    "commission_amount": "5,438.40",
    "tax_amount": "1,196.45",
    "total_invoice_amount": "6,634.85",
    "payment_due_date": "15/02/2026"
  }
}
```

### 2. Factura de Ganancias a Partner

**Template**: `partner_earnings_invoice`

Este template se usa para notificar al partner sobre sus ganancias por servicios vendidos en el marketplace.

```json
{
  "template_name": "partner_earnings_invoice",
  "recipient_email": "partner@email.com",
  "invoice_id": "b7a1d2f3-9c55-4e21-a7b8-223344556677",
  "wait_for_invoice": true,
  "data": {
    "partner_name": "Peluquería Canina HappyDog",
    "invoice_number": "EARN-000089",
    "invoice_date": "04/02/2026",
    "period_from": "01/01/2026",
    "period_to": "31/01/2026",
    "total_services_sold": "38",
    "gross_amount_generated": "72,500.00",
    "marketplace_commission_discount": "8,700.00",
    "net_amount_to_receive": "63,800.00",
    "payment_method": "Transferencia bancaria",
    "estimated_payment_date": "10/02/2026"
  }
}
```

## Flujo Completo de Integración

### Paso 1: Enviar solicitud de email con wait_for_invoice
```bash
curl -X POST https://drhbcmithlrldtjlhnee.supabase.co/functions/v1/pending-communication \
  -H "x-api-key: TU_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "template_name": "partner_commission_invoice",
    "recipient_email": "partner@email.com",
    "invoice_id": "a3f9c1e2-7b44-4c10-9a6d-112233445566",
    "wait_for_invoice": true,
    "data": { ... }
  }'
```

**Respuesta cuando NO hay PDF**:
```json
{
  "success": true,
  "message": "Email queued, waiting for invoice PDF",
  "log_id": "uuid-del-log",
  "pending_communication_id": "uuid-del-pending",
  "status": "queued"
}
```

### Paso 2: Generar el PDF con el mismo invoice_id
```bash
curl -X POST https://drhbcmithlrldtjlhnee.supabase.co/functions/v1/generate-pdf \
  -H "x-api-key: TU_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "template_name": "partner_commission_invoice_pdf",
    "order_id": "a3f9c1e2-7b44-4c10-9a6d-112233445566",
    "data": { ... }
  }'
```

### Paso 3: Sistema detecta automáticamente el PDF

Cuando el PDF se genera, el sistema:
- Busca comunicaciones pendientes con el mismo `order_id`/`invoice_id`
- Adjunta el PDF automáticamente
- Envía el email con el PDF

**Respuesta cuando YA hay PDF**:
```json
{
  "success": true,
  "message": "Email sent with PDF",
  "log_id": "uuid-del-log",
  "pending_communication_id": "uuid-del-pending",
  "status": "sent"
}
```

## Campos Importantes

### Campos Obligatorios
- `template_name`: Nombre del template en el sistema
- `recipient_email`: Email del destinatario
- `data`: Objeto con las variables del template

### Campos Opcionales
- `invoice_id` o `order_id`: ID único de la factura/orden (obligatorio si `wait_for_invoice: true`)
- `wait_for_invoice`: `true` para esperar PDF, `false` o ausente para envío directo

## Notas Importantes

1. **ID Consistente**: El `invoice_id` en el email debe coincidir exactamente con el `order_id` del PDF
2. **Orden Flexible**: Puedes enviar primero el email o primero el PDF, el sistema los vinculará automáticamente
3. **Templates Requeridos**: Debes crear los templates en el sistema antes de usarlos
4. **API Key**: Cada aplicación tiene su propia API key

## Ejemplos de Respuesta

### Email Enviado Directamente
```json
{
  "success": true,
  "log_id": "uuid-del-log",
  "message": "Email sent successfully"
}
```

### Email en Cola (esperando PDF)
```json
{
  "success": true,
  "message": "Email queued, waiting for invoice PDF",
  "log_id": "uuid-del-log",
  "pending_communication_id": "uuid-del-pending",
  "status": "queued"
}
```

### Email Enviado con PDF (PDF ya existía)
```json
{
  "success": true,
  "message": "Email sent with PDF",
  "log_id": "uuid-del-log",
  "pending_communication_id": "uuid-del-pending",
  "status": "sent"
}
```

## Errores Comunes

### Error: Template not found
```json
{
  "success": false,
  "error": "Template not found or inactive"
}
```
**Solución**: Verifica que el template existe y está activo en tu aplicación

### Error: Invalid API key
```json
{
  "success": false,
  "error": "Invalid API key"
}
```
**Solución**: Verifica que estás usando la API key correcta en el header `x-api-key`

### Error: Missing required fields
```json
{
  "success": false,
  "error": "Missing required fields: template_name, recipient_email"
}
```
**Solución**: Asegúrate de incluir `template_name` y `recipient_email` en el body
