import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const DEFAULT_FROM_EMAIL = "no-reply@sendcraft.net";
const DEFAULT_FROM_NAME = "SandCraft";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY")!;

    // Verify JWT — only authenticated users can call this
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { application_id } = await req.json();
    if (!application_id) {
      return new Response(JSON.stringify({ error: "application_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role to write credentials — keeps the API key server-side only
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Verify the application belongs to this user or their tenant
    const { data: app, error: appError } = await adminClient
      .from("applications")
      .select("id, user_id, tenant_id")
      .eq("id", application_id)
      .maybeSingle();

    if (appError || !app) {
      return new Response(JSON.stringify({ error: "Application not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check ownership: user_id match OR same tenant
    const { data: { user: callerUser } } = await adminClient.auth.admin.getUserById(user.id);
    const callerTenant = callerUser?.app_metadata?.tenant_id ?? callerUser?.user_metadata?.tenant_id ?? null;
    const ownedByUser = app.user_id === user.id;
    const ownedByTenant = callerTenant && app.tenant_id === callerTenant;

    if (!ownedByUser && !ownedByTenant) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if default credentials already exist for this app
    const { data: existing } = await adminClient
      .from("email_credentials")
      .select("id")
      .eq("application_id", application_id)
      .eq("is_active", true)
      .maybeSingle();

    if (existing) {
      // Already provisioned — update to default if needed
      await adminClient
        .from("email_credentials")
        .update({
          provider_type: "resend",
          resend_api_key: resendApiKey,
          from_email: DEFAULT_FROM_EMAIL,
          from_name: DEFAULT_FROM_NAME,
          smtp_host: null,
          smtp_port: null,
          smtp_user: null,
          smtp_password: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
    } else {
      await adminClient.from("email_credentials").insert({
        application_id,
        provider_type: "resend",
        resend_api_key: resendApiKey,
        from_email: DEFAULT_FROM_EMAIL,
        from_name: DEFAULT_FROM_NAME,
        is_active: true,
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("provision-default-email error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
