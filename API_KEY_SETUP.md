# API Key - Configuración y Uso

## ¿Dónde se genera el API Key?

El **API Key** se genera **automáticamente** cuando creas una nueva aplicación en el Dashboard.

### Ubicación de Generación

**Archivo:** `src/pages/Dashboard.tsx` (línea 59-60)

```typescript
const apiKey = `ak_${Math.random().toString(36).substr(2, 32)}`;
```

Cuando creas una aplicación, el sistema:
1. Genera un `app_id` único: `app_XXXXXXXXX`
2. Genera un `api_key` único: `ak_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX`
3. Los guarda en la tabla `applications` de Supabase

## ¿Para qué sirve el API Key?

El API Key se usa para **autenticar las llamadas a las Edge Functions** de Supabase desde aplicaciones externas.

### Edge Functions que requieren API Key:

1. **`send-email`** - Enviar emails con templates
2. **`generate-pdf`** - Generar PDFs desde templates
3. **`pending-communication`** - Crear comunicaciones pendientes
4. **`track-email`** - Registrar aperturas y clicks

## ¿Cómo se usa el API Key?

### Header de Autenticación

Todas las llamadas a las Edge Functions deben incluir el header `x-api-key`:

```javascript
const headers = {
  'Content-Type': 'application/json',
  'x-api-key': 'tu_api_key_aqui'
};
```

### Ejemplo completo - Enviar Email

```javascript
const supabaseUrl = 'https://tu-proyecto.supabase.co';
const apiKey = 'ak_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx'; // Obtenido del Dashboard

const response = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': apiKey
  },
  body: JSON.stringify({
    template_name: 'welcome_email',
    recipient_email: 'user@example.com',
    data: {
      name: 'Juan Pérez',
      company: 'Mi Empresa'
    }
  })
});

const result = await response.json();
console.log(result);
```

### Ejemplo - Generar PDF

```javascript
const response = await fetch(`${supabaseUrl}/functions/v1/generate-pdf`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': apiKey
  },
  body: JSON.stringify({
    pdf_template_name: 'invoice_pdf',
    data: {
      client_name: 'Juan Pérez',
      invoice_number: 'FAC-001',
      total: '$150.00'
    },
    external_reference_id: 'INV-12345'
  })
});

const result = await response.json();
// result.data.pdf_base64 contiene el PDF en base64
```

## ¿Cómo obtener tu API Key?

1. Ve al **Dashboard** en tu aplicación CommHub
2. Encuentra tu aplicación en la lista
3. El **API Key** se muestra en una tarjeta con el icono de llave 🔑
4. Haz clic en el icono de copiar para copiar al portapapeles

## Seguridad

⚠️ **IMPORTANTE:**

- **NUNCA** compartas tu API Key públicamente
- **NUNCA** la incluyas en código que esté en repositorios públicos
- **Guárdala** en variables de entorno (.env) en tus proyectos
- Cada aplicación tiene su propio API Key único
- Si crees que tu API Key ha sido comprometida, elimina la aplicación y crea una nueva

## Variables de Entorno (Recomendado)

### En Node.js / Express

```bash
# .env
COMMHUB_API_KEY=ak_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
COMMHUB_SUPABASE_URL=https://tu-proyecto.supabase.co
```

```javascript
// app.js
require('dotenv').config();

const apiKey = process.env.COMMHUB_API_KEY;
const supabaseUrl = process.env.COMMHUB_SUPABASE_URL;
```

### En React / Next.js

```bash
# .env.local
NEXT_PUBLIC_COMMHUB_API_KEY=ak_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_COMMHUB_SUPABASE_URL=https://tu-proyecto.supabase.co
```

```javascript
// component.jsx
const apiKey = process.env.NEXT_PUBLIC_COMMHUB_API_KEY;
```

## Validación en las Edge Functions

Las Edge Functions validan el API Key de la siguiente manera:

```typescript
// Extrae el API key del header
const apiKey = req.headers.get('x-api-key');

if (!apiKey) {
  return new Response(JSON.stringify({ error: 'API key required' }), {
    status: 401,
    headers: corsHeaders
  });
}

// Busca la aplicación con ese API key
const { data: application } = await supabase
  .from('applications')
  .select('*')
  .eq('api_key', apiKey)
  .single();

if (!application) {
  return new Response(JSON.stringify({ error: 'Invalid API key' }), {
    status: 401,
    headers: corsHeaders
  });
}
```

## Resumen

| Campo | Descripción | Ejemplo |
|-------|-------------|---------|
| **Generación** | Automática al crear aplicación | `Dashboard.tsx:59-60` |
| **Formato** | `ak_` + 32 caracteres alfanuméricos | `ak_a1b2c3d4e5f6...` |
| **Uso** | Header `x-api-key` en llamadas API | `'x-api-key': 'ak_...'` |
| **Ubicación** | Dashboard → Aplicación → API Key | Icono 🔑 |
| **Seguridad** | Variable de entorno (.env) | `COMMHUB_API_KEY=ak_...` |
