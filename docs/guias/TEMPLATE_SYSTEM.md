# Sistema de Templates Avanzado

## Descripción

CommHub incluye un motor de templates robusto que soporta variables dinámicas, loops sobre arrays y condicionales. Este sistema permite crear templates complejos para facturas, reportes y otros documentos que requieren iteración sobre datos.

## Sintaxis Soportada

### 1. Variables Simples

```html
<h1>Hola {{client_name}}</h1>
<p>Total: ${{total}}</p>
```

**Datos:**
```json
{
  "client_name": "Juan Pérez",
  "total": "1500.00"
}
```

### 2. Variables Anidadas

Accede a propiedades dentro de objetos usando la notación de punto:

```html
<p>Empresa: {{issuer.razon_social}}</p>
<p>RUT: {{issuer.rut_emisor}}</p>
<p>Observaciones: {{datos_adicionales.observaciones}}</p>
```

**Datos:**
```json
{
  "issuer": {
    "razon_social": "Mi Empresa S.A.",
    "rut_emisor": "211234560018"
  },
  "datos_adicionales": {
    "observaciones": "Pago al contado"
  }
}
```

### 3. Loops (Iteración sobre Arrays)

Usa `{{#each array}}` para iterar sobre arrays:

```html
<table>
  <thead>
    <tr>
      <th>Descripción</th>
      <th>Cantidad</th>
      <th>Precio</th>
      <th>Total</th>
    </tr>
  </thead>
  <tbody>
    {{#each items}}
    <tr>
      <td>{{descripcion}}</td>
      <td>{{cantidad}}</td>
      <td>${{precio_unitario}}</td>
      <td>${{total}}</td>
    </tr>
    {{/each}}
  </tbody>
</table>
```

**Datos:**
```json
{
  "items": [
    {
      "descripcion": "Producto A",
      "cantidad": 2,
      "precio_unitario": 100.00,
      "total": 200.00
    },
    {
      "descripcion": "Producto B",
      "cantidad": 1,
      "precio_unitario": 150.00,
      "total": 150.00
    }
  ]
}
```

### 4. Variables Especiales en Loops

Dentro de un loop, tienes acceso a variables especiales:

- `{{@index}}` - Índice del elemento (comienza en 0)
- `{{@number}}` - Número del elemento (comienza en 1)
- `{{this}}` - El valor actual (para arrays de valores primitivos)

```html
<ul>
  {{#each tags}}
  <li>Tag #{{@number}}: {{this}}</li>
  {{/each}}
</ul>
```

**Datos:**
```json
{
  "tags": ["urgente", "cliente-vip", "prioridad-alta"]
}
```

**Resultado:**
```html
<ul>
  <li>Tag #1: urgente</li>
  <li>Tag #2: cliente-vip</li>
  <li>Tag #3: prioridad-alta</li>
</ul>
```

### 5. Condicionales

Muestra contenido solo si una condición es verdadera:

```html
{{#if has_discount}}
<div class="discount">
  <p>Descuento aplicado: ${{discount_amount}}</p>
</div>
{{/if}}

{{#if customer.is_vip}}
<div class="vip-badge">Cliente VIP</div>
{{/if}}
```

**Datos:**
```json
{
  "has_discount": true,
  "discount_amount": "50.00",
  "customer": {
    "is_vip": true
  }
}
```

### 6. Condicionales con Else

```html
{{#if payment_status}}
<span class="status-paid">Pagado</span>
{{else}}
<span class="status-pending">Pendiente de pago</span>
{{/if}}
```

## Ejemplo Completo: Factura Electrónica

