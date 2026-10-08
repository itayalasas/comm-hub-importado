import { assertEquals, assertRejects } from "jsr:@std/assert@1";

// usage-enforcement.ts todavía no pasa el chequeo de tipos estricto (TS2347:
// `client.queryObject<T>()` con `client: any`). Importarlo con una ruta
// calculada evita que `deno test` lo chequee; volver a un import estático
// cuando se tipe el cliente.
type EnforceUsageQuotaParams = {
  client: unknown;
  tenantId: string | null;
  userId: string | null;
  usageFeatureCode: "total_de_correos_mensuales" | "pdf_generations_monthly";
  overageFeatureCode: "email_overage_price" | "pdf_overage_price";
  communicationTypes: string[];
  idempotencyKey: string;
};
type EnforceUsageQuotaResult = { allowed: boolean; charged: boolean; blockedReason?: string };
const moduleUrl = new URL("./usage-enforcement.ts", import.meta.url).href;
const { enforceUsageQuota } = (await import(moduleUrl)) as {
  enforceUsageQuota: (params: EnforceUsageQuotaParams) => Promise<EnforceUsageQuotaResult>;
};

// enforceUsageQuota recibe el cliente de Postgres por parámetro, pero usa el
// fetch global y Deno.env; los tests reemplazan ambos y los restauran al final.

const ENV_KEYS = [
  "AUTH_FUNCTIONS_BASE_URL",
  "AUTH_EDGE_FUNCTIONS_BASE_URL",
  "AUTH_URL",
  "VITE_AUTH_URL",
  "FUNCTIONS_BASE_URL",
  "AUTH_APP_ID",
  "AUTH_API_KEY",
  "FUNCTIONS_INTERNAL_KEY",
  "SENDCRAFT_DASHBOARD_URL",
  "PUBLIC_APP_URL",
  "VITE_APP_URL",
];

const BASE_ENV: Record<string, string> = {
  AUTH_FUNCTIONS_BASE_URL: "https://auth.test/",
  AUTH_APP_ID: "auth-app",
  AUTH_API_KEY: "auth-key",
  FUNCTIONS_BASE_URL: "https://sc.test",
  FUNCTIONS_INTERNAL_KEY: "internal",
  SENDCRAFT_DASHBOARD_URL: "https://dash.test/",
};

const PERIOD = { start: "2026-10-01T00:00:00.000Z", end: "2026-10-31T23:59:59.000Z" };

type FetchCall = { url: string; init: RequestInit; body: any };
type Route = (call: FetchCall) => Response | Promise<Response>;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function limitsOk(overrides: Record<string, unknown> = {}) {
  return json({
    success: true,
    data: {
      limits: { total_de_correos_mensuales: 100 },
      period: PERIOD,
      overage_prices: { email_overage_price: 2 },
      plan_name: "Pro",
      payer_email: "payer@test",
      ...overrides,
    },
  });
}

function fakeClient(opts: {
  appIds?: string[];
  usage?: number;
  existingNotice?: boolean;
  platformApiKey?: string | null;
  failOn?: RegExp;
} = {}) {
  const calls: { sql: string; params: unknown[] }[] = [];
  const client = {
    queryObject(sql: string, params: unknown[]) {
      calls.push({ sql, params });
      if (opts.failOn?.test(sql)) return Promise.reject(new Error("db caída"));
      if (sql.includes("SELECT id FROM applications")) {
        return Promise.resolve({ rows: (opts.appIds ?? ["app-1", "app-2"]).map((id) => ({ id })) });
      }
      if (sql.includes("COUNT(*)")) {
        return Promise.resolve({ rows: [{ count: String(opts.usage ?? 0) }] });
      }
      if (sql.includes("usage_threshold_notice") && sql.includes("SELECT id")) {
        return Promise.resolve({ rows: opts.existingNotice ? [{ id: "n1" }] : [] });
      }
      if (sql.includes("INSERT INTO email_logs")) return Promise.resolve({ rows: [] });
      if (sql.includes("SELECT api_key FROM applications")) {
        return Promise.resolve({ rows: opts.platformApiKey ? [{ api_key: opts.platformApiKey }] : [] });
      }
      return Promise.reject(new Error(`SQL inesperado: ${sql}`));
    },
  };
  return { client, calls };
}

