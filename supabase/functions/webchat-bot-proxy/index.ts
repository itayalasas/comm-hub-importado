import { Pool } from "https://deno.land/x/postgres@v0.19.3/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, Authorization, X-Integration-Key, x-api-key",
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

type WidgetContextRow = {
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
};

type ConversationRow = {
  id?: string | null;
  tenant_key?: string | null;
  tenant_id?: string | null;
  subscription_id?: string | null;
  scope_key?: string | null;
  session_id?: string | null;
  conversation_id?: string | null;
  source_domain?: string | null;
  page_url?: string | null;
  visitor_name?: string | null;
  visitor_email?: string | null;
  visitor_phone?: string | null;
  status?: string | null;
  assigned_user_id?: string | null;
  assigned_user_name?: string | null;
  assigned_at?: string | null;
  closed_at?: string | null;
  last_message_at?: string | null;
  last_user_message?: string | null;
  last_ai_reply?: string | null;
  handoff_requested?: boolean | null;
  handoff_reason?: string | null;
  cause?: string | null;
  cause_custom?: string | null;
  result?: string | null;
  result_notes?: string | null;
  source_channel?: string | null;
  source_detail?: string | null;
  client_id?: string | null;
  opportunity_id?: string | null;
  messages?: unknown;
  queued_messages?: unknown;
  metadata?: Record<string, unknown> | null;
  last_error?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type ApplicationRow = {
  id: string;
  name: string | null;
};

type TemplateRow = {
  name: string | null;
  template_type: string | null;
  subject: string | null;
  pdf_filename_pattern: string | null;
  application_name: string | null;
};

type WidgetBotRequest = Record<string, unknown> & {
  message?: string;
  conversationHistory?: Array<Record<string, unknown>>;
  locale?: string;
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
  source_domain?: string;
  sourceDomain?: string;
  page_url?: string;
  pageUrl?: string;
  visitor?: Record<string, unknown> | null;
};

type TenantWidgetContext = {
  title: string;
  welcomeMessage: string;
  quickReplies: string[];
  supportEmail: string;
  crmUrl: string;
  aiEnabled: boolean;
  handoffEnabled: boolean;
};

type WidgetBotResponse = {
  reply: string;
  handoff: boolean;
  quickReplies: string[];
};

const DEFAULT_QUICK_REPLIES = [
  "Que es SendCraft?",
  "Como envio un correo?",
  "Como genero un PDF?",
  "Que planes ofrecen?",
];
const DEFAULT_WIDGET_CRM_URL = "https://satzkpynnuloncwgxeev.supabase.co/functions/v1/webchat-widget";
const LEGACY_WIDGET_CRM_URL = "https://api.sendcraft.net/webchat-widget";

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function logBotEvent(event: string, details?: Record<string, unknown>): void {
  if (details) {
    console.info(`[webchat-bot-proxy] ${event}`, details);
    return;
  }

  console.info(`[webchat-bot-proxy] ${event}`);
}

function logBotError(event: string, error: unknown, details?: Record<string, unknown>): void {
  console.error(`[webchat-bot-proxy] ${event}`, {
    ...(details || {}),
    error: error instanceof Error ? error.message : String(error),
  });
}

function parseTokens(raw?: string): string[] {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch {
    // fallback to CSV
  }

  return raw.split(",").map((item) => item.trim()).filter(Boolean);
}

function firstString(...values: Array<string | number | boolean | null | undefined>): string {
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

function previewText(value: string, maxLength = 120): string {
  const text = String(value || "").trim();
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
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

function firstObject(...values: Array<unknown>): Record<string, unknown> | null {
  for (const value of values) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
  }

  return null;
}

async function queryRows<T>(
  client: any,
  query: string,
  values: unknown[] = [],
): Promise<T[]> {
  const result = await client.queryObject(query, values);
  return (result?.rows ?? []) as T[];
}

function normalizeUrl(value: string): string {
  return String(value || "").trim().replace(/\/+$/, "");
}

function normalizeWidgetCrmUrl(value: string): string {
  const normalized = normalizeUrl(value);
  if (!normalized) return DEFAULT_WIDGET_CRM_URL;
  if (normalized === LEGACY_WIDGET_CRM_URL) return DEFAULT_WIDGET_CRM_URL;
  return normalized;
}

function normalizeText(value: string): string {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeWidgetQuickReplies(value: unknown, fallback: string[]): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => firstString(item as string | number | boolean | null | undefined))
      .filter(Boolean);
  }

  if (typeof value === "string") {
    const parsed = value.split("\n").map((item) => item.trim()).filter(Boolean);
    if (parsed.length > 0) return parsed;
  }

  return [...fallback];
}

