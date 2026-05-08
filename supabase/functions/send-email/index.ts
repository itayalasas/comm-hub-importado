import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { resendFetchWithRetry } from './_shared/resend-client.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Api-Key",
};

function wrapLinksForTracking(html: string, logId: string, trackingBaseUrl: string): string {
  // Replace all <a href="..."> that point to external http(s) URLs with a tracking redirect.
  // Skips mailto:, tel:, #anchors, and URLs that are already pointing at the tracker.
  return html.replace(
    /(<a\s[^>]*href=")((https?:\/\/)[^"]+)(")/gi,
    (match, prefix, url, _scheme, suffix) => {
      if (url.includes(trackingBaseUrl)) return match;
      const trackingUrl = `${trackingBaseUrl}/functions/v1/track-email/click?log_id=${logId}&url=${encodeURIComponent(url)}`;
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
  result = result.replace(variableRegex, (match, path) => {
    const value = getNestedValue(data, path);
    return value !== undefined && value !== null ? String(value) : '';
  });
  return result;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const startTime = Date.now();
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const apiKey = req.headers.get('x-api-key');
    if (!apiKey) {
      return new Response(JSON.stringify({ success: false, error: 'Missing API key' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: application } = await supabase.from('applications').select('id, name').eq('api_key', apiKey).maybeSingle();
    if (!application) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid API key' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const requestData: any = await req.json();
    const { recipient_email, template_name, data = {}, subject, pdf_base64, pdf_filename, _pdf_attachment, _pdf_info, _existing_log_id } = requestData;

    let finalPdfBase64 = _pdf_attachment?.content || pdf_base64;
    const finalPdfFilename = _pdf_attachment?.filename || _pdf_info?.pdf_filename || pdf_filename || 'document.pdf';
    let pdfPublicUrl = null;
    let pdfSizeBytes = 0;
    const MAX_PDF_ATTACHMENT_SIZE = 1024 * 1024;

    if (_pdf_info?.pdf_email_log_id && !finalPdfBase64) {
      const { data: pdfData } = await supabase.from('pdf_generation_logs').select('pdf_base64, filename, size_bytes, public_url').eq('email_log_id', _pdf_info.pdf_email_log_id).maybeSingle();
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
      return new Response(JSON.stringify({ success: false, error: 'Missing required fields' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: credentials } = await supabase.from('email_credentials').select('*').eq('application_id', application.id).eq('is_active', true).maybeSingle();

    // Fall back to platform default credentials when the app has none configured
    let effectiveCredentials = credentials;
    if (!effectiveCredentials) {
      const { data: platformCreds } = await supabase
        .from('email_credentials')
        .select('*')
        .eq('application_id', '4685df9c-46ac-48d5-aa91-8b72221ec6f2')
        .eq('is_active', true)
        .maybeSingle();
      effectiveCredentials = platformCreds ?? {
        provider_type: 'resend',
        resend_api_key: '',
        from_email: 'noreply@sendcraft.net',
        from_name: 'SendCraft',
      };
    }

    const providerType = effectiveCredentials.provider_type || 'resend';

    const { data: template } = await supabase.from('communication_templates').select('*').eq('name', template_name).eq('application_id', application.id).eq('template_type', 'email').eq('is_active', true).maybeSingle();
    if (!template) {
      return new Response(JSON.stringify({ success: false, error: 'Template not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const pdfDownloadSection = pdfPublicUrl ? `
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
    ` : '';

    // Merge root-level fields (recipient_email, order_id, etc.) so templates can
    // reference {{recipient_email}} even though it lives outside the data object.
    // Explicit data fields take precedence over root fields.
    const enrichedData = {
      recipient_email,
      order_id: requestData.order_id || null,
      ...data,
      pdf_download_section: pdfDownloadSection,
    };
    let htmlContent = renderTemplate(template.html_content, enrichedData);
    let emailSubject = subject || renderTemplate(template.subject || '', enrichedData);

    emailSubject = emailSubject.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();
    htmlContent = htmlContent.trim().replace(/\n/g, ' ').replace(/\r/g, '');

    const hasPdfAttachment = !!finalPdfBase64;
    const normalizedData = (data && typeof data === 'object') ? data : {};
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
    let logEntry: any;

    if (_existing_log_id) {
      const { data: existingLog } = await supabase.from('email_logs').select('*').eq('id', _existing_log_id).maybeSingle();
      if (existingLog) {
        logEntry = existingLog;
      }
    }

    if (!logEntry) {
      const dedupeWindowMs = 15000;
      const dedupeSince = new Date(Date.now() - dedupeWindowMs).toISOString();
      const { data: recentLogs } = await supabase
        .from('email_logs')
        .select('id, status, metadata, created_at')
        .eq('application_id', application.id)
        .eq('recipient_email', recipient_email)
        .eq('subject', emailSubject)
        .in('communication_type', ['email', 'email_with_pdf'])
        .gte('created_at', dedupeSince)
        .order('created_at', { ascending: false })
        .limit(5);

      const duplicateLog = (recentLogs || []).find((candidate: any) => {
        const candidatePayload = candidate?.metadata?.idempotency_key;
        return candidatePayload && candidatePayload === idempotencyKey;
      });

      if (duplicateLog && !requestData._allow_duplicate_resend) {
        return new Response(
          JSON.stringify({
            success: true,
            message: 'Duplicate request prevented',
            log_id: duplicateLog.id,
            duplicate_prevented: true,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: logData } = await supabase.from('email_logs').insert({
        application_id: application.id,
        template_id: template.id,
        recipient_email,
        subject: emailSubject,
        status: 'pending',
        communication_type: hasPdfAttachment ? 'email_with_pdf' : 'email',
        pdf_generated: hasPdfAttachment,
        metadata: {
          email_payload: emailPayload,
          request_payload: requestPayload,
          idempotency_key: idempotencyKey,
          action: 'email_queued',
          template_name,
          order_id: requestData.order_id || null,
        },
      }).select().single();
      logEntry = logData;
    }

    const existingMetadata = (logEntry?.metadata && typeof logEntry.metadata === 'object') ? logEntry.metadata : {};
    const existingRequestPayload = (existingMetadata.request_payload && typeof existingMetadata.request_payload === 'object' && Object.keys(existingMetadata.request_payload).length > 0)
      ? existingMetadata.request_payload
      : null;
    const existingEmailPayload = (existingMetadata.email_payload && typeof existingMetadata.email_payload === 'object' && Object.keys(existingMetadata.email_payload).length > 0)
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
        pdf_email_log_id: _pdf_info?.pdf_email_log_id || existingMetadata?.pdf_info?.pdf_email_log_id || null,
        pdf_filename: finalPdfFilename || existingMetadata?.pdf_info?.pdf_filename || null,
        pdf_size_bytes: pdfSizeBytes || existingMetadata?.pdf_info?.pdf_size_bytes || null,
        pdf_public_url: pdfPublicUrl || existingMetadata?.pdf_info?.pdf_public_url || null,
      },
    };

    if (hasPdfAttachment && _pdf_info?.pdf_email_log_id) {
      await supabase.from('email_logs').update({ parent_log_id: logEntry.id }).eq('id', _pdf_info.pdf_email_log_id);
    }

    htmlContent = wrapLinksForTracking(htmlContent, logEntry.id, supabaseUrl);

    const trackingPixelUrl = supabaseUrl + '/functions/v1/track-email/open?log_id=' + logEntry.id;
    htmlContent += '<img src="' + trackingPixelUrl + '" width="1" height="1" style="display:none" />';

    try {
      const actualFromEmail = effectiveCredentials.from_email;
      const fromName = effectiveCredentials.from_name || application.name || 'SendCraft';

      if (providerType === 'smtp') {
        const useTLS = effectiveCredentials.smtp_port === 465;

        const connectionConfig: any = {
          hostname: effectiveCredentials.smtp_host,
          port: effectiveCredentials.smtp_port,
          auth: { username: effectiveCredentials.smtp_user, password: effectiveCredentials.smtp_password },
        };
        if (useTLS) connectionConfig.tls = true;

        const client = new SMTPClient({ connection: connectionConfig });

        const emailConfig: any = {
          from: `"${fromName}" <${actualFromEmail}>`,
          to: recipient_email,
          subject: emailSubject,
          content: 'text/html; charset=utf-8',
          html: htmlContent,
        };

        if (finalPdfBase64 && finalPdfFilename) {
          emailConfig.attachments = [{ filename: finalPdfFilename, content: finalPdfBase64, encoding: 'base64' }];
        }

        await client.send(emailConfig);
        await client.close();
      } else {
        const resendApiKey = effectiveCredentials.resend_api_key || Deno.env.get('RESEND_API_KEY')!;

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

        const resendResponse = await resendFetchWithRetry('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(resendPayload),
        });

        const resendData = await resendResponse.json();

        if (!resendResponse.ok) {
          throw new Error(`Resend API error: ${resendData.message || resendResponse.statusText}`);
        }

        await supabase.from('email_logs').update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          resend_email_id: resendData.id,
          delivery_status: 'sent',
          pdf_attachment_size: finalPdfBase64 ? finalPdfBase64.length : null,
          metadata: mergedMetadata,
        }).eq('id', logEntry.id);

        return new Response(JSON.stringify({ success: true, message: 'Email sent successfully', log_id: logEntry.id, resend_email_id: resendData.id, processing_time_ms: Date.now() - startTime }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      await supabase.from('email_logs').update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        pdf_attachment_size: finalPdfBase64 ? finalPdfBase64.length : null,
        metadata: mergedMetadata,
      }).eq('id', logEntry.id);

      return new Response(JSON.stringify({ success: true, message: 'Email sent successfully', log_id: logEntry.id, processing_time_ms: Date.now() - startTime }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    } catch (emailError: any) {
      await supabase.from('email_logs').update({ status: 'failed', error_message: emailError.message }).eq('id', logEntry.id);
      return new Response(JSON.stringify({ success: false, error: 'Failed to send email', details: emailError.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: 'Internal server error', details: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});