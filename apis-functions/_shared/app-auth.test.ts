import { assertEquals, assertRejects } from "jsr:@std/assert@1";
import {
  AppAuthError,
  authenticateApplication,
  buildUserContext,
  timingSafeEqual,
  type RowQuery,
} from "./app-auth.ts";

const COPIES = [
  "automation-monitoring",
  "automation-programs",
  "complete-pending-communication",
  "generate-pdf",
  "notify",
  "pending-communication",
  "send-email",
  "send-email-with-pdf",
];

function fakeQuery(handler: (sql: string, params: unknown[]) => Record<string, unknown>[]) {
  const calls: { sql: string; params: unknown[] }[] = [];
  const query: RowQuery = (sql, params) => {
    calls.push({ sql, params });
    return Promise.resolve(handler(sql, params));
  };
  return { query, calls };
}

function verifyFetch(body: unknown, ok = true): typeof fetch {
  return (() =>
    Promise.resolve(new Response(JSON.stringify(body), { status: ok ? 200 : 401 }))) as typeof fetch;
}

function withEnv(vars: Record<string, string | undefined>, fn: () => Promise<void>) {
  return async () => {
    const previous: Record<string, string | undefined> = {};
    for (const [k, v] of Object.entries(vars)) {
      previous[k] = Deno.env.get(k);
      if (v === undefined) Deno.env.delete(k);
      else Deno.env.set(k, v);
    }
    try {
      await fn();
    } finally {
      for (const [k, v] of Object.entries(previous)) {
        if (v === undefined) Deno.env.delete(k);
        else Deno.env.set(k, v);
      }
    }
  };
}

Deno.test("las copias en cada función son idénticas a la canónica", async () => {
  const canonical = await Deno.readTextFile(new URL("./app-auth.ts", import.meta.url));
  for (const fn of COPIES) {
    const copy = await Deno.readTextFile(new URL(`../${fn}/_shared/app-auth.ts`, import.meta.url));
    assertEquals(copy, canonical, `${fn}/_shared/app-auth.ts está desactualizada`);
  }
});

Deno.test("x-api-key busca por hash y reenvía la misma clave", async () => {
  const { query, calls } = fakeQuery(() => [{ id: "app-1" }]);
  const req = new Request("http://x", { headers: { "x-api-key": "sk_live_abc" } });
  const cred = await authenticateApplication(req, query);
  assertEquals(cred, {
    applicationId: "app-1",
    method: "api_key",
    forwardHeaders: { "x-api-key": "sk_live_abc" },
  });
  assertEquals(calls[0].params, ["sk_live_abc"]);
  assertEquals(calls[0].sql.includes("api_key_hash"), true);
});

Deno.test("API key desconocida da 401", async () => {
  const { query } = fakeQuery(() => []);
  const req = new Request("http://x", { headers: { "x-api-key": "nope" } });
  const err = await assertRejects(() => authenticateApplication(req, query), AppAuthError);
  assertEquals(err.status, 401);
});

Deno.test("sin credenciales da 401", async () => {
  const { query } = fakeQuery(() => []);
  const err = await assertRejects(
    () => authenticateApplication(new Request("http://x"), query),
    AppAuthError,
  );
  assertEquals(err.status, 401);
});

Deno.test(
  "clave interna válida autentica la aplicación indicada",
  withEnv({ FUNCTIONS_INTERNAL_KEY: "internal-secret" }, async () => {
    const { query } = fakeQuery(() => [{ id: "app-2" }]);
    const req = new Request("http://x", {
      headers: { "x-internal-key": "internal-secret", "x-application-id": "app-2" },
    });
    const cred = await authenticateApplication(req, query);
    assertEquals(cred.method, "internal");
    assertEquals(cred.forwardHeaders, { "x-internal-key": "internal-secret", "x-application-id": "app-2" });
  }),
);

