import { Pool } from "https://deno.land/x/postgres@v0.19.3/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, Authorization, x-api-key",
  Vary: "Origin",
};

let pool: Pool | null = null;

function getDatabaseUrl(): string {
  return firstString(
    Deno.env.get("DATABASE_URL"),
    Deno.env.get("SUPABASE_DB_URL"),
    Deno.env.get("POSTGRES_URL"),
  );
}

function getPool(): Pool {
  const databaseUrl = getDatabaseUrl();
  if (!databaseUrl) {
    throw new Error("Missing DATABASE_URL");
  }

  if (!pool) {
    pool = new Pool({ connectionString: databaseUrl, connectionTimeoutMillis: 5000 } as any, 3, true);
  }

  return pool;
}
const DEFAULT_WIDGET_ENDPOINT = "https://satzkpynnuloncwgxeev.supabase.co/functions/v1/webchat-widget";
const DEFAULT_WIDGET_CRM_URL = "https://api.sendcraft.net/webchat-widget";
const LEGACY_WIDGET_CRM_URL = "https://satzkpynnuloncwgxeev.supabase.co/functions/v1/webchat-widget";
const LEGACY_WIDGET_ENDPOINT = "https://api.flowbridge.site/functions/v1/api-gateway/84509071-8288-4698-b0dd-37bb6a5627a8";

type WidgetConfigRecord = {
  id?: string | null;
  tenant_key?: string | null;
  tenant_id?: string | null;
  subscription_id?: string | null;
  scope_key?: string | null;
  tenant_name?: string | null;
  subdomain?: string | null;
  enabled?: boolean | null;
  ai_enabled?: boolean | null;
  handoff_enabled?: boolean | null;
  crm_url?: string | null;
  support_email?: string | null;
  widget_config?: Record<string, unknown> | null;
  status?: string | null;
  last_error?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type WidgetConfigRequest = Record<string, unknown> & {
  tenant_key?: string;
  tenantKey?: string;
  tenant_id?: string;
  tenantId?: string;
  subscription_id?: string;
  subscriptionId?: string;
  scope_key?: string;
  scopeKey?: string;
  tenant_name?: string;
  tenantName?: string;
  subdomain?: string;
  enabled?: boolean | string | number;
  ai_enabled?: boolean | string | number;
  handoff_enabled?: boolean | string | number;
  crm_url?: string;
  crmUrl?: string;
  support_email?: string;
  supportEmail?: string;
  widget_config?: Record<string, unknown> | null;
  widgetConfig?: Record<string, unknown> | null;
  config?: Record<string, unknown> | null;
  status?: string;
  last_error?: string;
  lastError?: string;
};

type WidgetIdentity = {
  tenantKey: string;
  tenantId: string;
  subscriptionId: string;
  scopeKey: string;
  tenantName: string;
  subdomain: string;
};

type WidgetConfigDefaults = {
  endpoint: string;
  getEndpoint: string;
  domain: string;
  title: string;
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  agentColor: string;
  backgroundColor: string;
  statusText: string;
  welcomeMessage: string;
  quickReplies: string[];
  integrationHeader: string;
  integrationKey: string;
  getIntegrationHeader: string;
  getIntegrationKey: string;
  apiKey: string;
  botProxyUrl: string;
  crmUrl: string;
  supportEmail: string;
  enabled: boolean;
  aiEnabled: boolean;
  handoffEnabled: boolean;
  variables: Record<string, unknown>;
};

type NormalizedWidgetConfig = WidgetConfigDefaults & {
  variables: Record<string, unknown>;
};

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function parseTokens(raw?: string): string[] {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch {
    // fallback to CSV below
  }

  return raw.split(",").map((item) => item.trim()).filter(Boolean);
}

function validateApiKey(req: Request): Response | null {
  const headerName = "x-api-key";
  const apiKey = req.headers.get(headerName);

  const allowed = [
    Deno.env.get("API_KEY"),
    Deno.env.get("API_KEY_USER_EMBED"),
    Deno.env.get("API_KEY_CRM"),
    Deno.env.get("FPM_API_KEY"),
    Deno.env.get("WEBCHAT_WIDGET_API_KEY"),
    Deno.env.get("WEBCHAT_WIDGET_CONFIG_API_KEY"),
    Deno.env.get("X-API-KEY"),
    Deno.env.get("X_API_KEY"),
    ...parseTokens(Deno.env.get("API_KEYS")),
    ...parseTokens(Deno.env.get("API_KEYS_CSV")),
    ...parseTokens(Deno.env.get("FPM_API_KEYS")),
    ...parseTokens(Deno.env.get("FPM_API_KEYS_CSV")),
  ].filter((value): value is string => !!value);

  if (apiKey && allowed.includes(apiKey)) {
    return null;
  }

  return jsonResponse({ error: "Unauthorized" }, 401);
}

function firstString(...values: Array<string | number | null | undefined>): string {
  for (const value of values) {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) return trimmed;
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }

  return "";
}

