import { Pool } from "https://deno.land/x/postgres@v0.19.3/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, Authorization, X-Integration-Key, x-api-key",
  Vary: "Origin",
};

let pool: Pool | null = null;

const DEFAULT_UPSTREAM_WIDGET_CRM_URL = "https://satzkpynnuloncwgxeev.supabase.co/functions/v1/webchat-widget";

type DatabaseConnectionConfig = {
  connectionString?: string;
  hostname?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
  tls?: { enabled: boolean };
  connectionTimeoutMillis?: number;
};

function normalizeDatabaseConnectionString(value: string): string {
  const normalized = String(value || "").trim();
  if (!normalized) return "";

  try {
    const url = new URL(normalized);
    const database = url.pathname.replace(/^\/+/, "");
    if (!url.hostname || !url.username || !database) {
      return "";
    }

    return normalized;
  } catch {
    return "";
  }
}

function getDatabaseConnectionConfig(): DatabaseConnectionConfig | null {
  const connectionString = normalizeDatabaseConnectionString(
    firstString(
      Deno.env.get("DATABASE_URL"),
      Deno.env.get("SUPABASE_DB_URL"),
      Deno.env.get("POSTGRES_URL"),
      Deno.env.get("NEON_DATABASE_URL"),
      Deno.env.get("NEON_URL"),
    ),
  );

  if (connectionString) {
    return {
      connectionString,
      connectionTimeoutMillis: 5000,
    };
  }

  const hostname = firstString(
    Deno.env.get("PGHOST"),
    Deno.env.get("DB_HOST"),
    Deno.env.get("POSTGRES_HOST"),
    Deno.env.get("NEON_HOST"),
  );
  const user = firstString(
    Deno.env.get("PGUSER"),
    Deno.env.get("DB_USER"),
    Deno.env.get("POSTGRES_USER"),
    Deno.env.get("NEON_USER"),
  );
  const database = firstString(
    Deno.env.get("PGDATABASE"),
    Deno.env.get("DB_NAME"),
    Deno.env.get("POSTGRES_DB"),
    Deno.env.get("NEON_DATABASE"),
  );

  if (!hostname || !user || !database) {
    return null;
  }

  const password = firstString(
    Deno.env.get("PGPASSWORD"),
    Deno.env.get("DB_PASSWORD"),
    Deno.env.get("POSTGRES_PASSWORD"),
    Deno.env.get("NEON_PASSWORD"),
  );
  const port = Number(
    firstString(
      Deno.env.get("PGPORT"),
      Deno.env.get("DB_PORT"),
      Deno.env.get("POSTGRES_PORT"),
      Deno.env.get("NEON_PORT"),
      "5432",
    ),
  );
  const sslMode = firstString(
    Deno.env.get("PGSSLMODE"),
    Deno.env.get("DB_SSLMODE"),
    Deno.env.get("POSTGRES_SSLMODE"),
    Deno.env.get("NEON_SSLMODE"),
    "require",
  ).toLowerCase();

  return {
    hostname,
    user,
    database,
    port: Number.isFinite(port) ? port : 5432,
    ...(password ? { password } : {}),
    ...(sslMode === "disable" || sslMode === "disabled" || sslMode === "false" || sslMode === "0" || sslMode === "off"
      ? {}
      : { tls: { enabled: true } }),
    connectionTimeoutMillis: 5000,
  };
}

function getPool(): Pool {
  const databaseConfig = getDatabaseConnectionConfig();
  if (!databaseConfig) {
    throw new Error("Missing database connection configuration");
  }

  if (!pool) {
    pool = new Pool(databaseConfig as any, 3, true);
  }

  return pool;
}

function getUpstreamWidgetCrmUrl(): string {
  return normalizeUrl(
    firstString(
      Deno.env.get("WEBCHAT_WIDGET_UPSTREAM_URL"),
      Deno.env.get("WEBCHAT_WIDGET_CRM_PROXY_URL"),
      Deno.env.get("WEBCHAT_WIDGET_CRM_TARGET_URL"),
      DEFAULT_UPSTREAM_WIDGET_CRM_URL,
    ),
  ) || DEFAULT_UPSTREAM_WIDGET_CRM_URL;
}

