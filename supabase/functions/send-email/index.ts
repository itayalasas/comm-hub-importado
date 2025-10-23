import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { renderTemplate } from '../_shared/template-engine.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface EmailRequest {
  recipient_email: string;
  template_name: string;
  data?: Record<string, any>;
  application_id?: string;
  subject?: string;
  pdf_base64?: string;
  pdf_filename?: string;
  wait_for_invoice?: boolean;
  order_id?: string | null;
  _skip_pdf_generation?: boolean;
  _pdf_attachment?: { filename: string; content: string };
  _pdf_info?: {
    pdf_template_id?: string;
    pdf_filename?: string;
    pdf_size_bytes?: number;
    pdf_log_id?: string;
    pdf_generation_log_id?: string;
  };
  _pending_communication_id?: string;
  _existing_log_id?: string;
}

interface PdfInfo {
  pdf_template_id?: string;
  pdf_filename: string;
  pdf_size_bytes: number;
  pdf_log_id?: string;
  pdf_generation_log_id?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  const startTime = Date.now();

  try {
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
      .select('*')
      .eq('api_key', apiKey)
      .eq('is_active', true)
      .maybeSingle();

    if (appError || !application) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid or inactive API key',
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const requestData: EmailRequest = await req.json();

    const {
      recipient_email,
      template_name,
      data = {},
      subject,
      pdf_base64,
      pdf_filename,
      wait_for_invoice = false,
      order_id = null,
      _skip_pdf_generation = false,
      _pdf_attachment = null,
      _pdf_info = null,
      _pending_communication_id = null,
      _existing_log_id = null,
    } = requestData;

    console.log('=== SEND-EMAIL FUNCTION START ===');
    console.log('Application:', application.name, '(', application.id, ')');
    console.log('Template:', template_name);
    console.log('Recipient:', recipient_email);
    console.log('Order ID:', order_id);
    console.log('Wait for invoice:', wait_for_invoice);
    console.log('Skip PDF generation:', _skip_pdf_generation);
    console.log('Has PDF attachment:', !!_pdf_attachment);
    console.log('Has PDF info:', !!_pdf_info);
    console.log('Pending communication ID:', _pending_communication_id);
    console.log('Existing log ID:', _existing_log_id);
    console.log('Data keys:', Object.keys(data).join(', '));

    let logEntry: any = null;

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
            communication_type: 'order_invoice',
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

        await supabase.from('email_logs').insert({
          application_id: application.id,
          template_id: template.id,
          recipient_email,
          subject: `Pending: ${renderTemplate(template.subject || '', data)}`,
          status: 'pending',
          communication_type: 'email_with_pdf',
          pdf_generated: false,
          metadata: {
            order_id: order_id,
            pending_communication_id: pendingComm.id,
            data,
            action: 'waiting_for_invoice_pdf',
          },
        });

        return new Response(
          JSON.stringify({
            success: true,
            status: 'pending',
            message: 'Communication pending invoice data',
            pending_communication_id: pendingComm.id,
            order_id: externalRefId,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      } else if (pdf_base64 && pdf_filename) {
        console.log('Using provided PDF base64 attachment...');
        pdfAttachment = {
          filename: pdf_filename,
          content: pdf_base64,
        };
      } else {
        console.log('PDF template detected, generating PDF...');

        const externalRefId = order_id || `order_${Date.now()}_${Math.random().toString(36).substring(7)}`;

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
              pending_communication_id: pendingComm.id,
            }),
          });

          if (!pdfResponse.ok) {
            const errorText = await pdfResponse.text();
            console.error('PDF generation failed:', errorText);
            throw new Error(`PDF generation failed: ${errorText}`);
          }

          const pdfResult = await pdfResponse.json();

          if (!pdfResult.success || !pdfResult.pdf_base64) {
            console.error('PDF generation did not return base64:', pdfResult);
            throw new Error('PDF generation did not return valid base64 data');
          }

          console.log('PDF generated successfully:', pdfResult.filename);

          pdfAttachment = {
            filename: pdfResult.filename,
            content: pdfResult.pdf_base64,
          };

