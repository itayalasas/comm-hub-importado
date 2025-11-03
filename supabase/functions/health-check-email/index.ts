import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  console.log('[health-check-email] Request received:', {
    method: req.method,
    url: req.url,
    headers: Object.fromEntries(req.headers.entries()),
  });

  if (req.method === "OPTIONS") {
    console.log('[health-check-email] Responding to OPTIONS');
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    console.log('[health-check-email] Starting health check');
    const start = Date.now();

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase credentials not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: credentials, error } = await supabase
      .from('email_credentials')
      .select('id, provider_type, smtp_host, smtp_port, resend_api_key, is_active')
      .eq('is_active', true)
      .limit(1);

    const responseTime = Date.now() - start;

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    if (!credentials || credentials.length === 0) {
      return new Response(
        JSON.stringify({
          status: 'operational',
          responseTime,
          configured: false,
          error: 'No active email credentials configured',
          timestamp: new Date().toISOString(),
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const firstCredential = credentials[0];
    const providerType = firstCredential.provider_type || 'smtp';
    const isConfigured = providerType === 'smtp'
      ? !!(firstCredential.smtp_host && firstCredential.smtp_port)
      : !!firstCredential.resend_api_key;

    const responseData = {
      status: 'operational',
      responseTime,
      provider: providerType,
      configured: isConfigured,
      timestamp: new Date().toISOString(),
    };

    console.log('[health-check-email] Sending success response:', responseData);

    return new Response(
      JSON.stringify(responseData),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('[health-check-email] Error occurred:', error);

    const errorData = {
      status: 'down',
      responseTime: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    };

    console.log('[health-check-email] Sending error response:', errorData);

    return new Response(
      JSON.stringify(errorData),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});