function firstBoolean(...values: Array<unknown>): boolean | null {
  for (const value of values) {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") {
      if (Number.isFinite(value)) return value !== 0;
      continue;
    }
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (!normalized) continue;
      if (["true", "1", "yes", "on"].includes(normalized)) return true;
      if (["false", "0", "no", "off"].includes(normalized)) return false;
    }
  }

  return null;
}

function normalizeUrl(value: string): string {
  return String(value || "").trim().replace(/\/+$/, "");
}

function normalizeHostnameToBaseUrl(hostname: string): string {
  const trimmed = String(hostname || "").trim().replace(/\/+$/, "");
  if (!trimmed) return "";

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return normalizeUrl(withProtocol);
}

function normalizeWidgetCrmUrl(value: string): string {
  const normalized = normalizeUrl(value);
  if (!normalized) return DEFAULT_WIDGET_CRM_URL;
  if (normalized === LEGACY_WIDGET_CRM_URL) return DEFAULT_WIDGET_CRM_URL;
  return normalized;
}

function normalizeWidgetEndpointUrl(value: string): string {
  const normalized = normalizeUrl(value);
  if (!normalized) return DEFAULT_WIDGET_ENDPOINT;
  if (
    normalized === DEFAULT_WIDGET_CRM_URL ||
    normalized === LEGACY_WIDGET_CRM_URL ||
    normalized === LEGACY_WIDGET_ENDPOINT
  ) {
    return DEFAULT_WIDGET_ENDPOINT;
  }
  return normalized;
}

function slugifySubdomain(value: string): string {
  const normalized = String(value || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");

  return normalized.slice(0, 63) || "tenant";
}

function firstObject(...values: Array<unknown>): Record<string, unknown> | null {
  for (const value of values) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
  }

  return null;
}

function parseQuickReplies(value: unknown, fallback: string[]): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => firstString(item as string | number | null | undefined))
      .filter(Boolean);
  }

  if (typeof value === "string") {
    const parsed = value
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);
    if (parsed.length > 0) return parsed;
  }

  return [...fallback];
}

