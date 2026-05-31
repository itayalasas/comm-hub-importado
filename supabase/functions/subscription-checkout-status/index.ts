import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const CONFIG_API_URL = "https://ffihaeatoundrjzgtpzk.supabase.co/functions/v1/get-env";
const CONFIG_ACCESS_KEY = "cc3cdc09379e1dc8f8482007290a5d9e2d2755c5613f5a3fd81fb02c81040b37";

async function getAuthBaseUrl(): Promise<string> {
  const res = await fetch(CONFIG_API_URL, {
    headers: { "X-Access-Key": CONFIG_ACCESS_KEY },
  });
  if (!res.ok) throw new Error("Could not load config");
  const json = await res.json();
  return json?.variables?.VITE_AUTH_URL ?? "";
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

    const upstream = await fetch(`${authBaseUrl}/subscription-checkout-status`, {
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