function validateWidgetApiKey(req: Request): Response | null {
  const providedKey = firstString(
    req.headers.get("x-api-key"),
    req.headers.get("X-Integration-Key"),
    req.headers.get("x-integration-key"),
  );

  const allowedKeys = [
    Deno.env.get("WEBCHAT_WIDGET_API_KEY"),
    Deno.env.get("WEBCHAT_WIDGET_INTEGRATION_KEY"),
    Deno.env.get("WEBCHAT_WIDGET_CONFIG_API_KEY"),
    Deno.env.get("X-API-KEY"),
    Deno.env.get("X_API_KEY"),
    Deno.env.get("API_KEY"),
    Deno.env.get("API_KEY_USER_EMBED"),
    Deno.env.get("API_KEY_CRM"),
    Deno.env.get("FPM_API_KEY"),
    ...parseTokens(Deno.env.get("API_KEYS")),
    ...parseTokens(Deno.env.get("API_KEYS_CSV")),
    ...parseTokens(Deno.env.get("FPM_API_KEYS")),
    ...parseTokens(Deno.env.get("FPM_API_KEYS_CSV")),
  ].filter((value): value is string => !!value);

  if (providedKey && allowedKeys.includes(providedKey)) {
    return null;
  }

  return jsonResponse(
    {
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Unauthorized",
      },
    },
    401,
  );
}

function resolveWidgetIdentityFromRequest(req: Request, body?: WidgetBotRequest | null) {
  const url = new URL(req.url);
  const search = url.searchParams;
  const sourceDomain = firstString(
    body?.source_domain as string | number | boolean | null | undefined,
    body?.sourceDomain as string | number | boolean | null | undefined,
    search.get("source_domain"),
    search.get("sourceDomain"),
    url.hostname,
  );
  const tenantId = firstString(
    body?.tenant_id as string | number | boolean | null | undefined,
    body?.tenantId as string | number | boolean | null | undefined,
    search.get("tenant_id"),
    search.get("tenantId"),
  );
  const subscriptionId = firstString(
    body?.subscription_id as string | number | boolean | null | undefined,
    body?.subscriptionId as string | number | boolean | null | undefined,
    search.get("subscription_id"),
    search.get("subscriptionId"),
  );
  const tenantName = firstString(
    body?.tenant_name as string | number | boolean | null | undefined,
    body?.tenantName as string | number | boolean | null | undefined,
    search.get("tenant_name"),
    search.get("tenantName"),
    tenantId,
    subscriptionId,
    sourceDomain,
    "Widget CRM",
  );
  const subdomain = firstString(
    body?.subdomain as string | number | boolean | null | undefined,
    search.get("subdomain"),
    tenantName ? tenantName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") : "",
  );
  const tenantKey = firstString(
    body?.tenant_key as string | number | boolean | null | undefined,
    body?.tenantKey as string | number | boolean | null | undefined,
    body?.scope_key as string | number | boolean | null | undefined,
    body?.scopeKey as string | number | boolean | null | undefined,
    search.get("tenant_key"),
    search.get("tenantKey"),
    search.get("scope_key"),
    search.get("scopeKey"),
    tenantId ? `tenant:${tenantId.toLowerCase()}` : "",
    subscriptionId ? `subscription:${subscriptionId.toLowerCase()}` : "",
    tenantName ? `tenant:${tenantName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}` : "",
    sourceDomain ? `domain:${sourceDomain.toLowerCase().replace(/[^a-z0-9]+/g, "-")}` : "",
    `tenant:${subdomain || "tenant"}`,
  );

  return {
    tenantKey,
    tenantId,
    subscriptionId,
    scopeKey: firstString(
      body?.scope_key as string | number | boolean | null | undefined,
      body?.scopeKey as string | number | boolean | null | undefined,
      search.get("scope_key"),
      search.get("scopeKey"),
      tenantKey,
    ),
    tenantName,
    subdomain,
    sourceDomain,
  } as const;
}

