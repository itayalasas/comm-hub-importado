# Neon Migrations

This folder contains PostgreSQL migrations for the Neon database.

- Run the SQL files in order.
- `web_access_attempts` is the access analytics table used by the admin dashboard and `/query`.
- The schema is designed for one row per access attempt, identified by `attempt_id`.