function getUpstreamWidgetApiKey(req: Request): string {
  return firstString(
    Deno.env.get("WEBCHAT_WIDGET_UPSTREAM_API_KEY"),
    Deno.env.get("WEBCHAT_WIDGET_CRM_API_KEY"),
    req.headers.get("x-api-key"),
    req.headers.get("X-Integration-Key"),
    req.headers.get("x-integration-key"),
  );
}

async function proxyWidgetConversationToUpstream(
  req: Request,
  body: Record<string, unknown>,
): Promise<{ response: Response; payload: Record<string, unknown> | null }> {
  const upstreamUrl = new URL(getUpstreamWidgetCrmUrl());
  const incomingUrl = new URL(req.url);
  upstreamUrl.search = incomingUrl.search;

  const method = req.method.toUpperCase();
  const headers = new Headers();
  headers.set("Accept", "application/json");

  const apiKey = getUpstreamWidgetApiKey(req);
  if (apiKey) {
    headers.set("x-api-key", apiKey);
    headers.set("X-Integration-Key", apiKey);
  }

  const contentType = req.headers.get("content-type");
  if (contentType && method !== "GET" && method !== "HEAD") {
    headers.set("Content-Type", contentType);
  }

  const init: RequestInit = {
    method,
    headers,
  };

  if (method !== "GET" && method !== "HEAD") {
    init.body = JSON.stringify(body);
  }

  logWidgetEvent("proxy start", {
    method,
    endpoint: upstreamUrl.toString(),
  });

  try {
    const response = await fetch(upstreamUrl.toString(), init);
    const payload = await response.text();

    logWidgetEvent("proxy success", {
      method,
      endpoint: upstreamUrl.toString(),
      status: response.status,
    });

    return {
      response: new Response(payload, {
        status: response.status,
        headers: {
          ...corsHeaders,
          "Content-Type": response.headers.get("content-type") || "application/json",
        },
      }),
      payload: payload ? (() => {
        try {
          const parsed = JSON.parse(payload);
          return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
        } catch {
          return null;
        }
      })() : null,
    };
  } catch (error) {
    logWidgetError("proxy failed", error, {
      method,
      endpoint: upstreamUrl.toString(),
    });

    return {
      response: jsonResponse(
        {
          success: false,
          error: {
            code: "UPSTREAM_ERROR",
            message: error instanceof Error ? error.message : "Unexpected error",
          },
        },
        502,
      ),
      payload: null,
    };
  }
}

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

type WidgetIdentity = {
  tenantKey: string;
  tenantId: string;
  subscriptionId: string;
  scopeKey: string;
  tenantName: string;
  subdomain: string;
  sourceDomain: string;
};

