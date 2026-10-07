// Aislamiento por tenant para la API genérica `query`.
//
// Con QUERY_AUTH_MODE=enforce cada petición debe traer el access token del
// usuario (Authorization: Bearer). El token se valida contra el servicio de
// auth y toda consulta se restringe a las filas del tenant / usuario. Las
// claves listadas en QUERY_SERVICE_API_KEYS (llamadas servidor a servidor)
// siguen teniendo acceso completo. Con QUERY_AUTH_MODE=legacy (por defecto)
// el comportamiento no cambia.

export type ScopeKind = "owner" | "application" | "tenant" | "user" | "public_insert";

// Cómo se decide qué filas puede ver o tocar un usuario en cada tabla.
// owner: la tabla `applications` (dueño directo o mismo tenant).
// application: filas cuya `application_id` pertenece a una aplicación del usuario.
// tenant: filas con `tenant_id` igual al del usuario.
// user: filas con `user_id` igual al del usuario.
// public_insert: cualquiera puede insertar (tracking previo al login); leer o
// modificar queda reservado a administradores del sistema.
export const TABLE_SCOPES: Record<string, ScopeKind> = {
  applications: "owner",
  api_keys: "application",
  branding_configs: "application",
  email_credentials: "application",
  communication_templates: "application",
  email_logs: "application",
  environments: "application",
  pdf_generation_logs: "application",
  predefined_variables: "application",
  pending_communications: "application",
  whatsapp_configs: "application",
  whatsapp_templates: "application",
  whatsapp_logs: "application",
  audit_logs: "tenant",
  tenant_dedicated_api_servers: "tenant",
  tenant_webchat_widget_configs: "tenant",
  tenant_webchat_conversations: "tenant",
  user_preferences: "user",
  web_access_attempts: "public_insert",
};

const SCOPE_COLUMN: Record<ScopeKind, string | null> = {
  owner: null,
  application: "application_id",
  tenant: "tenant_id",
  user: "user_id",
  public_insert: null,
};

export interface UserContext {
  userId: string;
  email: string;
  tenantId: string | null;
  isSystemAdmin: boolean;
}

export class ScopeError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 403, code = "FORBIDDEN") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export type AuthMode = "legacy" | "enforce";

export function getAuthMode(): AuthMode {
  return (Deno.env.get("QUERY_AUTH_MODE") || "").trim().toLowerCase() === "enforce"
    ? "enforce"
    : "legacy";
}

function parseList(raw?: string): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(String).map((x) => x.trim()).filter(Boolean);
  } catch {
    // CSV
  }
  return raw.split(",").map((x) => x.trim()).filter(Boolean);
}

export function getServiceApiKeys(): string[] {
  return parseList(Deno.env.get("QUERY_SERVICE_API_KEYS"));
}

export function getSystemAdminEmails(): string[] {
  const configured = parseList(Deno.env.get("QUERY_SYSTEM_ADMIN_EMAILS")).map((x) => x.toLowerCase());
  return configured.length ? configured : ["administrador@sendcraft.net"];
}

// ---------------------------------------------------------------------------
// SQL de alcance
// ---------------------------------------------------------------------------

function col(column: string, qualifier?: string): string {
  return qualifier ? `"${qualifier}"."${column}"` : `"${column}"`;
}

function ownerCondition(ctx: UserContext, params: unknown[], qualifier?: string): string {
  params.push(ctx.userId);
  const userParam = `$${params.length}`;
  const byUser = `${col("user_id", qualifier)}::text = ${userParam}`;

  if (!ctx.tenantId) return `(${byUser})`;

  params.push(ctx.tenantId);
  return `(${byUser} OR ${col("tenant_id", qualifier)}::text = $${params.length})`;
}