function params(client: unknown, overrides: Partial<EnforceUsageQuotaParams> = {}): EnforceUsageQuotaParams {
  return {
    client,
    tenantId: "tenant-1",
    userId: "user-1",
    usageFeatureCode: "total_de_correos_mensuales",
    overageFeatureCode: "email_overage_price",
    communicationTypes: ["email", "email_pdf"],
    idempotencyKey: "idem-1",
    ...overrides,
  };
}

// Corre fn con el entorno y el fetch dados; routes se elige por sufijo de URL.
function scenario(
  env: Record<string, string | undefined>,
  routes: Record<string, Route>,
  fn: (fetchCalls: FetchCall[]) => Promise<void>,
) {
  return async () => {
    const previousEnv: Record<string, string | undefined> = {};
    for (const key of ENV_KEYS) {
      previousEnv[key] = Deno.env.get(key);
      Deno.env.delete(key);
    }
    for (const [k, v] of Object.entries(env)) if (v !== undefined) Deno.env.set(k, v);

    const fetchCalls: FetchCall[] = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: string | URL | Request, init: RequestInit = {}) => {
      const url = String(input);
      const call = { url, init, body: init.body ? JSON.parse(String(init.body)) : undefined };
      fetchCalls.push(call);
      const route = Object.entries(routes).find(([suffix]) => url.endsWith(suffix));
      if (!route) throw new Error(`fetch inesperado: ${url}`);
      return await route[1](call);
    }) as typeof fetch;

    const originalWarn = console.warn;
    const originalLog = console.log;
    console.warn = () => {};
    console.log = () => {};
    try {
      await fn(fetchCalls);
    } finally {
      globalThis.fetch = originalFetch;
      console.warn = originalWarn;
      console.log = originalLog;
      for (const [k, v] of Object.entries(previousEnv)) {
        if (v === undefined) Deno.env.delete(k);
        else Deno.env.set(k, v);
      }
    }
  };
}

const urls = (calls: FetchCall[]) => calls.map((c) => c.url);

Deno.test(
  "sin tenant ni usuario se permite sin consultar nada",
  scenario(BASE_ENV, {}, async (fetchCalls) => {
    const { client, calls } = fakeClient();
    const result = await enforceUsageQuota(params(client, { tenantId: null, userId: null }));
    assertEquals(result, { allowed: true, charged: false });
    assertEquals(fetchCalls.length, 0);
    assertEquals(calls.length, 0);
  }),
);

Deno.test(
  "sin configuración de AuthSystem se falla abierto",
  scenario({ ...BASE_ENV, AUTH_API_KEY: undefined }, {}, async (fetchCalls) => {
    const { client } = fakeClient();
    assertEquals(await enforceUsageQuota(params(client)), { allowed: true, charged: false });
    assertEquals(fetchCalls.length, 0);
  }),
);

Deno.test(
  "usa AUTH_URL como respaldo y quita las barras finales",
  scenario(
    { ...BASE_ENV, AUTH_FUNCTIONS_BASE_URL: undefined, AUTH_URL: "https://auth2.test//" },
    { "/application-usage-limits": () => json({ success: false }) },
    async (fetchCalls) => {
      const { client } = fakeClient();
      await enforceUsageQuota(params(client));
      assertEquals(urls(fetchCalls), ["https://auth2.test/application-usage-limits"]);
    },
  ),
);

Deno.test(
  "envía las credenciales de AuthSystem al pedir los límites",
  scenario(BASE_ENV, { "/application-usage-limits": () => json({ success: false }) }, async (fetchCalls) => {
    const { client } = fakeClient();
    await enforceUsageQuota(params(client));
    assertEquals(fetchCalls[0].url, "https://auth.test/application-usage-limits");
    assertEquals(fetchCalls[0].body, {
      application_id: "auth-app",
      api_key: "auth-key",
      tenant_id: "tenant-1",
      app_user_id: "user-1",
    });
  }),
);

Deno.test(
  "si AuthSystem falla o responde sin éxito se falla abierto sin tocar la base",
  async (t) => {
    const cases: Record<string, Route> = {
      "red caída": () => Promise.reject(new TypeError("network")),
      "HTTP 500": () => json({ success: true, data: {} }, 500),
      "success false": () => json({ success: false }),
      "cuerpo no JSON": () => new Response("<html>", { status: 200 }),
    };
    for (const [name, route] of Object.entries(cases)) {
      await t.step(
        name,
        scenario(BASE_ENV, { "/application-usage-limits": route }, async () => {
          const { client, calls } = fakeClient();
          assertEquals(await enforceUsageQuota(params(client)), { allowed: true, charged: false });
          assertEquals(calls.length, 0);
        }),
      );
    }
  },
);