function normalizeConversationMessages(value: unknown, conversationId: string): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];

    const record = item as Record<string, unknown>;
    const text = firstString(
      record.text as string | number | boolean | null | undefined,
      record.message as string | number | boolean | null | undefined,
      record.content as string | number | boolean | null | undefined,
    );

    if (!text) return [];

    const role = normalizeText(firstString(
      record.role as string | number | boolean | null | undefined,
      record.sender_type as string | number | boolean | null | undefined,
      record.senderType as string | number | boolean | null | undefined,
    ));
    const senderType = role === "assistant" ? "assistant" : role === "system" ? "system" : "visitor";

    return [
      {
        id: firstString(record.id as string | number | boolean | null | undefined, `${senderType}-${index}`),
        conversation_id: firstString(
          record.conversation_id as string | number | boolean | null | undefined,
          record.conversationId as string | number | boolean | null | undefined,
          conversationId,
        ),
        sender_type: senderType,
        sender_id: firstString(
          record.sender_id as string | number | boolean | null | undefined,
          record.senderId as string | number | boolean | null | undefined,
        ),
        sender_name: firstString(
          record.sender_name as string | number | boolean | null | undefined,
          record.senderName as string | number | boolean | null | undefined,
        ),
        message: text,
        attachments: Array.isArray(record.attachments) ? record.attachments : [],
        created_at: firstString(
          record.created_at as string | number | boolean | null | undefined,
          record.createdAt as string | number | boolean | null | undefined,
          new Date().toISOString(),
        ),
      },
    ];
  });
}

function buildMessageRecord(params: {
  conversationId: string;
  senderType: "visitor" | "assistant" | "system";
  senderId: string;
  senderName: string;
  message: string;
  attachments?: unknown[];
  createdAt?: string;
}): Record<string, unknown> {
  return {
    id: crypto.randomUUID(),
    conversation_id: params.conversationId,
    sender_type: params.senderType,
    sender_id: params.senderId,
    sender_name: params.senderName,
    message: params.message,
    attachments: Array.isArray(params.attachments) ? params.attachments : [],
    created_at: params.createdAt || new Date().toISOString(),
  };
}

function rowToConversationResponse(row: ConversationRow): Record<string, unknown> {
  const conversationId = firstString(row.conversation_id);
  const messages = normalizeConversationMessages(row.messages, conversationId);
  const queuedMessages = normalizeConversationMessages(row.queued_messages, conversationId);

  return {
    success: true,
    found: true,
    conversation_id: conversationId,
    conversation: {
      id: conversationId,
      session_id: firstString(row.session_id),
      source_domain: firstString(row.source_domain),
      page_url: row.page_url || null,
      visitor_id: null,
      visitor_name: row.visitor_name || null,
      visitor_email: row.visitor_email || null,
      visitor_phone: row.visitor_phone || null,
      status: firstString(row.status) || "open",
      assigned_user_id: row.assigned_user_id || null,
      assigned_user_name: row.assigned_user_name || null,
      assigned_at: row.assigned_at || null,
      closed_at: row.closed_at || null,
      last_message_at: row.last_message_at || null,
      created_at: row.created_at || null,
      updated_at: row.updated_at || null,
      cause: row.cause || null,
      cause_custom: row.cause_custom || null,
      result: row.result || null,
      result_notes: row.result_notes || null,
      source_channel: row.source_channel || null,
      source_detail: row.source_detail || null,
      client_id: row.client_id || null,
      opportunity_id: row.opportunity_id || null,
      handoff_requested: Boolean(row.handoff_requested),
      last_error: row.last_error || null,
    },
    messages,
    queued_messages: queuedMessages,
  };
}

function buildConversationQuery(identity: { tenantKey: string; }, sessionId: string, conversationId: string): Array<{ where: string; values: string[] }> {
  const lookups: Array<{ where: string; values: string[] }> = [];

  if (identity.tenantKey && sessionId) {
    lookups.push({
      where: "tenant_key = $1 AND session_id = $2",
      values: [identity.tenantKey, sessionId],
    });
  }

  if (identity.tenantKey && conversationId) {
    lookups.push({
      where: "tenant_key = $1 AND conversation_id = $2",
      values: [identity.tenantKey, conversationId],
    });
  }

  if (sessionId) {
    lookups.push({
      where: "session_id = $1",
      values: [sessionId],
    });
  }

  if (conversationId) {
    lookups.push({
      where: "conversation_id = $1",
      values: [conversationId],
    });
  }

  return lookups;
}