Deno.test(
  "clave interna incorrecta o no configurada da 401",
  withEnv({ FUNCTIONS_INTERNAL_KEY: undefined }, async () => {
    const { query } = fakeQuery(() => [{ id: "app-2" }]);
    const req = new Request("http://x", {
      headers: { "x-internal-key": "anything", "x-application-id": "app-2" },
    });
    const err = await assertRejects(() => authenticateApplication(req, query), AppAuthError);
    assertEquals(err.status, 401);
  }),
);

Deno.test(
  "token de usuario: exige que la aplicación sea del usuario o su tenant",
  withEnv({ AUTH_VERIFY_URL: "http://auth/verify", FUNCTIONS_INTERNAL_KEY: undefined }, async () => {
    const { query, calls } = fakeQuery(() => [{ id: "app-3" }]);
    const req = new Request("http://x", {
      headers: { Authorization: "Bearer tok-1", "x-application-id": "app-3" },
    });
    const cred = await authenticateApplication(req, query, {
      fetchImpl: verifyFetch({ valid: true, user: { id: "u1", email: "a@b.com", tenant_id: "t1" } }),
    });
    assertEquals(cred.method, "user_token");
    assertEquals(cred.forwardHeaders, { Authorization: "Bearer tok-1", "x-application-id": "app-3" });
    assertEquals(calls[0].params, ["app-3", "u1", "t1"]);
    assertEquals(calls[0].sql.includes("user_id::text = $2 OR tenant_id::text = $3"), true);
  }),
);

Deno.test(
  "token de usuario sobre aplicación ajena da 403",
  withEnv({ AUTH_VERIFY_URL: "http://auth/verify" }, async () => {
    const { query } = fakeQuery(() => []);
    const req = new Request("http://x", {
      headers: { Authorization: "Bearer tok-2", "x-application-id": "app-ajena" },
    });
    const err = await assertRejects(
      () =>
        authenticateApplication(req, query, {
          fetchImpl: verifyFetch({ valid: true, user: { id: "u2", email: "c@d.com" } }),
        }),
      AppAuthError,
    );
    assertEquals(err.status, 403);
  }),
);

Deno.test(
  "token rechazado por el servicio de auth da 401",
  withEnv({ AUTH_VERIFY_URL: "http://auth/verify" }, async () => {
    const { query } = fakeQuery(() => [{ id: "app-3" }]);
    const req = new Request("http://x", {
      headers: { Authorization: "Bearer tok-3", "x-application-id": "app-3" },
    });
    const err = await assertRejects(
      () => authenticateApplication(req, query, { fetchImpl: verifyFetch({ valid: false }, false) }),
      AppAuthError,
    );
    assertEquals(err.status, 401);
  }),
);

Deno.test(
  "token de usuario con clave interna configurada reenvía la clave interna",
  withEnv({ AUTH_VERIFY_URL: "http://auth/verify", FUNCTIONS_INTERNAL_KEY: "internal-secret" }, async () => {
    const { query } = fakeQuery(() => [{ id: "app-4" }]);
    const req = new Request("http://x", {
      headers: { Authorization: "Bearer tok-4", "x-application-id": "app-4" },
    });
    const cred = await authenticateApplication(req, query, {
      fetchImpl: verifyFetch({ valid: true, user: { id: "u4" } }),
    });
    assertEquals(cred.forwardHeaders, { "x-internal-key": "internal-secret", "x-application-id": "app-4" });
  }),
);

Deno.test("administrador del sistema no filtra por dueño", () => {
  const ctx = buildUserContext(
    { valid: true, user: { id: "u9", email: "Administrador@SendCraft.net" } },
    null,
    ["administrador@sendcraft.net"],
  );
  assertEquals(ctx?.isSystemAdmin, true);
});

Deno.test("timingSafeEqual", () => {
  assertEquals(timingSafeEqual("abc", "abc"), true);
  assertEquals(timingSafeEqual("abc", "abd"), false);
  assertEquals(timingSafeEqual("abc", "abcd"), false);
});