Deno.test(
  "sin límite numérico para la feature se permite (incluye límites como string)",
  async (t) => {
    for (const limit of [null, undefined, "100", Infinity]) {
      await t.step(
        String(limit),
        scenario(
          BASE_ENV,
          { "/application-usage-limits": () => limitsOk({ limits: { total_de_correos_mensuales: limit } }) },
          async () => {
            const { client, calls } = fakeClient();
            assertEquals(await enforceUsageQuota(params(client)), { allowed: true, charged: false });
            assertEquals(calls.length, 0);
          },
        ),
      );
    }
  },
);

Deno.test(
  "con tenant busca apps por tenant; sin tenant, por usuario sin tenant",
  scenario(BASE_ENV, { "/application-usage-limits": () => limitsOk() }, async () => {
    const withTenant = fakeClient({ usage: 1 });
    await enforceUsageQuota(params(withTenant.client));
    assertEquals(withTenant.calls[0].sql.includes("WHERE tenant_id = $1"), true);
    assertEquals(withTenant.calls[0].params, ["tenant-1"]);

    const withoutTenant = fakeClient({ usage: 1 });
    await enforceUsageQuota(params(withoutTenant.client, { tenantId: null }));
    assertEquals(withoutTenant.calls[0].sql.includes("user_id = $1 AND tenant_id IS NULL"), true);
    assertEquals(withoutTenant.calls[0].params, ["user-1"]);
  }),
);

Deno.test(
  "sin aplicaciones se permite sin contar uso",
  scenario(BASE_ENV, { "/application-usage-limits": () => limitsOk() }, async () => {
    const { client, calls } = fakeClient({ appIds: [] });
    assertEquals(await enforceUsageQuota(params(client)), { allowed: true, charged: false });
    assertEquals(calls.length, 1);
  }),
);

Deno.test(
  "por debajo del 90% se permite sin avisar ni cobrar, contando en el período de AuthSystem",
  scenario(BASE_ENV, { "/application-usage-limits": () => limitsOk() }, async (fetchCalls) => {
    const { client, calls } = fakeClient({ usage: 89 });
    assertEquals(await enforceUsageQuota(params(client)), { allowed: true, charged: false });
    assertEquals(urls(fetchCalls), ["https://auth.test/application-usage-limits"]);
    assertEquals(calls.length, 2);
    assertEquals(calls[1].params, [["app-1", "app-2"], ["email", "email_pdf"], PERIOD.start, PERIOD.end]);
  }),
);

Deno.test(
  "sin período de AuthSystem cuenta desde el inicio del mes actual",
  scenario(BASE_ENV, { "/application-usage-limits": () => limitsOk({ period: null }) }, async () => {
    const { client, calls } = fakeClient({ usage: 1 });
    await enforceUsageQuota(params(client));
    const [, , start, end] = calls[1].params as string[];
    const now = new Date();
    assertEquals(start, new Date(now.getFullYear(), now.getMonth(), 1).toISOString());
    assertEquals(end, new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString());
  }),
);

Deno.test(
  "al llegar al 90% registra el aviso y llama a send-email de SendCraft con la clave interna",
  scenario(
    BASE_ENV,
    {
      "/application-usage-limits": () => limitsOk(),
      "/wallet-balance": () => json({ success: true, data: { balance: 42.5, currency: "USD" } }),
      "/send-email": () => json({ success: true }),
    },
    async (fetchCalls) => {
      const { client, calls } = fakeClient({ usage: 90 });
      assertEquals(await enforceUsageQuota(params(client)), { allowed: true, charged: false });

      const insert = calls.find((c) => c.sql.includes("INSERT INTO email_logs"))!;
      assertEquals(insert.params.slice(0, 2), ["app-1", "payer@test"]);
      assertEquals(JSON.parse(insert.params[3] as string), {
        usage_feature_code: "total_de_correos_mensuales",
        period_start: PERIOD.start,
        period_end: PERIOD.end,
      });

      assertEquals(urls(fetchCalls), [
        "https://auth.test/application-usage-limits",
        "https://auth.test/wallet-balance",
        "https://sc.test/send-email",
      ]);
      const send = fetchCalls[2];
      const headers = send.init.headers as Record<string, string>;
      assertEquals(headers["x-internal-key"], "internal");
      assertEquals(headers["x-application-id"], "4685df9c-46ac-48d5-aa91-8b72221ec6f2");
      assertEquals(send.body.recipient_email, "payer@test");
      assertEquals(send.body.template_name, "usage_threshold_warning");
      const { period_end_formatted: _f, ...data } = send.body.data;
      assertEquals(data, {
        application_name: "SendCraft",
        plan_name: "Pro",
        feature_label: "Emails mensuales",
        current_usage: 90,
        plan_limit: 100,
        usage_percent: 90,
        period_end: PERIOD.end,
        wallet_balance: 42.5,
        wallet_currency: "USD",
        account_management_url: "https://dash.test/dashboard/billing",
      });
    },
  ),
);