function getDefaultWidgetConfigDefaults(): WidgetConfigDefaults {
  const endpoint = normalizeWidgetEndpointUrl(
    Deno.env.get("WEBCHAT_WIDGET_ENDPOINT") ||
      Deno.env.get("VITE_WEBCHAT_WIDGET_ENDPOINT") ||
      DEFAULT_WIDGET_ENDPOINT,
  );
  const getEndpoint = normalizeWidgetEndpointUrl(
    Deno.env.get("WEBCHAT_WIDGET_GET_ENDPOINT") ||
      Deno.env.get("VITE_WEBCHAT_WIDGET_GET_ENDPOINT") ||
      endpoint,
  );

  return {
    endpoint,
    getEndpoint,
    domain: String(
      Deno.env.get("WEBCHAT_WIDGET_DOMAIN") ||
        Deno.env.get("VITE_WEBCHAT_WIDGET_DOMAIN") ||
        "sendcraft.net",
    ).trim().replace(/\/+$/, "") || "sendcraft.net",
    title: String(
      Deno.env.get("WEBCHAT_WIDGET_TITLE") ||
        Deno.env.get("VITE_WEBCHAT_WIDGET_TITLE") ||
        "Asistente SendCraft",
    ).trim(),
    logoUrl: String(
      Deno.env.get("WEBCHAT_WIDGET_LOGO_URL") ||
        Deno.env.get("VITE_WEBCHAT_WIDGET_LOGO_URL") ||
        "/logo.svg",
    ).trim(),
    primaryColor: String(Deno.env.get("WEBCHAT_WIDGET_PRIMARY_COLOR") || "#0D9488").trim(),
    secondaryColor: String(Deno.env.get("WEBCHAT_WIDGET_SECONDARY_COLOR") || "#14B8A6").trim(),
    agentColor: String(Deno.env.get("WEBCHAT_WIDGET_AGENT_COLOR") || "#2563EB").trim(),
    backgroundColor: String(Deno.env.get("WEBCHAT_WIDGET_BACKGROUND_COLOR") || "#F3F4F6").trim(),
    statusText: String(Deno.env.get("WEBCHAT_WIDGET_STATUS_TEXT") || "En línea").trim(),
    welcomeMessage: String(
      Deno.env.get("WEBCHAT_WIDGET_WELCOME_MESSAGE") ||
        "¡Hola! Soy el asistente virtual de SendCraft. ¿Cómo puedo ayudarte con tus comunicaciones, correos o documentos PDF?",
    ).trim(),
    quickReplies: parseQuickReplies(
      Deno.env.get("WEBCHAT_WIDGET_QUICK_REPLIES"),
      [
        "¿Qué es SendCraft?",
        "¿Cómo envío un correo?",
        "¿Cómo genero un PDF?",
        "¿Qué planes ofrecen?",
      ],
    ),
    integrationHeader: String(Deno.env.get("WEBCHAT_WIDGET_INTEGRATION_HEADER") || "X-Integration-Key").trim(),
    integrationKey: String(
      Deno.env.get("WEBCHAT_WIDGET_INTEGRATION_KEY") ||
        Deno.env.get("WEBCHAT_WIDGET_API_KEY") ||
        "wc_7e4ac6fb-9202-4fdf-86bb-a3ec8c4c270b",
    ).trim(),
    getIntegrationHeader: String(Deno.env.get("WEBCHAT_WIDGET_GET_INTEGRATION_HEADER") || "X-Integration-Key").trim(),
    getIntegrationKey: String(
      Deno.env.get("WEBCHAT_WIDGET_GET_INTEGRATION_KEY") ||
        Deno.env.get("WEBCHAT_WIDGET_API_KEY") ||
        "wc_7e4ac6fb-9202-4fdf-86bb-a3ec8c4c270b",
    ).trim(),
    apiKey: String(
      Deno.env.get("WEBCHAT_WIDGET_API_KEY") ||
        Deno.env.get("WEBCHAT_WIDGET_INTEGRATION_KEY") ||
        "wc_7e4ac6fb-9202-4fdf-86bb-a3ec8c4c270b",
    ).trim(),
    botProxyUrl: normalizeUrl(
      Deno.env.get("WEBCHAT_WIDGET_BOT_PROXY_URL") ||
        Deno.env.get("VITE_WEBCHAT_WIDGET_BOT_PROXY_URL") ||
        "https://api.sendcraft.net/webchat-bot-proxy",
    ),
    crmUrl: normalizeWidgetCrmUrl(
      Deno.env.get("WEBCHAT_WIDGET_CRM_URL") ||
        Deno.env.get("VITE_WEBCHAT_WIDGET_CRM_URL") ||
        DEFAULT_WIDGET_CRM_URL,
    ),
    supportEmail: String(
      Deno.env.get("WEBCHAT_WIDGET_SUPPORT_EMAIL") ||
        Deno.env.get("VITE_WEBCHAT_WIDGET_SUPPORT_EMAIL") ||
        "soporte@sendcraft.net",
    ).trim(),
    enabled: true,
    aiEnabled: true,
    handoffEnabled: true,
    variables: {
      botProxyUrl: normalizeUrl(
        Deno.env.get("WEBCHAT_WIDGET_BOT_PROXY_URL") ||
          Deno.env.get("VITE_WEBCHAT_WIDGET_BOT_PROXY_URL") ||
          "https://api.sendcraft.net/webchat-bot-proxy",
      ),
      VITE_WIDGET_URL: endpoint,
      VITE_WIDGET_APIKEY: String(
        Deno.env.get("WEBCHAT_WIDGET_API_KEY") ||
          Deno.env.get("WEBCHAT_WIDGET_INTEGRATION_KEY") ||
          "wc_7e4ac6fb-9202-4fdf-86bb-a3ec8c4c270b",
      ).trim(),
      platform: "SendCraft",
      assistantName: "Crafty",
      supportEmail: String(
        Deno.env.get("WEBCHAT_WIDGET_SUPPORT_EMAIL") ||
          Deno.env.get("VITE_WEBCHAT_WIDGET_SUPPORT_EMAIL") ||
          "soporte@sendcraft.net",
      ).trim(),
      crmUrl: normalizeUrl(
        Deno.env.get("WEBCHAT_WIDGET_CRM_URL") ||
          Deno.env.get("VITE_WEBCHAT_WIDGET_CRM_URL") ||
          DEFAULT_WIDGET_CRM_URL,
      ),
    },
  };
}

