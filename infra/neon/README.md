# Migraciones de Neon

Las migraciones se aplican con [dbmate](https://github.com/amacneil/dbmate), que
queda instalado con `npm ci`. dbmate guarda en la tabla `schema_migrations` qué
versiones ya corrieron.

```sh
export DATABASE_URL="postgres://usuario:clave@host/base?sslmode=require"
npm run db:status    # qué falta aplicar
npm run db:migrate   # aplica lo pendiente
npm run db:new -- nombre_del_cambio   # crea una migración nueva
```

- `migrations/20261008000000_baseline.sql` es el esquema completo de la rama dev
  al 2026-10-08. Con todas las migraciones se puede crear una base desde cero, y
  el CI lo comprueba en cada PR contra un Postgres vacío.
- Cada archivo tiene `-- migrate:up` y `-- migrate:down`. Un `CREATE INDEX
  CONCURRENTLY` va solo en su archivo y con `transaction:false`.
- `pendientes/` tiene cambios que no se pueden deshacer y que se corren a mano
  cuando se cumplen sus condiciones. dbmate no los lee.

## Empezar a usar dbmate en una base que ya existe

Esto se hace una vez por base (dev, producción). La base ya tiene el esquema
base, así que solo hay que marcarlo como aplicado:

```sql
CREATE TABLE IF NOT EXISTS schema_migrations (version varchar(128) PRIMARY KEY);
INSERT INTO schema_migrations (version) VALUES ('20261008000000') ON CONFLICT DO NOTHING;
```

Después, `npm run db:migrate` corre el resto. Esas migraciones se pueden repetir
sin problema: crean tablas e índices solo si faltan y recalculan los hashes de API key.

Producción puede tener tablas que dev no tiene, o al revés. Antes de marcar la
base conviene comparar los esquemas, por ejemplo con
`pg_dump --schema-only` de las dos.
