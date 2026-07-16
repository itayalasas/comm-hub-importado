import nodemailer from "npm:nodemailer@^9";
import { Pool } from "https://deno.land/x/postgres@v0.19.3/mod.ts";
import { renderTemplate } from "./_shared/template-engine.ts";
import { renderHtmlToPdfBase64 } from "./_shared/pdf-renderer.ts";
import { resendFetchWithRetry } from "./_shared/resend-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey, X-Api-Key",
};

const MAX_PDF_ATTACHMENT_SIZE = 1024 * 1024;

const pool = new Pool(Deno.env.get("DATABASE_URL") || "", 3, true);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function generateQrCodeFromText(text: string): Promise<string> {
  const qrApiUrl =
    `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${
      encodeURIComponent(text)
    }`;

  const response = await fetch(qrApiUrl);

  if (!response.ok) {
    throw new Error(`QR API failed: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }

  return `data:image/png;base64,${btoa(binary)}`;
}

async function processQrCodes(
  data: Record<string, any>,
): Promise<Record<string, any>> {
  const QR_FIELDS = ["qr_code", "qr_url", "qr_image", "qr_text", "qr_data"];
  const processed = { ...data };

  for (const [key, value] of Object.entries(processed)) {
    if (value === null || value === undefined) continue;

    if (typeof value === "object" && !Array.isArray(value)) {
      processed[key] = await processQrCodes(value);
    } else if (Array.isArray(value)) {
      processed[key] = await Promise.all(
        value.map((item) =>
          typeof item === "object" && item !== null
            ? processQrCodes(item)
            : item
        ),
      );
    } else if (typeof value === "string" && QR_FIELDS.includes(key)) {
      if (value.startsWith("data:image")) {
        processed[`${key}_qr`] = value;
      } else {
        processed[`${key}_qr`] = await generateQrCodeFromText(value);
      }
    }
  }

  return processed;
}

function generateFilename(pattern: string, data: Record<string, any>): string {
  return renderTemplate(pattern || "document.pdf", data);
}

function wrapLinksForTracking(
  html: string,
  logId: string,
  trackingBaseUrl: string,
): string {
  return html.replace(
    /(<a\s[^>]*href=")((https?:\/\/)[^"]+)(")/gi,
    (match, prefix, url, _scheme, suffix) => {
      if (url.includes(trackingBaseUrl)) return match;

      const trackingUrl =
        `${trackingBaseUrl}/track-email/click?log_id=${logId}&url=${
          encodeURIComponent(url)
        }`;

      return `${prefix}${trackingUrl}${suffix}`;
    },
  );
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const startTime = Date.now();
  let client: any = null;

  try {
    if (req.method !== "POST") {
      return jsonResponse(
        { success: false, error: "Method not allowed" },
        405,
      );
    }

    const databaseUrl = Deno.env.get("DATABASE_URL");

    if (!databaseUrl) {
      return jsonResponse(
        { success: false, error: "Missing DATABASE_URL" },
        500,
      );
    }

    const apiKey = req.headers.get("x-api-key");

    if (!apiKey) {
      return jsonResponse(
        { success: false, error: "Missing API key" },
        401,
      );
    }

    client = await pool.connect();

    const appResult = await client.queryObject(
      `
      SELECT id, name
      FROM applications
      WHERE api_key = $1
      LIMIT 1
      `,
      [apiKey],
    );

    const application: any = appResult.rows[0] ?? null;

    if (!application) {
      return jsonResponse(
        { success: false, error: "Invalid API key" },
        401,
      );
    }

    const body: any = await req.json();

    const {
      recipient_email,
      email: emailSection,
      attachment: attachmentSection,
      order_id,
    } = body;

    if (!recipient_email) {
      return jsonResponse(
        { success: false, error: "recipient_email is required" },
        400,
      );
    }

    if (!emailSection?.template_name) {
      return jsonResponse(
        { success: false, error: "email.template_name is required" },
        400,
      );
    }

    if (!attachmentSection?.pdf_template_name) {
      return jsonResponse(
        { success: false, error: "attachment.pdf_template_name is required" },
        400,
      );
    }

    const emailData: Record<string, any> = emailSection.data ?? {};
    const pdfData: Record<string, any> = attachmentSection.data ?? {};

    const credentialsResult = await client.queryObject(
      `
      SELECT *
      FROM email_credentials
      WHERE application_id = $1
        AND is_active = true
      LIMIT 1
      `,
      [application.id],
    );

    let effectiveCredentials: any = credentialsResult.rows[0] ?? null;

    if (!effectiveCredentials) {
      const platformCredsResult = await client.queryObject(
        `
        SELECT *
        FROM email_credentials
        WHERE application_id = $1
          AND is_active = true
        LIMIT 1
        `,
        ["4685df9c-46ac-48d5-aa91-8b72221ec6f2"],
      );

      effectiveCredentials = platformCredsResult.rows[0] ?? {
        provider_type: "resend",
        resend_api_key: "",
        from_email: "noreply@sendcraft.net",
        from_name: "SendCraft",
      };
    }

    const providerType: string = effectiveCredentials.provider_type || "resend";

    const emailTemplateResult = await client.queryObject(
      `
      SELECT *
      FROM communication_templates
      WHERE name = $1
        AND application_id = $2
        AND template_type = 'email'
        AND is_active = true
      LIMIT 1
      `,
      [emailSection.template_name, application.id],
    );

    const emailTemplate: any = emailTemplateResult.rows[0] ?? null;

    if (!emailTemplate) {
      return jsonResponse(
        {
          success: false,
          error: `Email template '${emailSection.template_name}' not found`,
        },
        404,
      );
    }

    const pdfTemplateResult = await client.queryObject(
      `
      SELECT *
      FROM communication_templates
      WHERE name = $1
        AND application_id = $2
        AND template_type = 'pdf'
        AND is_active = true
      LIMIT 1
      `,
      [attachmentSection.pdf_template_name, application.id],
    );

    const pdfTemplate: any = pdfTemplateResult.rows[0] ?? null;

    if (!pdfTemplate) {
      return jsonResponse(
        {
          success: false,
          error: `PDF template '${attachmentSection.pdf_template_name}' not found`,
        },
        404,
      );
    }

    const processedPdfData = await processQrCodes(pdfData);
    const mergedPdfData = { ...processedPdfData, data: processedPdfData };

    const renderedPdfHtml = renderTemplate(
      pdfTemplate.html_content,
      mergedPdfData,
    );

    const filenamePattern = attachmentSection.filename ||
      pdfTemplate.pdf_filename_pattern ||
      "document.pdf";

    const pdfFilename = generateFilename(filenamePattern, mergedPdfData);

    const {
      base64: pdfBase64,
      sizeBytes: pdfSizeBytes,
    } = await renderHtmlToPdfBase64(renderedPdfHtml, { title: pdfFilename });

    const pdfLogResult = await client.queryObject(
      `
      INSERT INTO pdf_generation_logs (
        application_id,
        pdf_template_id,
        data,
        pdf_base64,
        filename,
        size_bytes
      )
      VALUES ($1,$2,$3::jsonb,$4,$5,$6)
      RETURNING id
      `,
      [
        application.id,
        pdfTemplate.id,
        JSON.stringify(pdfData),
        pdfBase64,
        pdfFilename,
        pdfSizeBytes,
      ],
    );

    const pdfLog: any = pdfLogResult.rows[0] ?? null;

    let pdfPublicUrl: string | null = null;

    const publicBaseUrl =
      Deno.env.get("PUBLIC_FUNCTIONS_URL") ||
      Deno.env.get("FUNCTIONS_BASE_URL") ||
      "";

    if (pdfLog?.id) {
      const accessToken = `${crypto.randomUUID()}-${Date.now()}`;
      const expiresAt = new Date(
        Date.now() + 90 * 24 * 60 * 60 * 1000,
      ).toISOString();

      await client.queryObject(
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
        `,
        [
          application.id,
          pdfLog.id,
          order_id ?? null,
          accessToken,
          pdfFilename,
          expiresAt,
          true,
        ],
      );

      pdfPublicUrl = publicBaseUrl
        ? `${publicBaseUrl}/view-pdf?token=${accessToken}`
        : null;
    }

    const mergedEmailData = { ...emailData, data: emailData };

    let htmlContent = renderTemplate(
      emailTemplate.html_content,
      mergedEmailData,
    );

    const emailSubject = emailSection.subject ||
      renderTemplate(emailTemplate.subject || "", mergedEmailData) ||
      `Email from ${application.name}`;

    const attachPdfInline = pdfSizeBytes <= MAX_PDF_ATTACHMENT_SIZE;

    if (pdfPublicUrl && !attachPdfInline) {
      htmlContent += `
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px">
        <tr>
          <td style="background:#f3f4f6;border-radius:8px;padding:16px;text-align:center">
            <p style="margin:0 0 12px;font-size:14px;color:#374151">El documento adjunto está disponible para descargar:</p>
            <a href="${pdfPublicUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:10px 24px;border-radius:6px;font-size:14px;font-weight:600">
              Descargar ${pdfFilename}
            </a>
          </td>
        </tr>
      </table>`;
    }

    const emailLogResult = await client.queryObject(
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
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
      RETURNING id
      `,
      [
        application.id,
        emailTemplate.id,
        recipient_email,
        emailSubject,
        "pending",
        "email_with_pdf",
        true,
        JSON.stringify({
          action: "send_email_with_pdf",
          order_id: order_id ?? null,
          pdf_template_name: attachmentSection.pdf_template_name,
          email_template_name: emailSection.template_name,
          pdf_filename: pdfFilename,
          pdf_size_bytes: pdfSizeBytes,
          pdf_attached_inline: attachPdfInline,
          pdf_log_id: pdfLog?.id ?? null,
        }),
      ],
    );

    const emailLog: any = emailLogResult.rows[0] ?? null;

    if (pdfLog?.id && emailLog?.id) {
      await client.queryObject(
        `
        UPDATE pdf_generation_logs
        SET email_log_id = $1,
            public_url = $2
        WHERE id = $3
        `,
        [emailLog.id, pdfPublicUrl, pdfLog.id],
      );

      await client.queryObject(
        `
        INSERT INTO email_logs (
          application_id,
          parent_log_id,
          communication_type,
          recipient_email,
          subject,
          status,
          metadata
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)
        `,
        [
          application.id,
          emailLog.id,
          "pdf_generation",
          "pdf_generation@system.local",
          `PDF Generated: ${pdfFilename}`,
          "generated",
          JSON.stringify({
            pdf_log_id: pdfLog.id,
            pdf_filename: pdfFilename,
            pdf_size_bytes: pdfSizeBytes,
            pdf_public_url: pdfPublicUrl ?? null,
            order_id: order_id ?? null,
          }),
        ],
      );
    }

    if (emailLog?.id && publicBaseUrl) {
      htmlContent = wrapLinksForTracking(
        htmlContent,
        emailLog.id,
        publicBaseUrl,
      );
    }

    if (emailLog?.id && publicBaseUrl) {
      const trackingPixelUrl =
        `${publicBaseUrl}/track-email/open?log_id=${emailLog.id}`;

      htmlContent +=
        `<img src="${trackingPixelUrl}" width="1" height="1" style="display:none" />`;
    }

    const fromEmail = effectiveCredentials.from_email;
    const fromName = effectiveCredentials.from_name ||
      application.name ||
      "SendCraft";

    let resendEmailId: string | null = null;

    if (providerType === "smtp") {
      const useTLS = effectiveCredentials.smtp_port === 465;

      const transporter = nodemailer.createTransport({
        host: effectiveCredentials.smtp_host,
        port: effectiveCredentials.smtp_port,
        secure: useTLS,
        auth: {
          user: effectiveCredentials.smtp_user,
          pass: effectiveCredentials.smtp_password,
        },
      });

      const emailConfig: any = {
        from: `"${fromName}" <${fromEmail}>`,
        to: recipient_email,
        subject: emailSubject,
        html: htmlContent,
      };

      if (attachPdfInline) {
        emailConfig.attachments = [
          {
            filename: pdfFilename,
            content: pdfBase64,
            encoding: "base64",
          },
        ];
      }

      await transporter.sendMail(emailConfig);
    } else {
      const resendApiKey = effectiveCredentials.resend_api_key ||
        Deno.env.get("RESEND_API_KEY");

      if (!resendApiKey) {
        throw new Error("Missing Resend API key");
      }

      const resendPayload: any = {
        from: fromName ? `${fromName} <${fromEmail}>` : fromEmail,
        to: [recipient_email],
        subject: emailSubject,
        html: htmlContent,
      };

      if (attachPdfInline) {
        resendPayload.attachments = [
          {
            filename: pdfFilename,
            content: pdfBase64,
          },
        ];
      }

      const resendResponse = await resendFetchWithRetry(
        "https://api.resend.com/emails",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(resendPayload),
        },
      );

      const resendBody: any = await resendResponse.json();

      if (!resendResponse.ok) {
        throw new Error(
          `Resend API error: ${resendBody.message || JSON.stringify(resendBody)}`,
        );
      }

      resendEmailId = resendBody.id;
    }

    if (emailLog?.id) {
      await client.queryObject(
        `
        UPDATE email_logs
        SET status = $1,
            sent_at = $2,
            resend_email_id = $3
        WHERE id = $4
        `,
        [
          "sent",
          new Date().toISOString(),
          resendEmailId,
          emailLog.id,
        ],
      );
    }

    const processingTime = Date.now() - startTime;

    return jsonResponse({
      success: true,
      message: "Email with PDF attachment sent successfully",
      log_id: emailLog?.id ?? null,
      pdf_log_id: pdfLog?.id ?? null,
      pdf_filename: pdfFilename,
      pdf_size_bytes: pdfSizeBytes,
      pdf_attached_inline: attachPdfInline,
      pdf_public_url: pdfPublicUrl,
      resend_email_id: resendEmailId,
      processing_time_ms: processingTime,
    });
  } catch (error: any) {
    return jsonResponse(
      {
        success: false,
        error: "Failed to send email",
        details: error.message || String(error),
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