Deno.test(
  "el aviso usa la feature de PDFs y su etiqueta",
  scenario(
    BASE_ENV,
    {
      "/application-usage-limits": () => limitsOk({ limits: { pdf_generations_monthly: 10 } }),
      "/wallet-balance": () => json({ success: false }),
      "/send-email": () => json({ success: true }),
    },
    async (fetchCalls) => {
      const { client } = fakeClient({ usage: 9 });
      await enforceUsageQuota(
        params(client, { usageFeatureCode: "pdf_generations_monthly", overageFeatureCode: "pdf_overage_price" }),
      );
      const send = fetchCalls.find((c) => c.url.endsWith("/send-email"))!;
      assertEquals(send.body.data.feature_label, "PDFs mensuales");
      assertEquals(send.body.data.wallet_balance, null);
      assertEquals(send.body.data.wallet_currency, "UYU");
    },
  ),
);

Deno.test(
  "no repite el aviso si ya hay uno en el período",
  scenario(BASE_ENV, { "/application-usage-limits": () => limitsOk() }, async (fetchCalls) => {
    const { client, calls } = fakeClient({ usage: 95, existingNotice: true });
    assertEquals(await enforceUsageQuota(params(client)), { allowed: true, charged: false });
    assertEquals(calls.some((c) => c.sql.includes("INSERT")), false);
    assertEquals(fetchCalls.length, 1);
  }),
);

Deno.test(
  "sin email del pagador no avisa",
  scenario(BASE_ENV, { "/application-usage-limits": () => limitsOk({ payer_email: null }) }, async (fetchCalls) => {
    const { client, calls } = fakeClient({ usage: 95 });
    assertEquals(await enforceUsageQuota(params(client)), { allowed: true, charged: false });
    assertEquals(calls.length, 2);
    assertEquals(fetchCalls.length, 1);
  }),
);

Deno.test(
  "sin clave interna usa la API key de la app plataforma leída de la base",
  scenario(
    { ...BASE_ENV, FUNCTIONS_INTERNAL_KEY: undefined },
    {
      "/application-usage-limits": () => limitsOk(),
      "/wallet-balance": () => json({ success: false }),
      "/send-email": () => json({ success: true }),
    },
    async (fetchCalls) => {
      const { client } = fakeClient({ usage: 90, platformApiKey: "sk_platform" });
      await enforceUsageQuota(params(client));
      const headers = fetchCalls.find((c) => c.url.endsWith("/send-email"))!.init.headers as Record<string, string>;
      assertEquals(headers["x-api-key"], "sk_platform");
      assertEquals("x-internal-key" in headers, false);
    },
  ),
);

Deno.test(
  "sin clave interna ni API key de plataforma no envía el aviso",
  scenario(
    { ...BASE_ENV, FUNCTIONS_INTERNAL_KEY: undefined },
    { "/application-usage-limits": () => limitsOk() },
    async (fetchCalls) => {
      const { client } = fakeClient({ usage: 90, platformApiKey: null });
      assertEquals(await enforceUsageQuota(params(client)), { allowed: true, charged: false });
      assertEquals(fetchCalls.length, 1);
    },
  ),
);

Deno.test(
  "sin FUNCTIONS_BASE_URL no llama a send-email (y no usa el de AuthSystem)",
  scenario(
    { ...BASE_ENV, FUNCTIONS_BASE_URL: undefined },
    {
      "/application-usage-limits": () => limitsOk(),
      "/wallet-balance": () => json({ success: false }),
    },
    async (fetchCalls) => {
      const { client } = fakeClient({ usage: 90 });
      assertEquals(await enforceUsageQuota(params(client)), { allowed: true, charged: false });
      assertEquals(fetchCalls.some((c) => c.url.endsWith("/send-email")), false);
    },
  ),
);