function buildWidgetConfigFromRow(row: WidgetConfigRecord | null): NormalizedWidgetConfig {
  const defaults = getDefaultWidgetConfigDefaults();
  const rawWidgetConfig = firstObject(row?.widget_config);
  const rawVariables = firstObject(rawWidgetConfig?.variables);

  const endpoint = normalizeWidgetEndpointUrl(
    firstString(
      rawWidgetConfig?.endpoint as string | number | null | undefined,
      rawWidgetConfig?.VITE_WIDGET_URL as string | number | null | undefined,
      defaults.endpoint,
    ),
  );
  const getEndpoint = normalizeWidgetEndpointUrl(
    firstString(
      rawWidgetConfig?.getEndpoint as string | number | null | undefined,
      defaults.getEndpoint,
      endpoint,
    ),
  );
  const title = firstString(rawWidgetConfig?.title as string | number | null | undefined, defaults.title);
  const logoUrl = firstString(rawWidgetConfig?.logoUrl as string | number | null | undefined, defaults.logoUrl);
  const primaryColor = firstString(rawWidgetConfig?.primaryColor as string | number | null | undefined, defaults.primaryColor);
  const secondaryColor = firstString(rawWidgetConfig?.secondaryColor as string | number | null | undefined, defaults.secondaryColor);
  const agentColor = firstString(rawWidgetConfig?.agentColor as string | number | null | undefined, defaults.agentColor);
  const backgroundColor = firstString(rawWidgetConfig?.backgroundColor as string | number | null | undefined, defaults.backgroundColor);
  const statusText = firstString(rawWidgetConfig?.statusText as string | number | null | undefined, defaults.statusText);
  const welcomeMessage = firstString(rawWidgetConfig?.welcomeMessage as string | number | null | undefined, defaults.welcomeMessage);
  const quickReplies = parseQuickReplies(rawWidgetConfig?.quickReplies ?? rawWidgetConfig?.quick_replies, defaults.quickReplies);
  const integrationHeader = firstString(rawWidgetConfig?.integrationHeader as string | number | null | undefined, defaults.integrationHeader);
  const integrationKey = firstString(rawWidgetConfig?.integrationKey as string | number | null | undefined, defaults.integrationKey);
  const getIntegrationHeader = firstString(rawWidgetConfig?.getIntegrationHeader as string | number | null | undefined, defaults.getIntegrationHeader);
  const getIntegrationKey = firstString(rawWidgetConfig?.getIntegrationKey as string | number | null | undefined, defaults.getIntegrationKey);
  const apiKey = firstString(rawWidgetConfig?.apiKey as string | number | null | undefined, defaults.apiKey);
  const botProxyUrl = normalizeUrl(
    firstString(
      rawWidgetConfig?.botProxyUrl as string | number | null | undefined,
      rawVariables?.botProxyUrl as string | number | null | undefined,
      defaults.botProxyUrl,
    ),
  );
  const crmUrl = normalizeUrl(
    firstString(
      rawWidgetConfig?.crmUrl as string | number | null | undefined,
      rawWidgetConfig?.crm_url as string | number | null | undefined,
      rawVariables?.crmUrl as string | number | null | undefined,
      defaults.crmUrl,
    ),
  );
  const normalizedCrmUrl = normalizeWidgetCrmUrl(crmUrl);
  const supportEmail = firstString(
    rawWidgetConfig?.supportEmail as string | number | null | undefined,
    rawWidgetConfig?.support_email as string | number | null | undefined,
    rawVariables?.supportEmail as string | number | null | undefined,
    defaults.supportEmail,
  );
  const enabled = firstBoolean(rawWidgetConfig?.enabled, row?.enabled, defaults.enabled) ?? defaults.enabled;
  const aiEnabled = firstBoolean(rawWidgetConfig?.aiEnabled, rawWidgetConfig?.ai_enabled, row?.ai_enabled, defaults.aiEnabled) ?? defaults.aiEnabled;
  const handoffEnabled = firstBoolean(rawWidgetConfig?.handoffEnabled, rawWidgetConfig?.handoff_enabled, row?.handoff_enabled, defaults.handoffEnabled) ?? defaults.handoffEnabled;

  const variables: Record<string, unknown> = {
    ...defaults.variables,
    ...(rawVariables || {}),
    botProxyUrl,
    VITE_WIDGET_URL: endpoint,
    VITE_WIDGET_APIKEY: apiKey,
    supportEmail,
    crmUrl: normalizedCrmUrl,
  };

  return {
    ...defaults,
    endpoint,
    getEndpoint,
    title,
    logoUrl,
    primaryColor,
    secondaryColor,
    agentColor,
    backgroundColor,
    statusText,
    welcomeMessage,
    quickReplies,
    integrationHeader,
    integrationKey,
    getIntegrationHeader,
    getIntegrationKey,
    apiKey,
    botProxyUrl,
    crmUrl: normalizedCrmUrl,
    supportEmail,
    enabled,
    aiEnabled,
    handoffEnabled,
    variables,
  };
}

