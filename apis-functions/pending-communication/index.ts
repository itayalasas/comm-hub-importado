
import { Pool } from "https://deno.land/x/postgres@v0.19.3/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-api-key",
};

const pool = new Pool(
  Deno.env.get("DATABASE_URL") || "",
  3,
  true,
);

const FUNCTIONS_BASE_URL =
  Deno.env.get("FUNCTIONS_BASE_URL") ||
  "http://localhost:8000/functions/v1";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });

export default async function handler(req: Request) {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  let client;

  try {
    const databaseUrl = Deno.env.get("DATABASE_URL");

    if (!databaseUrl) {
      return json({
        success: false,
        error: "Missing DATABASE_URL",
      }, 500);
    }

    const apiKey = req.headers.get("x-api-key");

    if (!apiKey) {
      return json({
        success: false,
        error: "Missing API key in x-api-key header",
      }, 401);
    }

    let requestData: any = null;

    try {
      requestData = await req.json();
    } catch (parseError: any) {
      return json({
        success: false,
        error: "Invalid JSON",
        details: parseError.message,
      }, 400);
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
        success: false,
        error: "Invalid API key",
      }, 401);
    }

    const {
      template_name,
      recipient_email,
      data,
      base_data,
    } = requestData;

    const emailData = data || base_data || {};

    if (!template_name || !recipient_email) {
      return json({
        success: false,
        error:
          "Missing required fields: template_name, recipient_email",
      }, 400);
    }

    const templateResult = await client.queryObject<{
      id: string;
      name: string;
      subject: string | null;
    }>(
      `
      SELECT *
      FROM communication_templates
      WHERE name = $1
        AND application_id = $2
        AND is_active = true
      LIMIT 1
      `,
      [
        template_name,
        application.id,
      ],
    );

    const template = templateResult.rows[0];

    if (!template) {
      return json({
        success: false,
        error: "Template not found or inactive",
      }, 404);
    }

    const orderId =
      requestData.order_id ||
      requestData.invoice_id;

    const waitForInvoice =
      requestData.wait_for_invoice;

    function renderTemplate(
      templateText: string,
      data: Record<string, any>,
    ): string {
      let result = templateText;

      const variableRegex =
        /\{\{([a-zA-Z0-9_.]+)\}\}/g;

      result = result.replace(
        variableRegex,
        (match, path) => {
          const keys = path.split(".");
          let value: any = data;

          for (const key of keys) {
            if (
              value === null ||
              value === undefined
            ) {
              return "";
            }

            value = value[key];
          }

          return value !== undefined &&
              value !== null
            ? String(value)
            : "";
        },
      );

      return result;
    }

    // WAIT FOR INVOICE FLOW
    if (orderId && waitForInvoice) {
      const emailDataWithOrderId = {
        ...emailData,
        order_id: orderId,
      };

      const renderedSubject =
        requestData.subject ||
        renderTemplate(
          template.subject || "Pending Invoice",
          emailDataWithOrderId,
        );

      const parentLogResult = await client.queryObject<{
        id: string;
      }>(
        `
        INSERT INTO email_logs (
          application_id,
          template_id,
          recipient_email,
          subject,
          status,
          communication_type,
          pdf_generated,
          metadata
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          'pending',
          'email_with_pdf',
          false,
          $5::jsonb
        )
        RETURNING id
        `,
        [
          application.id,
          template.id,
          recipient_email,
          renderedSubject,
          JSON.stringify({
            action: "email_queued",
            message:
              "Email queued, waiting for invoice PDF",
            order_id: orderId,
            wait_for_invoice: true,
            template_name,
          }),
        ],
      );

      const parentLog = parentLogResult.rows[0];

      if (!parentLog) {
        return json({
          success: false,
          error: "Failed to create email log",
        }, 500);
      }

      const pendingResult = await client.queryObject<{
        id: string;
      }>(
        `
        INSERT INTO pending_communications (
          application_id,
          template_name,
          recipient_email,
          base_data,
          pending_fields,
          external_system,
          external_reference_id,
          order_id,
          parent_log_id,
          status
        )
        VALUES (
          $1,
          $2,
          $3,
          $4::jsonb,
          $5::jsonb,
          'email_system',
          $6,
          $7,
          $8,
          'waiting_data'
        )
        RETURNING id
        `,
        [
          application.id,
          template_name,
          recipient_email,
          JSON.stringify(emailDataWithOrderId),
          JSON.stringify(["invoice_pdf"]),
          orderId,
          orderId,
          parentLog.id,
        ],
      );

      const pendingComm = pendingResult.rows[0];

      if (!pendingComm) {
        return json({
          success: false,
          error:
            "Failed to create pending communication",
        }, 500);
      }

      const pdfLogsResult = await client.queryObject<{
        id: string;
        metadata: any;
        created_at: string;
      }>(
        `
        SELECT id, metadata, created_at
        FROM email_logs
        WHERE application_id = $1
          AND communication_type = 'pdf_generation'
          AND status = 'sent'
        ORDER BY created_at DESC
        LIMIT 20
        `,
        [application.id],
      );

      let existingPdf: any = null;
      let pdfEmailLogId: string | null = null;

      for (const log of pdfLogsResult.rows) {
        const logOrderId = log.metadata?.order_id;

        if (logOrderId === orderId) {
          pdfEmailLogId = log.id;

          const pdfResult = await client.queryObject<{
            id: string;
            pdf_base64: string;
            filename: string;
            size_bytes: number;
          }>(
            `
            SELECT
              id,
              pdf_base64,
              filename,
              size_bytes
            FROM pdf_generation_logs
            WHERE email_log_id = $1
            LIMIT 1
            `,
            [log.id],
          );

          const pdfData = pdfResult.rows[0];

          if (pdfData?.pdf_base64) {
            existingPdf = pdfData;
            break;
          }
        }
      }

      if (!existingPdf) {
        return json({
          success: true,
          message:
            "Email queued, waiting for invoice PDF",
          log_id: parentLog.id,
          pending_communication_id: pendingComm.id,
          status: "queued",
        });
      }

      await client.queryObject(
        `
        UPDATE email_logs
        SET parent_log_id = $1
        WHERE id = $2
        `,
        [
          parentLog.id,
          pdfEmailLogId,
        ],
      );

      await client.queryObject(
        `
        UPDATE pending_communications
        SET
          completed_data = $1::jsonb,
          status = 'pdf_generated',
          pdf_generated = true,
          completed_at = NOW()
        WHERE id = $2
        `,
        [
          JSON.stringify({
            pdf_attachment: {
              filename: existingPdf.filename,
              content: existingPdf.pdf_base64,
              encoding: "base64",
            },
            pdf_generation_log_id:
              pdfEmailLogId,
            pdf_email_log_id:
              pdfEmailLogId,
            pdf_filename:
              existingPdf.filename,
            pdf_size_bytes:
              existingPdf.size_bytes,
            initial_log_id:
              parentLog.id,
          }),
          pendingComm.id,
        ],
      );

      const completeUrl =
        `${FUNCTIONS_BASE_URL}/complete-pending-communication`;

      const completeResponse =
        await fetch(completeUrl, {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
            "x-api-key": apiKey,
          },
          body: JSON.stringify({
            pending_communication_id:
              pendingComm.id,
          }),
        });

      const completeResult =
        await completeResponse.json();

      if (completeResult.success) {
        return json({
          success: true,
          message:
            "Email sent with PDF",
          log_id: parentLog.id,
          pending_communication_id:
            pendingComm.id,
          status: "sent",
        });
      }

      return json({
        success: false,
        error: "Failed to send email",
        details: completeResult,
      }, 500);
    }

    // NORMAL EMAIL FLOW
    const sendEmailUrl =
      `${FUNCTIONS_BASE_URL}/send-email`;

    const emailResponse =
      await fetch(sendEmailUrl, {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify({
          template_name,
          recipient_email,
          data: emailData,
        }),
      });

    const emailResult =
      await emailResponse.json();

    return json(
      emailResult,
      emailResponse.status,
    );
  } catch (error: any) {
    return json({
      success: false,
      error: "Internal server error",
      details: error.message,
    }, 500);
  } finally {
    if (client) {
      client.release();
    }
  }
}
