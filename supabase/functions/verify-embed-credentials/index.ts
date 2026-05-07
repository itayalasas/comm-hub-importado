import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { username, password_hash } = await req.json();

    if (!username || !password_hash) {
      return json({ valid: false, error: "Missing credentials" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data, error } = await supabase
      .from("embed_credentials")
      .select("id, user_id, app_id, label, is_active")
      .eq("username", username.trim())
      .eq("password_hash", password_hash)
      .eq("is_active", true)
      .maybeSingle();

    if (error || !data) {
      return json({ valid: false });
    }

    // Update last_used_at
    await supabase
      .from("embed_credentials")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", data.id);

    return json({
      valid: true,
      credential_id: data.id,
      label: data.label,
    });
  } catch (err) {
    return json({ valid: false, error: String(err) }, 500);
  }
});
