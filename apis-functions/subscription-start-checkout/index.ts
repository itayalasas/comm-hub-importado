
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

async function getAuthBaseUrl(): Promise<string> {
  return (
    Deno.env.get("AUTH_FUNCTIONS_BASE_URL") ||
    Deno.env.get("AUTH_EDGE_FUNCTIONS_BASE_URL") ||
    Deno.env.get("AUTH_URL") ||
    Deno.env.get("VITE_AUTH_URL") ||
    Deno.env.get("FUNCTIONS_BASE_URL") ||
    ""
  )
    .trim()
    .replace(/\/+$/, "");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const authBaseUrl = await getAuthBaseUrl();

    if (!authBaseUrl) {
      return new Response(
        JSON.stringify({ success: false, error: { message: "Auth URL not configured" } }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const upstream = await fetch(`${authBaseUrl}/subscription-start-checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await upstream.json();

    return new Response(JSON.stringify(data), {
      status: upstream.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: { message: err?.message ?? "Internal error" } }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

