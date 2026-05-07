import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { renderHtmlToPdfBase64 } from "./_shared/pdf-renderer.ts";

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

    const pdfResult = await renderHtmlToPdfBase64('<h1>Health Check</h1><p>Gotenberg renderer operational</p>', {
      title: 'Health Check',
    });
    const responseTime = Date.now() - start;
    const isHealthy = pdfResult.sizeBytes > 0;

    const responseData = {
      status: isHealthy ? 'operational' : 'degraded',
      responseTime,
      pdf_size_bytes: pdfResult.sizeBytes,
      timestamp: new Date().toISOString(),
    };

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
    const errorData = {
      status: 'down',
      responseTime: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    };

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