function resolveWidgetIdentityFromRequest(req: Request, body?: WidgetConfigRequest | null): WidgetIdentity {
  const url = new URL(req.url);
  const search = url.searchParams;
  const pathSegments = url.pathname.split("/").filter(Boolean);
  const pathLookup = pathSegments.length > 1 && pathSegments[0] === "webchat-widget-config"
    ? pathSegments[1]
    : "";

  const tenantId = firstString(
    body?.tenant_id as string | number | null | undefined,
    body?.tenantId as string | number | null | undefined,
    search.get("tenant_id"),
    search.get("tenantId"),
  );
  const subscriptionId = firstString(
    body?.subscription_id as string | number | null | undefined,
    body?.subscriptionId as string | number | null | undefined,
    search.get("subscription_id"),
    search.get("subscriptionId"),
  );
  const tenantName = firstString(
    body?.tenant_name as string | number | null | undefined,
    body?.tenantName as string | number | null | undefined,
    search.get("tenant_name"),
    search.get("tenantName"),
    tenantId,
    subscriptionId,
    "Widget CRM",
  );
  const subdomain = firstString(
    body?.subdomain as string | number | null | undefined,
    search.get("subdomain"),
    slugifySubdomain(tenantName),
  );

  const computedKey = firstString(
    body?.tenant_key as string | number | null | undefined,
    body?.tenantKey as string | number | null | undefined,
    body?.scope_key as string | number | null | undefined,
    body?.scopeKey as string | number | null | undefined,
    search.get("tenant_key"),
    search.get("tenantKey"),
    search.get("scope_key"),
    search.get("scopeKey"),
    pathLookup,
    tenantId ? `tenant:${tenantId.toLowerCase()}` : "",
    subscriptionId ? `subscription:${subscriptionId.toLowerCase()}` : "",
    tenantName ? `tenant:${slugifySubdomain(tenantName)}` : "",
    `tenant:${subdomain}`,
  );

  return {
    tenantKey: computedKey,
    tenantId,
    subscriptionId,
    scopeKey: firstString(
      body?.scope_key as string | number | null | undefined,
      body?.scopeKey as string | number | null | undefined,
      search.get("scope_key"),
      search.get("scopeKey"),
      computedKey,
    ),
    tenantName,
    subdomain,
  };
}

