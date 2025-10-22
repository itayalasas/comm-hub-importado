# Guía de Formato JSON y Registro de Errores

## Error Común: JSON Inválido

### ❌ JSON Incorrecto (con llave extra)

Este JSON **NO funcionará** porque tiene un `}` extra:

```json
{
  "template_name": "invoice_email_service",
  "recipient_email": "payalaortiz@gmail.com",
  "base_data": {
    "numero_cfe": "INV-001",
    "items": [...]
  },
  "response_payload": {
    "success": true
  }
  },  ← ❌ LLAVE EXTRA AQUÍ CAUSA ERROR
  "pending_fields": [...]
}
```

**Error que verás:**
```
"Unexpected non-whitespace character after JSON at position 1547 (line 55 column 4)"
```

### ✅ JSON Correcto

```json
{
  "template_name": "invoice_email_service",
  "recipient_email": "payalaortiz@gmail.com",
  "base_data": {
    "numero_cfe": "INV-1729567890-a2396dce",
    "serie": "A",
    "rut_emisor": "211234560018",
    "razon_social_emisor": "Empresa Demo S.A.",
    "fecha_emision": "2025-10-22",
    "moneda": "UYU",
    "subtotal": 819.67,
    "iva": 180.33,
    "total": 1000.00,
    "items": [
      {
        "descripcion": "Producto o Servicio",
        "cantidad": 2,
        "precio_unitario": 409.84,
        "iva_porcentaje": 22,
        "subtotal": 819.68,
        "iva": 180.33,
        "total": 1000.01
      }
    ],
    "datos_adicionales": {
      "observaciones": "Venta al público",
      "forma_pago": "Efectivo"
    },
    "response_payload": {
      "success": true,
      "approved": true,
      "cae": "12345678901234",
      "vencimiento_cae": "2025-10-29"
    }
  }
}
```

## Endpoints Disponibles

### 1. `/functions/v1/send-email` - Envío Directo

Envía un email inmediatamente con o sin PDF adjunto.

**Campos:**
- `template_name` (required): Nombre del template
- `recipient_email` (required): Email del destinatario
- `data` (required): Datos para el template

**Ejemplo:**
```json
{
  "template_name": "invoice_email",
  "recipient_email": "cliente@example.com",
  "data": {
    "numero_cfe": "INV-001",
    "cliente": "Juan Pérez",
    "total": 1000
  }
}
```

### 2. `/functions/v1/pending-communication` - Envío Simplificado

Wrapper que llama internamente a `send-email`. Útil para mantener compatibilidad.

**Campos:**
- `template_name` (required): Nombre del template
- `recipient_email` (required): Email del destinatario
- `data` o `base_data` (required): Datos para el template

**Ejemplo:**
```json
{
  "template_name": "invoice_email",
  "recipient_email": "cliente@example.com",
  "base_data": {
    "numero_cfe": "INV-001",
    "items": [...]
  }
}
```

## Registro de Errores

Ahora **TODOS los errores se registran** en `email_logs`:

### Errores Registrados:

1. **JSON Inválido**
   - Se guarda el body raw (primeros 1000 caracteres)
   - Se registra el error de parsing
   - Email: `unknown@error.com`
   - Status: `failed`

2. **Campos Faltantes**
   - Se registran los datos recibidos
   - Email: El proporcionado o `unknown@error.com`
   - Status: `failed`

3. **Template No Encontrado**
   - Se registra el nombre del template buscado
   - Se guardan todos los datos del request
   - Status: `failed`

4. **Error al Enviar Email**
   - Se registra el error de SMTP
   - Se guarda el tiempo de procesamiento
   - Status: `failed`

### Ver Logs de Errores

En el dashboard, verás TODOS los intentos incluyendo:
- ✅ Emails enviados exitosamente
- ❌ Errores de JSON
- ❌ Templates no encontrados
- ❌ Errores de SMTP
- ❌ Cualquier otro error

## Tips para Evitar Errores

### 1. Valida tu JSON antes de enviar

Usa herramientas online:
- https://jsonlint.com/
- https://jsonformatter.org/

O en tu código:
```javascript
try {
  JSON.parse(jsonString);
  console.log('✓ JSON válido');
} catch (e) {
  console.error('✗ JSON inválido:', e.message);
}
```

### 2. Estructura Correcta de Datos Anidados

```json
{
  "base_data": {
    "campo1": "valor1",
    "objeto_anidado": {
      "subcampo": "valor"
    },
    "array": [
      { "item": 1 },
      { "item": 2 }
    ]
  }
}
```

**NO pongas objetos fuera de `base_data` a menos que sean campos de nivel superior como `pending_fields`**

### 3. Verifica las Llaves

Cada `{` debe tener su `}`
Cada `[` debe tener su `]`

Usa un editor con syntax highlighting para ver los pares.

### 4. Usa el Formato Correcto

```json
{
  "base_data": {
    "issuer": {
      "razon_social": "...",
      "rut": "..."
    },
    "response_payload": {
      "cae": "...",
      "qr_code": "..."
    }
  }
}
```

NO así:
```json
{
  "base_data": {
    "issuer": {...}
  },
  "response_payload": {...}
}
```

## Resumen

- ✅ Todos los requests se registran (exitosos y fallidos)
- ✅ Los errores de JSON se detectan y registran
- ✅ Puedes usar `data` o `base_data` indistintamente
- ✅ Los templates no encontrados se registran
- ✅ Cualquier error se guarda con detalles completos

## JSON Corregido Completo

```json
{
  "template_name": "invoice_email_service",
  "recipient_email": "payalaortiz@gmail.com",
  "base_data": {
    "numero_cfe": "INV-1729567890-a2396dce",
    "serie": "A",
    "rut_emisor": "211234560018",
    "razon_social_emisor": "Empresa Demo S.A.",
    "fecha_emision": "2025-10-22",
    "moneda": "UYU",
    "subtotal": 819.67,
    "iva": 180.33,
    "total": 1000.00,
    "items": [
      {
        "descripcion": "Producto o Servicio A",
        "cantidad": 2,
        "precio_unitario": 409.84,
        "iva_porcentaje": 22,
        "subtotal": 819.68,
        "iva": 180.33,
        "total": 1000.01
      },
      {
        "descripcion": "Producto o Servicio B",
        "cantidad": 1,
        "precio_unitario": 409.84,
        "iva_porcentaje": 22,
        "subtotal": 819.68,
        "iva": 180.33,
        "total": 1000.01
      }
    ],
    "datos_adicionales": {
      "observaciones": "Venta al público",
      "forma_pago": "Efectivo"
    },
    "response_payload": {
      "success": true,
      "approved": true,
      "reference": "CFE-123456789",
      "numero_cfe": "101000001",
      "serie_cfe": "A",
      "tipo_cfe": "101",
      "cae": "12345678901234",
      "vencimiento_cae": "2025-10-29",
      "qr_code": "https://servicios.dgi.gub.uy/cfe?id=abc123...",
      "dgi_estado": "aprobado",
      "dgi_codigo_autorizacion": "AUTH12345",
      "dgi_mensaje": "Comprobante aprobado correctamente",
      "dgi_id_efactura": "EF-987654321",
      "dgi_fecha_validacion": "2025-10-22T14:35:22Z"
    }
  }
}
```
