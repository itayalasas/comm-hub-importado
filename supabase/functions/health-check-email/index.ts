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

    const apiKey = req.headers.get('x-api-key');

    const fetchStatusPage = async () => {
      const statusUrl = 'https://resend-status.com/';
      const res = await fetch(statusUrl, { method: 'GET' });
      if (!res.ok) {
        throw new Error(`Status page fetch failed (${res.status})`);
      }

      const body = await res.text();
      const content = body.toLowerCase();

      if (content.includes('fully operational')) {
        return { status: 'operational' as const, message: 'Resend status page reports fully operational' };
      }
      if (content.includes('partial outage') || content.includes('degraded') || content.includes('degraded performance') || content.includes('investigating')) {
        return { status: 'degraded' as const, message: 'Resend status page reports degraded or partial outage' };
      }
      if (content.includes('major outage') || content.includes('outage') || content.includes('service unavailable') || content.includes('system down')) {
        return { status: 'down' as const, message: 'Resend status page reports outage' };
      }

      return { status: 'operational' as const, message: 'Resend status page reachable, status could not be fully categorized' };
    };

    let providerType = 'smtp';
    let isConfigured = false;
    let appName: string | undefined;

    if (apiKey) {
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

      appName = app.name;

      const { data: credentials, error } = await supabase
        .from('email_credentials')
        .select('id, provider_type, smtp_host, smtp_port, resend_api_key, is_active')
        .eq('application_id', app.id)
        .eq('is_active', true)
        .limit(1);

      if (error) throw new Error(`Database error: ${error.message}`);

      const firstCredential = credentials?.[0];
      providerType = firstCredential?.provider_type || 'smtp';
      isConfigured = firstCredential
        ? (providerType === 'smtp'
            ? !!(firstCredential.smtp_host && firstCredential.smtp_port)
            : !!firstCredential.resend_api_key)
        : false;
    } else {
      const { data: credentials, error } = await supabase
        .from('email_credentials')
        .select('id, provider_type, smtp_host, smtp_port, resend_api_key, is_active')
        .eq('is_active', true)
        .limit(1);

      if (error) throw new Error(`Database error: ${error.message}`);

      const firstCredential = credentials?.[0];
      providerType = firstCredential?.provider_type || 'smtp';
      isConfigured = firstCredential
        ? (providerType === 'smtp'
            ? !!(firstCredential.smtp_host && firstCredential.smtp_port)
            : !!firstCredential.resend_api_key)
        : false;
    }

    const statusPage = await fetchStatusPage();
    const responseTime = Date.now() - start;

    return new Response(
      JSON.stringify({
        status: statusPage.status,
        responseTime,
        provider: providerType,
        configured: isConfigured,
        app_name: appName,
        message: statusPage.message,
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