function normalizeWidgetConfigInput(
  body: WidgetConfigRequest,
  identity: WidgetIdentity,
): NormalizedWidgetConfig {
  const defaults = getDefaultWidgetConfigDefaults();
  const rawWidgetConfig = firstObject(
    body.widget_config,
    body.widgetConfig,
    body.config,
  ) || {};
  const rawVariables = firstObject(rawWidgetConfig.variables, body.variables);

  const endpoint = normalizeWidgetEndpointUrl(
    firstString(
      rawWidgetConfig.endpoint as string | number | null | undefined,
      rawWidgetConfig.VITE_WIDGET_URL as string | number | null | undefined,
      defaults.endpoint,
    ),
  );
  const getEndpoint = normalizeWidgetEndpointUrl(
    firstString(
      rawWidgetConfig.getEndpoint as string | number | null | undefined,
      rawWidgetConfig.get_endpoint as string | number | null | undefined,
      defaults.getEndpoint,
      endpoint,
    ),
  );
  const title = firstString(
    rawWidgetConfig.title as string | number | null | undefined,
    defaults.title,
  );
  const logoUrl = firstString(
    rawWidgetConfig.logoUrl as string | number | null | undefined,
    rawWidgetConfig.logo_url as string | number | null | undefined,
    defaults.logoUrl,
  );
  const primaryColor = firstString(
    rawWidgetConfig.primaryColor as string | number | null | undefined,
    rawWidgetConfig.primary_color as string | number | null | undefined,
    defaults.primaryColor,
  );
  const secondaryColor = firstString(
    rawWidgetConfig.secondaryColor as string | number | null | undefined,
    rawWidgetConfig.secondary_color as string | number | null | undefined,
    defaults.secondaryColor,
  );
  const agentColor = firstString(
    rawWidgetConfig.agentColor as string | number | null | undefined,
    rawWidgetConfig.agent_color as string | number | null | undefined,
    defaults.agentColor,
  );
  const backgroundColor = firstString(
    rawWidgetConfig.backgroundColor as string | number | null | undefined,
    rawWidgetConfig.background_color as string | number | null | undefined,
    defaults.backgroundColor,
  );
  const statusText = firstString(
    rawWidgetConfig.statusText as string | number | null | undefined,
    rawWidgetConfig.status_text as string | number | null | undefined,
    defaults.statusText,
  );
  const welcomeMessage = firstString(
    rawWidgetConfig.welcomeMessage as string | number | null | undefined,
    rawWidgetConfig.welcome_message as string | number | null | undefined,
    defaults.welcomeMessage,
  );
  const quickReplies = parseQuickReplies(rawWidgetConfig.quickReplies ?? rawWidgetConfig.quick_replies, defaults.quickReplies);
  const integrationHeader = firstString(
    rawWidgetConfig.integrationHeader as string | number | null | undefined,
    rawWidgetConfig.integration_header as string | number | null | undefined,
    defaults.integrationHeader,
  );
  const integrationKey = firstString(
    rawWidgetConfig.integrationKey as string | number | null | undefined,
    rawWidgetConfig.integration_key as string | number | null | undefined,
    defaults.integrationKey,
  );
  const getIntegrationHeader = firstString(
    rawWidgetConfig.getIntegrationHeader as string | number | null | undefined,
    rawWidgetConfig.get_integration_header as string | number | null | undefined,
    defaults.getIntegrationHeader,
  );
  const getIntegrationKey = firstString(
    rawWidgetConfig.getIntegrationKey as string | number | null | undefined,
    rawWidgetConfig.get_integration_key as string | number | null | undefined,
    defaults.getIntegrationKey,
  );
  const apiKey = firstString(
    rawWidgetConfig.apiKey as string | number | null | undefined,
    rawWidgetConfig.api_key as string | number | null | undefined,
    defaults.apiKey,
  );
  const botProxyUrl = normalizeUrl(
    firstString(
      rawWidgetConfig.botProxyUrl as string | number | null | undefined,
      rawWidgetConfig.bot_proxy_url as string | number | null | undefined,
      rawVariables?.botProxyUrl as string | number | null | undefined,
      defaults.botProxyUrl,
    ),
  );
  const crmUrl = normalizeUrl(
    firstString(
      rawWidgetConfig.crmUrl as string | number | null | undefined,
      rawWidgetConfig.crm_url as string | number | null | undefined,
      rawVariables?.crmUrl as string | number | null | undefined,
      body.crm_url as string | number | null | undefined,
      body.crmUrl as string | number | null | undefined,
      defaults.crmUrl,
    ),
  );
  const normalizedCrmUrl = normalizeWidgetCrmUrl(crmUrl);
  const supportEmail = firstString(
    rawWidgetConfig.supportEmail as string | number | null | undefined,
    rawWidgetConfig.support_email as string | number | null | undefined,
    rawVariables?.supportEmail as string | number | null | undefined,
    body.support_email as string | number | null | undefined,
    body.supportEmail as string | number | null | undefined,
    defaults.supportEmail,
  );
  const enabled = firstBoolean(
    rawWidgetConfig.enabled as boolean | string | number | null | undefined,
    body.enabled,
    defaults.enabled,
  ) ?? defaults.enabled;
  const aiEnabled = firstBoolean(
    rawWidgetConfig.aiEnabled as boolean | string | number | null | undefined,
    rawWidgetConfig.ai_enabled as boolean | string | number | null | undefined,
    body.ai_enabled,
    body.aiEnabled,
    defaults.aiEnabled,
  ) ?? defaults.aiEnabled;
  const handoffEnabled = firstBoolean(
    rawWidgetConfig.handoffEnabled as boolean | string | number | null | undefined,
    rawWidgetConfig.handoff_enabled as boolean | string | number | null | undefined,
    body.handoff_enabled,
    body.handoffEnabled,
    defaults.handoffEnabled,
  ) ?? defaults.handoffEnabled;

  const variables: Record<string, unknown> = {
    ...defaults.variables,
    ...(rawVariables || {}),
    botProxyUrl,
    VITE_WIDGET_URL: endpoint,
    VITE_WIDGET_APIKEY: apiKey,
    supportEmail,
    crmUrl: normalizedCrmUrl,
  };

  return {
    endpoint,
    getEndpoint,
    domain: firstString(
      rawWidgetConfig.domain as string | number | null | undefined,
      body.domain as string | number | null | undefined,
      defaults.domain,
    ),
    title,
    logoUrl,
    primaryColor,
    secondaryColor,
    agentColor,
    backgroundColor,
    statusText,
    welcomeMessage,
    quickReplies,
    integrationHeader,
    integrationKey,
    getIntegrationHeader,
    getIntegrationKey,
    apiKey,
    botProxyUrl,
    crmUrl: normalizedCrmUrl,
    supportEmail,
    enabled,
    aiEnabled,
    handoffEnabled,
    variables,
  };
}

