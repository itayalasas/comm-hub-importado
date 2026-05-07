import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-api-key",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const start = Date.now();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Validate the API key from the request
    const apiKey = req.headers.get('x-api-key');
    if (!apiKey) {
      return new Response(JSON.stringify({ status: 'error', error: 'Missing API key' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: app, error: appError } = await supabase
      .from('applications')
      .select('id, name')
      .eq('api_key', apiKey)
      .maybeSingle();

    if (appError || !app) {
      return new Response(JSON.stringify({ status: 'error', error: 'Invalid API key' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: credentials, error } = await supabase
      .from('email_credentials')
      .select('id, provider_type, smtp_host, smtp_port, resend_api_key, is_active')
      .eq('application_id', app.id)
      .eq('is_active', true)
      .limit(1);

    const responseTime = Date.now() - start;

    if (error) throw new Error(`Database error: ${error.message}`);

    const firstCredential = credentials?.[0];
    const providerType = firstCredential?.provider_type || 'smtp';
    const isConfigured = firstCredential
      ? (providerType === 'smtp'
          ? !!(firstCredential.smtp_host && firstCredential.smtp_port)
          : !!firstCredential.resend_api_key)
      : false;

    return new Response(
      JSON.stringify({
        status: 'operational',
        responseTime,
        provider: providerType,
        configured: isConfigured,
        app_name: app.name,
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        status: 'down',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