async function findConversation(
  client: any,
  identity: { tenantKey: string; },
  sessionId: string,
  conversationId: string,
): Promise<ConversationRow | null> {
  const lookups = buildConversationQuery(identity, sessionId, conversationId);

  for (const lookup of lookups) {
    const rows = await queryRows<ConversationRow>(
      client,
      `
      SELECT *
      FROM tenant_webchat_conversations
      WHERE ${lookup.where}
      ORDER BY updated_at DESC
      LIMIT 1
      `,
      lookup.values,
    );

    const row = rows[0] ?? null;
    if (row) return row;
  }

  return null;
}

async function loadTenantWidgetContext(
  client: any,
  identity: { tenantKey: string; tenantId: string; subscriptionId: string; scopeKey: string; tenantName: string; subdomain: string; },
): Promise<TenantWidgetContext> {
  const defaults: TenantWidgetContext = {
    title: "Asistente SendCraft",
    welcomeMessage: "Hola! Soy el asistente de SendCraft. Como puedo ayudarte?",
    quickReplies: [...DEFAULT_QUICK_REPLIES],
    supportEmail: "soporte@sendcraft.net",
    crmUrl: DEFAULT_WIDGET_CRM_URL,
    aiEnabled: true,
    handoffEnabled: true,
  };

  if (!identity.tenantKey && !identity.tenantId && !identity.subscriptionId && !identity.scopeKey) {
    return defaults;
  }

  const lookups: Array<{ where: string; values: string[] }> = [];
  if (identity.tenantKey) lookups.push({ where: "tenant_key = $1", values: [identity.tenantKey] });
  if (identity.scopeKey) lookups.push({ where: "scope_key = $1", values: [identity.scopeKey] });
  if (identity.tenantId) lookups.push({ where: "tenant_id = $1", values: [identity.tenantId] });
  if (identity.subscriptionId) lookups.push({ where: "subscription_id = $1", values: [identity.subscriptionId] });

  for (const lookup of lookups) {
    const rows = await queryRows<WidgetContextRow>(
      client,
      `
      SELECT
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
      FROM tenant_webchat_widget_configs
      WHERE ${lookup.where}
      ORDER BY updated_at DESC
      LIMIT 1
      `,
      lookup.values,
    );

    const row = rows[0];
    if (!row) continue;

    const widgetConfig = firstObject(row.widget_config) || {};
    const quickReplies = normalizeWidgetQuickReplies(
      widgetConfig.quickReplies ?? widgetConfig.quick_replies,
      defaults.quickReplies,
    );

    return {
      title: firstString(widgetConfig.title as string | number | boolean | null | undefined, defaults.title),
      welcomeMessage: firstString(
        widgetConfig.welcomeMessage as string | number | boolean | null | undefined,
        widgetConfig.welcome_message as string | number | boolean | null | undefined,
        defaults.welcomeMessage,
      ),
      quickReplies,
      supportEmail: firstString(
        row.support_email,
        widgetConfig.supportEmail as string | number | boolean | null | undefined,
        widgetConfig.support_email as string | number | boolean | null | undefined,
        defaults.supportEmail,
      ),
      crmUrl: normalizeWidgetCrmUrl(firstString(
        row.crm_url,
        widgetConfig.crmUrl as string | number | boolean | null | undefined,
        widgetConfig.crm_url as string | number | boolean | null | undefined,
        defaults.crmUrl,
      )),
      aiEnabled: firstBoolean(widgetConfig.aiEnabled, widgetConfig.ai_enabled, row.ai_enabled, true) ?? true,
      handoffEnabled: firstBoolean(widgetConfig.handoffEnabled, widgetConfig.handoff_enabled, row.handoff_enabled, true) ?? true,
    };
  }

  return defaults;
}