          await supabase
            .from('pending_communications')
            .update({
              pdf_attachment: pdfResult.pdf_base64,
              status: 'data_received',
              updated_at: new Date().toISOString(),
            })
            .eq('id', pendingComm.id);
        } catch (pdfError: any) {
          console.error('Exception during PDF generation:', pdfError);

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
          template_name,
          template_data: data,
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

      const emailConfig: any = {
        from: credentials.from_email,
        to: recipient_email,
        subject: subject,
        html: htmlContent,
      };

      if (pdfAttachment) {
        emailConfig.attachments = [
          {
            filename: pdfAttachment.filename,
            content: pdfAttachment.content,
            encoding: 'base64',
          },
        ];
      }

      await client.send(emailConfig);
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
            ...(logEntry.metadata || {}),
            processing_time_ms: processingTime,
            smtp_config: {
              host: credentials.smtp_host,
              port: credentials.smtp_port,
              tls: useTLS,
            },
            pdf_base64: pdfAttachment ? pdfAttachment.content : null,
            pdf_filename: pdfAttachment ? pdfAttachment.filename : null,
          },
        })
        .eq('id', logEntry.id);

      if (pdfAttachment && _pdf_info && _pdf_info.pdf_filename) {
        const existingPdfLogId = _pdf_info.pdf_log_id || _pdf_info.pdf_generation_log_id;

        if (existingPdfLogId) {
          console.log('[send-email] Existing PDF log ID:', existingPdfLogId);
          console.log('[send-email] Updating existing PDF log to link with parent email log:', logEntry.id);

          const { data: existingLog, error: fetchError } = await supabase
            .from('email_logs')
            .select('*')
            .eq('id', existingPdfLogId)
            .maybeSingle();

          if (fetchError || !existingLog) {
            console.error('[send-email] Could not find existing PDF log, creating new one instead');

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
            console.log('[send-email] Found existing PDF log, updating parent_log_id');

            const { error: updateError } = await supabase
              .from('email_logs')
              .update({
                parent_log_id: logEntry.id,
              })
              .eq('id', existingPdfLogId);

            if (updateError) {
              console.error('[send-email] Error updating PDF log parent_log_id:', updateError);
            } else {
              console.log('[send-email] PDF log parent_log_id updated to:', logEntry.id);

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
                    action: 'pdf_linked',
                    template_name: template.name,
                  },
                })
                .select()
                .single();

              if (pdfLogError) {
                console.error('[send-email] Error creating PDF link log:', pdfLogError);
              } else {
                console.log('[send-email] PDF link log created with ID:', pdfChildLog.id);
              }
            }
          }
        } else {
          console.log('[send-email] Skipping PDF child log creation. pdfAttachment:', !!pdfAttachment, '_pdf_info:', !!_pdf_info, 'pdf_filename:', _pdf_info?.pdf_filename);
        }
      }

      if (_pending_communication_id) {
        await supabase
          .from('pending_communications')
          .update({
            status: 'completed',
            updated_at: new Date().toISOString(),
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
            ...(logEntry.metadata || {}),
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
          details: emailError.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
  } catch (error: any) {
    console.error('Unexpected error in send-email function:', error);
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

function addTracking(html: string, logId: string, supabaseUrl: string): string {
  const trackingPixel = `<img src="${supabaseUrl}/functions/v1/track-email?log_id=${logId}&action=open" width="1" height="1" style="display:none" alt="" />`;
  const trackingScript = `
    <script>
      document.addEventListener('DOMContentLoaded', function() {
        var links = document.querySelectorAll('a');
        links.forEach(function(link) {
          link.addEventListener('click', function() {
            navigator.sendBeacon('${supabaseUrl}/functions/v1/track-email?log_id=${logId}&action=click');
          });
        });
      });
    </script>
  `;

  if (html.includes('</body>')) {
    html = html.replace('</body>', `${trackingPixel}${trackingScript}</body>`);
  } else {
    html += trackingPixel + trackingScript;
  }

  return html;
}

function processLogoAndQR(html: string, data: any, template: any): string {
  if (template.has_logo && data.logo_url) {
    html = html.replace(/\{\{logo_url\}\}/g, data.logo_url);
  }

  if (template.has_qr && data.qr_code_url) {
    html = html.replace(/\{\{qr_code_url\}\}/g, data.qr_code_url);
  }

  return html;
}

function prepareForSMTP(content: string): string {
  return content
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n');
}
