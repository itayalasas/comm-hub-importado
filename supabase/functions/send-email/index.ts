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
    } = requestData;

    const finalPdfBase64 = _pdf_attachment?.content || pdf_base64;
    const finalPdfFilename = _pdf_attachment?.filename || _pdf_info?.pdf_filename || pdf_filename || 'document.pdf';

    console.log('=== SEND-EMAIL FUNCTION START ===');
    console.log('Application:', application.name);
    console.log('Template:', template_name);
    console.log('Recipient:', recipient_email);
    console.log('Has parent_log_id:', !!parent_log_id);
    console.log('Parent log ID:', parent_log_id);
    console.log('PDF from _pdf_attachment:', !!_pdf_attachment);
    console.log('Has PDF:', !!finalPdfBase64);

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
      .from('smtp_credentials')
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

    console.log('Rendering email with data:', JSON.stringify(data));

    const hasPdfAttachment = !!finalPdfBase64;

    let logEntry: any;

    if (parent_log_id) {
      console.log('[send-email] Using existing parent_log_id, not creating new log:', parent_log_id);

      const { data: existingLog, error: fetchError } = await supabase
        .from('email_logs')
        .select('*')
        .eq('id', parent_log_id)
        .maybeSingle();

      if (fetchError || !existingLog) {
        console.error('[send-email] Failed to fetch parent log:', fetchError);
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Parent log not found',
          }),
          {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      logEntry = existingLog;
      console.log('[send-email] Updating parent log from queued to pending:', parent_log_id);

      await supabase
        .from('email_logs')
        .update({
          status: 'pending',
          metadata: {
            ...(existingLog.metadata || {}),
            action: 'email_sending',
            message: 'Sending email with invoice',
            pdf_attached: hasPdfAttachment,
          },
        })
        .eq('id', parent_log_id);
    } else {
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

      const { data: newLog, error: logError } = await supabase
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

      logEntry = newLog;
    }

    const trackingPixelUrl = `${supabaseUrl}/functions/v1/track-email/open?log_id=${logEntry.id}`;
    htmlContent += `<img src="${trackingPixelUrl}" width="1" height="1" style="display:none" />`;

    htmlContent = htmlContent.replace(
      /href="(https?:\/\/[^"]+)"/gi,
      (match, url) => {
        const trackingUrl = `${supabaseUrl}/functions/v1/track-email/click?log_id=${logEntry.id}&url=${encodeURIComponent(url)}`;
        return `href="${trackingUrl}"`;
      }
    );

    try {
      const useTLS = credentials.smtp_port === 465;

      console.log('[send-email] SMTP Configuration:', {
        host: credentials.smtp_host,
        port: credentials.smtp_port,
        user: credentials.smtp_user,
        from: credentials.from_email,
        useTLS,
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

      const emailConfig: any = {
        from: credentials.from_email,
        to: recipient_email,
        subject: emailSubject,
        html: htmlContent,
      };

      if (finalPdfBase64 && finalPdfFilename) {
        emailConfig.attachments = [
          {
            filename: finalPdfFilename,
            content: finalPdfBase64,
            encoding: 'base64',
          },
        ];
        console.log('PDF attachment configured:', finalPdfFilename);
      }

      console.log('[send-email] Sending email to:', recipient_email);
      console.log('[send-email] Email subject:', emailSubject);
      console.log('[send-email] Has attachments:', !!emailConfig.attachments);

      const sendResult = await client.send(emailConfig);
      console.log('[send-email] SMTP send result:', JSON.stringify(sendResult));

      await client.close();
      console.log('[send-email] SMTP connection closed');

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      console.log('[send-email] Updating log status to sent:', logEntry.id);
      await supabase
        .from('email_logs')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          pdf_attachment_size: finalPdfBase64 ? finalPdfBase64.length : null,
          metadata: {
            ...(logEntry.metadata || {}),
            action: parent_log_id ? 'email_sent_with_invoice' : 'email_sent',
            message: parent_log_id
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