async function loadApplicationSnapshot(client: any, tenantId: string): Promise<{ applicationIds: string[]; applicationCount: number; applicationNames: string[]; }> {
  if (!tenantId) {
    return {
      applicationIds: [],
      applicationCount: 0,
      applicationNames: [],
    };
  }

  const rows = await queryRows<ApplicationRow>(
    client,
    `
    SELECT id, name
    FROM applications
    WHERE tenant_id = $1
    ORDER BY created_at DESC
    LIMIT 100
    `,
    [tenantId],
  );

  return {
    applicationIds: rows.map((row) => row.id).filter(Boolean),
    applicationCount: rows.length,
    applicationNames: rows.map((row) => row.name).filter((value): value is string => !!value),
  };
}

async function loadTemplateMatches(
  client: any,
  applicationIds: string[],
  message: string,
): Promise<TemplateRow[]> {
  if (applicationIds.length === 0) return [];

  const normalizedMessage = normalizeText(message);
  if (!normalizedMessage) return [];

  const tokens = normalizedMessage.split(" ").filter((token) => token.length >= 3).slice(0, 5);
  const patterns = Array.from(new Set([
    `%${normalizedMessage}%`,
    ...tokens.map((token) => `%${token}%`),
  ]));

  const conditions: string[] = [];
  const values: unknown[] = [applicationIds];
  let index = 2;

  for (const pattern of patterns) {
    conditions.push(
      `name ILIKE $${index} OR COALESCE(subject, '') ILIKE $${index} OR COALESCE(html_content, '') ILIKE $${index} OR COALESCE(pdf_filename_pattern, '') ILIKE $${index}`,
    );
    values.push(pattern);
    index += 1;
  }

  const whereText = conditions.length > 0 ? `AND (${conditions.join(" OR ")})` : "";
  const rows = await queryRows<TemplateRow>(
    client,
    `
    SELECT
      t.name,
      t.template_type,
      t.subject,
      t.pdf_filename_pattern,
      a.name AS application_name
    FROM communication_templates t
    JOIN applications a ON a.id = t.application_id
    WHERE t.application_id = ANY($1::uuid[])
      AND t.is_active = true
      ${whereText}
    ORDER BY t.template_type ASC, t.name ASC
    LIMIT 10
    `,
    values,
  );

  return rows;
}

function buildTemplateReply(hits: TemplateRow[], intro: string): string {
  const lines = hits.slice(0, 5).map((hit) => {
    const parts: string[] = [];
    parts.push(hit.name || "Plantilla");
    if (hit.template_type) parts.push(`(${hit.template_type})`);
    if (hit.subject) parts.push(`- ${hit.subject}`);
    if (hit.application_name) parts.push(`en ${hit.application_name}`);
    if (hit.pdf_filename_pattern) parts.push(`PDF: ${hit.pdf_filename_pattern}`);
    return `- ${parts.join(" ")}`;
  });

  return [
    intro,
    "",
    ...lines,
    "",
    "Si quieres, te explico cual usar segun tu caso o te conecto con soporte para dejarlo listo.",
  ].join("\n");
}

function buildAboutReply(context: TenantWidgetContext): string {
  return [
    `${context.title} es el asistente de SendCraft para ayudarte con correos, PDFs, widget y planes.`,
    "Puedo explicarte como funciona cada parte y darte pasos concretos segun lo que necesites.",
    "Si quieres, dime si buscas una guia, una configuracion o una duda puntual y te ayudo.",
  ].join(" ");
}

function buildHelpReply(context: TenantWidgetContext): string {
  return [
    `Claro, te ayudo con ${context.title}.`,
    "Puedo orientarte con correos, PDFs, el widget, planes o revisar un caso concreto contigo.",
    "Si me cuentas que quieres lograr, te doy el paso a paso.",
  ].join(" ");
}

function buildFallbackReply(context: TenantWidgetContext): string {
  return [
    `Puedo ayudarte con correos, PDFs, widget, planes y soporte de SendCraft.`,
    "Si no encuentro una respuesta precisa, te conecto con un agente para revisarlo contigo.",
  ].join(" ");
}