function buildConfigPayload(
  identity: WidgetIdentity,
  normalized: NormalizedWidgetConfig,
): Record<string, unknown> {
  return {
    tenant_key: identity.tenantKey,
    tenant_id: identity.tenantId || null,
    subscription_id: identity.subscriptionId || null,
    scope_key: identity.scopeKey,
    tenant_name: identity.tenantName,
    subdomain: identity.subdomain,
    enabled: normalized.enabled,
    ai_enabled: normalized.aiEnabled,
    handoff_enabled: normalized.handoffEnabled,
    crm_url: normalized.crmUrl || null,
    support_email: normalized.supportEmail || null,
    widget_config: {
      ...normalized,
      variables: {
        ...normalized.variables,
      },
    },
    status: "active",
    last_error: null,
  };
}

function rowToResponse(row: WidgetConfigRecord | null, fallbackIdentity: WidgetIdentity): Record<string, unknown> {
  const identity = {
    tenantKey: firstString(row?.tenant_key, fallbackIdentity.tenantKey),
    tenantId: firstString(row?.tenant_id, fallbackIdentity.tenantId),
    subscriptionId: firstString(row?.subscription_id, fallbackIdentity.subscriptionId),
    scopeKey: firstString(row?.scope_key, fallbackIdentity.scopeKey),
    tenantName: firstString(row?.tenant_name, fallbackIdentity.tenantName),
    subdomain: firstString(row?.subdomain, fallbackIdentity.subdomain),
  };

  const normalizedConfig = buildWidgetConfigFromRow(row);

  return {
    success: true,
    found: Boolean(row),
    id: row?.id || null,
    tenant_key: identity.tenantKey,
    tenant_id: identity.tenantId || null,
    subscription_id: identity.subscriptionId || null,
    scope_key: identity.scopeKey,
    tenant_name: identity.tenantName,
    subdomain: identity.subdomain,
    enabled: row?.enabled ?? normalizedConfig.enabled,
    ai_enabled: row?.ai_enabled ?? normalizedConfig.aiEnabled,
    handoff_enabled: row?.handoff_enabled ?? normalizedConfig.handoffEnabled,
    crm_url: row?.crm_url ?? normalizedConfig.crmUrl ?? null,
    support_email: row?.support_email ?? normalizedConfig.supportEmail ?? null,
    status: row?.status || "active",
    last_error: row?.last_error || null,
    created_at: row?.created_at || null,
    updated_at: row?.updated_at || null,
    widget_config: normalizedConfig,
    config: normalizedConfig,
  };
}

async function queryWidgetConfigByFilters(filters: Array<[string, string]>, fallbackIdentity: WidgetIdentity): Promise<Record<string, unknown> | null> {
  if (!Deno.env.get("DATABASE_URL")) {
    return null;
  }

  const client = await getPool().connect();
  try {
    const whereClauses: string[] = [];
    const values: string[] = [];

    filters.forEach(([column, value], index) => {
      whereClauses.push(`${column} = $${index + 1}`);
      values.push(value);
    });

    const query = `
      SELECT
        id,
        tenant_key,
        tenant_id,
        subscription_id,
        scope_key,
        tenant_name,
        subdomain,
        enabled,
        ai_enabled,
        handoff_enabled,
        crm_url,
        support_email,
        widget_config,
        status,
        last_error,
        created_at,
        updated_at
      FROM tenant_webchat_widget_configs
      ${whereClauses.length ? `WHERE ${whereClauses.join(" OR ")}` : ""}
      ORDER BY updated_at DESC
      LIMIT 1
    `;

    const result = await client.queryObject<WidgetConfigRecord>(query, values);
    const row = result.rows?.[0] ?? null;
    if (!row) return null;
    return rowToResponse(row, fallbackIdentity);
  } finally {
    client.release();
  }
}