Deno.test(
  "un fallo al avisar no impide el envío",
  scenario(
    BASE_ENV,
    {
      "/application-usage-limits": () => limitsOk(),
      "/wallet-balance": () => Promise.reject(new TypeError("network")),
      "/send-email": () => Promise.reject(new TypeError("network")),
    },
    async () => {
      const { client } = fakeClient({ usage: 99, failOn: /INSERT/ });
      assertEquals(await enforceUsageQuota(params(client)), { allowed: true, charged: false });
    },
  ),
);

Deno.test(
  "al superar el límite sin precio de excedente se permite sin cobrar",
  async (t) => {
    for (const prices of [null, {}, { email_overage_price: 0 }, { email_overage_price: -1 }, { email_overage_price: "x" }]) {
      await t.step(
        JSON.stringify(prices),
        scenario(
          BASE_ENV,
          { "/application-usage-limits": () => limitsOk({ overage_prices: prices }) },
          async (fetchCalls) => {
            const { client } = fakeClient({ usage: 100 });
            assertEquals(await enforceUsageQuota(params(client)), { allowed: true, charged: false });
            assertEquals(fetchCalls.length, 1);
          },
        ),
      );
    }
  },
);

Deno.test(
  "al superar el límite debita el excedente de la billetera con la clave de idempotencia",
  scenario(
    BASE_ENV,
    {
      "/application-usage-limits": () => limitsOk(),
      "/wallet-debit": () => json({ success: true }),
    },
    async (fetchCalls) => {
      const { client } = fakeClient({ usage: 100 });
      assertEquals(await enforceUsageQuota(params(client)), { allowed: true, charged: true });
      const debit = fetchCalls[1];
      assertEquals(debit.url, "https://auth.test/wallet-debit");
      assertEquals(debit.body, {
        application_id: "auth-app",
        api_key: "auth-key",
        tenant_id: "tenant-1",
        app_user_id: "user-1",
        feature_code: "email_overage_price",
        quantity: 1,
        idempotency_key: "idem-1",
      });
    },
  ),
);

Deno.test(
  "bloquea si la billetera no alcanza (402 o INSUFFICIENT_BALANCE)",
  async (t) => {
    const cases: Record<string, Route> = {
      "HTTP 402": () => json({ success: false }, 402),
      "código INSUFFICIENT_BALANCE": () => json({ success: false, error: { code: "INSUFFICIENT_BALANCE" } }, 400),
    };
    for (const [name, route] of Object.entries(cases)) {
      await t.step(
        name,
        scenario(BASE_ENV, { "/application-usage-limits": () => limitsOk(), "/wallet-debit": route }, async () => {
          const { client } = fakeClient({ usage: 150 });
          assertEquals(await enforceUsageQuota(params(client)), {
            allowed: false,
            charged: false,
            blockedReason: "insufficient_wallet_balance",
          });
        }),
      );
    }
  },
);

Deno.test(
  "otros fallos del débito fallan abierto sin cobrar",
  async (t) => {
    const cases: Record<string, Route> = {
      "HTTP 500": () => json({ success: false, error: { code: "INTERNAL" } }, 500),
      "red caída": () => Promise.reject(new TypeError("network")),
      "200 sin success": () => json({}),
    };
    for (const [name, route] of Object.entries(cases)) {
      await t.step(
        name,
        scenario(BASE_ENV, { "/application-usage-limits": () => limitsOk(), "/wallet-debit": route }, async () => {
          const { client } = fakeClient({ usage: 150 });
          assertEquals(await enforceUsageQuota(params(client)), { allowed: true, charged: false });
        }),
      );
    }
  },
);

Deno.test(
  "con límite 0 todo envío va al cobro de excedente",
  scenario(
    BASE_ENV,
    {
      "/application-usage-limits": () => limitsOk({ limits: { total_de_correos_mensuales: 0 } }),
      "/wallet-debit": () => json({ success: true }),
    },
    async () => {
      const { client } = fakeClient({ usage: 0 });
      assertEquals(await enforceUsageQuota(params(client)), { allowed: true, charged: true });
    },
  ),
);

Deno.test(
  "un error de base al contar el uso se propaga (no falla abierto; comportamiento actual)",
  scenario(BASE_ENV, { "/application-usage-limits": () => limitsOk() }, async () => {
    const { client } = fakeClient({ failOn: /COUNT/ });
    await assertRejects(() => enforceUsageQuota(params(client)), Error, "db caída");
  }),
);
