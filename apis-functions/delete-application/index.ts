
import { Pool } from "https://deno.land/x/postgres@v0.19.3/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey, X-Api-Key, x-api-key",
};

const pool = new Pool(Deno.env.get("DATABASE_URL") || "", 3, true);

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

interface DeleteApplicationRequest {
  application_id?: string;
  preview?: boolean;
  confirm_name?: string;
}

const CLEANUP_TABLES = [
  "campaign_jobs",
  "communication_templates",
  "predefined_variables",
  "email_credentials",
  "pending_communications",
  "pdf_generation_logs",
  "application_limits",
  "email_provider_audit",
  "usage_audit",
];

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

  if (!apiKey || !allowedApiKeys.includes(apiKey)) {
    return json(
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

  return null;
}

function isSafeIdentifier(value: string): boolean {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value);
}

function quoteIdentifier(value: string): string {
  if (!isSafeIdentifier(value)) {
    throw new Error(`Invalid table or column identifier: ${value}`);
  }

  return `"${value}"`;
}

function isMissingTableError(error: any): boolean {
  const code = error?.code ?? "";
  const message = `${error?.message ?? ""}`.toLowerCase();

  return code === "42P01" || message.includes("does not exist");
}

async function safeCountByApplicationId(
  client: any,
  table: string,
  applicationId: string,
): Promise<number> {
  try {
    const result = await client.queryObject(
      `
      SELECT COUNT(*)::int AS count
      FROM ${quoteIdentifier(table)}
      WHERE application_id = $1
      `,
      [applicationId],
    );

    return Number((result.rows[0] as any)?.count ?? 0);
  } catch (error) {
    if (isMissingTableError(error)) return 0;
    throw error;
  }
}

async function safeDeleteByApplicationId(
  client: any,
  table: string,
  applicationId: string,
): Promise<void> {
  try {
    await client.queryObject(
      `
      DELETE FROM ${quoteIdentifier(table)}
      WHERE application_id = $1
      `,
      [applicationId],
    );
  } catch (error) {
    if (!isMissingTableError(error)) {
      throw error;
    }
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return json(
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

  let client: any = null;

  try {
    const databaseUrl = Deno.env.get("DATABASE_URL");

    if (!databaseUrl) {
      return json(
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

    const apiKeyError = validateApiKey(req);

    if (apiKeyError) {
      return apiKeyError;
    }

    const body = (await req.json().catch(() => ({}))) as DeleteApplicationRequest;

    const applicationId = body.application_id?.trim();

    if (!applicationId) {
      return json(
        {
          success: false,
          error: {
            code: "BAD_REQUEST",
            message: "application_id is required",
          },
        },
        400,
      );
    }

    client = await pool.connect();

    const appResult = await client.queryObject(
      `
      SELECT
        id,
        name,
        user_id,
        tenant_id
      FROM applications
      WHERE id = $1
      LIMIT 1
      `,
      [applicationId],
    );

    const application: any = appResult.rows[0] ?? null;

    if (!application) {
      return json(
        {
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "Application not found",
          },
        },
        404,
      );
    }

    const templatesCount = await safeCountByApplicationId(
      client,
      "communication_templates",
      applicationId,
    );

    const jobsCount = await safeCountByApplicationId(
      client,
      "campaign_jobs",
      applicationId,
    );

    const dependencySummary = {
      templates_count: templatesCount,
      jobs_count: jobsCount,
    };

    if (body.preview === true) {
      return json({
        success: true,
        data: {
          application: {
            id: application.id,
            name: application.name,
          },
          dependency_summary: dependencySummary,
          can_delete: true,
        },
      });
    }

    if (
      !body.confirm_name ||
      body.confirm_name.trim().toLowerCase() !==
        application.name.trim().toLowerCase()
    ) {
      return json(
        {
          success: false,
          error: {
            code: "CONFIRMATION_MISMATCH",
            message: "The confirmation name does not match the application name",
          },
        },
        400,
      );
    }

    await client.queryObject("BEGIN");

    try {
      for (const table of CLEANUP_TABLES) {
        await safeDeleteByApplicationId(client, table, applicationId);
      }

      const deleteResult = await client.queryObject(
        `
        DELETE FROM applications
        WHERE id = $1
        RETURNING id
        `,
        [applicationId],
      );

      if (!deleteResult.rows.length) {
        throw new Error("No se pudo eliminar la aplicacion");
      }

      await client.queryObject("COMMIT");
    } catch (error) {
      await client.queryObject("ROLLBACK");
      throw error;
    }

    return json({
      success: true,
      data: {
        deleted: true,
        application: {
          id: application.id,
          name: application.name,
        },
        dependency_summary: dependencySummary,
      },
    });
  } catch (error: any) {
    return json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error?.message || "Unexpected error",
        },
      },
      500,
    );
  } finally {
    try {
      client?.release();
    } catch {
      // ignore
    }
  }
});
