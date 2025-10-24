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
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const startTime = Date.now();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const apiKey = req.headers.get('x-api-key');
    if (!apiKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing API key',
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: application, error: appError } = await supabase
      .from('applications')
      .select('id, name, api_key')
      .eq('api_key', apiKey)
      .maybeSingle();

    if (appError || !application) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid API key',
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const requestData: any = await req.json();

    const {
      recipient_email,
      template_name,
      data = {},
      subject,
      pdf_base64,
      pdf_filename,
      parent_log_id,
      _pdf_attachment,
      _pdf_info,
      _existing_log_id,
    } = requestData;

    console.log('[send-email] Request params:', {
      has_existing_log_id: !!_existing_log_id,
      existing_log_id: _existing_log_id,
      has_pdf_info: !!_pdf_info,
      pdf_email_log_id: _pdf_info?.pdf_email_log_id,
    });

    let finalPdfBase64 = _pdf_attachment?.content || pdf_base64;
    const finalPdfFilename = _pdf_attachment?.filename || _pdf_info?.pdf_filename || pdf_filename || 'document.pdf';

    if (_pdf_info?.pdf_email_log_id && !finalPdfBase64) {
      console.log('[send-email] No PDF in memory, fetching from pdf_generation_logs using email_log_id:', _pdf_info.pdf_email_log_id);

      const { data: pdfData, error: pdfError } = await supabase
        .from('pdf_generation_logs')
        .select('pdf_base64, filename, size_bytes')
        .eq('email_log_id', _pdf_info.pdf_email_log_id)
        .maybeSingle();

      if (pdfError) {
        console.error('[send-email] Error fetching PDF from database:', pdfError);
      } else if (pdfData && pdfData.pdf_base64) {
        console.log('[send-email] PDF fetched successfully from database:', {
          filename: pdfData.filename,
          size_bytes: pdfData.size_bytes,
        });
        finalPdfBase64 = pdfData.pdf_base64;
      } else {
        console.error('[send-email] PDF not found in pdf_generation_logs for email_log_id:', _pdf_info.pdf_email_log_id);
      }
    }

    if (!template_name || !recipient_email) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required fields',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: credentials, error: credsError } = await supabase
      .from('email_credentials')
      .select('*')
      .eq('application_id', application.id)
      .eq('is_active', true)
      .maybeSingle();

    if (credsError || !credentials) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'SMTP credentials not configured',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: template, error: templateError } = await supabase
      .from('communication_templates')
      .select('*')
      .eq('name', template_name)
      .eq('application_id', application.id)
      .eq('template_type', 'email')
      .eq('is_active', true)
      .maybeSingle();

    if (templateError || !template) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Template not found',
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    let htmlContent = renderTemplate(template.html_content, data);
    let emailSubject = subject || renderTemplate(template.subject || '', data);

    htmlContent = htmlContent.replace(/\r?\n/g, '\r\n');

    const hasPdfAttachment = !!finalPdfBase64;

    let logEntry: any;

    if (_existing_log_id) {
      console.log('[send-email] Using existing log:', _existing_log_id);

      const { data: existingLog, error: fetchError } = await supabase
        .from('email_logs')
        .select('*')
        .eq('id', _existing_log_id)
        .maybeSingle();

      if (fetchError || !existingLog) {
        console.error('[send-email] Could not fetch existing log, creating new one');
      } else {
        logEntry = existingLog;
        console.log('[send-email] Reusing existing log:', {
          id: logEntry.id,
          status: logEntry.status,
          subject: logEntry.subject,
        });
      }
    }

    if (!logEntry) {
      console.log('[send-email] Creating new email log');

      const initialLog: any = {
        application_id: application.id,
        template_id: template.id,
        recipient_email,
        subject: emailSubject,
        status: 'pending',
        communication_type: hasPdfAttachment ? 'email_with_pdf' : 'email',
        pdf_generated: hasPdfAttachment,
        metadata: {
          data,
          action: 'email_queued',
          message: 'Email queued for sending',
          template_name,
          processing_time_ms: Date.now() - startTime,
        },
      };

      const { data: logData, error: logError } = await supabase
        .from('email_logs')
        .insert(initialLog)
        .select()
        .single();

      if (logError) {
        console.error('Error creating email log:', logError);
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Failed to create email log',
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      logEntry = logData;
    }

    if (hasPdfAttachment && _pdf_info?.pdf_email_log_id) {
      console.log('[send-email] Linking PDF log as child of email log:', {
        pdf_log_id: _pdf_info.pdf_email_log_id,
        parent_log_id: logEntry.id,
      });

      await supabase
        .from('email_logs')
        .update({
          parent_log_id: logEntry.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', _pdf_info.pdf_email_log_id);
    }

    const trackingPixelUrl = `${supabaseUrl}/functions/v1/track-email/open?log_id=${logEntry.id}`;
    htmlContent += `<img src="${trackingPixelUrl}" width="1" height="1" style="display:none" />`;

    let linksReplaced = 0;
    htmlContent = htmlContent.replace(
      /href="(https?:\/\/[^"]+)"/gi,
      (match, url) => {
        linksReplaced++;
        const trackingUrl = `${supabaseUrl}/functions/v1/track-email/click?log_id=${logEntry.id}&url=${encodeURIComponent(url)}`;
        console.log(`[send-email] Replacing link ${linksReplaced}:`, { original: url, tracking: trackingUrl });
        return `href="${trackingUrl}"`;
      }
    );

    console.log(`[send-email] Total links replaced with tracking: ${linksReplaced}`);

    try {
      const useTLS = credentials.smtp_port === 465;

      console.log('[send-email] SMTP Configuration:', {
        host: credentials.smtp_host,
        port: credentials.smtp_port,
        user: credentials.smtp_user,
        from: credentials.from_email,
        tls: useTLS,
      });

      const client = new SMTPClient({
        connection: {
          hostname: credentials.smtp_host,
          port: credentials.smtp_port,
          tls: useTLS,
          auth: {
            username: credentials.smtp_user,
            password: credentials.smtp_password,
          },
        },
      });

      const fromAddress = credentials.from_name
        ? `${credentials.from_name} <${credentials.from_email}>`
        : credentials.from_email;

      const emailConfig: any = {
        from: fromAddress,
        to: recipient_email,
        subject: emailSubject,
        html: htmlContent,
      };

      if (finalPdfBase64 && finalPdfFilename) {
        const pdfSizeBytes = finalPdfBase64.length;
        const pdfSizeMB = (pdfSizeBytes / (1024 * 1024)).toFixed(2);

        emailConfig.attachments = [
          {
            filename: finalPdfFilename,
            content: finalPdfBase64,
            encoding: 'base64',
          },
        ];
        console.log('[send-email] PDF attachment configured:', {
          filename: finalPdfFilename,
          size_bytes: pdfSizeBytes,
          size_mb: pdfSizeMB,
        });
      }

      console.log('[send-email] Attempting to send email:', {
        to: recipient_email,
        from: fromAddress,
        subject: emailSubject,
        has_pdf: !!finalPdfBase64,
      });

      const sendResult = await client.send(emailConfig);
      console.log('[send-email] SMTP send result:', sendResult);

      await client.close();
      console.log('[send-email] SMTP connection closed');

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      await supabase
        .from('email_logs')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          pdf_attachment_size: finalPdfBase64 ? finalPdfBase64.length : null,
          metadata: {
            ...(logEntry.metadata || {}),
            action: hasPdfAttachment ? 'email_sent_with_invoice' : 'email_sent',
            message: hasPdfAttachment
              ? 'Email sent successfully with PDF invoice attached'
              : 'Email sent successfully',
            completed_at: new Date().toISOString(),
            processing_time_ms: processingTime,
          },
        })
        .eq('id', logEntry.id);

      console.log('Email sent successfully');

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Email sent successfully',
          log_id: logEntry.id,
          processing_time_ms: processingTime,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    } catch (emailError: any) {
      console.error('Error sending email:', emailError);

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      await supabase
        .from('email_logs')
        .update({
          status: 'failed',
          error_message: emailError.message || 'Unknown email sending error',
          metadata: {
            ...(logEntry.metadata || {}),
            action: 'email_failed',
            message: 'Failed to send email',
            error: emailError.message,
            processing_time_ms: processingTime,
          },
        })
        .eq('id', logEntry.id);

      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to send email',
          details: emailError.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal server error',
        details: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});