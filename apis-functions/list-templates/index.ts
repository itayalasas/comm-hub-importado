
import { Pool } from "https://deno.land/x/postgres@v0.19.3/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
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

function extractVariables(html: string): string[] {
  const matches = html.matchAll(/\{\{\s*([a-zA-Z0-9_\.]+)\s*\}\}/g);
  const vars = new Set<string>();

  for (const match of matches) {
    vars.add(match[1].trim());
  }

  return Array.from(vars).sort();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (req.method !== "GET") {
    return json({
      error: "Method not allowed",
    }, 405);
  }

  let client;

  try {
    const databaseUrl = Deno.env.get("DATABASE_URL");

    if (!databaseUrl) {
      return json({
        error: "Missing DATABASE_URL",
      }, 500);
    }

    const apiKey = req.headers.get("x-api-key");

    if (!apiKey) {
      return json({
        error: "Missing x-api-key header",
      }, 401);
    }

    client = await pool.connect();

    const applicationResult = await client.queryObject<{
      id: string;
      name: string;
    }>(
      `
      SELECT id, name
      FROM applications
      WHERE api_key = $1
      LIMIT 1
      `,
      [apiKey],
    );

    const application = applicationResult.rows[0];

    if (!application) {
      return json({
        error: "Invalid or inactive API key",
      }, 401);
    }

    const url = new URL(req.url);
    const typeFilter = url.searchParams.get("type");

    if (typeFilter && typeFilter !== "email" && typeFilter !== "pdf") {
      return json({
        error: "Invalid type filter. Allowed values: email, pdf",
      }, 400);
    }

    const params: unknown[] = [application.id];
    let typeWhere = "";

    if (typeFilter) {
      params.push(typeFilter);
      typeWhere = `AND template_type = $${params.length}`;
    }

    const templatesResult = await client.queryObject<{
      id: string;
      name: string;
      template_type: string;
      subject: string | null;
      pdf_filename_pattern: string | null;
      is_active: boolean;
      created_at: string;
      updated_at: string;
      html_content: string | null;
    }>(
      `
      SELECT
        id,
        name,
        template_type,
        subject,
        pdf_filename_pattern,
        is_active,
        created_at,
        updated_at,
        html_content
      FROM communication_templates
      WHERE application_id = $1
        AND is_active = true
        ${typeWhere}
      ORDER BY template_type ASC, name ASC
      `,
      params,
    );

    const result = templatesResult.rows.map((template) => {
      const variables = extractVariables(template.html_content ?? "");
      const subjectVars = extractVariables(template.subject ?? "");
      const filenameVars = extractVariables(
        template.pdf_filename_pattern ?? "",
      );

      const allVars = Array.from(
        new Set([
          ...variables,
          ...subjectVars,
          ...filenameVars,
        ]),
      ).sort();

      const item: Record<string, unknown> = {
        id: template.id,
        name: template.name,
        type: template.template_type,
        variables: allVars,
        variable_count: allVars.length,
        created_at: template.created_at,
        updated_at: template.updated_at,
      };

      if (template.template_type === "email") {
        item.subject = template.subject ?? null;
        item.subject_variables = subjectVars;
      }

      if (
        template.template_type === "pdf" &&
        template.pdf_filename_pattern
      ) {
        item.pdf_filename_pattern = template.pdf_filename_pattern;
      }

      return item;
    });

    return json({
      application: {
        id: application.id,
        name: application.name,
      },
      total: result.length,
      templates: result,
    });
  } catch (err) {
    return json({
      error: "Internal server error",
      detail: String(err),
    }, 500);
  } finally {
    if (client) {
      client.release();
    }
  }
});
