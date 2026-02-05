# Guía: Envío de Facturas a Múltiples Destinatarios

## Resumen

El sistema ahora soporta enviar la misma factura (PDF) a múltiples destinatarios usando diferentes templates en una sola llamada a la API.

## Caso de Uso: Facturas de Cliente y Partner

Cuando el sistema contable genera una factura, puede notificar simultáneamente a:
1. **Cliente**: Recibe su factura
2. **Partner**: Recibe su factura de comisión

Ambos comparten el mismo PDF pero con diferentes templates de email personalizados.

---

## Formato de API

### Endpoint
```
POST https://tu-proyecto.supabase.co/functions/v1/pending-communication
```

### Headers
```
x-api-key: tu_api_key
Content-Type: application/json
```

### Opción 1: Un Solo Destinatario (Compatible con versión anterior)

```json
{
  "template_name": "invoice_email",
  "recipient_email": "cliente@ejemplo.com",
  "order_id": "ORD-12345",
  "wait_for_invoice": true,
  "data": {
    "customer_name": "Juan Pérez",
    "total": "1500.00"
  }
}
```

### Opción 2: Múltiples Destinatarios (NUEVO)

```json
{
  "order_id": "ORD-12345",
  "wait_for_invoice": true,
  "data": {
    "invoice_number": "FAC-2024-001",
    "invoice_date": "2024-01-15",
    "total_amount": "1500.00"
  },
  "recipients": [
    {
      "recipient_email": "cliente@ejemplo.com",
      "template_name": "invoice_client",
      "data": {
        "customer_name": "Juan Pérez",
        "message": "Gracias por su compra"
      }
    },
    {
      "recipient_email": "partner@ejemplo.com",
      "template_name": "invoice_partner_commission",
      "data": {
        "partner_name": "Distribuidor ABC",
        "commission_amount": "150.00",
        "commission_percent": "10%"
      }
    }
  ]
}
```

---

## Estructura de Datos

### Datos Compartidos
Los datos en el objeto principal `data` se comparten entre todos los destinatarios:
```json
"data": {
  "invoice_number": "FAC-2024-001",
  "invoice_date": "2024-01-15"
}
```

### Datos Específicos por Destinatario
Cada destinatario puede tener datos adicionales que se fusionan con los compartidos:
```json
{
  "recipient_email": "partner@ejemplo.com",
  "template_name": "invoice_partner_commission",
  "data": {
    "partner_name": "Distribuidor ABC",
    "commission_amount": "150.00"
  }
}
```

**Resultado final para este destinatario:**
```json
{
  "invoice_number": "FAC-2024-001",
  "invoice_date": "2024-01-15",
  "partner_name": "Distribuidor ABC",
  "commission_amount": "150.00"
}
```

---

## Flujo de Trabajo

### 1. Sistema Contable Crea la Orden

Cuando se genera una venta:

```json
POST /pending-communication
{
  "order_id": "ORD-12345",
  "wait_for_invoice": true,
  "data": {
    "invoice_number": "FAC-2024-001",
    "customer_name": "Juan Pérez",
    "total": "1500.00"
  },
  "recipients": [
    {
      "recipient_email": "cliente@ejemplo.com",
      "template_name": "invoice_client",
      "data": {
        "greeting": "Estimado cliente"
      }
    },
    {
      "recipient_email": "partner@ejemplo.com",
      "template_name": "partner_commission",
      "data": {
        "partner_name": "Distribuidor ABC",
        "commission": "150.00"
      }
    }
  ]
}
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Emails queued for 2 recipients, waiting for invoice PDF",
  "recipients": [
    {
      "recipient_email": "cliente@ejemplo.com",
      "template_name": "invoice_client",
      "parent_log_id": "log-123",
      "pending_communication_id": "pending-456"
    },
    {
      "recipient_email": "partner@ejemplo.com",
      "template_name": "partner_commission",
      "parent_log_id": "log-124",
      "pending_communication_id": "pending-457"
    }
  ],
  "status": "queued"
}
```

