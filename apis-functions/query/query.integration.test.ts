// Prueba de integración del aislamiento por tenant contra un Postgres real.
// Solo corre si QUERY_TEST_DATABASE_URL apunta a una base vacía y desechable:
//   QUERY_TEST_DATABASE_URL=postgres://postgres@127.0.0.1:5432/query_test \
//     deno test --allow-env --allow-net --allow-read query.integration.test.ts
import { assertEquals } from "jsr:@std/assert@1";
import { Pool } from "https://deno.land/x/postgres@v0.19.3/mod.ts";

const databaseUrl = Deno.env.get("QUERY_TEST_DATABASE_URL");

const TENANT_A = "11111111-1111-1111-1111-111111111111";
const TENANT_B = "22222222-2222-2222-2222-222222222222";
const APP_A = "aaaaaaaa-0000-0000-0000-000000000001";
const APP_B = "bbbbbbbb-0000-0000-0000-000000000002";
const LOG_B = "bbbbbbbb-1111-0000-0000-000000000002";

const USERS: Record<string, unknown> = {
  "tok-alice": { valid: true, user: { id: "u-alice", email: "alice@a.com", tenant_id: TENANT_A } },
  "tok-bob": { valid: true, user: { id: "u-bob", email: "bob@b.com", tenant_id: TENANT_B } },
  "tok-admin": { valid: true, user: { id: "u-admin", email: "administrador@sendcraft.net" } },
};

async function setupDatabase(pool: Pool) {
  const client = await pool.connect();
  try {
    await client.queryArray(`
      DROP TABLE IF EXISTS applications, email_logs, audit_logs, user_preferences, web_access_attempts;
      CREATE TABLE applications (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text, user_id text, tenant_id text, api_key text);
      CREATE TABLE email_logs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), application_id uuid, status text);
      CREATE TABLE audit_logs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid, action text, ip_address text, user_agent text);
      CREATE TABLE user_preferences (user_id text PRIMARY KEY, theme text);
      CREATE TABLE web_access_attempts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text, event_type text,
        ip_address text, country_code text, country_name text);
      INSERT INTO applications (id, name, user_id, tenant_id, api_key) VALUES
        ('${APP_A}', 'A', 'u-alice', '${TENANT_A}', 'key-a'),
        ('${APP_B}', 'B', 'u-bob', '${TENANT_B}', 'key-b');
      INSERT INTO email_logs (id, application_id, status) VALUES
        (gen_random_uuid(), '${APP_A}', 'sent'),
        ('${LOG_B}', '${APP_B}', 'sent');
      INSERT INTO audit_logs (tenant_id, action) VALUES ('${TENANT_A}', 'a'), ('${TENANT_B}', 'b');
      INSERT INTO user_preferences (user_id, theme) VALUES ('u-bob', 'dark');
    `);
  } finally {
    client.release();
  }
}

