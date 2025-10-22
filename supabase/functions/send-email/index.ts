import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';
import { renderTemplate } from '../_shared/template-engine.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey, X-Api-Key',
};

interface SendEmailRequest {
  template_name: string;
  recipient_email: string;
  data: Record<string, any>;
}

const generateQRCode = (data: string): string => {
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(data)}`;
  return qrUrl;
};

const processLogoAndQR = (html: string, data: Record<string, any>, template: any): string => {
  let processedHtml = html;

  if (template.has_logo && template.logo_variable && data[template.logo_variable]) {
    const logoData = data[template.logo_variable];
    const logoSrc = logoData.startsWith('http') ? logoData : `data:image/png;base64,${logoData}`;
    const logoTag = `<img src="${logoSrc}" alt="Logo" style="max-width: 200px; height: auto;" />`;
    const regex = new RegExp(`\\{\\{${template.logo_variable}\\}\\}`, 'g');
    processedHtml = processedHtml.replace(regex, logoTag);
  }

  if (template.has_qr && template.qr_variable && data[template.qr_variable]) {
    const qrData = data[template.qr_variable];
    const qrUrl = generateQRCode(qrData);
    const qrTag = `<img src="${qrUrl}" alt="QR Code" style="width: 200px; height: 200px;" />`;
    const regex = new RegExp(`\\{\\{${template.qr_variable}_qr\\}\\}`, 'g');
    processedHtml = processedHtml.replace(regex, qrTag);
  }

  return processedHtml;
};

const prepareForSMTP = (text: string): string => {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map(line => line.trimEnd())
    .join('\r\n');
};

const addTracking = (html: string, logId: string, supabaseUrl: string): string => {
  let trackedHtml = html;

  const trackingPixel = `<img src="${supabaseUrl}/functions/v1/track-email/open?log_id=${logId}" width="1" height="1" style="display:none;" alt="" />`;
  trackedHtml = trackedHtml.replace('</body>', `${trackingPixel}</body>`);

  trackedHtml = trackedHtml.replace(
    /href="([^"]+)"/g,
    (match, url) => {
      if (url.startsWith('http://') || url.startsWith('https://')) {
        const trackingUrl = `${supabaseUrl}/functions/v1/track-email/click?log_id=${logId}&url=${encodeURIComponent(url)}`;
        return `href="${trackingUrl}"`;
      }
      return match;
    }
  );

  return trackedHtml;
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  const startTime = Date.now();
  let logEntry: any = null;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const apiKey = req.headers.get('x-api-key');
    if (!apiKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing API key in x-api-key header',
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: application, error: appError } = await supabase
      .from('applications')
      .select('id, name')
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

    const requestData: SendEmailRequest = await req.json();
    const { template_name, recipient_email, data } = requestData;

    if (!template_name || !recipient_email) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required fields: template_name, recipient_email',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: template, error: templateError } = await supabase
      .from('communication_templates')
      .select('*')
      .eq('name', template_name)
      .eq('application_id', application.id)
      .eq('is_active', true)
      .maybeSingle();

    if (templateError || !template) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Template not found or inactive',
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    let pdfAttachment = null;

    if (template.pdf_template_id) {
      console.log('Template requires PDF attachment, creating pending communication...');

      const externalRefId = `email_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      const { data: pendingComm, error: pendingError } = await supabase
        .from('pending_communications')
        .insert({
          application_id: application.id,
          template_name,
          recipient_email,
          base_data: data,
          pending_fields: ['pdf_attachment'],
          external_reference_id: externalRefId,
          external_system: 'pdf_generator',
          status: 'waiting_data',
        })
        .select()
        .single();

      if (pendingError) {
        console.error('Error creating pending communication:', pendingError);
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Failed to create pending communication',
            details: pendingError.message,
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      console.log('Pending communication created, calling generate-pdf function...');

      const generatePdfUrl = `${supabaseUrl}/functions/v1/generate-pdf`;

      try {
        const pdfResponse = await fetch(generatePdfUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
          },
          body: JSON.stringify({
            template_id: template.pdf_template_id,
            data,
            pending_communication_id: pendingComm.id,
          }),
        });

        const pdfResult = await pdfResponse.json();

        if (!pdfResult.success) {
          await supabase
            .from('pending_communications')
            .update({
              status: 'failed',
              error_message: pdfResult.error || 'PDF generation failed',
              updated_at: new Date().toISOString(),
            })
            .eq('id', pendingComm.id);

          return new Response(
            JSON.stringify({
              success: false,
              error: 'PDF generation failed',
              details: pdfResult.error,
            }),
            {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        console.log('PDF generated successfully, retrieving attachment data...');

        const { data: updatedPending, error: fetchError } = await supabase
          .from('pending_communications')
          .select('completed_data')
          .eq('id', pendingComm.id)
          .single();

        if (fetchError || !updatedPending?.completed_data?.pdf_attachment) {
          throw new Error('Failed to retrieve PDF attachment data');
        }

        pdfAttachment = updatedPending.completed_data.pdf_attachment;
        console.log('PDF attachment retrieved:', pdfAttachment.filename);
      } catch (pdfError: any) {
        console.error('Error calling generate-pdf:', pdfError);

        await supabase
          .from('pending_communications')
          .update({
            status: 'failed',
            error_message: pdfError.message,
            updated_at: new Date().toISOString(),
          })
          .eq('id', pendingComm.id);

        return new Response(
          JSON.stringify({
            success: false,
            error: 'Error generating PDF',
            details: pdfError.message,
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    const { data: credentials, error: credError } = await supabase
      .from('email_credentials')
      .select('*')
      .eq('application_id', application.id)
      .eq('is_active', true)
      .maybeSingle();

    if (credError || !credentials) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Email credentials not configured',
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    let htmlContent = renderTemplate(template.html_content, data);
    let subject = renderTemplate(template.subject || '', data);

    console.log('Variables received:', JSON.stringify(data));
    console.log('Template rendered with advanced template engine');

    htmlContent = processLogoAndQR(htmlContent, data, template);
    subject = prepareForSMTP(subject);

    const emailLog = {
      application_id: application.id,
      template_id: template.id,
      recipient_email,
      subject,
      status: 'pending',
      metadata: {
        data,
        has_attachment: template.has_attachment,
        has_logo: template.has_logo,
        has_qr: template.has_qr,
        request_headers: {
          'user-agent': req.headers.get('user-agent'),
          'x-forwarded-for': req.headers.get('x-forwarded-for'),
        },
      },
    };

    const { data: logData, error: logError } = await supabase
      .from('email_logs')
      .insert(emailLog)
      .select()
      .single();

    if (logError) {
      console.error('Error creating log entry:', logError);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to create log entry',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    logEntry = logData;

    htmlContent = addTracking(htmlContent, logEntry.id, supabaseUrl);
    htmlContent = prepareForSMTP(htmlContent);

    try {
      const useTLS = credentials.smtp_port === 465;

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

      const emailMessage: any = {
        from: credentials.from_name
          ? `${credentials.from_name} <${credentials.from_email}>`
          : credentials.from_email,
        to: recipient_email,
        subject: subject,
        content: 'text/html',
        html: htmlContent,
      };

      if (pdfAttachment) {
        emailMessage.attachments = [pdfAttachment];
        console.log('Adding PDF attachment:', pdfAttachment.filename);
      }

      await client.send(emailMessage);

      await client.close();

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      await supabase
        .from('email_logs')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          metadata: {
            ...emailLog.metadata,
            processing_time_ms: processingTime,
            smtp_config: {
              host: credentials.smtp_host,
              port: credentials.smtp_port,
              tls: useTLS,
            },
          },
        })
        .eq('id', logEntry.id);

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Email sent successfully',
          log_id: logEntry.id,
          features: {
            has_attachment: template.has_attachment || !!pdfAttachment,
            has_logo: template.has_logo,
            has_qr: template.has_qr,
            has_pdf: !!pdfAttachment,
          },
          pdf_attachment: pdfAttachment ? {
            filename: pdfAttachment.filename,
            size_bytes: pdfAttachment.content.length,
          } : null,
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
          error_message: emailError.message || String(emailError),
          metadata: {
            ...emailLog.metadata,
            processing_time_ms: processingTime,
            error_details: {
              name: emailError.name,
              message: emailError.message,
              stack: emailError.stack,
            },
          },
        })
        .eq('id', logEntry.id);

      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to send email',
          details: emailError.message || String(emailError),
          log_id: logEntry.id,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
  } catch (error: any) {
    console.error('Error processing request:', error);

    if (logEntry) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      await supabase
        .from('email_logs')
        .update({
          status: 'failed',
          error_message: error.message || String(error),
        })
        .eq('id', logEntry.id);
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal server error',
        details: error.message || String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});