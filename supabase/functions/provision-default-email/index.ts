import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-api-key",
};

const DEFAULT_FROM_EMAIL = "no-reply@sendcraft.net";
const DEFAULT_FROM_NAME = "SandCraft";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function parseTokens(raw?: string): string[] {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch {
    // fallback CSV
  }

  return raw.split(",").map((x) => x.trim()).filter(Boolean);
}

function getAllowedApiKeys(): string[] {
  return [
    Deno.env.get("API_KEY"),
    Deno.env.get("FPM_API_KEY"),
    ...parseTokens(Deno.env.get("API_KEYS")),
    ...parseTokens(Deno.env.get("API_KEYS_CSV")),
    ...parseTokens(Deno.env.get("FPM_API_KEYS")),
    ...parseTokens(Deno.env.get("FPM_API_KEYS_CSV")),
    ...parseTokens(Deno.env.get("FPM_AUTH_TOKENS")),
  ].filter((key): key is string => !!key);
}

function validateApiKey(req: Request): Response | null {
  const apiKey = req.headers.get("x-api-key");
  const allowedApiKeys = getAllowedApiKeys();

  if (!apiKey || (allowedApiKeys.length > 0 && !allowedApiKeys.includes(apiKey))) {
    return json({ error: "Unauthorized" }, 401);
  }

  return null;
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded));
    return payload && typeof payload === "object" ? payload : null;
  } catch {
    return null;
  }
}

function getExternalIdentity(authHeader: string | null): { userId: string; tenantId: string | null } | null {
  if (!authHeader?.startsWith("Bearer ")) return null;

  const payload = decodeJwtPayload(authHeader.slice(7));
  if (!payload) return null;

  const userId = String(
    payload.sub ||
      payload.user_id ||
      payload.id ||
      (payload.user && typeof payload.user === "object" ? (payload.user as Record<string, unknown>).id : "") ||
      "",
  ).trim();
  if (!userId) return null;

  const tenantFromUser = payload.user && typeof payload.user === "object"
    ? ((payload.user as Record<string, unknown>).tenant_id ??
      (payload.user as Record<string, unknown>).tenantId)
    : undefined;

  const tenantId =
    payload.tenant_id ||
    tenantFromUser ||
    (payload.tenant && typeof payload.tenant === "object" ? (payload.tenant as Record<string, unknown>).id : undefined) ||
    null;

  return {
    userId,
    tenantId: tenantId ? String(tenantId) : null,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY")!;

    const apiKeyError = validateApiKey(req);
    if (apiKeyError) {
      return apiKeyError;
    }

    const identity = getExternalIdentity(req.headers.get("Authorization"));
    if (!identity) {
      return json({ error: "Unauthorized" }, 401);
    }

    const { application_id } = await req.json();
    if (!application_id) {
      return json({ error: "application_id is required" }, 400);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: app, error: appError } = await adminClient
      .from("applications")
      .select("id, user_id, tenant_id")
      .eq("id", application_id)
      .maybeSingle();

    if (appError || !app) {
      return json({ error: "Application not found" }, 404);
    }

    const ownedByUser = app.user_id === identity.userId;
    const ownedByTenant = !!identity.tenantId && app.tenant_id === identity.tenantId;

    if (!ownedByUser && !ownedByTenant) {
      return json({ error: "Forbidden" }, 403);
    }

    const { data: existing } = await adminClient
      .from("email_credentials")
      .select("id")
      .eq("application_id", application_id)
      .eq("is_active", true)
      .maybeSingle();

    if (existing) {
      await adminClient
        .from("email_credentials")
        .update({
          provider_type: "resend",
          resend_api_key: resendApiKey,
          from_email: DEFAULT_FROM_EMAIL,
          from_name: DEFAULT_FROM_NAME,
          smtp_host: null,
          smtp_port: null,
          smtp_user: null,
          smtp_password: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
    } else {
      await adminClient.from("email_credentials").insert({
        application_id,
        provider_type: "resend",
        resend_api_key: resendApiKey,
        from_email: DEFAULT_FROM_EMAIL,
        from_name: DEFAULT_FROM_NAME,
        is_active: true,
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
