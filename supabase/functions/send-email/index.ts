import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Api-Key",
};

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

    console.log('[send-email] Request:', { has_existing_log_id: !!_existing_log_id, has_pdf_info: !!_pdf_info, pdf_email_log_id: _pdf_info?.pdf_email_log_id });

    let finalPdfBase64 = _pdf_attachment?.content || pdf_base64;
    const finalPdfFilename = _pdf_attachment?.filename || _pdf_info?.pdf_filename || pdf_filename || 'document.pdf';
    let pdfPublicUrl = null;
    let pdfSizeBytes = 0;
    const MAX_PDF_ATTACHMENT_SIZE = 1024 * 1024;

    if (_pdf_info?.pdf_email_log_id && !finalPdfBase64) {
      console.log('[send-email] Fetching PDF from database, email_log_id:', _pdf_info.pdf_email_log_id);
      const { data: pdfData } = await supabase.from('pdf_generation_logs').select('pdf_base64, filename, size_bytes, public_url').eq('email_log_id', _pdf_info.pdf_email_log_id).maybeSingle();
      if (pdfData?.pdf_base64) {
        console.log('[send-email] PDF fetched from DB, size:', pdfData.size_bytes);
        pdfSizeBytes = pdfData.size_bytes || pdfData.pdf_base64.length;
        pdfPublicUrl = pdfData.public_url;

        if (pdfSizeBytes > MAX_PDF_ATTACHMENT_SIZE) {
          console.log('[send-email] PDF too large to attach (' + pdfSizeBytes + ' bytes), will send link only');
          finalPdfBase64 = null;
        } else {
          finalPdfBase64 = pdfData.pdf_base64;
        }
      } else {
        console.log('[send-email] PDF not found in database');
      }
    }

    if (finalPdfBase64) {
      pdfSizeBytes = finalPdfBase64.length;
      if (pdfSizeBytes > MAX_PDF_ATTACHMENT_SIZE) {
        console.log('[send-email] PDF too large to attach (' + pdfSizeBytes + ' bytes), will send link only');
        finalPdfBase64 = null;
      }
    }

    if (!template_name || !recipient_email) {
      return new Response(JSON.stringify({ success: false, error: 'Missing required fields' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: credentials } = await supabase.from('email_credentials').select('*').eq('application_id', application.id).eq('is_active', true).maybeSingle();
    if (!credentials) {
      return new Response(JSON.stringify({ success: false, error: 'SMTP credentials not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: template } = await supabase.from('communication_templates').select('*').eq('name', template_name).eq('application_id', application.id).eq('template_type', 'email').eq('is_active', true).maybeSingle();
    if (!template) {
      return new Response(JSON.stringify({ success: false, error: 'Template not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let htmlContent = renderTemplate(template.html_content, data);
    let emailSubject = subject || renderTemplate(template.subject || '', data);

    emailSubject = emailSubject.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();

    const hasPdfAttachment = !!finalPdfBase64;
    let logEntry: any;

    if (_existing_log_id) {
      console.log('[send-email] Using existing log:', _existing_log_id);
      const { data: existingLog } = await supabase.from('email_logs').select('*').eq('id', _existing_log_id).maybeSingle();
      if (existingLog) {
        logEntry = existingLog;
        console.log('[send-email] Reusing existing log');
      }
    }

    if (!logEntry) {
      console.log('[send-email] Creating new log');
      const { data: logData } = await supabase.from('email_logs').insert({
        application_id: application.id,
        template_id: template.id,
        recipient_email,
        subject: emailSubject,
        status: 'pending',
        communication_type: hasPdfAttachment ? 'email_with_pdf' : 'email',
        pdf_generated: hasPdfAttachment,
        metadata: { data, action: 'email_queued', template_name },
      }).select().single();
      logEntry = logData;
    }

    if (hasPdfAttachment && _pdf_info?.pdf_email_log_id) {
      console.log('[send-email] Linking PDF log as child');
      await supabase.from('email_logs').update({ parent_log_id: logEntry.id }).eq('id', _pdf_info.pdf_email_log_id);
    }

    if (pdfPublicUrl) {
      console.log('[send-email] Adding PDF download link to email');
      const downloadMessage = hasPdfAttachment ? 'Tu factura esta adjunta a este correo' : 'Descarga tu factura';
      const downloadSubtext = hasPdfAttachment ? 'Tambien puedes descargarla o verla en linea haciendo clic en el boton:' : 'Haz clic en el boton para ver o descargar tu factura:';
      const downloadSection = '<div style="margin: 30px 0; padding: 20px; background-color: #f8f9fa; border-radius: 8px; text-align: center; font-family: Arial, sans-serif;"><p style="margin: 0 0 15px 0; color: #333; font-size: 16px;"><strong>' + downloadMessage + '</strong></p><p style="margin: 0 0 15px 0; color: #666; font-size: 14px;">' + downloadSubtext + '</p><a href="' + pdfPublicUrl + '" style="display: inline-block; padding: 12px 30px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 14px;">Ver/Descargar Factura</a><p style="margin: 15px 0 0 0; color: #999; font-size: 12px;">Este enlace estara disponible por 90 dias</p></div>';
      htmlContent += downloadSection;
    }

    const trackingPixelUrl = supabaseUrl + '/functions/v1/track-email/open?log_id=' + logEntry.id;
    htmlContent += '<img src="' + trackingPixelUrl + '" width="1" height="1" style="display:none" />';

    htmlContent = htmlContent.replace(/\r?\n/g, '\r\n');
    htmlContent = htmlContent.replace(/\r\r\n/g, '\r\n');

    try {
      const useTLS = credentials.smtp_port === 465;
      console.log('[send-email] SMTP config:', { host: credentials.smtp_host, port: credentials.smtp_port, user: credentials.smtp_user, tls: useTLS });

      const connectionConfig: any = {
        hostname: credentials.smtp_host,
        port: credentials.smtp_port,
        auth: { username: credentials.smtp_user, password: credentials.smtp_password },
      };
      if (useTLS) connectionConfig.tls = true;

      const client = new SMTPClient({ connection: connectionConfig });

      const actualFromEmail = credentials.from_email || credentials.smtp_user;
      const fromAddress = credentials.from_name ? credentials.from_name + ' <' + actualFromEmail + '>' : actualFromEmail;
      console.log('[send-email] From address:', fromAddress);

      const emailConfig: any = {
        from: fromAddress,
        to: recipient_email,
        subject: emailSubject,
        html: htmlContent,
      };

      if (finalPdfBase64 && finalPdfFilename) {
        emailConfig.attachments = [{ filename: finalPdfFilename, content: finalPdfBase64, encoding: 'base64' }];
        console.log('[send-email] PDF attached:', { filename: finalPdfFilename, size_bytes: pdfSizeBytes });
      } else if (pdfPublicUrl && !finalPdfBase64) {
        console.log('[send-email] Sending email with download link only (no attachment)');
      }

      console.log('[send-email] Sending email...');
      await client.send(emailConfig);
      await client.close();
      console.log('[send-email] Email sent successfully');

      await supabase.from('email_logs').update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        pdf_attachment_size: finalPdfBase64 ? finalPdfBase64.length : null,
        metadata: { action: hasPdfAttachment ? 'email_sent_with_invoice' : 'email_sent', completed_at: new Date().toISOString(), processing_time_ms: Date.now() - startTime },
      }).eq('id', logEntry.id);

      return new Response(JSON.stringify({ success: true, message: 'Email sent successfully', log_id: logEntry.id, processing_time_ms: Date.now() - startTime }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    } catch (emailError: any) {
      console.error('[send-email] Error:', emailError);
      await supabase.from('email_logs').update({ status: 'failed', error_message: emailError.message }).eq('id', logEntry.id);
      return new Response(JSON.stringify({ success: false, error: 'Failed to send email', details: emailError.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  } catch (error: any) {
    console.error('[send-email] Unexpected error:', error);
    return new Response(JSON.stringify({ success: false, error: 'Internal server error', details: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});