# Función `query`

API genérica de lectura y escritura sobre las tablas de `allowedTables`.

Con `QUERY_AUTH_MODE=enforce`, cada petición necesita el token del usuario
(`Authorization: Bearer`) y solo ve o modifica filas de sus aplicaciones, su
tenant o su usuario. Las reglas por tabla están en `tenant-scope.ts`. Sin la
variable (modo `legacy`) funciona como antes.

## Variables de entorno

| Variable | Para qué |
| --- | --- |
| `DATABASE_URL` y `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE` | Conexión a Postgres. Hoy el pool toma los datos de las variables `PG*`. |
| `API_KEY` | Key que manda el frontend en `x-api-key`. |
| `QUERY_AUTH_MODE` | `enforce` activa el aislamiento por tenant. Vacío = `legacy`. |
| `AUTH_UPSTREAM_VERIFY_URL` (o `AUTH_URL`) | Endpoint que valida el token del usuario. |
| `AUTH_APP_ID`, `AUTH_API_KEY` | Credenciales de la app ante el servicio de auth. |
| `QUERY_SERVICE_API_KEYS` | Keys de backends con acceso completo (separadas por coma). No usar la key del navegador. |
| `QUERY_SYSTEM_ADMIN_EMAILS` | Opcional. Por defecto `administrador@sendcraft.net`. |

## Probar en local

Hace falta [Deno 2](https://docs.deno.com/runtime/getting_started/installation/)
y Docker. Los comandos se corren desde la raíz del repo.

### 1. Tests automáticos (sin base de datos)

```bash
deno test --allow-env --allow-read apis-functions/query/tenant-scope.test.ts
```

### 2. Test de integración con un Postgres desechable

Crea dos tenants de prueba y verifica que ninguno pueda leer ni escribir datos
del otro. Usa un servicio de auth simulado, no el real.

```bash
docker run -d --name query-test -e POSTGRES_HOST_AUTH_METHOD=trust -p 55432:5432 postgres:16
docker exec query-test createdb -U postgres query_test

PGHOST=127.0.0.1 PGPORT=55432 PGUSER=postgres PGPASSWORD=x PGDATABASE=query_test \
QUERY_TEST_DATABASE_URL=postgres://postgres@127.0.0.1:55432/query_test \
deno test --no-check --allow-env --allow-net --allow-read --allow-sys \
  apis-functions/query/query.integration.test.ts

docker rm -f query-test
```

`--no-check` evita un error de tipos que ya existía en la creación del pool
(`connectionString` no es una opción de deno-postgres); no afecta al test.

### 3. Prueba manual contra una copia de la base

Usar un branch de Neon creado desde producción, nunca la base de producción.

```bash
export PGHOST=... PGPORT=5432 PGUSER=... PGPASSWORD=... PGDATABASE=... PGSSLMODE=require
export DATABASE_URL="postgres://..."   # la misma conexión
export API_KEY=local-key
export QUERY_AUTH_MODE=enforce
export AUTH_UPSTREAM_VERIFY_URL=...    # el mismo que usa auth-verify-token
export AUTH_APP_ID=... AUTH_API_KEY=...

deno run --allow-env --allow-net --allow-read --allow-sys apis-functions/query/dev-server.ts
```

Copia un token real: inicia sesión en la app y, en la consola del navegador,
ejecuta `localStorage.getItem('access_token')`.

```bash
TOKEN=eyJ...

# Sin token: debe responder 401
curl -s localhost:8787 -H 'x-api-key: local-key' -H 'Content-Type: application/json' \
  -d '{"table":"applications","operation":"select"}'

# Con token: solo las aplicaciones de tu usuario o tenant
curl -s localhost:8787 -H 'x-api-key: local-key' -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"table":"applications","operation":"select","select":"id,name,tenant_id"}'

# Logs de una aplicación de otro tenant: debe devolver data: []
curl -s localhost:8787 -H 'x-api-key: local-key' -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"table":"email_logs","operation":"select","filters":[{"column":"application_id","op":"eq","value":"<id-de-otra-app>"}]}'
```

## Migración

Las columnas e índices que usa el filtro por tenant ya están en el esquema base
(`infra/neon/migrations/20261008000000_baseline.sql`). Ver `infra/neon/README.md`.
