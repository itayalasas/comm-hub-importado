import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { renderTemplate } from './_shared/template-engine.ts';

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

async function htmlToPdfBase64(html: string): Promise<string> {
  const pdfshiftApiKey = Deno.env.get('PDFSHIFT_API_KEY');
  const pdfshiftApiUrl = Deno.env.get('PDFSHIFT_API_URL') || 'https://api.pdfshift.io/v3/convert/pdf';

  if (!pdfshiftApiKey) {
    console.error('[generate-pdf] PDFSHIFT_API_KEY not configured');
    throw new Error('PDFSHIFT_API_KEY environment variable is not set. Please configure it in Supabase Edge Functions secrets.');
  }

  console.log('[generate-pdf] Calling PDFShift API...');
  console.log('[generate-pdf] HTML length:', html.length);

  const credentials = btoa(`api:${pdfshiftApiKey}`);

  const response = await fetch(pdfshiftApiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      source: html,
      landscape: false,
      use_print: false,
    }),
  });

  console.log('[generate-pdf] PDFShift response status:', response.status);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[generate-pdf] PDFShift API error:', errorText);
    throw new Error(`PDFShift API error: ${response.status} - ${errorText}`);
  }

  const pdfArrayBuffer = await response.arrayBuffer();
  console.log('[generate-pdf] Received PDF buffer, size:', pdfArrayBuffer.byteLength, 'bytes');

  const uint8Array = new Uint8Array(pdfArrayBuffer);

  let binaryString = '';
  const chunkSize = 8192;
  for (let i = 0; i < uint8Array.length; i += chunkSize) {
    const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
    binaryString += String.fromCharCode.apply(null, Array.from(chunk));
  }

  const base64 = btoa(binaryString);
  console.log('[generate-pdf] PDF converted to base64, length:', base64.length);

  return base64;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

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
      console.error('[generate-pdf] Missing API key');

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
      console.error('[generate-pdf] Invalid API key:', apiKey?.substring(0, 8) + '...');

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

    let requestData: GeneratePDFRequest;
    let requestBody = '';

    try {
      requestBody = await req.text();
      requestData = JSON.parse(requestBody);
    } catch (parseError: any) {
      console.error('[generate-pdf] JSON parse error:', parseError);

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

    if (!data) {
      console.error('[generate-pdf] Missing required field: data');

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
      console.log(`Looking for pending communication with order_id: ${order_id}`);

      const { data: pending, error: pendingError } = await supabase
        .from('pending_communications')
        .select('*')
        .eq('order_id', order_id)
        .eq('application_id', application.id)
        .in('status', ['waiting_data', 'pdf_generated'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (pendingError) {
        console.error('Error finding pending communication:', pendingError);
      } else if (pending) {
        console.log(`Found pending communication for order ${order_id}:`, pending.id);
        pendingComm = pending;
      } else {
        console.warn(`No pending communication found for order_id: ${order_id}`);
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
        console.error('PDF template not found:', { template_id, error: templateError });

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
        console.error('PDF template not found:', { pdf_template_name, error: templateError });

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
      console.error('[generate-pdf] Missing template identifier');

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

    console.log('Rendering HTML template with data...');
    console.log('[generate-pdf] Data structure:', JSON.stringify(data).substring(0, 500));

    const wrappedData = { data };
    const htmlContent = renderTemplate(pdfTemplate.html_content, wrappedData);

    const filename = generateFilename(pdfTemplate.pdf_filename_pattern || 'document.pdf', wrappedData);

    console.log('Converting HTML to PDF with PDFShift API...');
    const pdfBase64 = await htmlToPdfBase64(htmlContent);

    const sizeBytes = pdfBase64.length;

    console.log('PDF generated successfully:', { filename, sizeBytes });

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
      console.log('[generate-pdf] Setting parent_log_id from pending communication:', pendingComm.parent_log_id);
    }

    const { data: emailLog, error: emailLogError } = await supabase
      .from('email_logs')
      .insert(emailLogData)
      .select()
      .single();

    if (emailLogError) {
      console.error('[generate-pdf] Error creating email_log entry:', emailLogError);
    } else {
      console.log('[generate-pdf] Email log created with ID:', emailLog.id);
    }

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
      console.error('Error logging PDF generation:', logError);

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

    console.log('[generate-pdf] PDF generation logged successfully. email_log_id:', emailLog?.id, ', pdf_log_id:', pdfLog.id);

    const targetPendingId = pending_communication_id || (pendingComm ? pendingComm.id : null);

    if (targetPendingId) {
      console.log('Updating pending communication with PDF attachment...');

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
        pdf_template_id: pdfTemplate.id,
        pdf_filename: filename,
        pdf_size_bytes: sizeBytes,
      };

      console.log('[generate-pdf] Saving completed_data:', JSON.stringify({
        ...completedDataToSave,
        pdf_attachment: { filename: pdfAttachment.filename, size: pdfAttachment.content.length }
      }));

      const { error: updateError } = await supabase
        .from('pending_communications')
        .update({
          completed_data: completedDataToSave,
          status: 'pdf_generated',
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', targetPendingId);

      if (updateError) {
        console.error('Error updating pending communication:', updateError);
      } else {
        console.log('Pending communication updated successfully with status: pdf_generated');
        console.log(`Triggering email send for pending_communication_id: ${targetPendingId}...`);

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

          if (completeResult.success) {
            console.log(`Email sent successfully for pending_communication_id: ${targetPendingId}`);
          } else {
            console.error(`Failed to send email for pending_communication_id ${targetPendingId}:`, completeResult);
          }
        } catch (emailError: any) {
          console.error(`Error triggering email send for pending_communication_id ${targetPendingId}:`, emailError);
        }
      }
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
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Error generating PDF:', error);

    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

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
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

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