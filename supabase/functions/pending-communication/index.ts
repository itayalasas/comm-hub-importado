import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey, X-Api-Key',
};

interface SendCommunicationRequest {
  template_name: string;
  recipient_email: string;
  data: Record<string, any>;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  const startTime = Date.now();

  try {
    console.log('[pending-communication] Request received:', {
      method: req.method,
      url: req.url,
      headers: Object.fromEntries(req.headers.entries()),
    });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const apiKey = req.headers.get('x-api-key');
    console.log('[pending-communication] API Key present:', !!apiKey);

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

    const { data: application, error: appError } = await supabase
      .from('applications')
      .select('id, name')
      .eq('api_key', apiKey)
      .maybeSingle();

    console.log('[pending-communication] Application lookup:', {
      found: !!application,
      error: appError,
    });

    if (appError || !application) {
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

    const requestData: SendCommunicationRequest = await req.json();
    const { template_name, recipient_email, data } = requestData;

    console.log('[pending-communication] Request data:', {
      template_name,
      recipient_email,
      hasData: !!data,
    });

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

    console.log('[pending-communication] Template lookup:', {
      found: !!template,
      error: templateError,
    });

    if (templateError || !template) {
      console.error('[pending-communication] Template not found or inactive');
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

    const sendEmailUrl = `${supabaseUrl}/functions/v1/send-email`;

    console.log('[pending-communication] Calling send-email function...');

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
          data: data || {},
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