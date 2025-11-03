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
    
    const pdfshiftApiKey = Deno.env.get('PDFSHIFT_API_KEY');
    if (!pdfshiftApiKey) {
      throw new Error('PDFSHIFT_API_KEY not configured');
    }

    const testHtml = '<html><body><h1>Health Check</h1></body></html>';
    
    const response = await fetch('https://api.pdfshift.io/v3/convert/pdf', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`api:${pdfshiftApiKey}`)}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source: testHtml,
        sandbox: true,
      }),
    });

    const responseTime = Date.now() - start;
    const isHealthy = response.ok;

    return new Response(
      JSON.stringify({
        status: isHealthy ? 'operational' : 'degraded',
        responseTime,
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