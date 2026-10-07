// Autenticación de una aplicación en las funciones de envío.
//
// Copia canónica: apis-functions/_shared/app-auth.ts. Cada función lleva una
// copia idéntica en su propia carpeta _shared (se despliegan por separado);
// `deno test apis-functions/_shared/app-auth.test.ts` verifica que todas las
// copias coincidan.
//
// Acepta tres credenciales:
//   1. x-api-key: la API key del cliente, buscada por su hash SHA-256.
//   2. Authorization: Bearer <token de usuario> + x-application-id: el panel
//      llama en nombre del usuario logueado; la aplicación debe ser suya, de su
//      tenant, o el usuario debe ser administrador del sistema.
//   3. x-internal-key + x-application-id: llamadas entre funciones y del
//      scheduler. La clave sale de FUNCTIONS_INTERNAL_KEY.
//
// Con 2 y 3 el panel y el scheduler ya no necesitan la API key en texto plano.

export type AppAuthMethod = "api_key" | "user_token" | "internal";

export interface AppCredential {
  applicationId: string;
  method: AppAuthMethod;
  // Cabeceras para llamar a otra función de SendCraft en nombre de la misma
  // aplicación (por ejemplo notify -> send-email).
  forwardHeaders: Record<string, string>;
}

export interface UserContext {
  userId: string;
  email: string;
  tenantId: string | null;
  isSystemAdmin: boolean;
}

export class AppAuthError extends Error {
  status: number;

  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

export type RowQuery = (sql: string, params: unknown[]) => Promise<Record<string, unknown>[]>;

export const APP_AUTH_CORS_HEADERS = "Authorization, x-application-id, x-internal-key";

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
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

export function getInternalKey(): string {
  return (Deno.env.get("FUNCTIONS_INTERNAL_KEY") || "").trim();
}

export function getSystemAdminEmails(): string[] {
  const configured = parseList(
    Deno.env.get("SYSTEM_ADMIN_EMAILS") || Deno.env.get("QUERY_SYSTEM_ADMIN_EMAILS"),
  ).map((x) => x.toLowerCase());
  return configured.length ? configured : ["administrador@sendcraft.net"];
}

export function timingSafeEqual(a: string, b: string): boolean {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  let diff = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length; i++) {
    diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  }
  return diff === 0;
}

export function readBearerToken(req: Request): string {
  const header = req.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
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

// Extrae el usuario de la respuesta del servicio de auth. El payload del JWT
// solo se usa después de que el servicio confirmó que el token es válido.
export function buildUserContext(
  verifyResponse: unknown,
  jwtPayload: Record<string, any> | null,
  adminEmails: string[],
): UserContext | null {
  if (!isRecord(verifyResponse)) return null;
  const root = isRecord(verifyResponse.data) ? verifyResponse.data : verifyResponse;
  if (root.valid === false || verifyResponse.success === false) return null;

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

  return { userId, email, tenantId, isSystemAdmin: !!email && adminEmails.includes(email) };
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
  if (!verifyUrl) throw new AppAuthError("Auth verify URL is not configured", 500);

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
    throw new AppAuthError("Auth service unavailable", 503);
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

function internalForwardHeaders(applicationId: string, internalKey: string): Record<string, string> {
  return { "x-internal-key": internalKey, "x-application-id": applicationId };
}

// Resuelve la aplicación que hace la llamada. `apiKey` permite pasar una
// clave que la función leyó de otro lugar (query string o body); si no se
// pasa se usa la cabecera x-api-key. Lanza AppAuthError si no hay credencial
// válida.
export async function authenticateApplication(
  req: Request,
  query: RowQuery,
  options: { apiKey?: string | null; fetchImpl?: typeof fetch } = {},
): Promise<AppCredential> {
  const apiKey = (options.apiKey ?? req.headers.get("x-api-key") ?? "").trim();

  if (apiKey) {
    const rows = await query(
      `SELECT id FROM applications
       WHERE api_key_hash = encode(sha256(convert_to($1::text, 'UTF8')), 'hex')
       LIMIT 1`,
      [apiKey],
    );
    const id = rows[0]?.id;
    if (id === undefined || id === null) throw new AppAuthError("Invalid API key", 401);
    return { applicationId: String(id), method: "api_key", forwardHeaders: { "x-api-key": apiKey } };
  }

  const applicationId = (req.headers.get("x-application-id") || "").trim();
  const internalKey = getInternalKey();
  const providedInternalKey = (req.headers.get("x-internal-key") || "").trim();

  if (providedInternalKey) {
    if (!internalKey || !timingSafeEqual(providedInternalKey, internalKey)) {
      throw new AppAuthError("Invalid internal key", 401);
    }
    if (!applicationId) throw new AppAuthError("Missing x-application-id header", 400);
    const rows = await query(`SELECT id FROM applications WHERE id::text = $1 LIMIT 1`, [applicationId]);
    if (!rows.length) throw new AppAuthError("Application not found", 404);
    return {
      applicationId,
      method: "internal",
      forwardHeaders: internalForwardHeaders(applicationId, internalKey),
    };
  }

  const token = readBearerToken(req);
  if (token && applicationId) {
    const ctx = await verifyUserToken(token, options.fetchImpl);
    if (!ctx) throw new AppAuthError("Invalid or expired session", 401);

    const params: unknown[] = [applicationId];
    let ownership = "TRUE";
    if (!ctx.isSystemAdmin) {
      params.push(ctx.userId);
      ownership = `user_id::text = $2`;
      if (ctx.tenantId) {
        params.push(ctx.tenantId);
        ownership = `(user_id::text = $2 OR tenant_id::text = $3)`;
      }
    }

    const rows = await query(
      `SELECT id FROM applications WHERE id::text = $1 AND ${ownership} LIMIT 1`,
      params,
    );
    if (!rows.length) throw new AppAuthError("Application not found for this user", 403);

    return {
      applicationId,
      method: "user_token",
      forwardHeaders: internalKey
        ? internalForwardHeaders(applicationId, internalKey)
        : { Authorization: `Bearer ${token}`, "x-application-id": applicationId },
    };
  }

  throw new AppAuthError("Missing API key", 401);
}
