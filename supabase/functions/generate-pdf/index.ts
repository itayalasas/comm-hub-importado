import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { renderTemplate } from './_shared/template-engine.ts';
import { renderHtmlToPdfBase64 } from './_shared/pdf-renderer.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey, X-Api-Key',
};

interface GeneratePDFRequest {
  template_id?: string;
  pdf_template_name?: string;
  data: Record<string, any>;
  pending_communication_id?: string;
  order_id?: string;
}

function generateFilename(pattern: string, data: Record<string, any>): string {
  return renderTemplate(pattern || 'document.pdf', data);
}

async function generateQrCodeFromText(text: string): Promise<string> {
  try {
    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(text)}`;

    const response = await fetch(qrApiUrl);

    if (!response.ok) {
      throw new Error(`QR API failed with status: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);

    return `data:image/png;base64,${base64}`;
  } catch (error) {
    throw error;
  }
}

async function convertQrUrlsToBase64(data: any): Promise<any> {
  if (typeof data !== 'object' || data === null) {
    return data;
  }

  if (Array.isArray(data)) {
    return Promise.all(data.map(item => convertQrUrlsToBase64(item)));
  }

  const result: any = {};

  for (const [key, value] of Object.entries(data)) {
    if (key === 'qr_code' || key === 'qr_url' || key === 'qr_image' || key === 'qr_text' || key === 'qr_data') {
      if (typeof value === 'string' && value.length > 0) {
        if (value.startsWith('data:image')) {
          result[key] = value;
          result[`${key}_qr`] = value;
        } else {
          const qrBase64 = await generateQrCodeFromText(value);
          result[key] = qrBase64;
          result[`${key}_qr`] = qrBase64;
        }
      } else {
        result[key] = value;
      }
    } else if (typeof value === 'object' && value !== null) {
      result[key] = await convertQrUrlsToBase64(value);
    } else {
      result[key] = value;
    }
  }

  return result;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  let requestData: GeneratePDFRequest | null = null;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Method not allowed',
        }),
        {
          status: 405,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const apiKey = req.headers.get('x-api-key');
    if (!apiKey) {
      await supabase.from('email_logs').insert({
        application_id: null,
        template_id: null,
        recipient_email: 'unknown@error.com',
        subject: 'Error: Missing API key in /generate-pdf',
        status: 'failed',
        error_message: 'Missing API key in x-api-key header',
        communication_type: 'pdf_generation',
        metadata: {
          endpoint: 'generate-pdf',
          error_type: 'authentication',
          headers: {
            'user-agent': req.headers.get('user-agent'),
            'x-forwarded-for': req.headers.get('x-forwarded-for'),
          },
        },
      });

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
      await supabase.from('email_logs').insert({
        application_id: null,
        template_id: null,
        recipient_email: 'unknown@error.com',
        subject: 'Error: Invalid API key in /generate-pdf',
        status: 'failed',
        error_message: 'Invalid API key',
        communication_type: 'pdf_generation',
        metadata: {
          endpoint: 'generate-pdf',
          error_type: 'authentication',
          api_key_prefix: apiKey?.substring(0, 8),
          error_details: appError?.message,
        },
      });

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

    let requestBody = '';

    try {
      requestBody = await req.text();
      requestData = JSON.parse(requestBody);
    } catch (parseError: any) {
      await supabase.from('email_logs').insert({
        application_id: application.id,
        template_id: null,
        recipient_email: 'unknown@error.com',
        subject: 'Error: Invalid JSON in /generate-pdf',
        status: 'failed',
        error_message: `JSON parse error: ${parseError.message}`,
        communication_type: 'pdf_generation',
        metadata: {
          endpoint: 'generate-pdf',
          error_type: 'validation',
          raw_body: requestBody.substring(0, 500),
          parse_error: parseError.message,
        },
      });

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

    const { template_id, pdf_template_name, data, pending_communication_id, order_id } = requestData;

    if (order_id) {
      try {
        await supabase.from('pdf_generation_locks').insert({
          order_id,
          application_id: application.id,
        });
      } catch { }

      const { data: existingPdfLog } = await supabase
        .from('email_logs')
        .select('id, metadata')
        .eq('application_id', application.id)
        .eq('communication_type', 'pdf_generation')
        .eq('status', 'sent')
        .order('created_at', { ascending: false })
        .limit(50);

      if (existingPdfLog && existingPdfLog.length > 0) {
        for (const log of existingPdfLog) {
          if (log.metadata?.order_id === order_id) {
            const { data: existingPdf } = await supabase
              .from('pdf_generation_logs')
              .select('*')
              .eq('email_log_id', log.id)
              .maybeSingle();

            if (existingPdf) {
              if (order_id) {
                await supabase.from('pdf_generation_locks').delete().eq('order_id', order_id);
              }

              return new Response(
                JSON.stringify({
                  success: true,
                  message: 'PDF already exists for this order',
                  data: {
                    pdf_id: existingPdf.id,
                    pdf_base64: existingPdf.pdf_base64,
                    filename: existingPdf.filename,
                    size_bytes: existingPdf.size_bytes,
                    public_url: existingPdf.public_url,
                  },
                  duplicate_prevented: true,
                }),
                {
                  status: 200,
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                }
              );
            }
          }
        }
      }

    }

    if (!data) {
      await supabase.from('email_logs').insert({
        application_id: application.id,
        template_id: null,
        recipient_email: 'unknown@error.com',
        subject: 'Error: Missing required field in /generate-pdf',
        status: 'failed',
        error_message: 'Missing required field: data',
        communication_type: 'pdf_generation',
        metadata: {
          endpoint: 'generate-pdf',
          error_type: 'validation',
          request_data: requestData,
        },
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required field: data',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    let pendingComm = null;

    if (order_id) {
      const { data: pending, error: pendingError } = await supabase
        .from('pending_communications')
        .select('*')
        .eq('order_id', order_id)
        .eq('application_id', application.id)
        .in('status', ['waiting_data', 'pdf_generated'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!pendingError && pending) {
        pendingComm = pending;
      }
    }

    let pdfTemplate;

    if (template_id) {
      const { data: template, error: templateError } = await supabase
        .from('communication_templates')
        .select('id, name, html_content, template_type, pdf_filename_pattern')
        .eq('id', template_id)
        .eq('application_id', application.id)
        .eq('template_type', 'pdf')
        .eq('is_active', true)
        .maybeSingle();

      if (templateError || !template) {
        await supabase.from('email_logs').insert({
          application_id: application.id,
          template_id: null,
          recipient_email: 'unknown@error.com',
          subject: `Error: PDF template '${template_id}' not found`,
          status: 'failed',
          error_message: 'PDF template not found or inactive',
          communication_type: 'pdf_generation',
          metadata: {
            endpoint: 'generate-pdf',
            error_type: 'template_not_found',
            template_id,
            order_id,
            request_data: data,
            error_details: templateError?.message,
          },
        });

        return new Response(
          JSON.stringify({
            success: false,
            error: 'PDF template not found or inactive',
            details: templateError?.message || 'Template not found',
          }),
          {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      pdfTemplate = template;
    } else if (pdf_template_name) {
      const { data: template, error: templateError } = await supabase
        .from('communication_templates')
        .select('id, name, html_content, template_type, pdf_filename_pattern')
        .eq('name', pdf_template_name)
        .eq('application_id', application.id)
        .eq('template_type', 'pdf')
        .eq('is_active', true)
        .maybeSingle();

      if (templateError || !template) {
        await supabase.from('email_logs').insert({
          application_id: application.id,
          template_id: null,
          recipient_email: 'unknown@error.com',
          subject: `Error: PDF template '${pdf_template_name}' not found`,
          status: 'failed',
          error_message: 'PDF template not found or inactive',
          communication_type: 'pdf_generation',
          metadata: {
            endpoint: 'generate-pdf',
            error_type: 'template_not_found',
            pdf_template_name,
            order_id,
            request_data: data,
            error_details: templateError?.message,
          },
        });

        return new Response(
          JSON.stringify({
            success: false,
            error: 'PDF template not found or inactive',
            details: templateError?.message || 'Template not found',
          }),
          {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      pdfTemplate = template;
    } else {
      await supabase.from('email_logs').insert({
        application_id: application.id,
        template_id: null,
        recipient_email: 'unknown@error.com',
        subject: 'Error: Missing template identifier in /generate-pdf',
        status: 'failed',
        error_message: 'Either template_id or pdf_template_name is required',
        communication_type: 'pdf_generation',
        metadata: {
          endpoint: 'generate-pdf',
          error_type: 'validation',
          order_id,
          request_data: data,
        },
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: 'Either template_id or pdf_template_name is required',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const processedData = await convertQrUrlsToBase64(data);

    const templateData = { ...processedData, data: processedData };
    const htmlContent = renderTemplate(pdfTemplate.html_content, templateData);

    const filename = generateFilename(pdfTemplate.pdf_filename_pattern || 'document.pdf', processedData);

    const pdfResult = await renderHtmlToPdfBase64(htmlContent, { title: filename });
    const pdfBase64 = pdfResult.base64;
    const sizeBytes = pdfResult.sizeBytes;

    const emailLogData: any = {
      application_id: application.id,
      template_id: pdfTemplate.id,
      recipient_email: 'pdf_generation@system.local',
      subject: `PDF Generated: ${filename}`,
      status: 'sent',
      sent_at: new Date().toISOString(),
      communication_type: 'pdf_generation',
      pdf_generated: true,
      metadata: {
        endpoint: 'generate-pdf',
        filename,
        size_bytes: sizeBytes,
        order_id,
        pending_communication_id,
        action: 'pdf_generated',
        template_name: pdfTemplate.name,
        data,
      },
    };

    if (pendingComm?.parent_log_id) {
      emailLogData.parent_log_id = pendingComm.parent_log_id;
    }

    const { data: emailLog, error: emailLogError } = await supabase
      .from('email_logs')
      .insert(emailLogData)
      .select()
      .single();


    const { data: pdfLog, error: logError } = await supabase
      .from('pdf_generation_logs')
      .insert({
        application_id: application.id,
        pdf_template_id: pdfTemplate.id,
        data,
        pdf_base64: pdfBase64,
        filename,
        size_bytes: sizeBytes,
        email_log_id: emailLog?.id,
      })
      .select()
      .single();

    if (logError) {
      await supabase.from('email_logs').insert({
        application_id: application.id,
        template_id: pdfTemplate.id,
        recipient_email: 'unknown@error.com',
        subject: 'Error: Failed to log PDF generation',
        status: 'failed',
        error_message: `Failed to log PDF generation: ${logError.message}`,
        communication_type: 'pdf_generation',
        metadata: {
          endpoint: 'generate-pdf',
          error_type: 'database',
          order_id,
          filename,
          error_details: logError.message,
        },
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to log PDF generation',
          details: logError.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const accessToken = crypto.randomUUID() + '-' + Date.now().toString(36);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 90);

    const { data: publicLink, error: linkError } = await supabase
      .from('public_pdf_links')
      .insert({
        application_id: application.id,
        pdf_generation_log_id: pdfLog.id,
        order_id: order_id || null,
        access_token: accessToken,
        filename,
        expires_at: expiresAt.toISOString(),
        is_active: true,
      })
      .select()
      .single();


    const publicUrl = publicLink ? `${supabaseUrl}/functions/v1/view-pdf?token=${accessToken}` : null;

    if (publicUrl) {
      await supabase
        .from('pdf_generation_logs')
        .update({ public_url: publicUrl })
        .eq('id', pdfLog.id);

      if (emailLog?.id) {
        await supabase
          .from('email_logs')
          .update({
            metadata: {
              ...(emailLog.metadata || {}),
              pdf_generation_log_id: pdfLog.id,
              pdf_public_url: publicUrl,
              pdf_access_token: accessToken,
            },
          })
          .eq('id', emailLog.id);
      }
    }

    const targetPendingId = pending_communication_id || (pendingComm ? pendingComm.id : null);

    if (targetPendingId) {
      const { data: currentPending } = await supabase
        .from('pending_communications')
        .select('completed_data')
        .eq('id', targetPendingId)
        .single();

      const pdfAttachment = {
        filename,
        content: pdfBase64,
        encoding: 'base64',
      };

      const completedDataToSave = {
        ...currentPending?.completed_data,
        pdf_attachment: pdfAttachment,
        pdf_generation_log_id: pdfLog.id,
        pdf_log_id: emailLog?.id,
        pdf_email_log_id: emailLog?.id,
        pdf_template_id: pdfTemplate.id,
        pdf_filename: filename,
        pdf_size_bytes: sizeBytes,
        pdf_public_url: publicUrl,
      };

      const { error: updateError } = await supabase
        .from('pending_communications')
        .update({
          completed_data: completedDataToSave,
          status: 'pdf_generated',
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', targetPendingId);

      if (!updateError) {
        try {
          const completeUrl = `${supabaseUrl}/functions/v1/complete-pending-communication`;

          const completeResponse = await fetch(completeUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseKey}`,
              'x-api-key': apiKey,
            },
            body: JSON.stringify({
              pending_communication_id: targetPendingId,
            }),
          });

          const completeResult = await completeResponse.json();

        } catch { }
      }
    }

    if (order_id) {
      await supabase.from('pdf_generation_locks').delete().eq('order_id', order_id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'PDF generated successfully',
        data: {
          pdf_id: pdfLog.id,
          pdf_base64: pdfBase64,
          filename,
          size_bytes: sizeBytes,
          public_url: publicUrl,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const orderId = (error as any).order_id || requestData?.order_id;
      if (orderId) {
        await supabase.from('pdf_generation_locks').delete().eq('order_id', orderId);
      }

      await supabase.from('email_logs').insert({
        application_id: null,
        template_id: null,
        recipient_email: 'unknown@error.com',
        subject: 'Error: Unexpected error in /generate-pdf',
        status: 'failed',
        error_message: error.message || String(error),
        communication_type: 'pdf_generation',
        metadata: {
          endpoint: 'generate-pdf',
          error_type: 'unexpected',
          error_details: {
            name: error.name,
            message: error.message,
            stack: error.stack,
          },
        },
      });
    } catch { }

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal server error',
        details: error.message || String(error),
        stack: error.stack,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
