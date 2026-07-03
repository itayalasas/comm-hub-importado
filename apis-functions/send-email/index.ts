
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';
import { Pool } from 'https://deno.land/x/postgres@v0.19.3/mod.ts';
import { resendFetchWithRetry } from './_shared/resend-client.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey, X-Api-Key',
};

const pool = new Pool({ connectionString: Deno.env.get("DATABASE_URL") || "", connectionTimeoutMillis: 5000 }, 3, true);

function wrapLinksForTracking(
  html: string,
  logId: string,
  trackingBaseUrl: string,
): string {
  return html.replace(
    /(<a\s[^>]*href=")((https?:\/\/)[^"]+)"/gi,
    (match, prefix, url, _scheme, suffix) => {
      if (url.includes(trackingBaseUrl)) return match;
      const trackingUrl =
        `${trackingBaseUrl}/track-email/click?log_id=${logId}&url=${encodeURIComponent(url)
        }`;
      return `${prefix}${trackingUrl}${suffix}`;
    },
  );
}

function renderTemplate(template: string, data: Record<string, any>): string {
  let result = template;

  const getNestedValue = (obj: any, path: string): any => {
    const keys = path.split('.');
    let value = obj;

    for (const key of keys) {
      if (value === null || value === undefined) return '';
      value = value[key];
    }

    return value !== undefined && value !== null ? value : '';
  };

  const variableRegex = /\{\{([a-zA-Z0-9_.]+)\}\}/g;

  result = result.replace(variableRegex, (_match, path) => {
    const value = getNestedValue(data, path);
    return value !== undefined && value !== null ? String(value) : '';
  });

  return result;
}

