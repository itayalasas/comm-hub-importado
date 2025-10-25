# Configuración Dinámica de Variables de Entorno

Este proyecto utiliza un sistema de configuración dinámica que carga las variables de entorno desde una API al iniciar la aplicación, en lugar de usar archivos `.env` estáticos.

## ¿Cómo funciona?

### 1. Carga al Inicio
Al iniciar la aplicación (`main.tsx`), se hace una llamada a la API de configuración:

```
GET https://ffihaeatoundrjzgtpzk.supabase.co/functions/v1/get-env
Header: X-Access-Key: 4ceffb91030a93e1e3670ca95f8b63976517745a64ace0aa8b86e7861884ca45
```

### 2. Respuesta de la API
La API retorna un JSON con las variables de configuración:

```json
{
  "project_name": "Comm-Hub",
  "description": "Comunicaciones centralizadas",
  "variables": {
    "VITE_SUPABASE_URL": "https://...",
    "VITE_SUPABASE_ANON_KEY": "eyJhbG...",
    "VITE_AUTH_API_KEY": "ak_production_...",
    "VITE_AUTH_APP_ID": "app_...",
    "VITE_AUTH_URL": "https://...",
    "VITE_REDIRECT_URI": "https://..."
  },
  "updated_at": "2025-10-25T04:48:20.450809+00:00"
}
```

### 3. Pantallas de Estado

- **Cargando**: Se muestra un spinner mientras se cargan las configuraciones
- **Error**: Si falla la carga, se muestra un mensaje de error con botón de reintento
- **Éxito**: Se renderiza la aplicación normalmente

## Archivos Principales

### `src/lib/config.ts`
Gestiona la carga y acceso a las variables de configuración:

```typescript
import { configManager } from './lib/config';

// Acceder a variables
const supabaseUrl = configManager.supabaseUrl;
const authApiKey = configManager.authApiKey;
```

### `src/lib/supabase.ts`
Cliente de Supabase que se inicializa dinámicamente:

```typescript
import { supabase } from './lib/supabase';

// Usar como siempre
const { data } = await supabase.from('table').select('*');
```

### `src/contexts/AuthContext.tsx`
Sistema de autenticación usando configuración dinámica.

## Ventajas

✅ **Sin archivos `.env`**: No es necesario mantener archivos de configuración locales
✅ **Centralizado**: Todas las configuraciones se gestionan desde un solo lugar
✅ **Dinámico**: Los cambios en la configuración se aplican sin necesidad de rebuild
✅ **Seguro**: Las credenciales no se exponen en el repositorio
✅ **Multi-entorno**: Fácil de cambiar entre diferentes configuraciones

## Desarrollo Local

Para desarrollo local, la aplicación cargará automáticamente la configuración desde la API al iniciar. No es necesario configurar nada adicional.

## Producción

El mismo sistema funciona en producción. La aplicación siempre carga la configuración más reciente al iniciar.

## Troubleshooting

### Error: "Failed to load config"
- Verifica que la API esté disponible
- Verifica que el `X-Access-Key` sea correcto
- Revisa la consola del navegador para más detalles

### Error: "Configuration not loaded"
- Este error indica que se intentó usar Supabase antes de que la configuración se cargara
- El sistema debería prevenir esto automáticamente
- Si ocurre, reporta el bug con los pasos para reproducirlo