function detectIntent(message: string): "greeting" | "about" | "help" | "email" | "pdf" | "widget" | "plans" | "contact" | "other" {
  const text = normalizeText(message);
  if (!text) return "greeting";

  if (
    text.includes("hola") ||
    text.includes("buenas") ||
    text.includes("buen dia") ||
    text.includes("buenos dias") ||
    text.includes("buenas tardes") ||
    text.includes("buenas noches")
  ) {
    return "greeting";
  }

  if (
    text.includes("que es sendcraft") ||
    (text.includes("sendcraft") && (
      text.includes("que es") ||
      text.includes("que hace") ||
      text.includes("como funciona") ||
      text.includes("quien es")
    ))
  ) {
    return "about";
  }

  if (
    text.includes("me ayudas") ||
    text.includes("ayuda") ||
    text.includes("puedes ayudar") ||
    text.includes("necesito ayuda") ||
    text.includes("como funciona") ||
    text.includes("que puedes hacer")
  ) {
    return "help";
  }

  if (
    text.includes("correo") ||
    text.includes("email") ||
    text.includes("mail") ||
    text.includes("enviar un correo") ||
    text.includes("enviar email")
  ) {
    return "email";
  }

  if (text.includes("pdf") || text.includes("documento")) {
    return "pdf";
  }

  if (text.includes("widget") || text.includes("integr") || text.includes("chat") || text.includes("snippet")) {
    return "widget";
  }

  if (text.includes("plan") || text.includes("precio") || text.includes("suscripcion") || text.includes("subscription")) {
    return "plans";
  }

  if (
    text.includes("contact") ||
    text.includes("soporte") ||
    text.includes("agente") ||
    text.includes("humano") ||
    text.includes("transfer") ||
    text.includes("deriv") ||
    text.includes("escal") ||
    text.includes("asesor") ||
    text.includes("representante") ||
    text.includes("persona") ||
    text.includes("hablar con alguien")
  ) {
    return "contact";
  }

  return "other";
}

function buildQuickReplies(context: TenantWidgetContext): string[] {
  return context.quickReplies.length > 0 ? context.quickReplies : [...DEFAULT_QUICK_REPLIES];
}

function buildSystemPrompt(context: TenantWidgetContext, snapshot: { applicationCount: number; applicationNames: string[]; templateNames: string[]; }): string {
  return [
    "Eres el asistente de SendCraft para el widget web.",
    "Respondes en espanol con un tono humano, cercano y profesional, como si fueras parte del equipo de soporte.",
    "Usa 2 a 4 oraciones claras, evita sonar robotico o demasiado generico, y no respondas con una sola linea.",
    "Cuando tengas contexto util, explica el paso a paso y agrega una sugerencia concreta de siguiente accion.",
    "Responde directamente siempre que puedas y usa handoff=true solo si el usuario pide una persona, un agente, o si no puedes resolverlo con el contexto disponible.",
    "Investiga primero el contexto de la aplicacion, templates y configuracion antes de decidir handoff.",
    "Si la consulta es generica o parece una pregunta frecuente, da una respuesta util sin derivar.",
    "Si falta contexto pero puedes pedir un dato breve, haz una pregunta corta en vez de derivar.",
    "No inventes URLs ni credenciales.",
    "Devuelve solo JSON valido con esta forma: {\"reply\":\"...\",\"handoff\":true|false}.",
    `Contexto: titulo=${context.title}; soporte=${context.supportEmail}; aplicaciones=${snapshot.applicationCount}; nombresAplicaciones=${snapshot.applicationNames.join("|") || "ninguna"}; templates=${snapshot.templateNames.join("|") || "ninguna"}.`,
  ].join("\n");
}

