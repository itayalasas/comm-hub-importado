# Ejemplo JSON Correcto para Variables Anidadas

## El Problema

Si tu template usa variables anidadas como:
```
{{response_payload.numero_cfe}}
{{issuer.serie}}
{{issuer.fecha_emision}}
```

Tu JSON **DEBE** tener esa estructura anidada.

## ❌ JSON Incorrecto (Plano)

```json
{
  "template_name": "invoice_email_service",
  "recipient_email": "payalaortiz@gmail.com",
  "base_data": {
    "numero_cfe": "INV-001",
    "serie": "A",
    "fecha_emision": "2025-10-22",
    "cae": "12345678901234"
  }
}
```

**Resultado:**
- `{{response_payload.numero_cfe}}` → No se encuentra, queda vacío
- `{{issuer.serie}}` → No se encuentra, queda vacío

## ✅ JSON Correcto (Anidado)

```json
{
  "template_name": "invoice_email_service",
  "recipient_email": "payalaortiz@gmail.com",
  "base_data": {
    "response_payload": {
      "numero_cfe": "INV-1729567890-a2396dce",
      "cae": "12345678901234",
      "vencimiento_cae": "2025-10-29",
      "qr_code": "https://dgi.gub.uy/..."
    },
    "issuer": {
      "serie": "A",
      "fecha_emision": "2025-10-22",
      "moneda": "UYU",
      "subtotal": 819.67,
      "iva": 180.33,
      "total": 1000.00
    },
    "items": [
      {
        "descripcion": "Producto A",
        "cantidad": 2,
        "precio_unitario": 409.84,
        "iva_porcentaje": 22,
        "subtotal": 819.68,
        "iva": 180.33,
        "total": 1000.01
      }
    ]
  }
}
```

**Resultado:**
- `{{response_payload.numero_cfe}}` → `INV-1729567890-a2396dce` ✅
- `{{issuer.serie}}` → `A` ✅
- `{{issuer.fecha_emision}}` → `2025-10-22` ✅
- `{{issuer.moneda}}` → `UYU` ✅

## Ejemplo Completo para Factura

```json
{
  "template_name": "invoice_email_service",
  "recipient_email": "payalaortiz@gmail.com",
  "base_data": {
    "response_payload": {
      "success": true,
      "approved": true,
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
    },
    "issuer": {
      "razon_social": "Empresa Demo S.A.",
      "rut": "211234560018",
      "direccion": "Av. Principal 123",
      "ciudad": "Montevideo",
      "telefono": "+598 2xxx xxxx",
      "email": "contacto@empresa.com",
      "serie": "A",
      "fecha_emision": "2025-10-22",
      "moneda": "UYU",
      "subtotal": 819.67,
      "iva": 180.33,
      "total": 1000.00
    },
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
        "precio_unitario": 200.00,
        "iva_porcentaje": 22,
        "subtotal": 200.00,
        "iva": 44.00,
        "total": 244.00
      }
    ],
    "datos_adicionales": {
      "observaciones": "Venta al público",
      "forma_pago": "Efectivo"
    }
  }
}
```

## Cómo Mapear tus Datos

Si tu sistema tiene datos en formato plano, agrúpalos antes de enviar:

```javascript
// Datos originales (planos)
const facturaData = {
  numero_cfe: "INV-001",
  serie: "A",
  fecha: "2025-10-22",
  cae: "12345678901234",
  // ... más campos
};

// Transformar a estructura anidada
const requestData = {
  template_name: "invoice_email_service",
  recipient_email: "cliente@example.com",
  base_data: {
    response_payload: {
      numero_cfe: facturaData.numero_cfe,
      cae: facturaData.cae,
      vencimiento_cae: facturaData.vencimiento_cae,
      qr_code: facturaData.qr_code,
    },
    issuer: {
      serie: facturaData.serie,
      fecha_emision: facturaData.fecha,
      moneda: facturaData.moneda,
      subtotal: facturaData.subtotal,
      iva: facturaData.iva,
      total: facturaData.total,
    },
    items: facturaData.items, // Ya es un array
  }
};

// Enviar
await fetch('https://xxx.supabase.co/functions/v1/pending-communication', {
  method: 'POST',
  headers: {
    'x-api-key': 'your_api_key',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(requestData),
});
```

## Reglas para Variables Anidadas

1. **La estructura del JSON debe coincidir con el template**
   - Template usa `{{issuer.serie}}` → JSON debe tener `issuer.serie`
   - Template usa `{{response_payload.cae}}` → JSON debe tener `response_payload.cae`

2. **Los puntos indican niveles de anidación**
   - `{{user.name}}` busca `data.user.name`
   - `{{company.address.street}}` busca `data.company.address.street`

3. **Arrays se acceden con #each**
   - `{{#each items}}{{descripcion}}{{/each}}`
   - Requiere que `data.items` sea un array

## Verificar tu Template

Para ver qué variables usa tu template, búscalas en el código:

```javascript
// Extraer todas las variables
const template = `tu HTML aquí`;
const variables = template.match(/\{\{([a-zA-Z0-9_.]+)\}\}/g);
console.log(variables);

// Output: ['{{response_payload.numero_cfe}}', '{{issuer.serie}}', ...]
```

Luego asegúrate de que tu JSON tenga exactamente esa estructura.

## Debugging

Si las variables no aparecen:

1. **Verifica la estructura del JSON** - Usa un validador JSON
2. **Verifica los nombres** - Deben coincidir exactamente (case-sensitive)
3. **Verifica la anidación** - `issuer.serie` requiere `{ issuer: { serie: "A" } }`
4. **Revisa los logs** - El edge function imprime las variables recibidas

```sql
-- Ver metadata del último email enviado
SELECT metadata
FROM email_logs
ORDER BY created_at DESC
LIMIT 1;
```

El campo `metadata.data` contiene exactamente lo que el template engine recibió.