type WidgetConversationRequest = Record<string, unknown> & {
  action?: string;
  session_id?: string;
  sessionId?: string;
  conversation_id?: string;
  conversationId?: string;
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
  message?: string;
  sender_type?: string;
  senderType?: string;
  role?: string;
  sourceChannel?: string;
  sourceDetail?: string;
  clientId?: string;
  opportunityId?: string;
  assignedUserId?: string;
  assignedUserName?: string;
  assignedAt?: string;
  closedAt?: string;
  lastError?: string;
  visitor?: Record<string, unknown> | null;
  attachments?: unknown[];
  messages?: unknown;
  queued_messages?: unknown;
  assistant_reply?: string;
  assistantReply?: string;
  handoff_reason?: string;
  handoffReason?: string;
  reason?: string;
  metadata?: Record<string, unknown> | null;
  assigned_user_id?: string;
  assigned_user_name?: string;
  assigned_at?: string;
  closed_at?: string;
  status?: string;
  last_error?: string;
  cause?: string;
  cause_custom?: string;
  result?: string;
  result_notes?: string;
  source_channel?: string;
  source_detail?: string;
  client_id?: string;
  opportunity_id?: string;
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

function logWidgetEvent(event: string, details?: Record<string, unknown>): void {
  if (details) {
    console.info(`[webchat-widget] ${event}`, details);
    return;
  }

  console.info(`[webchat-widget] ${event}`);
}

function logWidgetError(event: string, error: unknown, details?: Record<string, unknown>): void {
  console.error(`[webchat-widget] ${event}`, {
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
    // fallback to CSV below
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

function normalizeSenderType(value: string): "visitor" | "assistant" | "system" {
  const normalized = String(value || "").trim().toLowerCase();
  if (
    normalized === "assistant" ||
    normalized === "agent" ||
    normalized === "support" ||
    normalized === "staff" ||
    normalized === "human" ||
    normalized === "bot"
  ) {
    return "assistant";
  }
  if (normalized === "system") return normalized;
  return "visitor";
}

function validateWidgetApiKey(req: Request): Response | null {
  const url = new URL(req.url);
  const providedKey = firstString(
    url.searchParams.get("api_key"),
    url.searchParams.get("apiKey"),
    url.searchParams.get("x-api-key"),
    url.searchParams.get("x_api_key"),
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
    Deno.env.get("API_KEY_CRM"),
    Deno.env.get("API_KEY_USER_EMBED"),
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

function resolveWidgetIdentityFromRequest(req: Request, body?: WidgetConversationRequest | null): WidgetIdentity {
  const url = new URL(req.url);
  const search = url.searchParams;
  const sourceDomain = firstString(
    body?.source_domain as string | number | null | undefined,
    body?.sourceDomain as string | number | null | undefined,
    search.get("source_domain"),
    search.get("sourceDomain"),
    url.hostname,
  );
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
    sourceDomain,
    "Widget CRM",
  );
  const subdomain = firstString(
    body?.subdomain as string | number | null | undefined,
    search.get("subdomain"),
    slugifySubdomain(tenantName),
  );
  const tenantKey = firstString(
    body?.tenant_key as string | number | null | undefined,
    body?.tenantKey as string | number | null | undefined,
    body?.scope_key as string | number | null | undefined,
    body?.scopeKey as string | number | null | undefined,
    search.get("tenant_key"),
    search.get("tenantKey"),
    search.get("scope_key"),
    search.get("scopeKey"),
    tenantId ? `tenant:${tenantId.toLowerCase()}` : "",
    subscriptionId ? `subscription:${subscriptionId.toLowerCase()}` : "",
    tenantName ? `tenant:${slugifySubdomain(tenantName)}` : "",
    sourceDomain ? `domain:${slugifySubdomain(sourceDomain)}` : "",
    `tenant:${subdomain}`,
  );

  return {
    tenantKey,
    tenantId,
    subscriptionId,
    scopeKey: firstString(
      body?.scope_key as string | number | null | undefined,
      body?.scopeKey as string | number | null | undefined,
      search.get("scope_key"),
      search.get("scopeKey"),
      tenantKey,
    ),
    tenantName,
    subdomain,
    sourceDomain,
  };
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

    const senderType = normalizeSenderType(firstString(
      record.sender_type as string | number | boolean | null | undefined,
      record.senderType as string | number | boolean | null | undefined,
      record.role as string | number | boolean | null | undefined,
    ));

    return [
      {
        id: firstString(
          record.id as string | number | boolean | null | undefined,
          `${senderType}-${index}`,
        ),
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

function extractConversationFallbackMessage(value: unknown): string {
  if (!Array.isArray(value)) return "";

  let fallbackText = "";

  for (let index = value.length - 1; index >= 0; index -= 1) {
    const item = value[index];
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;

    const record = item as Record<string, unknown>;
    const text = firstString(
      record.text as string | number | boolean | null | undefined,
      record.message as string | number | boolean | null | undefined,
      record.content as string | number | boolean | null | undefined,
    );
    if (!text) continue;

    const role = firstString(
      record.role as string | number | boolean | null | undefined,
      record.sender_type as string | number | boolean | null | undefined,
      record.senderType as string | number | boolean | null | undefined,
    ).toLowerCase();

    if (role === "user" || role === "visitor") {
      return text;
    }

    if (!fallbackText) {
      fallbackText = text;
    }
  }

  return fallbackText;
}

function normalizeConversationList(value: unknown, conversationId: string): Record<string, unknown>[] {
  return normalizeConversationMessages(value, conversationId);
}

function rowToConversationResponse(row: ConversationRow): Record<string, unknown> {
  const messages = normalizeConversationList(row.messages, firstString(row.conversation_id));
  const queuedMessages = normalizeConversationList(row.queued_messages, firstString(row.conversation_id));

  return {
    success: true,
    found: true,
    conversation_id: firstString(row.conversation_id),
    conversation: {
      id: firstString(row.conversation_id),
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

function normalizeStoredMessages(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];

    const record = item as Record<string, unknown>;
    const text = firstString(
      record.message as string | number | boolean | null | undefined,
      record.content as string | number | boolean | null | undefined,
      record.text as string | number | boolean | null | undefined,
    );
    if (!text) return [];

    const senderType = normalizeSenderType(firstString(
      record.sender_type as string | number | boolean | null | undefined,
      record.senderType as string | number | boolean | null | undefined,
      record.role as string | number | boolean | null | undefined,
    ));

    return [
      {
        id: firstString(
          record.id as string | number | boolean | null | undefined,
          `${senderType}-${index}`,
        ),
        conversation_id: firstString(
          record.conversation_id as string | number | boolean | null | undefined,
          record.conversationId as string | number | boolean | null | undefined,
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

async function findConversation(
  client: any,
  identity: WidgetIdentity,
  sessionId: string,
  conversationId: string,
): Promise<ConversationRow | null> {
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

async function upsertConversation(
  client: any,
  identity: WidgetIdentity,
  body: WidgetConversationRequest,
  sessionId: string,
  existing: ConversationRow | null,
): Promise<ConversationRow> {
  const now = new Date().toISOString();
  const action = firstString(body.action).toLowerCase();
  const conversationId = firstString(
    body.conversation_id,
    body.conversationId,
    existing?.conversation_id,
    crypto.randomUUID(),
  );
  const visitor = firstObject(body.visitor) || {};
  const sourceDomain = firstString(
    body.source_domain,
    body.sourceDomain,
    identity.sourceDomain,
    "sendcraft.net",
  );
  const pageUrl = firstString(body.page_url, body.pageUrl, existing?.page_url);
  const visitorName = firstString(
    visitor.name as string | number | boolean | null | undefined,
    existing?.visitor_name,
    "Visitante",
  );
  const visitorEmail = firstString(
    visitor.email as string | number | boolean | null | undefined,
    existing?.visitor_email,
  );
  const visitorPhone = firstString(
    visitor.phone as string | number | boolean | null | undefined,
    existing?.visitor_phone,
  );
  const senderType = normalizeSenderType(firstString(body.sender_type, body.senderType, body.role));
  const senderName = senderType === "assistant"
    ? firstString(identity.tenantName, "SendCraft")
    : senderType === "system"
      ? "SendCraft"
      : visitorName;
  const senderId = senderType === "assistant" ? "assistant" : senderType === "system" ? "system" : sessionId;
  const incomingMessage = firstString(
    body.message,
    body.assistant_reply,
    body.assistantReply,
    action === "request_agent_handoff"
      ? extractConversationFallbackMessage(body.messages) || "Solicitud de contacto con un agente"
      : "",
  );
  const assignedUserId = firstString(body.assigned_user_id, body.assignedUserId, existing?.assigned_user_id);
  const assignedUserName = firstString(body.assigned_user_name, body.assignedUserName, existing?.assigned_user_name);
  const assignedAt = firstString(body.assigned_at, body.assignedAt, existing?.assigned_at);
  const closedAt = firstString(body.closed_at, body.closedAt, existing?.closed_at);
  const statusFromBody = firstString(body.status, existing?.status, "open");
  const handoffRequested = firstBoolean(body.action === "request_agent_handoff", body.handoff_requested, existing?.handoff_requested) ?? false;
  const handoffReason = firstString(
    body.handoff_reason,
    body.handoffReason,
    body.reason,
    existing?.handoff_reason,
    action === "request_agent_handoff" ? "auto_fallback" : "",
  );
  const sourceChannel = firstString(
    body.source_channel,
    body.sourceChannel,
    action === "request_agent_handoff" ? "webchat" : "",
    existing?.source_channel,
  );
  const sourceDetail = firstString(
    body.source_detail,
    body.sourceDetail,
    body.reason,
    existing?.source_detail,
  );
  const clientId = firstString(body.client_id, body.clientId, existing?.client_id);
  const opportunityId = firstString(body.opportunity_id, body.opportunityId, existing?.opportunity_id);
  const normalizedReason = firstString(body.reason, body.handoff_reason, body.handoffReason).toLowerCase();
  const cause = firstString(
    body.cause,
    existing?.cause,
    action === "request_agent_handoff"
      ? normalizedReason === "manual_contact"
        ? "user_requested_agent"
        : "ai_no_answer"
      : "",
  );
  const causeCustom = firstString(body.cause_custom, existing?.cause_custom);
  const resultValue = firstString(body.result, existing?.result, action === "request_agent_handoff" ? "handoff_requested" : "");
  const resultNotes = firstString(
    body.result_notes,
    existing?.result_notes,
    action === "request_agent_handoff"
      ? normalizedReason === "manual_contact"
        ? "El usuario pidió hablar con un agente desde el widget."
        : "La IA no encontró una respuesta segura y derivó la conversación."
      : "",
  );
  const lastError = firstString(body.last_error, body.lastError);

  let messages = existing ? normalizeStoredMessages(existing.messages) : [];
  let queuedMessages = existing ? normalizeStoredMessages(existing.queued_messages) : [];

  if (action === "request_agent_handoff" && Array.isArray(body.messages) && body.messages.length > 0) {
    messages = normalizeConversationMessages(body.messages, conversationId);
  } else if (incomingMessage) {
    messages = [
      ...messages,
      buildMessageRecord({
        conversationId,
        senderType,
        senderId,
        senderName,
        message: incomingMessage,
        attachments: Array.isArray(body.attachments) ? body.attachments : [],
        createdAt: now,
      }),
    ];
  }

  const assistantReply = firstString(body.assistant_reply, body.assistantReply);
  if (senderType === "assistant" && assistantReply && assistantReply !== incomingMessage) {
    messages = [
      ...messages,
      buildMessageRecord({
        conversationId,
        senderType: "assistant",
        senderId: "assistant",
        senderName,
        message: assistantReply,
        createdAt: now,
      }),
    ];
  }

  if (action === "request_agent_handoff") {
    queuedMessages = [
      ...queuedMessages,
      buildMessageRecord({
        conversationId,
        senderType: "system",
        senderId: "system",
        senderName: identity.tenantName || "SendCraft",
        message: firstString(
          body.message,
          normalizedReason === "manual_contact"
            ? "El usuario solicito contacto con un agente"
            : "Solicitud de agente pendiente",
        ),
        createdAt: now,
      }),
    ];
  }

  const nextStatus = action === "request_agent_handoff"
    ? "waiting_agent"
    : assignedUserName || assignedUserId
      ? "taken"
      : (statusFromBody || "open");

  const nextConversation: ConversationRow = {
    id: existing?.id || null,
    tenant_key: identity.tenantKey,
    tenant_id: identity.tenantId || null,
    subscription_id: identity.subscriptionId || null,
    scope_key: identity.scopeKey,
    session_id: sessionId,
    conversation_id: conversationId,
    source_domain: sourceDomain,
    page_url: pageUrl || null,
    visitor_name: visitorName || null,
    visitor_email: visitorEmail || null,
    visitor_phone: visitorPhone || null,
    status: nextStatus,
    assigned_user_id: assignedUserId || null,
    assigned_user_name: assignedUserName || null,
    assigned_at: assignedAt || null,
    closed_at: closedAt || null,
    last_message_at: now,
    last_user_message: senderType === "visitor" ? incomingMessage || existing?.last_user_message || null : existing?.last_user_message || null,
    last_ai_reply: action === "request_agent_handoff"
      ? assistantReply || existing?.last_ai_reply || null
      : senderType === "assistant"
        ? incomingMessage || assistantReply || existing?.last_ai_reply || null
        : existing?.last_ai_reply || null,
    handoff_requested: handoffRequested || action === "request_agent_handoff",
    handoff_reason: handoffReason || null,
    cause: cause || null,
    cause_custom: causeCustom || null,
    result: resultValue || null,
    result_notes: resultNotes || null,
    source_channel: sourceChannel || null,
    source_detail: sourceDetail || null,
    client_id: clientId || null,
    opportunity_id: opportunityId || null,
    messages,
    queued_messages: queuedMessages,
    metadata: firstObject(body.metadata, existing?.metadata) || {},
    last_error: lastError || null,
    created_at: existing?.created_at || now,
    updated_at: now,
  };

  const rows = await queryRows<ConversationRow>(
    client,
    `
    INSERT INTO tenant_webchat_conversations (
      tenant_key,
      tenant_id,
      subscription_id,
      scope_key,
      session_id,
      conversation_id,
      source_domain,
      page_url,
      visitor_name,
      visitor_email,
      visitor_phone,
      status,
      assigned_user_id,
      assigned_user_name,
      assigned_at,
      closed_at,
      last_message_at,
      last_user_message,
      last_ai_reply,
      handoff_requested,
      handoff_reason,
      cause,
      cause_custom,
      result,
      result_notes,
      source_channel,
      source_detail,
      client_id,
      opportunity_id,
      messages,
      queued_messages,
      metadata,
      last_error
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
      $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
      $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
      $31, $32::jsonb, $33
    )
    ON CONFLICT (tenant_key, session_id) DO UPDATE SET
      tenant_id = EXCLUDED.tenant_id,
      subscription_id = EXCLUDED.subscription_id,
      scope_key = EXCLUDED.scope_key,
      conversation_id = EXCLUDED.conversation_id,
      source_domain = EXCLUDED.source_domain,
      page_url = EXCLUDED.page_url,
      visitor_name = EXCLUDED.visitor_name,
      visitor_email = EXCLUDED.visitor_email,
      visitor_phone = EXCLUDED.visitor_phone,
      status = EXCLUDED.status,
      assigned_user_id = EXCLUDED.assigned_user_id,
      assigned_user_name = EXCLUDED.assigned_user_name,
      assigned_at = EXCLUDED.assigned_at,
      closed_at = EXCLUDED.closed_at,
      last_message_at = EXCLUDED.last_message_at,
      last_user_message = EXCLUDED.last_user_message,
      last_ai_reply = EXCLUDED.last_ai_reply,
      handoff_requested = EXCLUDED.handoff_requested,
      handoff_reason = EXCLUDED.handoff_reason,
      cause = EXCLUDED.cause,
      cause_custom = EXCLUDED.cause_custom,
      result = EXCLUDED.result,
      result_notes = EXCLUDED.result_notes,
      source_channel = EXCLUDED.source_channel,
      source_detail = EXCLUDED.source_detail,
      client_id = EXCLUDED.client_id,
      opportunity_id = EXCLUDED.opportunity_id,
      messages = EXCLUDED.messages,
      queued_messages = EXCLUDED.queued_messages,
      metadata = EXCLUDED.metadata,
      last_error = EXCLUDED.last_error
    RETURNING *
    `,
    [
      nextConversation.tenant_key,
      nextConversation.tenant_id,
      nextConversation.subscription_id,
      nextConversation.scope_key,
      nextConversation.session_id,
      nextConversation.conversation_id,
      nextConversation.source_domain,
      nextConversation.page_url,
      nextConversation.visitor_name,
      nextConversation.visitor_email,
      nextConversation.visitor_phone,
      nextConversation.status,
      nextConversation.assigned_user_id,
      nextConversation.assigned_user_name,
      nextConversation.assigned_at,
      nextConversation.closed_at,
      nextConversation.last_message_at,
      nextConversation.last_user_message,
      nextConversation.last_ai_reply,
      nextConversation.handoff_requested,
      nextConversation.handoff_reason,
      nextConversation.cause,
      nextConversation.cause_custom,
      nextConversation.result,
      nextConversation.result_notes,
      nextConversation.source_channel,
      nextConversation.source_detail,
      nextConversation.client_id,
      nextConversation.opportunity_id,
      JSON.stringify(nextConversation.messages),
      JSON.stringify(nextConversation.queued_messages),
      JSON.stringify(nextConversation.metadata || {}),
      nextConversation.last_error,
    ],
  );

  return rows[0] ?? nextConversation;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  logWidgetEvent("request received", {
    method: req.method,
    path: new URL(req.url).pathname,
  });

  const authError = validateWidgetApiKey(req);
  if (authError) {
    logWidgetEvent("auth rejected", {
      method: req.method,
      path: new URL(req.url).pathname,
    });
    return authError;
  }

  const method = req.method.toUpperCase();
  if (method === "GET") {
    const upstreamResult = await proxyWidgetConversationToUpstream(req, {});
    return upstreamResult.response;
  }

  let client;

  try {
    const databaseConfig = getDatabaseConnectionConfig();
    if (!databaseConfig) {
      return jsonResponse(
        {
          success: false,
          error: {
            code: "CONFIG_ERROR",
            message: "Missing database connection configuration",
          },
        },
        500,
      );
    }

    client = await getPool().connect();
    const url = new URL(req.url);

    if (method === "GET") {
      const identity = resolveWidgetIdentityFromRequest(req, null);
      const sessionId = firstString(url.searchParams.get("session_id"), url.searchParams.get("sessionId"));
      const conversationId = firstString(url.searchParams.get("conversation_id"), url.searchParams.get("conversationId"));

      logWidgetEvent("GET lookup start", {
        sessionId,
        conversationId,
        tenantKey: identity.tenantKey,
        scopeKey: identity.scopeKey,
      });

      if (!sessionId && !conversationId) {
        logWidgetEvent("GET lookup skipped", {
          reason: "missing_session_and_conversation",
          tenantKey: identity.tenantKey,
          scopeKey: identity.scopeKey,
        });
        return jsonResponse(
          {
            success: true,
            found: false,
            conversation: null,
            messages: [],
            queued_messages: [],
          },
          200,
        );
      }

      const row = await findConversation(client, identity, sessionId, conversationId);
      if (!row) {
        logWidgetEvent("GET lookup miss", {
          sessionId,
          conversationId,
          tenantKey: identity.tenantKey,
          scopeKey: identity.scopeKey,
        });
        return jsonResponse(
          {
            success: true,
            found: false,
            conversation: null,
            messages: [],
            queued_messages: [],
          },
          200,
        );
      }

      logWidgetEvent("GET lookup hit", {
        sessionId,
        conversationId: firstString(row.conversation_id),
        status: firstString(row.status),
        assignedUserName: firstString(row.assigned_user_name),
        handoffRequested: Boolean(row.handoff_requested),
      });

      return jsonResponse(rowToConversationResponse(row));
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

    const body = rawBody as WidgetConversationRequest;
    const action = firstString(body.action).toLowerCase();
    const sessionId = firstString(body.session_id, body.sessionId);
    if (!sessionId) {
      return jsonResponse(
        {
          success: false,
          error: {
            code: "MISSING_SESSION",
            message: "session_id is required",
          },
        },
        400,
      );
    }

    const identity = resolveWidgetIdentityFromRequest(req, body);
    const conversationId = firstString(body.conversation_id, body.conversationId);
    logWidgetEvent("POST start", {
      action: action || "message",
      sessionId,
      conversationId,
      tenantKey: identity.tenantKey,
      scopeKey: identity.scopeKey,
      senderType: firstString(body.sender_type, body.senderType, body.role),
    });

    const existing = await findConversation(client, identity, sessionId, conversationId);
    const savedRow = await upsertConversation(client, identity, body, sessionId, existing);
    const responsePayload = rowToConversationResponse(savedRow);

    if (action === "request_agent_handoff") {
      const conversation = responsePayload.conversation as Record<string, unknown> | undefined;
      const assignedAgentName = firstString(
        conversation?.assigned_user_name as string | number | boolean | null | undefined,
        savedRow.assigned_user_name as string | number | boolean | null | undefined,
      );
      const reply = assignedAgentName
        ? `Ya te estoy conectando con ${assignedAgentName}. En breve revisará tu conversación.`
        : "Ya recibimos tu solicitud. Te estamos conectando con un agente para seguir ayudándote.";

      const upstreamResult = await proxyWidgetConversationToUpstream(req, body);
      if (!upstreamResult.response.ok) {
        return upstreamResult.response;
      }

      return jsonResponse({
        ...responsePayload,
        ...(upstreamResult.payload || {}),
        success: true,
        reply,
        handoff: true,
        conversation_id: firstString(
          upstreamResult.payload?.conversation_id as string | number | boolean | null | undefined,
          responsePayload.conversation_id as string | number | boolean | null | undefined,
        ),
      });
    }

    logWidgetEvent("POST saved", {
      sessionId,
      conversationId: firstString(savedRow.conversation_id),
      status: firstString(savedRow.status),
      assignedUserName: firstString(savedRow.assigned_user_name),
      handoffRequested: Boolean(savedRow.handoff_requested),
    });

    return jsonResponse(responsePayload);
  } catch (error) {
    logWidgetError("request failed", error);
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
