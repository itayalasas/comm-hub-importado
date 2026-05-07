import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-api-key",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Extract all unique {{variable}} tokens from a string (ignores whitespace inside braces)
function extractVariables(html: string): string[] {
  const matches = html.matchAll(/\{\{\s*([a-zA-Z0-9_\.]+)\s*\}\}/g);
  const vars = new Set<string>();
  for (const m of matches) {
    vars.add(m[1].trim());
  }
  return Array.from(vars).sort();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // Authenticate via x-api-key header
    const apiKey = req.headers.get("x-api-key");
    if (!apiKey) {
      return json({ error: "Missing x-api-key header" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Resolve application from API key
    const { data: application, error: appError } = await supabase
      .from("applications")
      .select("id, name")
      .eq("api_key", apiKey)
      .eq("is_active", true)
      .maybeSingle();

    if (appError || !application) {
      return json({ error: "Invalid or inactive API key" }, 401);
    }

    // Parse optional query filters
    const url = new URL(req.url);
    const typeFilter = url.searchParams.get("type"); // 'email' | 'pdf' | null

    // Fetch active templates for this application
    let query = supabase
      .from("communication_templates")
      .select("id, name, template_type, subject, pdf_filename_pattern, is_active, created_at, updated_at, html_content")
      .eq("application_id", application.id)
      .eq("is_active", true)
      .order("template_type", { ascending: true })
      .order("name", { ascending: true });

    if (typeFilter === "email" || typeFilter === "pdf") {
      query = query.eq("template_type", typeFilter);
    }

    const { data: templates, error: tplError } = await query;

    if (tplError) {
      return json({ error: "Failed to fetch templates", detail: tplError.message }, 500);
    }

    const result = (templates ?? []).map((t) => {
      const variables = extractVariables(t.html_content ?? "");
      // Also extract from subject and pdf_filename_pattern
      const subjectVars = extractVariables(t.subject ?? "");
      const filenameVars = extractVariables(t.pdf_filename_pattern ?? "");

      // Merge all variable sources, deduplicated
      const allVars = Array.from(new Set([...variables, ...subjectVars, ...filenameVars])).sort();

      const item: Record<string, unknown> = {
        id: t.id,
        name: t.name,
        type: t.template_type,
        variables: allVars,
        variable_count: allVars.length,
        created_at: t.created_at,
        updated_at: t.updated_at,
      };

      if (t.template_type === "email") {
        item.subject = t.subject ?? null;
        // Separate subject-only vars so callers know which came from subject
        item.subject_variables = subjectVars;
      }

      if (t.template_type === "pdf" && t.pdf_filename_pattern) {
        item.pdf_filename_pattern = t.pdf_filename_pattern;
      }

      return item;
    });

    return json({
      application: { id: application.id, name: application.name },
      total: result.length,
      templates: result,
    });
  } catch (err) {
    return json({ error: "Internal server error", detail: String(err) }, 500);
  }
});
