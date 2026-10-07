# Guía de Estructuras de Datos Complejas

## Introducción

CommHub soporta estructuras de datos complejas como objetos anidados y arrays, permitiéndote crear templates sofisticados para facturas, reportes y más.

## ¿Qué son las estructuras complejas?

Las estructuras complejas son:

1. **Objetos Anidados**: Datos organizados en jerarquías
2. **Arrays**: Listas de elementos que se repiten
3. **Combinaciones**: Arrays de objetos con propiedades anidadas

## Cómo Usar el Editor

### 1. Variables del Template (Auto-detectadas)

Cuando escribes tu template, el sistema automáticamente detecta y muestra todas las variables que usas:

- ✓ **Variables simples**: `{{cliente}}`, `{{total}}`
- 📦 **Variables anidadas**: `{{issuer.razon_social}}`
- 🔄 **Loops**: `{{#each items}}`

Estas aparecen en la sección **"Variables del Template"** en la barra lateral.

### 2. Sección "Estructuras Complejas"

En esta sección encuentras botones para insertar rápidamente:

#### 🔄 Loop sobre Array
Inserta un loop para iterar sobre una lista:

```html
{{#each items}}
  <tr>
    <td>{{descripcion}}</td>
    <td>{{cantidad}}</td>
    <td>{{precio}}</td>
  </tr>
{{/each}}
```

**Datos esperados:**
```json
{
  "items": [
    { "descripcion": "Item 1", "cantidad": 2, "precio": 100 },
    { "descripcion": "Item 2", "cantidad": 1, "precio": 50 }
  ]
}
```

#### ❓ Condicional Simple
Muestra contenido solo si una condición es verdadera:

```html
{{#if has_discount}}
  <p>Descuento: {{discount_amount}}</p>
{{/if}}
```

**Datos esperados:**
```json
{
  "has_discount": true,
  "discount_amount": "50.00"
}
```

#### ⚡ Condicional con Else
Muestra contenido alternativo:

```html
{{#if is_paid}}
  <span class="paid">Pagado</span>
{{else}}
  <span class="pending">Pendiente</span>
{{/if}}
```

**Datos esperados:**
```json
{
  "is_paid": false
}
```

#### 📦 Objeto Anidado
Accede a propiedades dentro de objetos:

```html
<p>Emisor: {{issuer.razon_social}}</p>
<p>RUT: {{issuer.rut}}</p>
```

**Datos esperados:**
```json
{
  "issuer": {
    "razon_social": "Mi Empresa S.A.",
    "rut": "211234560018"
  }
}
```

## Ejemplos Prácticos

### Ejemplo 1: Factura Simple

**Template:**
```html
<h1>Factura {{numero}}</h1>
<p>Cliente: {{cliente.nombre}}</p>
<p>Email: {{cliente.email}}</p>

<table>
  {{#each items}}
  <tr>
    <td>{{descripcion}}</td>
    <td>${{precio}}</td>
  </tr>
  {{/each}}
</table>

<p>Total: ${{total}}</p>
```

**JSON de datos:**
```json
{
  "numero": "FAC-001",
  "cliente": {
    "nombre": "Juan Pérez",
    "email": "juan@example.com"
  },
  "items": [
    { "descripcion": "Producto A", "precio": "100" },
    { "descripcion": "Producto B", "precio": "50" }
  ],
  "total": "150"
}
```

### Ejemplo 2: Factura Electrónica Completa

**Template:**
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #ddd; padding: 8px; }
  </style>
