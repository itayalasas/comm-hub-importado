
import { Pool } from "https://deno.land/x/postgres@v0.19.3/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-api-key",
};

const DEFAULT_FROM_EMAIL = "no-reply@sendcraft.net";
const DEFAULT_FROM_NAME = "SendCraft";

const pool = new Pool({ connectionString: Deno.env.get("DATABASE_URL") || "", connectionTimeoutMillis: 5000 }, 3, true);

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function parseTokens(raw: string | undefined): string[] {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch {
    // fallback CSV
  }

  return raw.split(",").map((item) => item.trim()).filter(Boolean);
}

function validateApiKey(req: Request): Response | null {
  const headerName = Deno.env.get("FPM_AUTH_HEADER") || "x-api-key";
  const apiKey = req.headers.get(headerName);

  const allowed = [
    Deno.env.get("FPM_API_KEY"),
    Deno.env.get("API_KEY"),
    ...parseTokens(Deno.env.get("FPM_AUTH_TOKENS")),
    ...parseTokens(Deno.env.get("FPM_API_KEYS")),
    ...parseTokens(Deno.env.get("FPM_API_KEYS_CSV")),
  ].filter((value): value is string => !!value);

  if (apiKey && allowed.includes(apiKey)) {
    return null;
  }

  return json({ error: "Unauthorized" }, 401);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const authError = validateApiKey(req);

  if (authError) {
    return authError;
  }

  let client;

  try {
    const databaseUrl = Deno.env.get("DATABASE_URL");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!databaseUrl) {
      return json({ error: "Missing DATABASE_URL" }, 500);
    }

    if (!resendApiKey) {
      return json({ error: "Missing RESEND_API_KEY" }, 500);
    }

    const { application_id } = await req.json();

    if (!application_id) {
      return json({ error: "application_id is required" }, 400);
    }

    client = await pool.connect();

    const appResult = await client.queryObject<{
      id: string;
      user_id: string | null;
      tenant_id: string | null;
    }>(
      `
      SELECT id, user_id, tenant_id
      FROM applications
      WHERE id = $1
      LIMIT 1
      `,
      [application_id],
    );

    const app = appResult.rows[0];

    if (!app) {
      return json({ error: "Application not found" }, 404);
    }

    const existingResult = await client.queryObject<{ id: string }>(
      `
      SELECT id
      FROM email_credentials
      WHERE application_id = $1
        AND is_active = true
      LIMIT 1
      `,
      [application_id],
    );

    const existing = existingResult.rows[0];

    if (existing) {
      await client.queryObject(
        `
        UPDATE email_credentials
        SET
          provider_type = 'resend',
          resend_api_key = $1,
          from_email = $2,
          from_name = $3,
          smtp_host = NULL,
          smtp_port = NULL,
          smtp_user = NULL,
          smtp_password = NULL,
          updated_at = NOW()
        WHERE id = $4
        `,
        [
          resendApiKey,
          DEFAULT_FROM_EMAIL,
          DEFAULT_FROM_NAME,
          existing.id,
        ],
      );
    } else {
      await client.queryObject(
        `
        INSERT INTO email_credentials (
          application_id,
          provider_type,
          resend_api_key,
          from_email,
          from_name,
          is_active
        )
        VALUES ($1, 'resend', $2, $3, $4, true)
        `,
        [
          application_id,
          resendApiKey,
          DEFAULT_FROM_EMAIL,
          DEFAULT_FROM_NAME,
        ],
      );
    }

    return json({ ok: true });
  } catch (err) {
    return json({
      error: "Internal server error",
      detail: err instanceof Error ? err.message : String(err),
    }, 500);
  } finally {
    if (client) {
      client.release();
    }
  }
});
