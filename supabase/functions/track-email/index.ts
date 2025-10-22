import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const url = new URL(req.url);
    const logId = url.searchParams.get('log_id');
    const path = url.pathname;

    if (!logId) {
      return new Response('Missing log_id parameter', {
        status: 400,
        headers: corsHeaders,
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (path.includes('/open')) {
      await supabase
        .from('email_logs')
        .update({ opened_at: new Date().toISOString() })
        .eq('id', logId)
        .is('opened_at', null);

      const transparentPixel = Uint8Array.from([
        0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00,
        0x80, 0x00, 0x00, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x21,
        0xf9, 0x04, 0x01, 0x00, 0x00, 0x00, 0x00, 0x2c, 0x00, 0x00,
        0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 0x44,
        0x01, 0x00, 0x3b,
      ]);

      return new Response(transparentPixel, {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'image/gif',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });
    }

    if (path.includes('/click')) {
      const targetUrl = url.searchParams.get('url');

      await supabase
        .from('email_logs')
        .update({ clicked_at: new Date().toISOString() })
        .eq('id', logId)
        .is('clicked_at', null);

      if (targetUrl) {
        return new Response(null, {
          status: 302,
          headers: {
            ...corsHeaders,
            'Location': decodeURIComponent(targetUrl),
          },
        });
      }

      return new Response('Missing url parameter', {
        status: 400,
        headers: corsHeaders,
      });
    }

    return new Response('Invalid endpoint', {
      status: 404,
      headers: corsHeaders,
    });
  } catch (error: any) {
    console.error('Error tracking email:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