async function askOpenAI(
  message: string,
  history: Array<{ role: string; content: string }>,
  context: TenantWidgetContext,
  snapshot: { applicationCount: number; applicationNames: string[]; templateNames: string[]; },
): Promise<WidgetBotResponse | null> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) return null;

  const model = Deno.env.get("OPENAI_WIDGET_MODEL") || "gpt-4o-mini";
  const messages = [
    { role: "system", content: buildSystemPrompt(context, snapshot) },
    ...history.slice(-10),
    { role: "user", content: message.slice(0, 2000) },
  ];

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: 600,
      temperature: 0.3,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    return null;
  }

  const payload = await response.json().catch(() => null);
  const assistantText = payload?.choices?.[0]?.message?.content;
  if (typeof assistantText !== "string" || !assistantText.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(assistantText);
    return {
      reply: firstString(
        parsed.reply,
        buildFallbackReply(context),
      ),
      handoff: firstBoolean(parsed.handoff) ?? false,
      quickReplies: DEFAULT_QUICK_REPLIES,
    };
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  logBotEvent("request received", {
    method: req.method,
    path: new URL(req.url).pathname,
  });

  if (req.method !== "POST" && req.method !== "GET") {
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

  const authError = validateWidgetApiKey(req);
  if (authError) {
    logBotEvent("auth rejected", {
      method: req.method,
      path: new URL(req.url).pathname,
    });
    return authError;
  }

  let client;

  try {
    const databaseUrl = getDatabaseUrl();
    if (!databaseUrl) {
      return jsonResponse(
        {
          success: false,
          error: {
            code: "CONFIG_ERROR",
            message: "Missing DATABASE_URL",
          },
        },
        500,
      );
    }

    client = await getPool().connect();

    const rawBody = req.method === "GET" ? {} : await req.json().catch(() => null);
    const body = rawBody && typeof rawBody === "object" && !Array.isArray(rawBody)
      ? rawBody as WidgetBotRequest
      : {};
    const message = firstString(body.message);
    const identity = resolveWidgetIdentityFromRequest(req, body);
    const context = await loadTenantWidgetContext(client, identity);
    const appSnapshot = await loadApplicationSnapshot(client, identity.tenantId);
    const templateMatches = await loadTemplateMatches(client, appSnapshot.applicationIds, message);
    const templateNames = templateMatches.map((template) => template.name || "").filter(Boolean);
    const quickReplies = buildQuickReplies(context);

    logBotEvent("request parsed", {
      method: req.method,
      tenantKey: identity.tenantKey,
      scopeKey: identity.scopeKey,
      sessionId: firstString(body.session_id as string | number | boolean | null | undefined),
      conversationId: firstString(body.conversation_id as string | number | boolean | null | undefined),
      messagePreview: previewText(message),
      appCount: appSnapshot.applicationCount,
      templateHits: templateMatches.length,
    });

    const textHistory = Array.isArray(body.conversationHistory)
        ? body.conversationHistory.flatMap((item) => {
          if (!item || typeof item !== "object" || Array.isArray(item)) return [];
          const record = item as Record<string, unknown>;
          const content = firstString(
            record.content as string | number | boolean | null | undefined,
            record.text as string | number | boolean | null | undefined,
            record.message as string | number | boolean | null | undefined,
          );
          if (!content) return [];
          const role = firstString(record.role as string | number | boolean | null | undefined).toLowerCase();
          return [{ role: role === "assistant" || role === "system" ? role : "user", content: content.slice(0, 2000) }];
        })
      : [];

    const intent = detectIntent(message);
    logBotEvent("intent detected", {
      intent,
      templateHits: templateMatches.length,
      quickReplies: quickReplies.length,
    });

    if (intent === "greeting") {
      const reply = [
        `Hola! Soy ${context.title}.`,
        "Puedo ayudarte con correos, PDFs, widget, planes y derivacion a soporte.",
        "Si me dices que necesitas, te doy el paso a paso o te conecto con un agente.",
      ].join(" ");
      logBotEvent("response prepared", {
        intent,
        handoff: false,
        replyPreview: previewText(reply),
      });
      return jsonResponse({ reply, handoff: false, quickReplies });
    }

    if (intent === "about") {
      const reply = buildAboutReply(context);
      logBotEvent("response prepared", {
        intent,
        handoff: false,
        replyPreview: previewText(reply),
      });
      return jsonResponse({ reply, handoff: false, quickReplies });
    }

    if (intent === "help") {
      const reply = buildHelpReply(context);
      logBotEvent("response prepared", {
        intent,
        handoff: false,
        replyPreview: previewText(reply),
      });
      return jsonResponse({ reply, handoff: false, quickReplies });
    }

    if (intent === "contact") {
      const reply = context.supportEmail
        ? `Claro, te conecto con un agente para revisar tu caso en vivo. Si además prefieres correo, puedes escribir a ${context.supportEmail}.`
        : "Claro, te conecto con un agente para revisar tu caso en vivo.";
      logBotEvent("response prepared", {
        intent,
        handoff: true,
        replyPreview: previewText(reply),
      });
      return jsonResponse({ reply, handoff: true, quickReplies });
    }

    if (intent === "widget") {
      const reply = [
        "El widget se integra con un snippet corto y queda conectado al CRM automáticamente.",
        "Desde ahí puedes ajustar el saludo, las respuestas rápidas, los colores, la IA y la derivación a agente.",
        "Si quieres, te digo exactamente qué campos tocar para dejarlo listo en tu cuenta.",
      ].join(" ");
      logBotEvent("response prepared", {
        intent,
        handoff: false,
        replyPreview: previewText(reply),
      });
      return jsonResponse({ reply, handoff: false, quickReplies });
    }

    if (intent === "email" || intent === "pdf" || templateMatches.length > 0) {
      if (templateMatches.length > 0) {
        const intro = intent === "pdf"
          ? "Encontré estas plantillas PDF relacionadas con tu consulta:"
          : "Encontré estas plantillas relacionadas con tu consulta:";
        const reply = buildTemplateReply(templateMatches, intro);
        logBotEvent("response prepared", {
          intent,
          handoff: false,
          replyPreview: previewText(reply),
        });
        return jsonResponse({ reply, handoff: false, quickReplies });
      }

      if (intent === "email") {
        const reply = "Para enviar correos en SendCraft puedes usar tus plantillas de email y la API de envio. El flujo normal es elegir la plantilla, completar destinatarios y validar el contenido antes de enviarlo. Si quieres, te guio paso a paso con tu configuracion actual.";
        logBotEvent("response prepared", {
          intent,
          handoff: false,
          replyPreview: previewText(reply),
        });
        return jsonResponse({
          reply,
          handoff: false,
          quickReplies,
        });
      }

      const reply = "Para generar PDFs en SendCraft puedes usar plantillas PDF y el flujo de generacion correspondiente. Normalmente eliges la plantilla, completas los datos y el sistema genera el archivo listo para usar o enviar. Si quieres, te ayudo a configurarlo con tu caso concreto.";
      logBotEvent("response prepared", {
        intent,
        handoff: false,
        replyPreview: previewText(reply),
      });
      return jsonResponse({
        reply,
        handoff: false,
        quickReplies,
      });
    }

    if (intent === "plans") {
      const reply = [
        "Tu plan se valida desde la suscripción activa y se sincroniza con lo que ve el widget.",
        "Si tu cuenta tiene APIs dedicadas, el sistema puede aprovisionar un dominio propio para el tenant.",
        "Si quieres, reviso contigo que esté habilitado en tu cuenta y te digo si ya debería estar activo.",
      ].join(" ");
      logBotEvent("response prepared", {
        intent,
        handoff: false,
        replyPreview: previewText(reply),
      });
      return jsonResponse({ reply, handoff: false, quickReplies });
    }

    if (templateMatches.length > 0) {
      const reply = buildTemplateReply(templateMatches, "Encontré estas coincidencias en tu cuenta:");
      logBotEvent("response prepared", {
        intent,
        handoff: false,
        replyPreview: previewText(reply),
      });
      return jsonResponse({ reply, handoff: false, quickReplies });
    }

    const snapshot = {
      applicationCount: appSnapshot.applicationCount,
      applicationNames: appSnapshot.applicationNames,
      templateNames,
    };

    const openAiResponse = await askOpenAI(message, textHistory, context, snapshot);
    if (openAiResponse) {
      const reply = firstString(openAiResponse.reply, context.welcomeMessage);
      const handoff = firstBoolean(openAiResponse.handoff) ?? false;
      logBotEvent("response prepared", {
        intent: "openai",
        handoff,
        replyPreview: previewText(reply),
      });
      return jsonResponse({
        reply: reply || buildFallbackReply(context),
        handoff,
        quickReplies,
      });
    }

    const fallbackReply = buildFallbackReply(context);

    logBotEvent("response prepared", {
      intent: "fallback",
      handoff: true,
      replyPreview: previewText(fallbackReply),
    });
    return jsonResponse({
      reply: fallbackReply,
      handoff: true,
      quickReplies,
    });
  } catch (error) {
    logBotError("request failed", error);
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
  } finally {
    if (client) {
      client.release();
    }
  }
});
