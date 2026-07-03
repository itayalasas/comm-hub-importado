
import { Pool } from "https://deno.land/x/postgres@v0.19.3/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-api-key",
};

const pool = new Pool({ connectionString: Deno.env.get("DATABASE_URL") || "", connectionTimeoutMillis: 5000 }, 3, true);

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function fetchStatusPage() {
  const statusUrl = "https://resend-status.com/";
  const res = await fetch(statusUrl, { method: "GET" });

  if (!res.ok) {
    throw new Error(`Status page fetch failed (${res.status})`);
  }

  const body = await res.text();
  const content = body.toLowerCase();

  if (content.includes("fully operational")) {
    return {
      status: "operational" as const,
      message: "Resend status page reports fully operational",
    };
  }

  if (
    content.includes("partial outage") ||
    content.includes("degraded") ||
    content.includes("degraded performance") ||
    content.includes("investigating")
  ) {
    return {
      status: "degraded" as const,
      message: "Resend status page reports degraded or partial outage",
    };
  }

  if (
    content.includes("major outage") ||
    content.includes("outage") ||
    content.includes("service unavailable") ||
    content.includes("system down")
  ) {
    return {
      status: "down" as const,
      message: "Resend status page reports outage",
    };
  }

  return {
    status: "operational" as const,
    message: "Resend status page reachable, status could not be fully categorized",
  };
}

async function getApplicationByApiKey(apiKey: string) {
  const client = await pool.connect();

  try {
    const result = await client.queryObject<{ id: string; name: string }>(
      `
      SELECT id, name
      FROM applications
      WHERE api_key = $1
      LIMIT 1
      `,
      [apiKey],
    );

    return result.rows[0] ?? null;
  } finally {
    client.release();
  }
}

async function getActiveCredential(applicationId?: string) {
  const client = await pool.connect();

  try {
    if (applicationId) {
      const result = await client.queryObject<{
        id: string;
        provider_type: string | null;
        smtp_host: string | null;
        smtp_port: number | null;
        resend_api_key: string | null;
        is_active: boolean;
      }>(
        `
        SELECT
          id,
          provider_type,
          smtp_host,
          smtp_port,
          resend_api_key,
          is_active
        FROM email_credentials
        WHERE application_id = $1
          AND is_active = true
        LIMIT 1
        `,
        [applicationId],
      );

      return result.rows[0] ?? null;
    }

    const result = await client.queryObject<{
      id: string;
      provider_type: string | null;
      smtp_host: string | null;
      smtp_port: number | null;
      resend_api_key: string | null;
      is_active: boolean;
    }>(
      `
      SELECT
        id,
        provider_type,
        smtp_host,
        smtp_port,
        resend_api_key,
        is_active
      FROM email_credentials
      WHERE is_active = true
      LIMIT 1
      `,
    );

    return result.rows[0] ?? null;
  } finally {
    client.release();
  }
}

function credentialIsConfigured(credential: any): boolean {
  if (!credential) return false;

  const providerType = credential.provider_type || "smtp";

  if (providerType === "smtp") {
    return !!(credential.smtp_host && credential.smtp_port);
  }

  return !!credential.resend_api_key;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return json({ status: "error", error: "Method not allowed" }, 405);
  }

  try {
    const start = Date.now();

    const databaseUrl = Deno.env.get("DATABASE_URL");

    if (!databaseUrl) {
      return json({
        status: "down",
        error: "Missing DATABASE_URL",
        timestamp: new Date().toISOString(),
      }, 500);
    }

    const apiKey = req.headers.get("x-api-key");

    let providerType = "smtp";
    let isConfigured = false;
    let appName: string | undefined;

    if (apiKey) {
      const app = await getApplicationByApiKey(apiKey);

      if (!app) {
        return json({ status: "error", error: "Invalid API key" }, 401);
      }

      appName = app.name;

      const credential = await getActiveCredential(app.id);

      providerType = credential?.provider_type || "smtp";
      isConfigured = credentialIsConfigured(credential);
    } else {
      const credential = await getActiveCredential();

      providerType = credential?.provider_type || "smtp";
      isConfigured = credentialIsConfigured(credential);
    }

    const statusPage = await fetchStatusPage();
    const responseTime = Date.now() - start;

    return json({
      status: statusPage.status,
      responseTime,
      provider: providerType,
      configured: isConfigured,
      app_name: appName,
      message: statusPage.message,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return json({
      status: "down",
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
    });
  }
});
