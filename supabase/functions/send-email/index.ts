import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';
import { renderTemplate } from './template-engine.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey, X-Api-Key',
};

interface SendEmailRequest {
  template_name: string;
  recipient_email: string;
  data: Record<string, any>;
  order_id?: string;
  wait_for_invoice?: boolean;
  _skip_pdf_generation?: boolean;
  _pdf_attachment?: {
    filename: string;
    content: string;
    encoding: string;
  };
  _pdf_info?: {
    pdf_log_id?: string;
    pdf_template_id?: string;
    pdf_filename?: string;
    pdf_size_bytes?: number;
  };
  _pending_communication_id?: string;
  _existing_log_id?: string;
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
  let application: any = null;
  let supabase: any = null;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    supabase = createClient(supabaseUrl, supabaseKey);

    const apiKey = req.headers.get('x-api-key');

    let requestData: any = null;
    let requestBody = '';

    try {
      requestBody = await req.text();
      requestData = JSON.parse(requestBody);
    } catch (parseError: any) {
      console.error('JSON parse error:', parseError);

      if (apiKey) {
        const { data: app } = await supabase
          .from('applications')
          .select('id')
          .eq('api_key', apiKey)
          .maybeSingle();

        if (app) {
          await supabase.from('email_logs').insert({
            application_id: app.id,
            template_id: null,
            recipient_email: 'unknown@error.com',
            subject: 'Error: Invalid JSON',
            status: 'failed',
            error_message: `JSON parse error: ${parseError.message}`,
            metadata: {
              raw_body: requestBody.substring(0, 500),
              parse_error: parseError.message,
            },
          });
        }
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid JSON',
          details: parseError.message,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

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

    const { data: app, error: appError } = await supabase
      .from('applications')
      .select('id, name')
      .eq('api_key', apiKey)
      .maybeSingle();

    if (appError || !app) {
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

    application = app;
    const { template_name, recipient_email, data, order_id, wait_for_invoice, _skip_pdf_generation, _pdf_attachment, _pdf_info, _pending_communication_id, _existing_log_id } = requestData;

    if (!template_name || !recipient_email) {
      await supabase.from('email_logs').insert({
        application_id: application.id,
        template_id: null,
        recipient_email: recipient_email || 'unknown@error.com',
        subject: 'Error: Missing required fields',
        status: 'failed',
        error_message: 'Missing required fields: template_name, recipient_email',
        metadata: { request_data: requestData },
      });

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
      await supabase.from('email_logs').insert({
        application_id: application.id,
        template_id: null,
        recipient_email: recipient_email,
        subject: `Error: Template '${template_name}' not found`,
        status: 'failed',
        error_message: 'Template not found or inactive',
        metadata: {
          template_name,
          request_data: requestData,
        },
      });

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

    if (_skip_pdf_generation && _pdf_attachment) {
      console.log('Using pre-generated PDF attachment from pending communication...');
      pdfAttachment = _pdf_attachment;
    } else if (template.pdf_template_id) {
      if (wait_for_invoice && order_id) {
        console.log(`Creating pending communication for order ${order_id}, waiting for invoice...`);

        const externalRefId = order_id || `order_${Date.now()}_${Math.random().toString(36).substring(7)}`;

        const { data: pendingComm, error: pendingError } = await supabase
          .from('pending_communications')
          .insert({
            application_id: application.id,
            template_name,
            recipient_email,
            base_data: data,
            pending_fields: ['invoice_pdf'],
            external_reference_id: externalRefId,
            external_system: 'billing_system',
            order_id: order_id,
            status: 'waiting_data',
            communication_type: 'pdf',
            pdf_template_id: template.pdf_template_id,
          })
          .select()
          .single();

        if (pendingError) {
          console.error('Error creating pending communication:', pendingError);

          await supabase.from('email_logs').insert({
            application_id: application.id,
            template_id: template.id,
            recipient_email,
            subject: renderTemplate(template.subject || '', data),
            status: 'failed',
            error_message: `Failed to create pending communication: ${pendingError.message}`,
            communication_type: 'email_with_pdf',
            pdf_generated: false,
            metadata: {
              order_id,
              wait_for_invoice: true,
              data,
              action: 'pending_communication_creation_failed',
              error_details: {
                code: pendingError.code,
                message: pendingError.message,
                details: pendingError.details,
                hint: pendingError.hint,
              },
            },
          });

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

        console.log(`Pending communication created for order ${order_id}. Waiting for invoice...`);

        const { data: initialLog } = await supabase.from('email_logs').insert({
          application_id: application.id,
          template_id: template.id,
          recipient_email,
          subject: renderTemplate(template.subject || '', data),
          status: 'queued',
          communication_type: 'email_with_pdf',
          pdf_generated: false,
          metadata: {
            order_id,
            pending_communication_id: pendingComm.id,
            wait_for_invoice: true,
            data,
            action: 'email_queued',
            message: 'Email queued, waiting for invoice PDF',
          },
        }).select().single();

        await supabase.from('pending_communications').update({
          completed_data: { initial_log_id: initialLog.id }
        }).eq('id', pendingComm.id);

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Email queued, waiting for invoice',
            pending_communication_id: pendingComm.id,
            order_id,
            status: 'waiting_invoice',
            instructions: `Call /generate-pdf with order_id: "${order_id}" when invoice is ready`,
          }),
          {
            status: 202,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      console.log('Template requires PDF attachment, creating pending communication...');

      const externalRefId = order_id || `email_${Date.now()}_${Math.random().toString(36).substring(7)}`;

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
          order_id: order_id || null,
          status: 'waiting_data',
          communication_type: 'pdf',
          pdf_template_id: template.pdf_template_id,
        })
        .select()
        .single();

      if (pendingError) {
        console.error('Error creating pending communication:', pendingError);

        await supabase.from('email_logs').insert({
          application_id: application.id,
          template_id: template.id,
          recipient_email,
          subject: renderTemplate(template.subject || '', data),
          status: 'failed',
          error_message: `Failed to create pending communication: ${pendingError.message}`,
          communication_type: 'email_with_pdf',
          pdf_generated: false,
          metadata: {
            order_id: order_id || null,
            data,
            action: 'pending_communication_creation_failed',
            error_details: {
              code: pendingError.code,
              message: pendingError.message,
              details: pendingError.details,
              hint: pendingError.hint,
            },
          },
        });

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
            'Authorization': `Bearer ${supabaseKey}`,
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
          console.error('PDF generation failed:', pdfResult);

          await supabase
            .from('pending_communications')
            .update({
              status: 'failed',
              error_message: pdfResult.error || 'PDF generation failed',
              updated_at: new Date().toISOString(),
            })
            .eq('id', pendingComm.id);

          await supabase.from('email_logs').insert({
            application_id: application.id,
            template_id: template.id,
            recipient_email: recipient_email,
            subject: `Error: PDF generation failed for ${template_name}`,
            status: 'failed',
            error_message: `PDF generation failed: ${pdfResult.error || 'Unknown error'}`,
            communication_type: 'email_with_pdf',
            metadata: {
              template_name,
              request_data: data,
              pdf_error: pdfResult,
              endpoint: 'send-email',
            },
          });

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

        await supabase.from('email_logs').insert({
          application_id: application.id,
          template_id: template.id,
          recipient_email: recipient_email,
          subject: `Error: Exception generating PDF for ${template_name}`,
          status: 'failed',
          error_message: `Exception generating PDF: ${pdfError.message}`,
          communication_type: 'email_with_pdf',
          metadata: {
            template_name,
            request_data: data,
            pdf_error: {
              message: pdfError.message,
              stack: pdfError.stack,
              name: pdfError.name,
            },
            endpoint: 'send-email',
          },
        });

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

    const hasPdfAttachment = !!pdfAttachment;
    const communicationType = hasPdfAttachment ? 'email_with_pdf' : 'email';

    if (_existing_log_id) {
      console.log('[send-email] Reusing existing log:', _existing_log_id);
      const { data: existingLog, error: fetchLogError } = await supabase
        .from('email_logs')
        .select('*')
        .eq('id', _existing_log_id)
        .single();

      if (fetchLogError || !existingLog) {
        console.error('Error fetching existing log:', fetchLogError);
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Failed to fetch existing log entry',
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      logEntry = existingLog;
      console.log('[send-email] Using existing log entry with ID:', logEntry.id);
    } else {
      console.log('[send-email] Creating new log entry');
      const emailLog: any = {
        application_id: application.id,
        template_id: template.id,
        recipient_email,
        subject,
        status: 'pending',
        communication_type: communicationType,
        pdf_generated: hasPdfAttachment,
        metadata: {
          data,
          has_attachment: template.has_attachment,
          has_logo: template.has_logo,
          has_qr: template.has_qr,
          pdf_attachment: hasPdfAttachment,
          pdf_info: _pdf_info,
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
      console.log('[send-email] New log entry created with ID:', logEntry.id);
    }

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

      const pdfSize = pdfAttachment ? pdfAttachment.content.length : null;

      await supabase
        .from('email_logs')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          pdf_attachment_size: pdfSize,
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

      if (pdfAttachment && _pdf_info && _pdf_info.pdf_filename) {
        console.log('[send-email] Creating PDF generation log as child of email log...');
        console.log('[send-email] PDF info:', JSON.stringify(_pdf_info));
        console.log('[send-email] Parent log ID:', logEntry.id);

        const { data: pdfChildLog, error: pdfLogError } = await supabase
          .from('email_logs')
          .insert({
            application_id: application.id,
            template_id: _pdf_info.pdf_template_id || template.pdf_template_id,
            recipient_email: 'pdf_generation@system.local',
            subject: `PDF Generated: ${_pdf_info.pdf_filename || 'document.pdf'}`,
            status: 'sent',
            sent_at: new Date().toISOString(),
            communication_type: 'pdf_generation',
            pdf_generated: true,
            parent_log_id: logEntry.id,
            metadata: {
              endpoint: 'send-email',
              filename: _pdf_info.pdf_filename,
              size_bytes: _pdf_info.pdf_size_bytes,
              order_id: order_id || null,
              pending_communication_id: _pending_communication_id,
              action: 'pdf_generated',
              template_name: template.name,
              pdf_generation_log_id: _pdf_info.pdf_log_id,
            },
          })
          .select()
          .single();

        if (pdfLogError) {
          console.error('[send-email] Error creating PDF child log:', pdfLogError);
        } else {
          console.log('[send-email] PDF generation log created as child successfully with ID:', pdfChildLog.id);
        }
      } else {
        console.log('[send-email] Skipping PDF child log creation. pdfAttachment:', !!pdfAttachment, '_pdf_info:', !!_pdf_info, 'pdf_filename:', _pdf_info?.pdf_filename);
      }

      if (pdfAttachment && template.pdf_template_id) {
        await supabase
          .from('pending_communications')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            sent_log_id: logEntry.id,
            pdf_generated: true,
          })
          .eq('template_name', template_name)
          .eq('recipient_email', recipient_email)
          .eq('status', 'data_received');
      }

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