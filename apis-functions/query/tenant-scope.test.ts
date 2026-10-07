import { assert, assertEquals, assertRejects } from "jsr:@std/assert@1";
import {
  buildScopeCondition,
  buildUserContext,
  enforceRowScope,
  mergeWhere,
  ScopeError,
  TABLE_SCOPES,
  type UserContext,
  verifyUserToken,
} from "./tenant-scope.ts";

const alice: UserContext = { userId: "u-alice", email: "alice@a.com", tenantId: "t-a", isSystemAdmin: false };
const noTenant: UserContext = { userId: "u-solo", email: "solo@x.com", tenantId: null, isSystemAdmin: false };
const admin: UserContext = { userId: "u-admin", email: "administrador@sendcraft.net", tenantId: null, isSystemAdmin: true };

function fakeJwt(payload: Record<string, unknown>): string {
  const enc = (v: unknown) => btoa(JSON.stringify(v)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
  return `${enc({ alg: "HS256" })}.${enc(payload)}.sig`;
}

Deno.test("every table allowed by query has a scope rule", async () => {
  const source = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
  const block = source.match(/const allowedTables = \[([\s\S]*?)\];/);
  assert(block, "allowedTables not found");
  const tables = [...block[1].matchAll(/"([a-z_]+)"/g)].map((m) => m[1]);
  for (const table of tables) {
    assert(TABLE_SCOPES[table], `missing scope for ${table}`);
  }
});

Deno.test("owner scope matches user or tenant", () => {
  const params: unknown[] = [];
  const sql = buildScopeCondition("applications", alice, params);
  assertEquals(sql, `("user_id"::text = $1 OR "tenant_id"::text = $2)`);
  assertEquals(params, ["u-alice", "t-a"]);
});

Deno.test("owner scope without tenant only matches the user", () => {
  const params: unknown[] = [];
  assertEquals(buildScopeCondition("applications", noTenant, params), `("user_id"::text = $1)`);
  assertEquals(params, ["u-solo"]);
});

Deno.test("application scope continues parameter numbering", () => {
  const params: unknown[] = ["already"];
  const sql = buildScopeCondition("email_logs", alice, params);
  assertEquals(
    sql,
    `"application_id" IN (SELECT "id" FROM "applications" WHERE ("user_id"::text = $2 OR "tenant_id"::text = $3))`,
  );
  assertEquals(params, ["already", "u-alice", "t-a"]);
});

Deno.test("qualified scope for upsert DO UPDATE", () => {
  const params: unknown[] = [];
  const sql = buildScopeCondition("user_preferences", alice, params, "user_preferences");
  assertEquals(sql, `"user_preferences"."user_id"::text = $1`);
});

Deno.test("tenant scope denies users without tenant", () => {
  assertEquals(buildScopeCondition("audit_logs", noTenant, []), "FALSE");
});

Deno.test("system admin is not scoped", () => {
  const params: unknown[] = [];
  assertEquals(buildScopeCondition("email_logs", admin, params), "TRUE");
  assertEquals(params, []);
});

Deno.test("unknown table is rejected", () => {
  let error: unknown;
  try {
    buildScopeCondition("secrets", alice, []);
  } catch (e) {
    error = e;
  }
  assert(error instanceof ScopeError);
});

Deno.test("mergeWhere appends the scope", () => {
  assertEquals(mergeWhere("", "X"), "WHERE X");
  assertEquals(mergeWhere(`WHERE "id" = $1`, "X"), `WHERE "id" = $1 AND X`);
});

const lookup = (owned: string[]) => (ids: string[]) => Promise.resolve(new Set(ids.filter((id) => owned.includes(id))));

Deno.test("insert into application table requires an owned application", async () => {
  await enforceRowScope("email_logs", [{ application_id: "app-1" }], alice, lookup(["app-1"]), { fillMissing: true });
  await assertRejects(
    () => enforceRowScope("email_logs", [{ application_id: "app-2" }], alice, lookup(["app-1"]), { fillMissing: true }),
    ScopeError,
  );
  await assertRejects(
    () => enforceRowScope("email_logs", [{ subject: "x" }], alice, lookup(["app-1"]), { fillMissing: true }),
    ScopeError,
  );
});

Deno.test("update that moves a row to a foreign application is rejected", async () => {
  await enforceRowScope("email_logs", [{ status: "sent" }], alice, lookup([]), { fillMissing: false });
  await assertRejects(
    () => enforceRowScope("email_logs", [{ application_id: "app-2" }], alice, lookup(["app-1"]), { fillMissing: false }),
    ScopeError,
  );
});

Deno.test("tenant and user columns are filled or checked", async () => {
  const row: Record<string, unknown> = { action: "login" };
  await enforceRowScope("audit_logs", [row], alice, lookup([]), { fillMissing: true });
  assertEquals(row.tenant_id, "t-a");
  await assertRejects(
    () => enforceRowScope("audit_logs", [{ tenant_id: "t-b" }], alice, lookup([]), { fillMissing: true }),
    ScopeError,
  );

  const pref: Record<string, unknown> = {};
  await enforceRowScope("user_preferences", [pref], alice, lookup([]), { fillMissing: true });
  assertEquals(pref.user_id, "u-alice");
});

Deno.test("applications insert must belong to the user and tenant", async () => {
  await enforceRowScope("applications", [{ user_id: "u-alice", tenant_id: "t-a" }], alice, lookup([]), { fillMissing: true });
  await assertRejects(
    () => enforceRowScope("applications", [{ user_id: "u-bob" }], alice, lookup([]), { fillMissing: true }),
    ScopeError,
  );
  await assertRejects(
    () => enforceRowScope("applications", [{ user_id: "u-alice", tenant_id: "t-b" }], alice, lookup([]), { fillMissing: true }),
    ScopeError,
  );
});

Deno.test("buildUserContext reads nested auth responses", () => {
  const ctx = buildUserContext(
    { data: { valid: true, user: { id: "u-1", email: "Ana@X.com", tenant_id: "t-9" } } },
    null,
    ["admin@x.com"],
  );
  assertEquals(ctx, { userId: "u-1", email: "ana@x.com", tenantId: "t-9", isSystemAdmin: false });
});

Deno.test("buildUserContext rejects invalid tokens and flags admins", () => {
  assertEquals(buildUserContext({ valid: false, user: { id: "u-1" } }, null, []), null);
  assertEquals(buildUserContext({ valid: true }, null, []), null);
  const ctx = buildUserContext({ valid: true }, { sub: "u-2", email: "admin@x.com" }, ["admin@x.com"]);
  assertEquals(ctx?.isSystemAdmin, true);
});

Deno.test("verifyUserToken calls the auth service once and caches", async () => {
  Deno.env.set("AUTH_UPSTREAM_VERIFY_URL", "https://auth.test/verify");
  let calls = 0;
  const fakeFetch = (() => {
    calls++;
    return Promise.resolve(Response.json({ valid: true, user: { id: "u-1", email: "a@b.c", tenant_id: "t-1" } }));
  }) as typeof fetch;

  const token = fakeJwt({ sub: "u-1", exp: Math.floor(Date.now() / 1000) + 600 });
  const first = await verifyUserToken(token, fakeFetch);
  const second = await verifyUserToken(token, fakeFetch);
  assertEquals(first?.tenantId, "t-1");
  assertEquals(second, first);
  assertEquals(calls, 1);
});

Deno.test("verifyUserToken rejects expired tokens and failed verifications", async () => {
  Deno.env.set("AUTH_UPSTREAM_VERIFY_URL", "https://auth.test/verify");
  const neverCalled = (() => {
    throw new Error("should not call");
  }) as typeof fetch;
  const expired = fakeJwt({ sub: "u-1", exp: Math.floor(Date.now() / 1000) - 10 });
  assertEquals(await verifyUserToken(expired, neverCalled), null);

  const unauthorized = (() => Promise.resolve(new Response("no", { status: 401 }))) as typeof fetch;
  assertEquals(await verifyUserToken(fakeJwt({ sub: "u-3" }), unauthorized), null);
});
