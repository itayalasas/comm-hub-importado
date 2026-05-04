import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { renderTemplate } from './_shared/template-engine.ts';
import { renderHtmlToPdfBase64 } from './_shared/pdf-renderer.ts';

/*
  send-email-with-pdf
  ───────────────────
  Generates a PDF from a template and sends it as an email attachment in a
  single API call. No queuing, no intermediate state — generate + send happens
  atomically within this function.

  Payload shape:
  {
    "recipient_email": "user@example.com",   // REQUIRED
    "email": {                               // REQUIRED – email section
      "template_name": "my_email_template",  // REQUIRED – email HTML template
      "subject": "Optional subject override",
      "data": { ...any fields the template needs }
    },
    "attachment": {                          // REQUIRED – PDF section
      "pdf_template_name": "invoice_pdf",    // REQUIRED – PDF HTML template
      "filename": "invoice-{{order_id}}.pdf",// OPTIONAL – filename pattern
      "data": { ...any fields the PDF template needs }
    },
    "order_id": "ORD-123"                   // OPTIONAL – for audit / dedup
  }
*/

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Api-Key",
};

const MAX_PDF_ATTACHMENT_SIZE = 1024 * 1024; // 1 MB

async function generateQrCodeFromText(text: string): Promise<string> {
  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(text)}`;
  const response = await fetch(qrApiUrl);
  if (!response.ok) throw new Error(`QR API failed: ${response.status}`);
  const arrayBuffer = await response.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return `data:image/png;base64,${btoa(binary)}`;
}

async function processQrCodes(data: Record<string, any>): Promise<Record<string, any>> {
  const QR_FIELDS = ['qr_code', 'qr_url', 'qr_image', 'qr_text', 'qr_data'];
  const processed = { ...data };

  for (const [key, value] of Object.entries(processed)) {
    if (value === null || value === undefined) continue;

    if (typeof value === 'object' && !Array.isArray(value)) {
      processed[key] = await processQrCodes(value);
    } else if (Array.isArray(value)) {
      processed[key] = await Promise.all(
        value.map((item) => typeof item === 'object' && item !== null ? processQrCodes(item) : item)
      );
    } else if (typeof value === 'string' && QR_FIELDS.includes(key)) {
      if (value.startsWith('data:image')) {
        processed[`${key}_qr`] = value;
      } else {
        processed[`${key}_qr`] = await generateQrCodeFromText(value);
      }
    }
  }
  return processed;
}

function generateFilename(pattern: string, data: Record<string, any>): string {
  return renderTemplate(pattern || 'document.pdf', data);
}

function wrapLinksForTracking(html: string, logId: string, trackingBaseUrl: string): string {
  return html.replace(
    /(<a\s[^>]*href=")((https?:\/\/)[^"]+)(")/gi,
    (match, prefix, url, _scheme, suffix) => {
      if (url.includes(trackingBaseUrl)) return match;
      const trackingUrl = `${trackingBaseUrl}/functions/v1/track-email/click?log_id=${logId}&url=${encodeURIComponent(url)}`;
      return `${prefix}${trackingUrl}${suffix}`;
    },
  );
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ── Auth ──────────────────────────────────────────────────────────────────
    const apiKey = req.headers.get('x-api-key');
    if (!apiKey) {
      return new Response(JSON.stringify({ success: false, error: 'Missing API key' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: application } = await supabase
      .from('applications')
      .select('id, name')
      .eq('api_key', apiKey)
      .maybeSingle();

    if (!application) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid API key' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Parse payload ─────────────────────────────────────────────────────────
    const body: any = await req.json();
    const { recipient_email, email: emailSection, attachment: attachmentSection, order_id } = body;

    if (!recipient_email) {
      return new Response(JSON.stringify({ success: false, error: 'recipient_email is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!emailSection?.template_name) {
      return new Response(JSON.stringify({ success: false, error: 'email.template_name is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!attachmentSection?.pdf_template_name) {
      return new Response(JSON.stringify({ success: false, error: 'attachment.pdf_template_name is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const emailData: Record<string, any> = emailSection.data ?? {};
    const pdfData: Record<string, any> = attachmentSection.data ?? {};

    console.log('[send-email-with-pdf] recipient:', recipient_email);
    console.log('[send-email-with-pdf] email template:', emailSection.template_name);
    console.log('[send-email-with-pdf] pdf template:', attachmentSection.pdf_template_name);

    // ── Load email credentials ─────────────────────────────────────────────────
    const { data: credentials } = await supabase
      .from('email_credentials')
      .select('*')
      .eq('application_id', application.id)
      .eq('is_active', true)
      .maybeSingle();

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
      console.log('[send-email-with-pdf] Using platform default credentials');
    }

    const providerType: string = effectiveCredentials.provider_type || 'resend';

    // ── Fetch email template ──────────────────────────────────────────────────
    const { data: emailTemplate } = await supabase
      .from('communication_templates')
      .select('*')
      .eq('name', emailSection.template_name)
      .eq('application_id', application.id)
      .eq('template_type', 'email')
      .eq('is_active', true)
      .maybeSingle();

    if (!emailTemplate) {
      return new Response(JSON.stringify({ success: false, error: `Email template '${emailSection.template_name}' not found` }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Fetch PDF template ────────────────────────────────────────────────────
    const { data: pdfTemplate } = await supabase
      .from('communication_templates')
      .select('*')
      .eq('name', attachmentSection.pdf_template_name)
      .eq('application_id', application.id)
      .eq('template_type', 'pdf')
      .eq('is_active', true)
      .maybeSingle();

    if (!pdfTemplate) {
      return new Response(JSON.stringify({ success: false, error: `PDF template '${attachmentSection.pdf_template_name}' not found` }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Generate PDF ──────────────────────────────────────────────────────────
    console.log('[send-email-with-pdf] Generating PDF...');
    const processedPdfData = await processQrCodes(pdfData);
    const mergedPdfData = { ...processedPdfData, data: processedPdfData };
    const renderedPdfHtml = renderTemplate(pdfTemplate.html_content, mergedPdfData);

    const filenamePattern = attachmentSection.filename || pdfTemplate.pdf_filename_pattern || 'document.pdf';
    const pdfFilename = generateFilename(filenamePattern, mergedPdfData);

    const { base64: pdfBase64, sizeBytes: pdfSizeBytes } = await renderHtmlToPdfBase64(renderedPdfHtml, { title: pdfFilename });
    console.log('[send-email-with-pdf] PDF generated, size:', pdfSizeBytes, 'bytes');

    // ── Store PDF generation log ──────────────────────────────────────────────
    const { data: pdfLog } = await supabase
      .from('pdf_generation_logs')
      .insert({
        application_id: application.id,
        pdf_template_id: pdfTemplate.id,
        data: pdfData,
        pdf_base64: pdfBase64,
        filename: pdfFilename,
        size_bytes: pdfSizeBytes,
      })
      .select('id')
      .maybeSingle();

    // ── Build public PDF link ─────────────────────────────────────────────────
    let pdfPublicUrl: string | null = null;
    if (pdfLog?.id) {
      const accessToken = `${crypto.randomUUID()}-${Date.now()}`;
      const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
      await supabase.from('public_pdf_links').insert({
        application_id: application.id,
        pdf_generation_log_id: pdfLog.id,
        order_id: order_id ?? null,
        access_token: accessToken,
        filename: pdfFilename,
        expires_at: expiresAt,
        is_active: true,
      });
      pdfPublicUrl = `${supabaseUrl}/functions/v1/view-pdf?token=${accessToken}`;
    }

    // ── Render email HTML ─────────────────────────────────────────────────────
    const mergedEmailData = { ...emailData, data: emailData };
    let htmlContent = renderTemplate(emailTemplate.html_content, mergedEmailData);
    const emailSubject = emailSection.subject || renderTemplate(emailTemplate.subject || '', mergedEmailData) || `Email from ${application.name}`;

    // Attach PDF download link if PDF is too large for inline attachment
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

    // ── Create email log ──────────────────────────────────────────────────────
    const { data: emailLog } = await supabase
      .from('email_logs')
      .insert({
        application_id: application.id,
        template_id: emailTemplate.id,
        recipient_email,
        subject: emailSubject,
        status: 'pending',
        communication_type: 'email_with_pdf',
        pdf_generated: true,
        metadata: {
          action: 'send_email_with_pdf',
          order_id: order_id ?? null,
          pdf_template_name: attachmentSection.pdf_template_name,
          email_template_name: emailSection.template_name,
          pdf_filename: pdfFilename,
          pdf_size_bytes: pdfSizeBytes,
          pdf_attached_inline: attachPdfInline,
          pdf_log_id: pdfLog?.id ?? null,
        },
      })
      .select('id')
      .maybeSingle();

    // Update pdf_generation_log with email_log_id
    if (pdfLog?.id && emailLog?.id) {
      await supabase
        .from('pdf_generation_logs')
        .update({ email_log_id: emailLog.id })
        .eq('id', pdfLog.id);
    }

    // Wrap external links for click tracking
    if (emailLog?.id) {
      htmlContent = wrapLinksForTracking(htmlContent, emailLog.id, supabaseUrl);
    }

    // Add tracking pixel
    const trackingPixelUrl = `${supabaseUrl}/functions/v1/track-email/open?log_id=${emailLog?.id}`;
    htmlContent += `<img src="${trackingPixelUrl}" width="1" height="1" style="display:none" />`;

    // ── Send email ────────────────────────────────────────────────────────────
    const fromEmail = effectiveCredentials.from_email;
    const fromName = effectiveCredentials.from_name || application.name || 'SendCraft';

    console.log('[send-email-with-pdf] Sending via', providerType, 'from', fromEmail);

    let resendEmailId: string | null = null;

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
        from: `"${fromName}" <${fromEmail}>`,
        to: recipient_email,
        subject: emailSubject,
        content: 'text/html; charset=utf-8',
        html: htmlContent,
      };

      if (attachPdfInline) {
        emailConfig.attachments = [{ filename: pdfFilename, content: pdfBase64, encoding: 'base64' }];
      }

      await client.send(emailConfig);
      await client.close();
      console.log('[send-email-with-pdf] Sent via SMTP');
    } else {
      const resendApiKey = effectiveCredentials.resend_api_key || Deno.env.get('RESEND_API_KEY')!;

      const resendPayload: any = {
        from: fromName ? `${fromName} <${fromEmail}>` : fromEmail,
        to: [recipient_email],
        subject: emailSubject,
        html: htmlContent,
      };

      if (attachPdfInline) {
        resendPayload.attachments = [{ filename: pdfFilename, content: pdfBase64 }];
      }

      const resendResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(resendPayload),
      });

      const resendBody: any = await resendResponse.json();

      if (!resendResponse.ok) {
        throw new Error(`Resend API error: ${resendBody.message || JSON.stringify(resendBody)}`);
      }

      resendEmailId = resendBody.id;
      console.log('[send-email-with-pdf] Sent via Resend, id:', resendEmailId);
    }

    // ── Update email log to sent ──────────────────────────────────────────────
    if (emailLog?.id) {
      await supabase
        .from('email_logs')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          resend_email_id: resendEmailId,
        })
        .eq('id', emailLog.id);
    }

    const processingTime = Date.now() - startTime;

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Email with PDF attachment sent successfully',
        log_id: emailLog?.id ?? null,
        pdf_log_id: pdfLog?.id ?? null,
        pdf_filename: pdfFilename,
        pdf_size_bytes: pdfSizeBytes,
        pdf_attached_inline: attachPdfInline,
        pdf_public_url: pdfPublicUrl,
        resend_email_id: resendEmailId,
        processing_time_ms: processingTime,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );

  } catch (error: any) {
    console.error('[send-email-with-pdf] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Failed to send email', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
