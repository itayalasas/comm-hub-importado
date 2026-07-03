
import { Pool } from "https://deno.land/x/postgres@v0.19.3/mod.ts";
import { renderTemplate } from "./_shared/template-engine.ts";
import { renderHtmlToPdfBase64 } from "./_shared/pdf-renderer.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey, X-Api-Key",
};

const pool = new Pool(Deno.env.get("DATABASE_URL") || "", 3, true);

interface GeneratePDFRequest {
  template_id?: string;
  pdf_template_name?: string;
  data: Record<string, any>;
  pending_communication_id?: string;
  order_id?: string;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function generateFilename(pattern: string, data: Record<string, any>): string {
  return renderTemplate(pattern || "document.pdf", data);
}

async function generateQrCodeFromText(text: string): Promise<string> {
  const qrApiUrl =
    `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${
      encodeURIComponent(text)
    }`;

  const response = await fetch(qrApiUrl);

  if (!response.ok) {
    throw new Error(`QR API failed with status: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  let binary = "";

  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }

  const base64 = btoa(binary);

  return `data:image/png;base64,${base64}`;
}

async function convertQrUrlsToBase64(data: any): Promise<any> {
  if (typeof data !== "object" || data === null) {
    return data;
  }

  if (Array.isArray(data)) {
    return Promise.all(data.map((item) => convertQrUrlsToBase64(item)));
  }

  const result: any = {};

  for (const [key, value] of Object.entries(data)) {
    if (
      key === "qr_code" ||
      key === "qr_url" ||
      key === "qr_image" ||
      key === "qr_text" ||
      key === "qr_data"
    ) {
      if (typeof value === "string" && value.length > 0) {
        if (value.startsWith("data:image")) {
          result[key] = value;
          result[`${key}_qr`] = value;
        } else {
          const qrBase64 = await generateQrCodeFromText(value);
          result[key] = qrBase64;
          result[`${key}_qr`] = qrBase64;
        }
      } else {
        result[key] = value;
      }
    } else if (typeof value === "object" && value !== null) {
      result[key] = await convertQrUrlsToBase64(value);
    } else {
      result[key] = value;
    }
  }

  return result;
}

async function insertEmailLog(client: any, logData: any): Promise<any | null> {
  const result = await client.queryObject(
    `
    INSERT INTO email_logs (
      application_id,
      template_id,
      recipient_email,
      subject,
      status,
      error_message,
      communication_type,
      metadata,
      sent_at,
      pdf_generated,
      parent_log_id
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11)
    RETURNING *
    `,
    [
      logData.application_id ?? null,
      logData.template_id ?? null,
      logData.recipient_email ?? null,
      logData.subject ?? null,
      logData.status ?? null,
      logData.error_message ?? null,
      logData.communication_type ?? null,
      JSON.stringify(logData.metadata ?? {}),
      logData.sent_at ?? null,
      logData.pdf_generated ?? false,
      logData.parent_log_id ?? null,
    ],
  );

  return result.rows[0] ?? null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  let client: any = null;
  let requestData: GeneratePDFRequest | null = null;
  let application: any = null;

  try {
    if (req.method !== "POST") {
      return jsonResponse(
        {
          success: false,
          error: "Method not allowed",
        },
        405,
      );
    }

    const databaseUrl = Deno.env.get("DATABASE_URL");

    if (!databaseUrl) {
      return jsonResponse(
        {
          success: false,
          error: "Missing DATABASE_URL",
        },
        500,
      );
    }

    client = await pool.connect();

    const apiKey = req.headers.get("x-api-key");

    if (!apiKey) {
      await insertEmailLog(client, {
        application_id: null,
        template_id: null,
        recipient_email: "unknown@error.com",
        subject: "Error: Missing API key in /generate-pdf",
        status: "failed",
        error_message: "Missing API key in x-api-key header",
        communication_type: "pdf_generation",
        metadata: {
          endpoint: "generate-pdf",
          error_type: "authentication",
          headers: {
            "user-agent": req.headers.get("user-agent"),
            "x-forwarded-for": req.headers.get("x-forwarded-for"),
          },
        },
      });

      return jsonResponse(
        {
          success: false,
          error: "Missing API key in x-api-key header",
        },
        401,
      );
    }

    const appResult = await client.queryObject(
      `
      SELECT id, name
      FROM applications
      WHERE api_key = $1
      LIMIT 1
      `,
      [apiKey],
    );

    application = appResult.rows[0] ?? null;

    if (!application) {
      await insertEmailLog(client, {
        application_id: null,
        template_id: null,
        recipient_email: "unknown@error.com",
        subject: "Error: Invalid API key in /generate-pdf",
        status: "failed",
        error_message: "Invalid API key",
        communication_type: "pdf_generation",
        metadata: {
          endpoint: "generate-pdf",
          error_type: "authentication",
          api_key_prefix: apiKey.substring(0, 8),
        },
      });

      return jsonResponse(
        {
          success: false,
          error: "Invalid API key",
        },
        401,
      );
    }

    let requestBody = "";

    try {
      requestBody = await req.text();
      requestData = JSON.parse(requestBody);
    } catch (parseError: any) {
      await insertEmailLog(client, {
        application_id: application.id,
        template_id: null,
        recipient_email: "unknown@error.com",
        subject: "Error: Invalid JSON in /generate-pdf",
        status: "failed",
        error_message: `JSON parse error: ${parseError.message}`,
        communication_type: "pdf_generation",
        metadata: {
          endpoint: "generate-pdf",
          error_type: "validation",
          raw_body: requestBody.substring(0, 500),
          parse_error: parseError.message,
        },
      });

      return jsonResponse(
        {
          success: false,
          error: "Invalid JSON",
          details: parseError.message,
        },
        400,
      );
    }

    const {
      template_id,
      pdf_template_name,
      data,
      pending_communication_id,
      order_id,
    } = requestData;

    if (order_id) {
      try {
        await client.queryObject(
          `
          INSERT INTO pdf_generation_locks (
            order_id,
            application_id
          )
          VALUES ($1,$2)
          ON CONFLICT DO NOTHING
          `,
          [order_id, application.id],
        );
      } catch {
        // ignore lock errors
      }

      const existingPdfLogResult = await client.queryObject(
        `
        SELECT id, metadata
        FROM email_logs
        WHERE application_id = $1
          AND communication_type = 'pdf_generation'
          AND status = 'sent'
        ORDER BY created_at DESC
        LIMIT 50
        `,
        [application.id],
      );

      for (const log of existingPdfLogResult.rows as any[]) {
        if (log.metadata?.order_id === order_id) {
          const existingPdfResult = await client.queryObject(
            `
            SELECT *
            FROM pdf_generation_logs
            WHERE email_log_id = $1
            LIMIT 1
            `,
            [log.id],
          );

          const existingPdf: any = existingPdfResult.rows[0] ?? null;

          if (existingPdf) {
            await client.queryObject(
              `
              DELETE FROM pdf_generation_locks
              WHERE order_id = $1
              `,
              [order_id],
            );

            return jsonResponse({
              success: true,
              message: "PDF already exists for this order",
              data: {
                pdf_id: existingPdf.id,
                pdf_base64: existingPdf.pdf_base64,
                filename: existingPdf.filename,
                size_bytes: existingPdf.size_bytes,
                public_url: existingPdf.public_url,
              },
              duplicate_prevented: true,
            });
          }
        }
      }
    }

    if (!data) {
      await insertEmailLog(client, {
        application_id: application.id,
        template_id: null,
        recipient_email: "unknown@error.com",
        subject: "Error: Missing required field in /generate-pdf",
        status: "failed",
        error_message: "Missing required field: data",
        communication_type: "pdf_generation",
        metadata: {
          endpoint: "generate-pdf",
          error_type: "validation",
          request_data: requestData,
        },
      });

      return jsonResponse(
        {
          success: false,
          error: "Missing required field: data",
        },
        400,
      );
    }

    let pendingComm: any = null;

    if (order_id) {
      const pendingResult = await client.queryObject(
        `
        SELECT *
        FROM pending_communications
        WHERE order_id = $1
          AND application_id = $2
          AND status IN ('waiting_data', 'pdf_generated')
        ORDER BY created_at DESC
        LIMIT 1
        `,
        [order_id, application.id],
      );

      pendingComm = pendingResult.rows[0] ?? null;
    }

    let pdfTemplate: any = null;

    if (template_id) {
      const templateResult = await client.queryObject(
        `
        SELECT id, name, html_content, template_type, pdf_filename_pattern
        FROM communication_templates
        WHERE id = $1
          AND application_id = $2
          AND template_type = 'pdf'
          AND is_active = true
        LIMIT 1
        `,
        [template_id, application.id],
      );

      pdfTemplate = templateResult.rows[0] ?? null;

      if (!pdfTemplate) {
        await insertEmailLog(client, {
          application_id: application.id,
          template_id: null,
          recipient_email: "unknown@error.com",
          subject: `Error: PDF template '${template_id}' not found`,
          status: "failed",
          error_message: "PDF template not found or inactive",
          communication_type: "pdf_generation",
          metadata: {
            endpoint: "generate-pdf",
            error_type: "template_not_found",
            template_id,
            order_id,
            request_data: data,
          },
        });

        return jsonResponse(
          {
            success: false,
            error: "PDF template not found or inactive",
            details: "Template not found",
          },
          404,
        );
      }
    } else if (pdf_template_name) {
      const templateResult = await client.queryObject(
        `
        SELECT id, name, html_content, template_type, pdf_filename_pattern
        FROM communication_templates
        WHERE name = $1
          AND application_id = $2
          AND template_type = 'pdf'
          AND is_active = true
        LIMIT 1
        `,
        [pdf_template_name, application.id],
      );

      pdfTemplate = templateResult.rows[0] ?? null;

      if (!pdfTemplate) {
        await insertEmailLog(client, {
          application_id: application.id,
          template_id: null,
          recipient_email: "unknown@error.com",
          subject: `Error: PDF template '${pdf_template_name}' not found`,
          status: "failed",
          error_message: "PDF template not found or inactive",
          communication_type: "pdf_generation",
          metadata: {
            endpoint: "generate-pdf",
            error_type: "template_not_found",
            pdf_template_name,
            order_id,
            request_data: data,
          },
        });

        return jsonResponse(
          {
            success: false,
            error: "PDF template not found or inactive",
            details: "Template not found",
          },
          404,
        );
      }
    } else {
      await insertEmailLog(client, {
        application_id: application.id,
        template_id: null,
        recipient_email: "unknown@error.com",
        subject: "Error: Missing template identifier in /generate-pdf",
        status: "failed",
        error_message: "Either template_id or pdf_template_name is required",
        communication_type: "pdf_generation",
        metadata: {
          endpoint: "generate-pdf",
          error_type: "validation",
          order_id,
          request_data: data,
        },
      });

      return jsonResponse(
        {
          success: false,
          error: "Either template_id or pdf_template_name is required",
        },
        400,
      );
    }

    const processedData = await convertQrUrlsToBase64(data);

    const templateData = {
      ...processedData,
      data: processedData,
    };

    const htmlContent = renderTemplate(pdfTemplate.html_content, templateData);

    const filename = generateFilename(
      pdfTemplate.pdf_filename_pattern || "document.pdf",
      processedData,
    );

    const pdfResult = await renderHtmlToPdfBase64(htmlContent, {
      title: filename,
    });

    const pdfBase64 = pdfResult.base64;
    const sizeBytes = pdfResult.sizeBytes;

    const emailLogData: any = {
      application_id: application.id,
      template_id: pdfTemplate.id,
      recipient_email: "pdf_generation@system.local",
      subject: `PDF Generated: ${filename}`,
      status: "sent",
      sent_at: new Date().toISOString(),
      communication_type: "pdf_generation",
      pdf_generated: true,
      metadata: {
        endpoint: "generate-pdf",
        filename,
        size_bytes: sizeBytes,
        order_id,
        pending_communication_id,
        action: "pdf_generated",
        template_name: pdfTemplate.name,
        data,
      },
    };

    if (pendingComm?.parent_log_id) {
      emailLogData.parent_log_id = pendingComm.parent_log_id;
    }

    const emailLog = await insertEmailLog(client, emailLogData);

    const pdfLogResult = await client.queryObject(
      `
      INSERT INTO pdf_generation_logs (
        application_id,
        pdf_template_id,
        data,
        pdf_base64,
        filename,
        size_bytes,
        email_log_id
      )
      VALUES ($1,$2,$3::jsonb,$4,$5,$6,$7)
      RETURNING *
      `,
      [
        application.id,
        pdfTemplate.id,
        JSON.stringify(data),
        pdfBase64,
        filename,
        sizeBytes,
        emailLog?.id ?? null,
      ],
    );

    const pdfLog: any = pdfLogResult.rows[0] ?? null;

    if (!pdfLog) {
      await insertEmailLog(client, {
        application_id: application.id,
        template_id: pdfTemplate.id,
        recipient_email: "unknown@error.com",
        subject: "Error: Failed to log PDF generation",
        status: "failed",
        error_message: "Failed to log PDF generation",
        communication_type: "pdf_generation",
        metadata: {
          endpoint: "generate-pdf",
          error_type: "database",
          order_id,
          filename,
        },
      });

      return jsonResponse(
        {
          success: false,
          error: "Failed to log PDF generation",
        },
        500,
      );
    }

    const accessToken = crypto.randomUUID() + "-" + Date.now().toString(36);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 90);

    const publicLinkResult = await client.queryObject(
      `
      INSERT INTO public_pdf_links (
        application_id,
        pdf_generation_log_id,
        order_id,
        access_token,
        filename,
        expires_at,
        is_active
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING *
      `,
      [
        application.id,
        pdfLog.id,
        order_id || null,
        accessToken,
        filename,
        expiresAt.toISOString(),
        true,
      ],
    );

    const publicLink: any = publicLinkResult.rows[0] ?? null;

    const publicBaseUrl =
      Deno.env.get("PUBLIC_FUNCTIONS_URL") ||
      Deno.env.get("FUNCTIONS_BASE_URL") ||
      "";

    const publicUrl = publicLink && publicBaseUrl
      ? `${publicBaseUrl}/view-pdf?token=${accessToken}`
      : null;

    if (publicUrl) {
      await client.queryObject(
        `
        UPDATE pdf_generation_logs
        SET public_url = $1
        WHERE id = $2
        `,
        [publicUrl, pdfLog.id],
      );

      if (emailLog?.id) {
        await client.queryObject(
          `
          UPDATE email_logs
          SET metadata = $1::jsonb
          WHERE id = $2
          `,
          [
            JSON.stringify({
              ...(emailLog.metadata || {}),
              pdf_generation_log_id: pdfLog.id,
              pdf_public_url: publicUrl,
              pdf_access_token: accessToken,
            }),
            emailLog.id,
          ],
        );
      }
    }

    const targetPendingId = pending_communication_id ||
      (pendingComm ? pendingComm.id : null);

    if (targetPendingId) {
      const currentPendingResult = await client.queryObject(
        `
        SELECT completed_data
        FROM pending_communications
        WHERE id = $1
        LIMIT 1
        `,
        [targetPendingId],
      );

      const currentPending: any = currentPendingResult.rows[0] ?? null;

      const pdfAttachment = {
        filename,
        content: pdfBase64,
        encoding: "base64",
      };

      const completedDataToSave = {
        ...(currentPending?.completed_data || {}),
        pdf_attachment: pdfAttachment,
        pdf_generation_log_id: pdfLog.id,
        pdf_log_id: emailLog?.id,
        pdf_email_log_id: emailLog?.id,
        pdf_template_id: pdfTemplate.id,
        pdf_filename: filename,
        pdf_size_bytes: sizeBytes,
        pdf_public_url: publicUrl,
      };

      await client.queryObject(
        `
        UPDATE pending_communications
        SET completed_data = $1::jsonb,
            status = 'pdf_generated',
            completed_at = $2,
            updated_at = $3
        WHERE id = $4
        `,
        [
          JSON.stringify(completedDataToSave),
          new Date().toISOString(),
          new Date().toISOString(),
          targetPendingId,
        ],
      );

      try {
        const completeUrl = Deno.env.get("COMPLETE_PENDING_COMMUNICATION_URL");

        if (completeUrl) {
          await fetch(completeUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": apiKey,
            },
            body: JSON.stringify({
              pending_communication_id: targetPendingId,
            }),
          });
        }
      } catch {
        // ignore complete-pending error
      }
    }

    if (order_id) {
      await client.queryObject(
        `
        DELETE FROM pdf_generation_locks
        WHERE order_id = $1
        `,
        [order_id],
      );
    }

    return jsonResponse({
      success: true,
      message: "PDF generated successfully",
      data: {
        pdf_id: pdfLog.id,
        pdf_base64: pdfBase64,
        filename,
        size_bytes: sizeBytes,
        public_url: publicUrl,
      },
    });
  } catch (error: any) {
    try {
      if (!client) {
        client = await pool.connect();
      }

      const orderId = error?.order_id || requestData?.order_id;

      if (orderId) {
        await client.queryObject(
          `
          DELETE FROM pdf_generation_locks
          WHERE order_id = $1
          `,
          [orderId],
        );
      }

      await insertEmailLog(client, {
        application_id: application?.id ?? null,
        template_id: null,
        recipient_email: "unknown@error.com",
        subject: "Error: Unexpected error in /generate-pdf",
        status: "failed",
        error_message: error.message || String(error),
        communication_type: "pdf_generation",
        metadata: {
          endpoint: "generate-pdf",
          error_type: "unexpected",
          error_details: {
            name: error.name,
            message: error.message,
            stack: error.stack,
          },
        },
      });
    } catch {
      // ignore logging error
    }

    return jsonResponse(
      {
        success: false,
        error: "Internal server error",
        details: error.message || String(error),
        stack: error.stack,
      },
      500,
    );
  } finally {
    try {
      client?.release();
    } catch {
      // ignore release error
    }
  }
});
