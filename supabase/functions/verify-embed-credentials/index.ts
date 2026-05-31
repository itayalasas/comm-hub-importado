import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { Pool } from "https://deno.land/x/postgres@v0.19.3/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-api-key",
};

const pool = new Pool(
  Deno.env.get("DATABASE_URL") || "",
  3,
  true,
);

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });

function parseTokens(raw: string | undefined): string[] {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);

    if (Array.isArray(parsed)) {
      return parsed.map(String);
    }
  } catch {
    // fallback CSV
  }

  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function validateApiKey(req: Request): Response | null {
  const apiKey = req.headers.get("x-api-key");

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

export default async function handler(req: Request) {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  const authError = validateApiKey(req);

  if (authError) {
    return authError;
  }

  let client;

  try {
    const databaseUrl = Deno.env.get("DATABASE_URL");

    if (!databaseUrl) {
      return json({
        valid: false,
        error: "Missing DATABASE_URL",
      }, 500);
    }

    const body = await req.json();
    const { username, password_hash } = body;

    if (!username || !password_hash) {
      return json({
        valid: false,
        error: "Missing credentials",
      }, 400);
    }

    client = await pool.connect();

    const result = await client.queryObject<{
      id: string;
      user_id: string;
      app_id: string | null;
      label: string | null;
      is_active: boolean;
    }>(
      `
      SELECT
        id,
        user_id,
        app_id,
        label,
        is_active
      FROM embed_credentials
      WHERE username = $1
        AND password_hash = $2
        AND is_active = true
      LIMIT 1
      `,
      [
        username.trim(),
        password_hash,
      ],
    );

    const credential = result.rows[0];

    if (!credential) {
      return json({
        valid: false,
      });
    }

    // Update last_used_at
    await client.queryObject(
      `
      UPDATE embed_credentials
      SET last_used_at = NOW()
      WHERE id = $1
      `,
      [credential.id],
    );

    return json({
      valid: true,
      credential_id: credential.id,
      label: credential.label,
      user_id: credential.user_id,
      app_id: credential.app_id,
    });
  } catch (err) {
    return json({
      valid: false,
      error: String(err),
    }, 500);
  } finally {
    if (client) {
      client.release();
    }
  }
}
