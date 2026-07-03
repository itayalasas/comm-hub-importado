# Gotenberg Setup

## Que montar y donde

La decision depende de **donde corre tu Supabase Edge Function**:

### Opcion A: Supabase cloud hospedado por Supabase

Si tu proyecto usa Supabase cloud, la Edge Function **no puede llamar a `localhost` ni a una IP privada de tu laptop**.

En este caso, Gotenberg debe vivir en un servicio accesible por red desde Supabase, por ejemplo:

- Cloud Run
- Azure Container Apps
- un VM/VPS con Docker
- Kubernetes
- cualquier host de contenedores con HTTPS publico

La URL que pondras en secrets sera algo como:

```env
GOTENBERG_URL=https://pdf.tudominio.com
```

### Opcion B: Supabase self-hosted

Si tienes Supabase en Docker o Kubernetes junto con tus servicios, Gotenberg puede vivir **en la misma red interna**.

En ese caso, la URL puede ser interna:

```env
GOTENBERG_URL=http://gotenberg:3000
```

Esta es la opcion mas limpia y segura si todo corre en tu propia infraestructura.

## Recomendacion para este proyecto

Por el repo actual:

- el frontend parece desplegarse aparte, con [netlify.toml](./netlify.toml)
- las Edge Functions estan pensadas para Supabase

Entonces, **si tu Supabase esta en la nube de Supabase**, lo normal es montar Gotenberg como un contenedor separado en cloud y exponerlo por HTTPS.

## Configuracion minima recomendada

### 1. Docker Compose local o self-hosted

Hay un ejemplo listo en:

- [infra/gotenberg/docker-compose.yml](./infra/gotenberg/docker-compose.yml)

Levantarlo:

```bash
docker compose -f infra/gotenberg/docker-compose.yml up -d
```

En ese ejemplo:

- usa `gotenberg/gotenberg:8-chromium`
- expone solo `127.0.0.1:3000`
- activa Basic Auth
- auto-arranca Chromium
- sube timeouts y limites razonables para PDFs HTML

### 2. Variables en Supabase Edge Functions

Configura estos secrets:

```bash
supabase secrets set GOTENBERG_URL=https://pdf.tudominio.com
supabase secrets set GOTENBERG_BASIC_AUTH_USERNAME=admin
supabase secrets set GOTENBERG_BASIC_AUTH_PASSWORD=tu_password_seguro
supabase secrets set GOTENBERG_WAIT_DELAY=1s
```

Si Gotenberg corre en red interna con Supabase self-hosted:

```bash
supabase secrets set GOTENBERG_URL=http://gotenberg:3000
supabase secrets set GOTENBERG_BASIC_AUTH_USERNAME=admin
supabase secrets set GOTENBERG_BASIC_AUTH_PASSWORD=tu_password_seguro
supabase secrets set GOTENBERG_WAIT_DELAY=1s
```

`GOTENBERG_WAIT_DELAY` es opcional. Sirve si algun template necesita una pequena espera antes de imprimir.

## Como securizarlo

### Recomendado

- no expongas Gotenberg directo a internet si puedes evitarlo
- si lo expones, ponlo detras de HTTPS
- usa Basic Auth o un reverse proxy
- limita acceso por firewall/IP cuando sea posible

La function ya soporta enviar Basic Auth usando:

- `GOTENBERG_BASIC_AUTH_USERNAME`
- `GOTENBERG_BASIC_AUTH_PASSWORD`

## Opcion muy recomendada para produccion

### Cloud Run

Gotenberg publica imagenes preparadas para Cloud Run, por ejemplo:

- `gotenberg/gotenberg:8-cloudrun`
- `gotenberg/gotenberg:8-chromium-cloudrun`

Si quieres una opcion administrada y simple, esta suele ser muy buena.

En ese caso, tu `GOTENBERG_URL` seria la URL HTTPS del servicio.

## Health check

La function `health-check-pdf` ahora prueba una conversion real contra Gotenberg.

Si falla, revisa:

- `GOTENBERG_URL`
- usuario/password
- que el servicio responda en `/health`
- memoria del contenedor

## Valores sugeridos

Para empezar:

```env
API_TIMEOUT=120s
API_BODY_LIMIT=20MB
CHROMIUM_AUTO_START=true
CHROMIUM_START_TIMEOUT=30s
CHROMIUM_RESTART_AFTER=50
CHROMIUM_MAX_CONCURRENCY=4
CHROMIUM_MAX_QUEUE_SIZE=16
```

Si luego tienes mas trafico, escala horizontalmente con mas instancias.
