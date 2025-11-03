import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
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
      .maybeSingle();

    const responseTime = Date.now() - start;

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    if (!credentials) {
      return new Response(
        JSON.stringify({
          status: 'down',
          responseTime,
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

    const providerType = credentials.provider_type || 'smtp';
    const isConfigured = providerType === 'smtp'
      ? !!(credentials.smtp_host && credentials.smtp_port)
      : !!credentials.resend_api_key;

    return new Response(
      JSON.stringify({
        status: 'operational',
        responseTime,
        provider: providerType,
        configured: isConfigured,
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
  } catch (error) {
    return new Response(
      JSON.stringify({
        status: 'down',
        responseTime: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
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
});