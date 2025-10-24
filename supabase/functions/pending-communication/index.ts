import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey, X-Api-Key',
};

interface SendCommunicationRequest {
  template_name: string;
  recipient_email: string;
  data?: Record<string, any>;
  base_data?: Record<string, any>;
  pending_fields?: string[];
  external_reference_id?: string;
  external_system?: string;
  webhook_url?: string;
  expires_at?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  const startTime = Date.now();
  let application: any = null;
  let supabase: any = null;

  try {
    console.log('[pending-communication] Request received');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    supabase = createClient(supabaseUrl, supabaseKey);

    const apiKey = req.headers.get('x-api-key');

    let requestData: any = null;
    let requestBody = '';

    try {
      requestBody = await req.text();
      requestData = JSON.parse(requestBody);
      console.log('[pending-communication] Request parsed successfully');
    } catch (parseError: any) {
      console.error('[pending-communication] JSON parse error:', parseError);

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
            error_message: `JSON parse error at pending-communication: ${parseError.message}`,
            metadata: {
              raw_body: requestBody.substring(0, 1000),
              parse_error: parseError.message,
              endpoint: 'pending-communication',
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
      console.error('[pending-communication] Missing API key');
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
      console.error('[pending-communication] Invalid API key or app not found');
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
    const { template_name, recipient_email, data, base_data } = requestData;
    const emailData = data || base_data || {};

    console.log('[pending-communication] Request data:', {
      template_name,
      recipient_email,
      hasData: !!emailData,
    });

    if (!template_name || !recipient_email) {
      await supabase.from('email_logs').insert({
        application_id: application.id,
        template_id: null,
        recipient_email: recipient_email || 'unknown@error.com',
        subject: 'Error: Missing required fields',
        status: 'failed',
        error_message: 'Missing required fields: template_name, recipient_email',
        metadata: {
          request_data: requestData,
          endpoint: 'pending-communication',
        },
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
      console.error('[pending-communication] Template not found or inactive');

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
          endpoint: 'pending-communication',
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

    if (template.template_type === 'pdf') {
      console.log('[pending-communication] Template is PDF-only, creating pending communication without sending email');

      const externalRefId = requestData.external_reference_id || `pdf_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const externalSystem = requestData.external_system || 'manual';
      const webhookUrl = requestData.webhook_url || null;
      const expiresAt = requestData.expires_at || null;
      const pendingFields = requestData.pending_fields || [];
      const orderId = requestData.order_id || null;

      if (orderId) {
        const { data: existing } = await supabase
          .from('pending_communications')
          .select('id, status')
          .eq('order_id', orderId)
          .eq('application_id', application.id)
          .in('status', ['waiting_data', 'pdf_generated'])
          .maybeSingle();

        if (existing) {
          console.log(`[pending-communication] Found existing pending communication for order ${orderId}:`, existing.id);

          return new Response(
            JSON.stringify({
              success: true,
              message: 'Pending communication already exists for this order',
              pending_communication_id: existing.id,
              external_reference_id: externalRefId,
              status: existing.status,
              type: 'pdf',
              note: 'Using existing pending communication',
            }),
            {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }
      }

      const { data: pendingComm, error: pendingError } = await supabase
        .from('pending_communications')
        .insert({
          application_id: application.id,
          template_name,
          recipient_email,
          base_data: emailData,
          pending_fields: pendingFields,
          external_reference_id: externalRefId,
          external_system: externalSystem,
          status: 'waiting_data',
          webhook_url: webhookUrl,
          expires_at: expiresAt,
          communication_type: 'pdf',
          pdf_template_id: template.id,
          order_id: orderId,
        })
        .select()
        .single();

      if (pendingError) {
        console.error('[pending-communication] Error creating pending communication:', pendingError);

        await supabase.from('email_logs').insert({
          application_id: application.id,
          template_id: template.id,
          recipient_email: recipient_email,
          subject: `Error: Failed to create pending PDF`,
          status: 'failed',
          error_message: `Failed to create pending communication: ${pendingError.message}`,
          communication_type: 'pdf',
          metadata: {
            template_name,
            request_data: requestData,
            endpoint: 'pending-communication',
            error: pendingError,
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

      console.log('[pending-communication] Pending PDF communication created:', pendingComm.id);

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Pending PDF communication created successfully',
          pending_communication_id: pendingComm.id,
          external_reference_id: externalRefId,
          status: 'waiting_data',
          type: 'pdf',
          note: 'PDF will be generated and email sent when all pending fields are completed',
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const orderId = requestData.order_id;
    const waitForInvoice = requestData.wait_for_invoice;

    if (orderId && waitForInvoice) {
      console.log('[pending-communication] wait_for_invoice=true, creating parent log and pending communication');

      const parentLog: any = {
        application_id: application.id,
        template_id: template.id,
        recipient_email,
        subject: requestData.subject || template.subject || 'Pending Invoice',
        status: 'sent',
        communication_type: 'email_with_pdf',
        pdf_generated: false,
        metadata: {
          action: 'email_queued',
          message: 'Email queued, waiting for invoice PDF',
          order_id: orderId,
          wait_for_invoice: true,
          template_name,
          template_data: emailData,
          processing_time_ms: Date.now() - startTime,
        },
      };

      const { data: parentLogData, error: parentLogError } = await supabase
        .from('email_logs')
        .insert(parentLog)
        .select()
        .single();

      if (parentLogError) {
        console.error('[pending-communication] Error creating parent log:', parentLogError);
        throw new Error('Failed to create parent log');
      }

      const { data: pendingComm, error: pendingError } = await supabase
        .from('pending_communications')
        .insert({
          application_id: application.id,
          email_template_id: template.id,
          recipient_email,
          subject: parentLog.subject,
          base_data: emailData,
          pending_fields: ['invoice_pdf'],
          external_system: 'email_system',
          external_reference_id: orderId,
          order_id: orderId,
          parent_log_id: parentLogData.id,
        })
        .select()
        .single();

      if (pendingError) {
        console.error('[pending-communication] Error creating pending communication:', pendingError);
        throw new Error('Failed to create pending communication');
      }

      console.log('[pending-communication] Created parent log and pending communication:', {
        parent_log_id: parentLogData.id,
        pending_communication_id: pendingComm.id,
      });

      await supabase
        .from('email_logs')
        .update({
          metadata: {
            ...parentLog.metadata,
            pending_communication_id: pendingComm.id,
          },
        })
        .eq('id', parentLogData.id);

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Email queued successfully, waiting for invoice PDF',
          log_id: parentLogData.id,
          pending_communication_id: pendingComm.id,
          status: 'queued',
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const sendEmailUrl = `${supabaseUrl}/functions/v1/send-email`;

    console.log('[pending-communication] Template is email type, calling send-email function...');

    try {
      const emailResponse = await fetch(sendEmailUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
        body: JSON.stringify({
          template_name,
          recipient_email,
          data: emailData,
        }),
      });

      const emailResult = await emailResponse.json();
      const endTime = Date.now();
      const processingTime = endTime - startTime;

      console.log('[pending-communication] Email send result:', {
        success: emailResult.success,
        status: emailResponse.status,
        processingTime,
      });

      if (emailResult.success) {
        return new Response(
          JSON.stringify({
            success: true,
            message: 'Email sent successfully',
            log_id: emailResult.log_id,
            features: emailResult.features || {
              has_attachment: template.has_attachment,
              has_logo: template.has_logo,
              has_qr: template.has_qr,
            },
            processing_time_ms: processingTime,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      } else {
        return new Response(
          JSON.stringify({
            success: false,
            error: emailResult.error || 'Failed to send email',
            details: emailResult.details,
          }),
          {
            status: emailResponse.status,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    } catch (sendError: any) {
      console.error('Error sending email:', sendError);

      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to send email',
          details: sendError.message || String(sendError),
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
  } catch (error: any) {
    console.error('Error processing request:', error);

    const endTime = Date.now();
    const processingTime = endTime - startTime;

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal server error',
        details: error.message || String(error),
        processing_time_ms: processingTime,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});