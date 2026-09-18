
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

function extractVariables(...sources: (string | null | undefined)[]): string[] {
  const vars = new Set<string>();

  for (const source of sources) {
    if (!source) continue;

    const matches = source.matchAll(/\{\{\s*([a-zA-Z0-9_\.]+)\s*\}\}/g);
    for (const match of matches) {
      vars.add(match[1].trim());
    }
  }

  return Array.from(vars).sort();
}

function buildVariablesPayload(vars: string[]): Record<string, boolean> {
  return vars.reduce<Record<string, boolean>>((acc, v) => {
    acc[v] = true;
    return acc;
  }, {});
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
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

    const body = await req.json().catch(() => null) as Record<string, unknown> | null;

    if (!body || typeof body !== "object") {
      return json({
        error: "Invalid JSON body",
      }, 400);
    }

    const name = nonEmptyString(body.name)?.trim() ?? "";
    const htmlContent = typeof body.html_content === "string" ? body.html_content : "";

    if (!name) {
      return json({ error: "name is required" }, 400);
    }

    if (!htmlContent) {
      return json({ error: "html_content is required" }, 400);
    }

    if (
      body.template_type !== undefined &&
      body.template_type !== "email" &&
      body.template_type !== "pdf"
    ) {
      return json({ error: "template_type must be 'email' or 'pdf'" }, 400);
    }

    const templateType = body.template_type === "pdf" ? "pdf" : "email";
    const description = nonEmptyString(body.description);
    const subject = nonEmptyString(body.subject);
    const pdfFilenamePattern = templateType === "pdf"
      ? nonEmptyString(body.pdf_filename_pattern)
      : null;
    const pdfTemplateId = nonEmptyString(body.pdf_template_id);

    const hasAttachment = body.has_attachment === true;
    const attachmentVariable = hasAttachment
      ? nonEmptyString(body.attachment_variable)
      : null;
    const hasLogo = body.has_logo === true;
    const logoVariable = hasLogo ? nonEmptyString(body.logo_variable) : null;
    const hasQr = body.has_qr === true;
    const qrVariable = hasQr ? nonEmptyString(body.qr_variable) : null;
    const isActive = body.is_active !== false;

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

    if (pdfTemplateId) {
      const pdfTemplateResult = await client.queryObject<{ id: string }>(
        `
        SELECT id
        FROM communication_templates
        WHERE id = $1
          AND application_id = $2
          AND template_type = 'pdf'
          AND is_active = true
        LIMIT 1
        `,
        [pdfTemplateId, application.id],
      );

      if (pdfTemplateResult.rows.length === 0) {
        return json({
          error: "pdf_template_id does not match an active PDF template of this application",
        }, 400);
      }
    }

    const duplicateResult = await client.queryObject<{ id: string }>(
      `
      SELECT id
      FROM communication_templates
      WHERE application_id = $1
        AND name = $2
        AND template_type = $3
        AND is_active = true
      LIMIT 1
      `,
      [application.id, name, templateType],
    );

    if (duplicateResult.rows.length > 0) {
      return json({
        error: "A template with that name and type already exists for this application",
        existing_template_id: duplicateResult.rows[0].id,
      }, 409);
    }

    const variables = extractVariables(htmlContent, subject, pdfFilenamePattern);
    const variablesPayload = buildVariablesPayload(variables);

    const insertResult = await client.queryObject<{
      id: string;
      name: string;
      template_type: string;
      subject: string | null;
      pdf_filename_pattern: string | null;
      is_active: boolean;
      created_at: string;
      updated_at: string;
    }>(
      `
      INSERT INTO communication_templates (
        application_id,
        name,
        description,
        channel,
        subject,
        html_content,
        variables,
        has_attachment,
        attachment_variable,
        has_logo,
        logo_variable,
        has_qr,
        qr_variable,
        template_type,
        generates_pdf,
        pdf_template_id,
        pdf_filename_pattern,
        is_active
      )
      VALUES (
        $1, $2, $3, 'email', $4, $5, $6::jsonb, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
      )
      RETURNING id, name, template_type, subject, pdf_filename_pattern, is_active, created_at, updated_at
      `,
      [
        application.id,
        name,
        description,
        subject,
        htmlContent,
        JSON.stringify(variablesPayload),
        hasAttachment,
        attachmentVariable,
        hasLogo,
        logoVariable,
        hasQr,
        qrVariable,
        templateType,
        templateType === "pdf",
        pdfTemplateId,
        pdfFilenamePattern,
        isActive,
      ],
    );

    const template = insertResult.rows[0];

    return json({
      application: {
        id: application.id,
        name: application.name,
      },
      template: {
        id: template.id,
        name: template.name,
        type: template.template_type,
        subject: template.subject,
        pdf_filename_pattern: template.pdf_filename_pattern,
        variables,
        variable_count: variables.length,
        is_active: template.is_active,
        created_at: template.created_at,
        updated_at: template.updated_at,
      },
    }, 201);
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
