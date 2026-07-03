
import { renderHtmlToPdfBase64 } from "./_shared/pdf-renderer.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-api-key",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (req.method !== "GET") {
    return json({
      status: "error",
      error: "Method not allowed",
      timestamp: new Date().toISOString(),
    }, 405);
  }

  try {
    const start = Date.now();

    const pdfResult = await renderHtmlToPdfBase64(
      "<h1>Health Check</h1><p>Gotenberg renderer operational</p>",
      {
        title: "Health Check",
      },
    );

    const responseTime = Date.now() - start;
    const isHealthy = pdfResult.sizeBytes > 0;

    return json({
      status: isHealthy ? "operational" : "degraded",
      responseTime,
      pdf_size_bytes: pdfResult.sizeBytes,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return json({
      status: "down",
      responseTime: 0,
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
    });
  }
});
