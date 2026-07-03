
import { Pool } from "https://deno.land/x/postgres@v0.19.3/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-api-key",
};

const pool = new Pool({ connectionString: Deno.env.get("DATABASE_URL") || "", connectionTimeoutMillis: 5000 }, 3, true);

const FUNCTIONS_BASE_URL =
  Deno.env.get("FUNCTIONS_BASE_URL") ||
  "http://localhost:8000/functions/v1";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

export default async function handler(req: Request) {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
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

    const requestData: any = await req.json();

    const {
      external_reference_id,
      pending_communication_id,
      completed_data = {},
    } = requestData;

    if (!external_reference_id && !pending_communication_id) {
      return json({
        success: false,
        error:
          "Missing required field: external_reference_id or pending_communication_id",
      }, 400);
    }

    const pendingParams: unknown[] = [application.id];
    let pendingWhere = "application_id = $1";

    if (pending_communication_id) {
      pendingParams.push(pending_communication_id);
      pendingWhere += ` AND id = $${pendingParams.length}`;
    } else {
      pendingParams.push(external_reference_id);
      pendingWhere += ` AND external_reference_id = $${pendingParams.length}`;
    }

    const pendingResult = await client.queryObject<any>(
      `
      SELECT *
      FROM pending_communications
      WHERE ${pendingWhere}
      LIMIT 1
      `,
      pendingParams,
    );

    const pendingComm = pendingResult.rows[0];

    if (!pendingComm) {
      return json({
        success: false,
        error: "Pending communication not found",
      }, 404);
    }

    if (pendingComm.status === "sent") {
      return json({
        success: false,
        error: "Communication already sent",
        sent_at: pendingComm.sent_at,
      }, 400);
    }

    const baseData =
      pendingComm.base_data && typeof pendingComm.base_data === "object"
        ? pendingComm.base_data
        : {};

    const mergedData = {
      ...baseData,
      ...completed_data,
    };

    if (pendingComm.status === "waiting_data") {
      await client.queryObject(
        `
        UPDATE pending_communications
        SET
          completed_data = $1::jsonb,
          status = 'data_received',
          completed_at = NOW()
        WHERE id = $2
        `,
        [
          JSON.stringify(mergedData),
          pendingComm.id,
        ],
      );
    }

    try {
      const completedData =
        pendingComm.completed_data && typeof pendingComm.completed_data === "object"
          ? pendingComm.completed_data
          : {};

      const pdfEmailLogId =
        completedData.pdf_email_log_id ||
        completedData.pdf_generation_log_id ||
        completed_data?.pdf_email_log_id ||
        completed_data?.pdf_generation_log_id ||
        null;

      const pdfInfo = {
        pdf_email_log_id: pdfEmailLogId,
        pdf_template_id:
          completedData.pdf_template_id || completed_data?.pdf_template_id || null,
        pdf_filename:
          completedData.pdf_filename || completed_data?.pdf_filename || null,
        pdf_size_bytes:
          completedData.pdf_size_bytes || completed_data?.pdf_size_bytes || null,
      };

      const requestBody: any = {
        template_name: pendingComm.template_name,
        recipient_email: pendingComm.recipient_email,
        data: mergedData,
        order_id: pendingComm.order_id || null,
        parent_log_id: pendingComm.parent_log_id || null,
        _skip_pdf_generation: !!pdfEmailLogId,
        _pdf_info: pdfInfo,
        _pending_communication_id: pendingComm.id,
        _existing_log_id: pendingComm.parent_log_id,
      };

      const sendEmailUrl = `${FUNCTIONS_BASE_URL}/send-email`;

      const emailResponse = await fetch(sendEmailUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify(requestBody),
      });

      const emailResponseText = await emailResponse.text();

      let emailResult: any;

      try {
        emailResult = emailResponseText ? JSON.parse(emailResponseText) : {};
      } catch {
        throw new Error(
          `Invalid JSON response from send-email (${emailResponse.status})`,
        );
      }

      if (emailResult.success) {
        await client.queryObject(
          `
          UPDATE pending_communications
          SET
            status = 'sent',
            sent_at = NOW(),
            sent_log_id = $1
          WHERE id = $2
          `,
          [
            emailResult.log_id,
            pendingComm.id,
          ],
        );

        if (pendingComm.parent_log_id) {
          await client.queryObject(
            `
            UPDATE email_logs
            SET
              status = 'sent',
              sent_at = NOW()
            WHERE id = $1
            `,
            [pendingComm.parent_log_id],
          );
        }

        if (pendingComm.webhook_url) {
          try {
            await fetch(pendingComm.webhook_url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                event: "communication_sent",
                external_reference_id: pendingComm.external_reference_id,
                sent_at: new Date().toISOString(),
                log_id: emailResult.log_id,
              }),
            });
          } catch {
            // Ignore webhook errors
          }
        }

        return json({
          success: true,
          message: "Communication completed and email sent",
          pending_communication_id: pendingComm.id,
          log_id: emailResult.log_id,
        });
      }

      await client.queryObject(
        `
        UPDATE pending_communications
        SET
          status = 'failed',
          error_message = $1
        WHERE id = $2
        `,
        [
          emailResult.error || "Failed to send email",
          pendingComm.id,
        ],
      );

      return json({
        success: false,
        error: "Failed to send email",
        details: emailResult.error,
      }, 500);
    } catch (sendError: any) {
      await client.queryObject(
        `
        UPDATE pending_communications
        SET
          status = 'failed',
          error_message = $1
        WHERE id = $2
        `,
        [
          sendError.message,
          pendingComm.id,
        ],
      );

      return json({
        success: false,
        error: "Error sending email",
        details: sendError.message,
      }, 500);
    }
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