Deno.test({
  name: "query isolates tenants in enforce mode",
  ignore: !databaseUrl,
  sanitizeOps: false,
  sanitizeResources: false,
  async fn(t) {
    const pool = new Pool(databaseUrl!, 1, true);
    await setupDatabase(pool);

    const authServer = Deno.serve({ port: 0, onListen() {} }, async (req) => {
      const { token } = await req.json();
      const body = USERS[token];
      return body ? Response.json(body) : new Response("invalid", { status: 401 });
    });

    Deno.env.set("DATABASE_URL", databaseUrl!);
    Deno.env.set("API_KEY", "public-key");
    Deno.env.set("QUERY_SERVICE_API_KEYS", "service-key");
    Deno.env.set("AUTH_UPSTREAM_VERIFY_URL", `http://127.0.0.1:${authServer.addr.port}/verify`);
    Deno.env.set("QUERY_AUTH_MODE", "enforce");

    const { default: handler } = await import("./index.ts");

    async function call(body: Record<string, unknown>, opts: { key?: string; token?: string } = {}) {
      const headers: Record<string, string> = { "Content-Type": "application/json", "x-api-key": opts.key ?? "public-key" };
      if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
      const res = await handler(new Request("http://localhost/query", { method: "POST", headers, body: JSON.stringify(body) }));
      return { status: res.status, json: await res.json() };
    }

    const logsOf = (rows: Array<{ application_id: string }>) => rows.map((r) => r.application_id).sort();

    await t.step("public key without a session is rejected", async () => {
      const res = await call({ table: "email_logs", operation: "select" });
      assertEquals(res.status, 401);
    });

    await t.step("invalid session is rejected", async () => {
      const res = await call({ table: "email_logs", operation: "select" }, { token: "tok-nope" });
      assertEquals(res.status, 401);
    });

    await t.step("service key keeps full access", async () => {
      const res = await call({ table: "email_logs", operation: "select" }, { key: "service-key" });
      assertEquals(logsOf(res.json.data), [APP_A, APP_B]);
    });

    await t.step("user only sees own rows", async () => {
      const logs = await call({ table: "email_logs", operation: "select" }, { token: "tok-alice" });
      assertEquals(logsOf(logs.json.data), [APP_A]);

      const apps = await call({ table: "applications", operation: "select" }, { token: "tok-alice" });
      assertEquals(apps.json.data.map((a: { id: string }) => a.id), [APP_A]);

      const audit = await call({ table: "audit_logs", operation: "select" }, { token: "tok-alice" });
      assertEquals(audit.json.data.map((a: { action: string }) => a.action), ["a"]);
    });

    await t.step("filters by another tenant return nothing", async () => {
      const res = await call({
        table: "email_logs",
        operation: "select",
        filters: [{ column: "application_id", op: "eq", value: APP_B }],
      }, { token: "tok-alice" });
      assertEquals(res.json.data, []);
    });

    await t.step("update and delete cannot touch another tenant", async () => {
      const filters = [{ column: "id", op: "eq", value: LOG_B }];
      const upd = await call({ table: "email_logs", operation: "update", data: { status: "hacked" }, filters }, { token: "tok-alice" });
      assertEquals(upd.json.count, 0);
      const del = await call({ table: "email_logs", operation: "delete", filters }, { token: "tok-alice" });
      assertEquals(del.json.count, 0);

      const check = await call({ table: "email_logs", operation: "select", filters }, { token: "tok-bob" });
      assertEquals(check.json.data[0].status, "sent");
    });

    await t.step("insert into a foreign application is forbidden", async () => {
      const res = await call({ table: "email_logs", operation: "insert", data: { application_id: APP_B, status: "x" } }, { token: "tok-alice" });
      assertEquals(res.status, 403);
      const ok = await call({ table: "email_logs", operation: "insert", data: { application_id: APP_A, status: "x" } }, { token: "tok-alice" });
      assertEquals(ok.status, 200);
    });

    await t.step("update cannot move a row to a foreign application", async () => {
      const res = await call({
        table: "email_logs",
        operation: "update",
        data: { application_id: APP_B },
        filters: [{ column: "status", op: "eq", value: "x" }],
      }, { token: "tok-alice" });
      assertEquals(res.status, 403);
    });

    await t.step("upsert cannot overwrite another user's row", async () => {
      const foreign = await call({
        table: "user_preferences",
        operation: "upsert",
        data: { user_id: "u-bob", theme: "light" },
        onConflict: "user_id",
      }, { token: "tok-alice" });
      assertEquals(foreign.status, 403);

      const own = await call({
        table: "user_preferences",
        operation: "upsert",
        data: { theme: "light" },
        onConflict: "user_id",
      }, { token: "tok-alice" });
      assertEquals(own.status, 200);
      assertEquals(own.json.data[0].user_id, "u-alice");

      const bob = await call({ table: "user_preferences", operation: "select" }, { token: "tok-bob" });
      assertEquals(bob.json.data[0].theme, "dark");
    });

    await t.step("anonymous login tracking can insert but not read", async () => {
      const ins = await call({ table: "web_access_attempts", operation: "insert", data: { email: "x@y.z", event_type: "login_failed" } });
      assertEquals(ins.status, 200);
      const anonRead = await call({ table: "web_access_attempts", operation: "select" });
      assertEquals(anonRead.status, 401);
      const userRead = await call({ table: "web_access_attempts", operation: "select" }, { token: "tok-alice" });
      assertEquals(userRead.status, 403);
      const adminRead = await call({ table: "web_access_attempts", operation: "select" }, { token: "tok-admin" });
      assertEquals(adminRead.json.data.length, 1);
    });

    await t.step("system admin sees every tenant", async () => {
      const res = await call({ table: "applications", operation: "select" }, { token: "tok-admin" });
      assertEquals(res.json.data.length, 2);
    });

    await t.step("legacy mode keeps the old behavior", async () => {
      Deno.env.set("QUERY_AUTH_MODE", "legacy");
      const res = await call({ table: "applications", operation: "select" });
      assertEquals(res.json.data.length, 2);
      Deno.env.set("QUERY_AUTH_MODE", "enforce");
    });

    await authServer.shutdown();
    await pool.end();
  },
});