// Devuelve la condición SQL (sin WHERE) que limita `table` a las filas del
// usuario. `qualifier` antepone el nombre de la tabla a las columnas, necesario
// en el `DO UPDATE ... WHERE` de un upsert.
export function buildScopeCondition(
  table: string,
  ctx: UserContext,
  params: unknown[],
  qualifier?: string,
): string {
  if (ctx.isSystemAdmin) return "TRUE";

  const kind = TABLE_SCOPES[table];
  switch (kind) {
    case "owner":
      return ownerCondition(ctx, params, qualifier);
    case "application":
      return `${col("application_id", qualifier)} IN (SELECT "id" FROM "applications" WHERE ${ownerCondition(ctx, params)})`;
    case "tenant":
      if (!ctx.tenantId) return "FALSE";
      params.push(ctx.tenantId);
      return `${col("tenant_id", qualifier)}::text = $${params.length}`;
    case "user":
      params.push(ctx.userId);
      return `${col("user_id", qualifier)}::text = $${params.length}`;
    case "public_insert":
      return "FALSE";
    default:
      throw new ScopeError(`Table has no scope rule: ${table}`);
  }
}

// Combina el WHERE que arma el cliente con la condición de alcance.
export function mergeWhere(clientWhere: string, scopeCondition: string): string {
  if (!clientWhere) return `WHERE ${scopeCondition}`;
  return `${clientWhere} AND ${scopeCondition}`;
}

// ---------------------------------------------------------------------------
// Validación de filas escritas (insert, upsert, update)
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;

type ApplicationLookup = (applicationIds: string[], ctx: UserContext) => Promise<Set<string>>;

// Comprueba (y completa cuando falta) la columna de alcance de cada fila. Las
// filas pueden traer el valor del usuario o del tenant; nunca el de otro.
export async function enforceRowScope(
  table: string,
  rows: Row[],
  ctx: UserContext,
  lookupOwnedApplications: ApplicationLookup,
  { fillMissing }: { fillMissing: boolean },
): Promise<void> {
  if (ctx.isSystemAdmin) return;

  const kind = TABLE_SCOPES[table];
  if (!kind) throw new ScopeError(`Table has no scope rule: ${table}`);
  if (kind === "public_insert") return;

  if (kind === "owner") {
    for (const row of rows) {
      if (fillMissing && row.user_id == null) row.user_id = ctx.userId;
      const userOk = row.user_id == null || String(row.user_id) === ctx.userId;
      const tenantOk = row.tenant_id == null || (ctx.tenantId !== null && String(row.tenant_id) === ctx.tenantId);
      if (!userOk || !tenantOk) {
        throw new ScopeError("Row belongs to another user or tenant");
      }
    }
    return;
  }

  const column = SCOPE_COLUMN[kind]!;

  if (kind === "application") {
    const ids = new Set<string>();
    for (const row of rows) {
      if (!(column in row)) {
        if (fillMissing) throw new ScopeError("application_id is required", 400, "BAD_REQUEST");
        continue;
      }
      ids.add(String(row[column]));
    }
    if (!ids.size) return;
    const owned = await lookupOwnedApplications([...ids], ctx);
    for (const id of ids) {
      if (!owned.has(id)) throw new ScopeError("Application does not belong to this user");
    }
    return;
  }

  const expected = kind === "tenant" ? ctx.tenantId : ctx.userId;
  if (!expected) throw new ScopeError("User has no tenant");

  for (const row of rows) {
    if (row[column] == null) {
      if (fillMissing) row[column] = expected;
      continue;
    }
    if (String(row[column]) !== expected) {
      throw new ScopeError(`Row ${column} does not match the current user`);
    }
  }
}

// Una tabla `public_insert` solo admite insert sin ser administrador.
export function assertOperationAllowed(table: string, operation: string, ctx: UserContext): void {
  if (ctx.isSystemAdmin) return;
  if (TABLE_SCOPES[table] === "public_insert" && operation !== "insert") {
    throw new ScopeError("Only system administrators can read this table");
  }
}

// ---------------------------------------------------------------------------
// Verificación del token de usuario
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, any> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

export function decodeJwtPayload(token: string): Record<string, any> | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const json = new TextDecoder().decode(Uint8Array.from(atob(padded), (c) => c.charCodeAt(0)));
    const payload = JSON.parse(json);
    return isRecord(payload) ? payload : null;
  } catch {
    return null;
  }
}