function jsonResponse(body: Record<string, any>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const databaseUrl = Deno.env.get('DATABASE_URL');
  const functionsBaseUrl = Deno.env.get('FUNCTIONS_BASE_URL');

  if (!databaseUrl) {
    return jsonResponse({
      success: false,
      error: 'Missing DATABASE_URL environment variable',
    }, 500);
  }

  if (!functionsBaseUrl) {
    return jsonResponse({
      success: false,
      error: 'Missing FUNCTIONS_BASE_URL environment variable',
    }, 500);
  }

  const client = await pool.connect();

  try {
    const startTime = Date.now();

    const apiKey = req.headers.get('x-api-key');

    if (!apiKey) {
      return jsonResponse({
        success: false,
        error: 'Missing API key',
      }, 401);
    }

    const applicationResult = await client.queryObject<any>(
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
      return jsonResponse({
        success: false,
        error: 'Invalid API key',
      }, 401);
    }

    const requestData: any = await req.json();

    const {
      recipient_email,
      template_name,
      data = {},
      subject,
      pdf_base64,
      pdf_filename,
      _pdf_attachment,
      _pdf_info,
      _existing_log_id,
    } = requestData;

    let finalPdfBase64 = _pdf_attachment?.content || pdf_base64;

    const finalPdfFilename =
      _pdf_attachment?.filename ||
      _pdf_info?.pdf_filename ||
      pdf_filename ||
      'document.pdf';

    let pdfPublicUrl: string | null = null;
    let pdfSizeBytes = 0;

    const MAX_PDF_ATTACHMENT_SIZE = 1024 * 1024;

    if (_pdf_info?.pdf_email_log_id && !finalPdfBase64) {
      const pdfResult = await client.queryObject<any>(
        `
        SELECT pdf_base64, filename, size_bytes, public_url
        FROM pdf_generation_logs
        WHERE email_log_id = $1
        LIMIT 1
        `,
        [_pdf_info.pdf_email_log_id],
      );

      const pdfData = pdfResult.rows[0];

      if (pdfData?.pdf_base64) {
        pdfSizeBytes = pdfData.size_bytes || pdfData.pdf_base64.length;
        pdfPublicUrl = pdfData.public_url;

        if (pdfSizeBytes > MAX_PDF_ATTACHMENT_SIZE) {
          finalPdfBase64 = null;
        } else {
          finalPdfBase64 = pdfData.pdf_base64;
        }
      }
    }

    if (finalPdfBase64) {
      pdfSizeBytes = finalPdfBase64.length;

      if (pdfSizeBytes > MAX_PDF_ATTACHMENT_SIZE) {
        finalPdfBase64 = null;
      }
    }

    if (!template_name || !recipient_email) {
      return jsonResponse({
        success: false,
        error: 'Missing required fields',
      }, 400);
    }

    const credentialsResult = await client.queryObject<any>(
      `
      SELECT *
      FROM email_credentials
      WHERE application_id = $1
        AND is_active = true
      LIMIT 1
      `,
      [application.id],
    );

    let effectiveCredentials = credentialsResult.rows[0];

    if (!effectiveCredentials) {
      const platformCredsResult = await client.queryObject<any>(
        `
        SELECT *
        FROM email_credentials
        WHERE application_id = $1
          AND is_active = true
        LIMIT 1
        `,
        ['4685df9c-46ac-48d5-aa91-8b72221ec6f2'],
      );

      effectiveCredentials = platformCredsResult.rows[0] ?? {
        provider_type: 'resend',
        resend_api_key: '',
        from_email: 'noreply@sendcraft.net',
        from_name: 'SendCraft',
      };
    }

    const providerType = effectiveCredentials.provider_type || 'resend';

    const templateResult = await client.queryObject<any>(
      `
      SELECT *
      FROM communication_templates
      WHERE name = $1
        AND application_id = $2
        AND template_type = 'email'
        AND is_active = true
      LIMIT 1
      `,
      [template_name, application.id],
    );

    const template = templateResult.rows[0];

    if (!template) {
      return jsonResponse({
        success: false,
        error: 'Template not found',
      }, 404);
    }

    const pdfDownloadSection = pdfPublicUrl
      ? `
      <tr>
        <td style="padding: 0 30px 30px;">
          <div style="border: 2px solid #4B9991; border-radius: 8px; padding: 24px; text-align: center; background: #f9fafb;">
            <h2 style="margin: 0 0 12px; font-size: 20px; color: #0f172a; font-weight: 700;">
              Descarga tu factura
            </h2>
            <p style="margin: 0 0 20px; font-size: 15px; color: #334155; line-height: 1.5;">
              Haz clic en el boton para ver o descargar tu factura:
            </p>
            <a href="${pdfPublicUrl}" style="display: inline-block; padding: 14px 32px; background: #4B9991; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 700; font-size: 15px;">
              Ver/Descargar Factura
            </a>
            <p style="margin: 16px 0 0; font-size: 12px; color: #6b7280;">
              Este enlace estara disponible por 90 dias
            </p>
          </div>
        </td>
      </tr>
    `
      : '';

    const enrichedData = {
      recipient_email,
      order_id: requestData.order_id || null,
      ...data,
      pdf_download_section: pdfDownloadSection,
    };

    let htmlContent = renderTemplate(template.html_content, enrichedData);
    let emailSubject = subject ||
      renderTemplate(template.subject || '', enrichedData);

    emailSubject = emailSubject
      .replace(/\r?\n/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    htmlContent = htmlContent.trim().replace(/\n/g, ' ').replace(/\r/g, '');

    const hasPdfAttachment = !!finalPdfBase64;
    const normalizedData = data && typeof data === 'object' ? data : {};

    const emailPayload = {
      recipient_email,
      subject: emailSubject,
      template_name,
      order_id: requestData.order_id || null,
      has_pdf_attachment: hasPdfAttachment,
      pdf_filename: hasPdfAttachment ? finalPdfFilename : null,
    };

    const requestPayload = {
      ...requestData,
      data: normalizedData,
      template_name,
      recipient_email,
      subject: subject || requestData.subject || undefined,
    };

    const idempotencyKey = JSON.stringify({
      recipient_email,
      template_name,
      subject: emailSubject,
      data: normalizedData,
      order_id: requestData.order_id || null,
      has_pdf_attachment: hasPdfAttachment,
      pdf_filename: hasPdfAttachment ? finalPdfFilename : null,
    });

    let logEntry: any = null;

    if (_existing_log_id) {
      const existingLogResult = await client.queryObject<any>(
        `
        SELECT *
        FROM email_logs
        WHERE id = $1
        LIMIT 1
        `,
        [_existing_log_id],
      );

      logEntry = existingLogResult.rows[0] || null;
    }

    if (!logEntry) {
      const dedupeWindowMs = 15000;
      const dedupeSince = new Date(Date.now() - dedupeWindowMs).toISOString();

      const recentLogsResult = await client.queryObject<any>(
        `
        SELECT id, status, metadata, created_at
        FROM email_logs
        WHERE application_id = $1
          AND recipient_email = $2
          AND subject = $3
          AND communication_type IN ('email', 'email_with_pdf')
          AND created_at >= $4
        ORDER BY created_at DESC
        LIMIT 5
        `,
        [application.id, recipient_email, emailSubject, dedupeSince],
      );

      const duplicateLog = recentLogsResult.rows.find((candidate: any) => {
        const candidatePayload = candidate?.metadata?.idempotency_key;
        return candidatePayload && candidatePayload === idempotencyKey;
      });

      if (duplicateLog && !requestData._allow_duplicate_resend) {
        return jsonResponse({
          success: true,
          message: 'Duplicate request prevented',
          log_id: duplicateLog.id,
          duplicate_prevented: true,
        });
      }

      const logResult = await client.queryObject<any>(
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
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
        RETURNING *
        `,
        [
          application.id,
          template.id,
          recipient_email,
          emailSubject,
          'pending',
          hasPdfAttachment ? 'email_with_pdf' : 'email',
          hasPdfAttachment,
          JSON.stringify({
            email_payload: emailPayload,
            request_payload: requestPayload,
            idempotency_key: idempotencyKey,
            action: 'email_queued',
            template_name,
            order_id: requestData.order_id || null,
          }),
        ],
      );

      logEntry = logResult.rows[0];
    }

    const existingMetadata =
      logEntry?.metadata && typeof logEntry.metadata === 'object'
        ? logEntry.metadata
        : {};

    const existingRequestPayload =
      existingMetadata.request_payload &&
        typeof existingMetadata.request_payload === 'object' &&
        Object.keys(existingMetadata.request_payload).length > 0
        ? existingMetadata.request_payload
        : null;

    const existingEmailPayload =
      existingMetadata.email_payload &&
        typeof existingMetadata.email_payload === 'object' &&
        Object.keys(existingMetadata.email_payload).length > 0
        ? existingMetadata.email_payload
        : null;

    const mergedMetadata = {
      ...existingMetadata,
      action: hasPdfAttachment ? 'email_sent_with_invoice' : 'email_sent',
      completed_at: new Date().toISOString(),
      processing_time_ms: Date.now() - startTime,
      template_name: existingMetadata.template_name || template_name,
      email_payload: existingEmailPayload || emailPayload,
      request_payload: existingRequestPayload || requestPayload,
      idempotency_key: existingMetadata.idempotency_key || idempotencyKey,
      pdf_info: {
        ...(existingMetadata.pdf_info || {}),
        pdf_email_log_id:
          _pdf_info?.pdf_email_log_id ||
          existingMetadata?.pdf_info?.pdf_email_log_id ||
          null,
        pdf_filename:
          finalPdfFilename ||
          existingMetadata?.pdf_info?.pdf_filename ||
          null,
        pdf_size_bytes:
          pdfSizeBytes ||
          existingMetadata?.pdf_info?.pdf_size_bytes ||
          null,
        pdf_public_url:
          pdfPublicUrl ||
          existingMetadata?.pdf_info?.pdf_public_url ||
          null,
      },
    };

    if (hasPdfAttachment && _pdf_info?.pdf_email_log_id) {
      await client.queryObject(
        `
        UPDATE email_logs
        SET parent_log_id = $1
        WHERE id = $2
        `,
        [logEntry.id, _pdf_info.pdf_email_log_id],
      );
    }

    htmlContent = wrapLinksForTracking(
      htmlContent,
      logEntry.id,
      functionsBaseUrl,
    );

    const trackingPixelUrl =
      functionsBaseUrl + '/track-email/open?log_id=' + logEntry.id;

    htmlContent +=
      '<img src="' +
      trackingPixelUrl +
      '" width="1" height="1" style="display:none" />';

    try {
      const actualFromEmail = effectiveCredentials.from_email;
      const fromName = effectiveCredentials.from_name ||
        application.name ||
        'SendCraft';

      if (providerType === 'smtp') {
        const useTLS = effectiveCredentials.smtp_port === 465;

        const connectionConfig: any = {
          hostname: effectiveCredentials.smtp_host,
          port: effectiveCredentials.smtp_port,
          auth: {
            username: effectiveCredentials.smtp_user,
            password: effectiveCredentials.smtp_password,
          },
        };

        if (useTLS) connectionConfig.tls = true;

        const smtpClient = new SMTPClient({ connection: connectionConfig });

        const emailConfig: any = {
          from: `"${fromName}" <${actualFromEmail}>`,
          to: recipient_email,
          subject: emailSubject,
          content: 'text/html; charset=utf-8',
          html: htmlContent,
        };

        if (finalPdfBase64 && finalPdfFilename) {
          emailConfig.attachments = [{
            filename: finalPdfFilename,
            content: finalPdfBase64,
            encoding: 'base64',
          }];
        }

        await smtpClient.send(emailConfig);
        await smtpClient.close();

        await client.queryObject(
          `
          UPDATE email_logs
          SET
            status = 'sent',
            sent_at = NOW(),
            pdf_attachment_size = $1,
            metadata = $2::jsonb
          WHERE id = $3
          `,
          [
            finalPdfBase64 ? finalPdfBase64.length : null,
            JSON.stringify(mergedMetadata),
            logEntry.id,
          ],
        );

        return jsonResponse({
          success: true,
          message: 'Email sent successfully',
          log_id: logEntry.id,
          processing_time_ms: Date.now() - startTime,
        });
      }

      const resendApiKey =
        effectiveCredentials.resend_api_key || Deno.env.get('RESEND_API_KEY');

      if (!resendApiKey) {
        throw new Error('Missing RESEND_API_KEY');
      }

      const resendPayload: any = {
        from: fromName ? `${fromName} <${actualFromEmail}>` : actualFromEmail,
        to: [recipient_email],
        subject: emailSubject,
        html: htmlContent,
      };

      if (finalPdfBase64 && finalPdfFilename) {
        resendPayload.attachments = [{
          filename: finalPdfFilename,
          content: finalPdfBase64,
        }];
      }

      const resendResponse = await resendFetchWithRetry(
        'https://api.resend.com/emails',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(resendPayload),
        },
      );

      const resendData = await resendResponse.json();

      if (!resendResponse.ok) {
        throw new Error(
          `Resend API error: ${resendData.message || resendResponse.statusText
          }`,
        );
      }

      await client.queryObject(
        `
        UPDATE email_logs
        SET
          status = 'sent',
          sent_at = NOW(),
          resend_email_id = $1,
          delivery_status = 'sent',
          pdf_attachment_size = $2,
          metadata = $3::jsonb
        WHERE id = $4
        `,
        [
          resendData.id,
          finalPdfBase64 ? finalPdfBase64.length : null,
          JSON.stringify(mergedMetadata),
          logEntry.id,
        ],
      );

      return jsonResponse({
        success: true,
        message: 'Email sent successfully',
        log_id: logEntry.id,
        resend_email_id: resendData.id,
        processing_time_ms: Date.now() - startTime,
      });
    } catch (emailError: any) {
      await client.queryObject(
        `
        UPDATE email_logs
        SET
          status = 'failed',
          error_message = $1
        WHERE id = $2
        `,
        [emailError.message, logEntry.id],
      );

      return jsonResponse({
        success: false,
        error: 'Failed to send email',
        details: emailError.message,
      }, 500);
    }
  } catch (error: any) {
    return jsonResponse({
      success: false,
      error: 'Internal server error',
      details: error.message || String(error),
    }, 500);
  } finally {
    client.release();
  }
}