async function upsertWidgetConfig(
  body: WidgetConfigRequest,
  identity: WidgetIdentity,
): Promise<Record<string, unknown>> {
  if (!Deno.env.get("DATABASE_URL")) {
    throw new Error("Missing DATABASE_URL");
  }

  const normalized = normalizeWidgetConfigInput(body, identity);
  const payload = buildConfigPayload(identity, normalized);
  const client = await getPool().connect();

  try {
    const result = await client.queryObject<WidgetConfigRecord>(
      `
      INSERT INTO tenant_webchat_widget_configs (
        tenant_key,
        tenant_id,
        subscription_id,
        scope_key,
        tenant_name,
        subdomain,
        enabled,
        ai_enabled,
        handoff_enabled,
        crm_url,
        support_email,
        widget_config,
        status,
        last_error
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13, $14
      )
      ON CONFLICT (tenant_key) DO UPDATE SET
        tenant_id = EXCLUDED.tenant_id,
        subscription_id = EXCLUDED.subscription_id,
        scope_key = EXCLUDED.scope_key,
        tenant_name = EXCLUDED.tenant_name,
        subdomain = EXCLUDED.subdomain,
        enabled = EXCLUDED.enabled,
        ai_enabled = EXCLUDED.ai_enabled,
        handoff_enabled = EXCLUDED.handoff_enabled,
        crm_url = EXCLUDED.crm_url,
        support_email = EXCLUDED.support_email,
        widget_config = EXCLUDED.widget_config,
        status = EXCLUDED.status,
        last_error = EXCLUDED.last_error
      RETURNING
        id,
        tenant_key,
        tenant_id,
        subscription_id,
        scope_key,
        tenant_name,
        subdomain,
        enabled,
        ai_enabled,
        handoff_enabled,
        crm_url,
        support_email,
        widget_config,
        status,
        last_error,
        created_at,
        updated_at
      `,
      [
        payload.tenant_key,
        payload.tenant_id,
        payload.subscription_id,
        payload.scope_key,
        payload.tenant_name,
        payload.subdomain,
        payload.enabled,
        payload.ai_enabled,
        payload.handoff_enabled,
        payload.crm_url,
        payload.support_email,
        JSON.stringify(payload.widget_config),
        payload.status,
        payload.last_error,
      ],
    );

    const row = result.rows?.[0] ?? null;
    if (!row) {
      throw new Error("Failed to persist widget config");
    }

    return rowToResponse(row, identity);
  } finally {
    client.release();
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const authError = validateApiKey(req);
  if (authError) {
    return authError;
  }

  try {
    const url = new URL(req.url);
    const method = req.method.toUpperCase();

    if (method === "GET") {
      const identity = resolveWidgetIdentityFromRequest(req, null);
      if (!identity.tenantKey) {
        return jsonResponse(
          {
            success: false,
            error: {
              code: "MISSING_LOOKUP",
              message: "tenant_key, scope_key, tenant_id or subscription_id is required",
            },
          },
          400,
        );
      }

      const lookupResult = await queryWidgetConfigByFilters(
        [
          ["tenant_key", identity.tenantKey],
          ["scope_key", identity.scopeKey],
          ["tenant_id", identity.tenantId],
          ["subscription_id", identity.subscriptionId],
        ].filter(([, value]) => Boolean(value)) as Array<[string, string]>,
        identity,
      );

      if (lookupResult) {
        return jsonResponse(lookupResult);
      }

      return jsonResponse({
        ...rowToResponse(null, identity),
        found: false,
      });
    }

    if (method !== "POST") {
      return jsonResponse(
        {
          success: false,
          error: {
            code: "METHOD_NOT_ALLOWED",
            message: "Method not allowed",
          },
        },
        405,
      );
    }

    const rawBody = await req.json().catch(() => null);
    if (!rawBody || typeof rawBody !== "object" || Array.isArray(rawBody)) {
      return jsonResponse(
        {
          success: false,
          error: {
            code: "INVALID_BODY",
            message: "Invalid request body",
          },
        },
        400,
      );
    }

    const body = rawBody as WidgetConfigRequest;
    const identity = resolveWidgetIdentityFromRequest(req, body);

    if (!identity.tenantKey || !identity.scopeKey || !identity.tenantName || !identity.subdomain) {
      return jsonResponse(
        {
          success: false,
          error: {
            code: "MISSING_LOOKUP",
            message: "tenant_key, scope_key, tenant_name and subdomain are required or derivable",
          },
        },
        400,
      );
    }

    const result = await upsertWidgetConfig(body, identity);
    return jsonResponse(result, 200);
  } catch (error) {
    return jsonResponse(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Unexpected error",
        },
      },
      500,
    );
  }
});