// Extrae el usuario de la respuesta del servicio de auth. Se apoya en el
// payload del JWT solo después de que el servicio confirmó que es válido.
export function buildUserContext(
  verifyResponse: unknown,
  jwtPayload: Record<string, any> | null,
  adminEmails: string[],
): UserContext | null {
  const root = isRecord(verifyResponse)
    ? (isRecord(verifyResponse.data) ? verifyResponse.data : verifyResponse)
    : {};

  if (root.valid === false || verifyResponse === null) return null;

  const user = isRecord(root.user) ? root.user : {};
  const claims = isRecord(root.claims) ? root.claims : {};
  const tenant = isRecord(root.tenant) ? root.tenant : {};
  const jwt = jwtPayload || {};

  const userId = firstString(user.id, user.sub, user.user_id, claims.sub, claims.user_id, jwt.sub, jwt.user_id);
  if (!userId) return null;

  const email = firstString(user.email, claims.email, jwt.email).toLowerCase();
  const tenantId = firstString(
    user.tenant_id,
    claims.tenant_id,
    tenant.id,
    root.tenant_id,
    jwt.tenant_id,
    isRecord(jwt.tenant) ? jwt.tenant.id : undefined,
  ) || null;

  return {
    userId,
    email,
    tenantId,
    isSystemAdmin: !!email && adminEmails.includes(email),
  };
}

const VERIFY_CACHE_TTL_MS = 60_000;
const verifyCache = new Map<string, { ctx: UserContext; expiresAt: number }>();

function resolveVerifyUrl(): string {
  const explicit = firstString(
    Deno.env.get("AUTH_UPSTREAM_VERIFY_URL"),
    Deno.env.get("AUTH_VERIFY_URL"),
    Deno.env.get("AUTH_TOKEN_VALIDA"),
  );
  if (explicit) return explicit;

  const base = firstString(
    Deno.env.get("AUTH_FUNCTIONS_BASE_URL"),
    Deno.env.get("AUTH_EDGE_FUNCTIONS_BASE_URL"),
    Deno.env.get("AUTH_URL"),
  ).replace(/\/+$/, "");
  return base ? `${base}/auth-verify-token` : "";
}

export function readBearerToken(req: Request): string {
  const header = req.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

export async function verifyUserToken(
  token: string,
  fetchImpl: typeof fetch = fetch,
): Promise<UserContext | null> {
  const now = Date.now();
  const cached = verifyCache.get(token);
  if (cached && cached.expiresAt > now) return cached.ctx;
  if (cached) verifyCache.delete(token);

  const jwtPayload = decodeJwtPayload(token);
  if (jwtPayload && typeof jwtPayload.exp === "number" && jwtPayload.exp * 1000 <= now) {
    return null;
  }

  const verifyUrl = resolveVerifyUrl();
  if (!verifyUrl) {
    throw new ScopeError("Auth verify URL is not configured", 500, "CONFIG_ERROR");
  }

  let response: Response;
  try {
    response = await fetchImpl(verifyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        application_id: firstString(Deno.env.get("AUTH_APP_ID"), Deno.env.get("VITE_AUTH_APP_ID")),
        api_key: firstString(Deno.env.get("AUTH_API_KEY"), Deno.env.get("VITE_AUTH_API_KEY")),
      }),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    throw new ScopeError("Auth service unavailable", 503, "AUTH_UNAVAILABLE");
  }

  if (!response.ok) return null;

  const body = await response.json().catch(() => null);
  const ctx = buildUserContext(body, jwtPayload, getSystemAdminEmails());
  if (!ctx) return null;

  const tokenExpiry = jwtPayload && typeof jwtPayload.exp === "number" ? jwtPayload.exp * 1000 : Infinity;
  verifyCache.set(token, { ctx, expiresAt: Math.min(now + VERIFY_CACHE_TTL_MS, tokenExpiry) });
  if (verifyCache.size > 1000) {
    const oldest = verifyCache.keys().next().value;
    if (oldest !== undefined) verifyCache.delete(oldest);
  }

  return ctx;
}