### Template HTML

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #f2f2f2; }
    .header { text-align: center; margin-bottom: 20px; }
    .totals { margin-top: 20px; text-align: right; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Factura Electrónica</h1>
    <h2>{{numero_cfe}} - Serie {{serie}}</h2>
  </div>

  <div class="info">
    <p><strong>Emisor:</strong> {{razon_social_emisor}}</p>
    <p><strong>RUT:</strong> {{rut_emisor}}</p>
    <p><strong>Fecha:</strong> {{fecha_emision}}</p>
    <p><strong>Moneda:</strong> {{moneda}}</p>
  </div>

  <h3>Detalle de Items</h3>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Descripción</th>
        <th>Cantidad</th>
        <th>P. Unitario</th>
        <th>IVA %</th>
        <th>Subtotal</th>
        <th>IVA</th>
        <th>Total</th>
      </tr>
    </thead>
    <tbody>
      {{#each items}}
      <tr>
        <td>{{@number}}</td>
        <td>{{descripcion}}</td>
        <td>{{cantidad}}</td>
        <td>${{precio_unitario}}</td>
        <td>{{iva_porcentaje}}%</td>
        <td>${{subtotal}}</td>
        <td>${{iva}}</td>
        <td>${{total}}</td>
      </tr>
      {{/each}}
    </tbody>
  </table>

  <div class="totals">
    <p><strong>Subtotal:</strong> ${{subtotal}}</p>
    <p><strong>IVA:</strong> ${{iva}}</p>
    <p><strong>Total:</strong> ${{total}}</p>
  </div>

  {{#if datos_adicionales.observaciones}}
  <div class="notes">
    <h4>Observaciones</h4>
    <p>{{datos_adicionales.observaciones}}</p>
  </div>
  {{/if}}

  {{#if datos_adicionales.forma_pago}}
  <div class="payment">
    <p><strong>Forma de pago:</strong> {{datos_adicionales.forma_pago}}</p>
  </div>
  {{/if}}

  {{#if response_payload.qr_code}}
  <div class="qr-section">
    <h4>Código QR</h4>
    <img src="{{response_payload.qr_code}}" alt="QR Code" />
    <p>CAE: {{response_payload.cae}}</p>
    <p>Vencimiento: {{response_payload.vencimiento_cae}}</p>
  </div>
  {{/if}}
</body>
</html>
```

### Datos JSON

```json
{
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
    "dgi_estado": "aprobado"
  }
}
```

## Mejores Prácticas

### 1. Validación de Datos

Siempre valida que los arrays existan antes de enviarlos:

```javascript
// ✓ Correcto
const data = {
  items: invoiceItems || [],  // Array vacío si no hay items
  has_discount: Boolean(discount),  // Booleano explícito
};

// ✗ Incorrecto
const data = {
  items: invoiceItems,  // Podría ser undefined
  has_discount: discount,  // Podría ser cualquier cosa
};
```

### 2. Estructura de Objetos Anidados

Mantén una estructura clara y consistente:

```json
{
  "issuer": {
    "name": "...",
    "tax_id": "..."
  },
  "customer": {
    "name": "...",
    "email": "..."
  },
  "items": [...],
  "totals": {
    "subtotal": 100,
    "tax": 22,
    "total": 122
  }
}
```

### 3. Nombres Descriptivos

Usa nombres claros y consistentes:

```html
<!-- ✓ Bien -->
{{#each invoice_items}}
  <td>{{item_description}}</td>
{{/each}}

<!-- ✗ Evitar -->
{{#each i}}
  <td>{{desc}}</td>
{{/each}}
```

### 4. Valores por Defecto

El motor maneja valores nulos automáticamente:

- Variables no encontradas se reemplazan con cadena vacía
- Loops sobre arrays vacíos no generan contenido
- Condicionales sobre valores falsy no muestran el bloque

## Limitaciones

1. **No hay operaciones matemáticas**: No puedes hacer `{{price * quantity}}` en el template. Calcula estos valores antes de enviar los datos.

2. **No hay helpers personalizados**: No puedes crear funciones personalizadas como `{{formatDate date}}`. Formatea los datos antes de enviarlos.

3. **No hay comparaciones complejas**: Los condicionales solo verifican truthiness. Para comparaciones complejas, prepara un campo booleano.

## Debugging

Si un template no se renderiza correctamente:

1. Verifica que los tags estén balanceados:
   - Cada `{{#each}}` debe tener su `{{/each}}`
   - Cada `{{#if}}` debe tener su `{{/if}}`

2. Verifica la estructura de datos:
   - Los nombres de propiedades son case-sensitive
   - Las propiedades anidadas usan notación de punto

3. Revisa los logs en la función edge:
   - Los errores de rendering se registran en los logs
   - Puedes ver qué datos se recibieron

## Soporte

Para más información, consulta la documentación en la aplicación o contacta a soporte técnico.