### 2. Sistema Contable Genera el PDF

Cuando el PDF está listo:

```json
POST /generate-pdf
{
  "template_name": "invoice_pdf",
  "order_id": "ORD-12345",
  "data": {
    "invoice_number": "FAC-2024-001",
    "customer_name": "Juan Pérez",
    "items": [
      {"product": "Producto A", "quantity": 2, "price": "750.00"}
    ],
    "total": "1500.00"
  }
}
```

**El sistema automáticamente:**
1. Genera el PDF
2. Encuentra las comunicaciones pendientes con `order_id: "ORD-12345"`
3. Adjunta el mismo PDF a ambos emails
4. Envía los emails usando los templates correspondientes

**Respuesta final:**
```json
{
  "success": true,
  "message": "Emails sent successfully to 2 recipients",
  "recipients": [
    {
      "recipient": "cliente@ejemplo.com",
      "success": true,
      "log_id": "log-125"
    },
    {
      "recipient": "partner@ejemplo.com",
      "success": true,
      "log_id": "log-126"
    }
  ],
  "status": "sent"
}
```

---

## Templates de Ejemplo

### Template para Cliente: `invoice_client`

```html
<!DOCTYPE html>
<html>
<body>
  <h1>Factura {{invoice_number}}</h1>
  <p>Estimado/a {{customer_name}},</p>
  <p>Adjunto encontrará su factura por un total de ${{total}}.</p>
  <p>Fecha: {{invoice_date}}</p>
  <p>Gracias por su preferencia.</p>
</body>
</html>
```

### Template para Partner: `partner_commission`

```html
<!DOCTYPE html>
<html>
<body>
  <h1>Comisión Generada</h1>
  <p>Estimado/a {{partner_name}},</p>
  <p>Se ha generado una nueva comisión:</p>
  <ul>
    <li>Factura: {{invoice_number}}</li>
    <li>Fecha: {{invoice_date}}</li>
    <li>Total venta: ${{total}}</li>
    <li>Comisión ({{commission_percent}}): ${{commission_amount}}</li>
  </ul>
  <p>Adjunto encontrará una copia de la factura.</p>
</body>
</html>
```

---

## Ventajas

1. **Una sola llamada**: No necesitas hacer múltiples llamadas a la API
2. **Un solo PDF**: El mismo PDF se reutiliza para todos los destinatarios
3. **Templates personalizados**: Cada destinatario recibe un email con su propio contenido
4. **Datos compartidos y específicos**: Combina datos comunes con datos personalizados por destinatario
5. **Retrocompatible**: El formato antiguo sigue funcionando

---

## Envío Directo (Sin esperar PDF)

También puedes usar múltiples destinatarios sin el flujo de PDF:

```json
POST /pending-communication
{
  "recipients": [
    {
      "recipient_email": "cliente1@ejemplo.com",
      "template_name": "welcome_email",
      "data": {
        "name": "Juan"
      }
    },
    {
      "recipient_email": "cliente2@ejemplo.com",
      "template_name": "welcome_email",
      "data": {
        "name": "María"
      }
    }
  ]
}
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Emails sent successfully to 2 recipients",
  "recipients": [
    {
      "recipient": "cliente1@ejemplo.com",
      "success": true,
      "log_id": "log-130"
    },
    {
      "recipient": "cliente2@ejemplo.com",
      "success": true,
      "log_id": "log-131"
    }
  ]
}
```

---

## Manejo de Errores

Si algún template no existe o hay un error en un destinatario, el sistema:
- Continúa procesando los demás destinatarios
- Registra el error en los logs
- Devuelve un status 207 (Multi-Status) si algunos tuvieron éxito

```json
{
  "success": false,
  "message": "Some emails failed to send",
  "recipients": [
    {
      "recipient": "cliente@ejemplo.com",
      "success": true,
      "log_id": "log-140"
    },
    {
      "recipient": "partner@ejemplo.com",
      "success": false,
      "log_id": null
    }
  ]
}
```
