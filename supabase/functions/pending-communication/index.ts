import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey, X-Api-Key',
};

interface CreatePendingRequest {
  template_name: string;
  recipient_email: string;
  base_data: Record<string, any>;
  pending_fields: string[];
  external_reference_id: string;
  external_system: string;
  webhook_url?: string;
  expires_at?: string;
}

interface CompletePendingRequest {
  external_reference_id: string;
  data: Record<string, any>;
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

    const url = new URL(req.url);
    const action = url.pathname.split('/').pop();

    if (action === 'create' && req.method === 'POST') {
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

      const requestData: CreatePendingRequest = await req.json();
      const {
        template_name,
        recipient_email,
        base_data,
        pending_fields,
        external_reference_id,
        external_system,
        webhook_url,
        expires_at,
      } = requestData;

      if (!template_name || !recipient_email || !external_reference_id || !external_system) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Missing required fields: template_name, recipient_email, external_reference_id, external_system',
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      const { data: template } = await supabase
        .from('communication_templates')
        .select('id')
        .eq('name', template_name)
        .eq('application_id', application.id)
        .eq('is_active', true)
        .maybeSingle();

      if (!template) {
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

      const { data: pending, error: pendingError } = await supabase
        .from('pending_communications')
        .insert({
          application_id: application.id,
          template_name,
          recipient_email,
          base_data: base_data || {},
          pending_fields: pending_fields || [],
          external_reference_id,
          external_system,
          webhook_url,
          expires_at,
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

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Pending communication created',
          data: {
            id: pending.id,
            external_reference_id: pending.external_reference_id,
            status: pending.status,
            complete_url: `${supabaseUrl}/functions/v1/pending-communication/complete`,
          },
        }),
        {
          status: 201,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    } else if (action === 'complete' && req.method === 'POST') {
      const requestData: CompletePendingRequest = await req.json();
      const { external_reference_id, data } = requestData;

      if (!external_reference_id || !data) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Missing required fields: external_reference_id, data',
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      const { data: pending, error: fetchError } = await supabase
        .from('pending_communications')
        .select('*')
        .eq('external_reference_id', external_reference_id)
        .eq('status', 'waiting_data')
        .maybeSingle();

      if (fetchError || !pending) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Pending communication not found or already processed',
          }),
          {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      if (pending.expires_at && new Date(pending.expires_at) < new Date()) {
        await supabase
          .from('pending_communications')
          .update({
            status: 'failed',
            error_message: 'Communication expired',
          })
          .eq('id', pending.id);

        return new Response(
          JSON.stringify({
            success: false,
            error: 'Communication expired',
          }),
          {
            status: 410,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      const mergedData = { ...pending.base_data, ...data };

      await supabase
        .from('pending_communications')
        .update({
          completed_data: data,
          completed_at: new Date().toISOString(),
          status: 'data_received',
        })
        .eq('id', pending.id);

      const sendEmailUrl = `${supabaseUrl}/functions/v1/send-email`;
      const { data: application } = await supabase
        .from('applications')
        .select('api_key')
        .eq('id', pending.application_id)
        .single();

      try {
        const emailResponse = await fetch(sendEmailUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': application.api_key,
          },
          body: JSON.stringify({
            template_name: pending.template_name,
            recipient_email: pending.recipient_email,
            data: mergedData,
          }),
        });

        const emailResult = await emailResponse.json();

        if (emailResult.success) {
          await supabase
            .from('pending_communications')
            .update({
              status: 'sent',
              sent_at: new Date().toISOString(),
              sent_log_id: emailResult.log_id,
            })
            .eq('id', pending.id);

          if (pending.webhook_url) {
            try {
              await fetch(pending.webhook_url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  event: 'communication_sent',
                  external_reference_id: pending.external_reference_id,
                  log_id: emailResult.log_id,
                  sent_at: new Date().toISOString(),
                }),
              });
            } catch (webhookError) {
              console.error('Webhook notification failed:', webhookError);
            }
          }

          return new Response(
            JSON.stringify({
              success: true,
              message: 'Communication completed and sent',
              log_id: emailResult.log_id,
            }),
            {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        } else {
          await supabase
            .from('pending_communications')
            .update({
              status: 'failed',
              error_message: emailResult.error || 'Failed to send email',
            })
            .eq('id', pending.id);

          return new Response(
            JSON.stringify({
              success: false,
              error: 'Failed to send email',
              details: emailResult.error,
            }),
            {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }
      } catch (sendError: any) {
        console.error('Error sending email:', sendError);

        await supabase
          .from('pending_communications')
          .update({
            status: 'failed',
            error_message: sendError.message || 'Failed to send email',
          })
          .eq('id', pending.id);

        return new Response(
          JSON.stringify({
            success: false,
            error: 'Failed to send email',
            details: sendError.message,
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    } else if (action === 'status' && req.method === 'GET') {
      const external_reference_id = url.searchParams.get('external_reference_id');

      if (!external_reference_id) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Missing external_reference_id parameter',
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      const { data: pending, error: fetchError } = await supabase
        .from('pending_communications')
        .select('id, status, created_at, completed_at, sent_at, error_message, pending_fields')
        .eq('external_reference_id', external_reference_id)
        .maybeSingle();

      if (fetchError || !pending) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Pending communication not found',
          }),
          {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          data: pending,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Invalid action or method',
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Error processing request:', error);

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