</head>
<body>
  <h1>Factura Electrónica</h1>

  <!-- Datos del Emisor (objeto anidado) -->
  <div class="emisor">
    <h2>Emisor</h2>
    <p><strong>Razón Social:</strong> {{issuer.razon_social}}</p>
    <p><strong>RUT:</strong> {{issuer.rut}}</p>
    <p><strong>Dirección:</strong> {{issuer.direccion}}</p>

    {{#if issuer.telefono}}
    <p><strong>Tel:</strong> {{issuer.telefono}}</p>
    {{/if}}
  </div>

  <!-- Datos de la Factura -->
  <div class="factura-info">
    <p><strong>N°:</strong> {{numero_cfe}}</p>
    <p><strong>Serie:</strong> {{serie}}</p>
    <p><strong>Fecha:</strong> {{fecha_emision}}</p>
    <p><strong>Moneda:</strong> {{moneda}}</p>
  </div>

  <!-- Items (loop sobre array) -->
  <h3>Detalle</h3>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Descripción</th>
        <th>Cant.</th>
        <th>P. Unit.</th>
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

  <!-- Totales -->
  <div class="totales">
    <p><strong>Subtotal:</strong> ${{subtotal}}</p>
    <p><strong>IVA:</strong> ${{iva}}</p>
    <p><strong>Total:</strong> ${{total}}</p>
  </div>

  <!-- Datos Adicionales (condicionales) -->
  {{#if datos_adicionales.observaciones}}
  <div class="observaciones">
    <h4>Observaciones</h4>
    <p>{{datos_adicionales.observaciones}}</p>
  </div>
  {{/if}}

  {{#if datos_adicionales.forma_pago}}
  <p><strong>Forma de pago:</strong> {{datos_adicionales.forma_pago}}</p>
  {{/if}}

  <!-- Validación DGI (objeto anidado con condicionales) -->
  {{#if response_payload.dgi_estado}}
  <div class="validacion-dgi">
    <h4>Validación DGI</h4>
    <p><strong>Estado:</strong> {{response_payload.dgi_estado}}</p>
    <p><strong>CAE:</strong> {{response_payload.cae}}</p>
    <p><strong>Venc. CAE:</strong> {{response_payload.vencimiento_cae}}</p>

    {{#if response_payload.qr_code}}
    <img src="{{response_payload.qr_code}}" alt="QR DGI" />
    {{/if}}
  </div>
  {{/if}}
</body>
</html>
```

**JSON de datos:**
```json
{
  "numero_cfe": "INV-1729567890",
  "serie": "A",
  "fecha_emision": "2025-10-22",
  "moneda": "UYU",
  "issuer": {
    "razon_social": "Empresa Demo S.A.",
    "rut": "211234560018",
    "direccion": "Av. Principal 123",
    "telefono": "+598 2 1234567"
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
      "precio_unitario": 409.84,
      "iva_porcentaje": 22,
      "subtotal": 819.68,
      "iva": 180.33,
      "total": 1000.01
    }
  ],
  "subtotal": 819.67,
  "iva": 180.33,
  "total": 1000.00,
  "datos_adicionales": {
    "observaciones": "Venta al público",
    "forma_pago": "Efectivo"
  },
  "response_payload": {
    "dgi_estado": "aprobado",
    "cae": "12345678901234",
    "vencimiento_cae": "2025-10-29",
    "qr_code": "https://servicios.dgi.gub.uy/cfe?id=abc123"
  }
}
```

## Flujo de Trabajo Recomendado

### 1. Diseña tu Estructura de Datos

Primero define cómo se verán tus datos:

```json
{
  "factura": {
    "numero": "...",
    "fecha": "..."
  },
  "cliente": {
    "nombre": "...",
    "email": "..."
  },
  "items": [...]
}
```

### 2. Crea el Template

1. Abre el editor de templates
2. Usa los botones de "Estructuras Complejas" para insertar loops y condicionales
3. Personaliza las variables según tu estructura

### 3. Observa las Variables Detectadas

El panel "Variables del Template" te mostrará:
- Todas las variables que usaste
- Cuáles son objetos anidados (📦)
- Cuáles son loops (🔄)

### 4. Prueba con Datos Reales

Envía datos de prueba a tu API para verificar que todo funciona:

```bash
curl -X POST https://your-project.supabase.co/functions/v1/send-email \
  -H "x-api-key: your_api_key" \
  -H "Content-Type: application/json" \
  -d @datos-prueba.json
```

## Tips y Mejores Prácticas

### ✅ Recomendado

1. **Usa nombres descriptivos**: `cliente.nombre` es mejor que `c.n`
2. **Organiza por contexto**: Agrupa datos relacionados en objetos
3. **Valida datos antes**: Asegúrate que los arrays no sean `null`
4. **Usa condicionales**: Para campos opcionales, usa `{{#if}}`

### ❌ Evitar

1. **No uses arrays vacíos sin validar**: Siempre envía al menos un array vacío `[]`
2. **No anides demasiado**: Máximo 3-4 niveles de anidación
3. **No uses nombres con espacios**: Usa `nombre_cliente` en lugar de `nombre cliente`
4. **No calcules en el template**: Calcula `subtotal`, `iva`, etc. antes de enviar

## Solución de Problemas

### Problema: Las variables no se reemplazan

**Causa**: Nombre incorrecto o datos faltantes

**Solución**:
1. Verifica el panel "Variables del Template"
2. Asegúrate que los nombres coincidan exactamente
3. Revisa que los datos JSON tengan la estructura correcta

### Problema: El loop no muestra nada

**Causa**: Array vacío o undefined

**Solución**:
```javascript
// ✓ Correcto
const data = {
  items: invoiceItems || []  // Array vacío si no hay items
};

// ✗ Incorrecto
const data = {
  items: invoiceItems  // Podría ser undefined
};
```

### Problema: Variables anidadas no funcionan

**Causa**: Objeto null o undefined

**Solución**:
```javascript
// ✓ Correcto
const data = {
  issuer: {
    razon_social: company.name || 'N/A',
    rut: company.taxId || ''
  }
};

// ✗ Incorrecto
const data = {
  issuer: company  // Podría ser null
};
```

## Soporte

Para más ayuda:
- Revisa la documentación completa en `TEMPLATE_SYSTEM.md`
- Consulta los ejemplos en la sección "Documentación" de la app
- Contacta a soporte técnico si tienes dudas
