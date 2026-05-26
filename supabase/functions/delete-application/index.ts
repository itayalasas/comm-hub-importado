import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-api-key",
};

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

interface DependencySummary {
  templates_count: number;
  jobs_count: number;
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

const isMissingTableError = (error: { code?: string; message?: string }) => {
  const message = `${error.code ?? ""} ${error.message ?? ""}`.toLowerCase();
  return message.includes("does not exist") || error.code === "42P01" || error.code === "PGRST205";
};

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
    return json({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Unauthorized" },
    }, 401);
  }

  return null;
}

async function safeCountByApplicationId(adminClient: ReturnType<typeof createClient>, table: string, applicationId: string) {
  const { count, error } = await adminClient
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("application_id", applicationId);

  if (error) {
    if (isMissingTableError(error)) return 0;
    throw error;
  }

  return count ?? 0;
}

async function safeDeleteByApplicationId(adminClient: ReturnType<typeof createClient>, table: string, applicationId: string) {
  const { error } = await adminClient.from(table).delete().eq("application_id", applicationId);
  if (error && !isMissingTableError(error)) {
    throw error;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ success: false, error: { code: "METHOD_NOT_ALLOWED", message: "Method not allowed" } }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const apiKeyError = validateApiKey(req);
    if (apiKeyError) {
      return apiKeyError;
    }

    const body = (await req.json().catch(() => ({}))) as DeleteApplicationRequest;
    const applicationId = body.application_id?.trim();
    if (!applicationId) {
      return json({ success: false, error: { code: "BAD_REQUEST", message: "application_id is required" } }, 400);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: application, error: appError } = await adminClient
      .from("applications")
      .select("id, name, user_id, tenant_id")
      .eq("id", applicationId)
      .maybeSingle();

    if (appError || !application) {
      return json({ success: false, error: { code: "NOT_FOUND", message: "Application not found" } }, 404);
    }

    const templatesCount = await safeCountByApplicationId(adminClient, "communication_templates", applicationId);
    const jobsCount = await safeCountByApplicationId(adminClient, "campaign_jobs", applicationId);
    const dependencySummary: DependencySummary = {
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

    if (!body.confirm_name || body.confirm_name.trim().toLowerCase() !== application.name.trim().toLowerCase()) {
      return json({
        success: false,
        error: {
          code: "CONFIRMATION_MISMATCH",
          message: "The confirmation name does not match the application name",
        },
      }, 400);
    }

    for (const table of CLEANUP_TABLES) {
      await safeDeleteByApplicationId(adminClient, table, applicationId);
    }

    const { error: deleteError } = await adminClient.from("applications").delete().eq("id", applicationId);
    if (deleteError) {
      return json({
        success: false,
        error: {
          code: "DELETE_FAILED",
          message: "No se pudo eliminar la aplicacion",
          detail: deleteError.message,
        },
      }, 409);
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
  } catch (error) {
    return json(
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
