# Flujo de APIs dedicadas

```mermaid
flowchart TD
  A[Usuario inicia sesion o vuelve a cargar la app] --> B[AuthContext lee sesion y suscripcion]
  B --> C{La suscripcion tiene acceso_api_dedicado?}

  C -- No --> D[Usar FUNCTIONS_BASE_URL publica]
  D --> E[Continuar con login, checkout y APIs normales]

  C -- Si --> F[Leer URL_SERVER_DEDICADO desde /get-env]
  F --> G[Consultar tenant_dedicated_api_servers por tenant_key]
  G --> H{Hay registro?}
  H -- Si --> I[Tomar base_url y public_hostname]
  I --> J[Sincronizar localStorage como cache]
  J --> K[Reemplazar FUNCTIONS_BASE_URL efectiva solo para APIs de la app]
  K --> L[Renderizar loading corto de conexion]
  L --> M[App usa la URL dedicada para consultas y endpoints]

  H -- No --> N[Armar request de aprovisionamiento]
  N --> N1[name = tenantName]
  N --> N2[subdomain = tenantName normalizado]
  N --> N3[cpu, memory, minReplicas, maxReplicas, storageMountPath, domain]
  N --> N4[api_key de la app si esta disponible]
  N --> O[POST al proxy /provision-dedicated-api]
  O --> O1[Proxy reenvia body + x-api-key al URL_SERVER_DEDICADO]

  O1 --> P{Respuesta OK?}
  P -- Si --> Q[Tomar deployment.publicHostname]
  Q --> R[Guardar en tenant_dedicated_api_servers]
  R --> S[Guardar nueva base URL en localStorage]
  S --> T[Reemplazar FUNCTIONS_BASE_URL efectiva solo para APIs de la app]
  T --> U[Renderizar loading de aprovisionamiento mientras termina]
  U --> M

  P -- 500 Clone failed --> V[Leer publicHostname o hostname del error]
  V --> R

  P -- No --> W[Fallback a la base publica]
  W --> X[Mostrar loading/estado de respaldo]
  X --> E

  M --> Y[Auth, refresh y checkout siguen usando la base publica]
```

## Decisiones clave

- `FUNCTIONS_BASE_URL` sigue siendo la base publica/central.
- `URL_SERVER_DEDICADO` es la URL del servicio que aprovisiona el tenant dedicado.
- El navegador llama a `/provision-dedicated-api` y el backend hace el POST real al servicio externo, reenviando `x-api-key` o `api_key` cuando existen.
- La relation `tenant -> servidor dedicado` se persiste en `tenant_dedicated_api_servers` y `localStorage` queda solo como cache local.
- `publicHostname` es la URL efectiva que usa la app una vez creado el servidor.
- Si el clon ya existe, se reutiliza el hostname existente en vez de romper el flujo.
- Durante el aprovisionamiento se muestra un estado de carga especifico para que el usuario entienda que esta pasando.
