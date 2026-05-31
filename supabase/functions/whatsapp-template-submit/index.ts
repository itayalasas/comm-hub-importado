import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-api-key, x-user-id",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

/**
 * Submits a WhatsApp template to Meta for approval.
 *
 * POST body:
 * {
 *   application_id: string,
 *   template_id: string,          // whatsapp_templates.id (must be DRAFT)
 * }
 *
 * Reads whatsapp_configs for the application to get WABA credentials,
 * builds the Meta API payload from the stored components, calls
 * POST https://graph.facebook.com/v19.0/{waba_id}/message_templates
 * and updates whatsapp_templates.status = 'PENDING' with the returned meta_template_id.
 */
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json();
    const { application_id, template_id } = body;

    if (!application_id || !template_id) {
      return json({ error: "application_id and template_id are required" }, 400);
    }

    // Load config
    const { data: config, error: cfgErr } = await supabase
      .from("whatsapp_configs")
      .select("*")
      .eq("application_id", application_id)
      .maybeSingle();

    if (cfgErr || !config) {
      return json({ error: "WhatsApp config not found for this application" }, 404);
    }

    if (!config.is_active) {
      return json({ error: "WhatsApp config is disabled" }, 400);
    }

    // Load template
    const { data: tpl, error: tplErr } = await supabase
      .from("whatsapp_templates")
      .select("*")
      .eq("id", template_id)
      .eq("application_id", application_id)
      .maybeSingle();

    if (tplErr || !tpl) {
      return json({ error: "Template not found" }, 404);
    }

    if (!["DRAFT", "REJECTED"].includes(tpl.status)) {
      return json({ error: `Template is already in status: ${tpl.status}` }, 400);
    }

    // Build Meta API payload
    const metaPayload = {
      name: tpl.meta_template_name,
      language: tpl.language_code,
      category: tpl.category,
      components: tpl.components,
    };

    const metaRes = await fetch(
      `https://graph.facebook.com/v19.0/${config.waba_id}/message_templates`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${config.access_token}`,
        },
        body: JSON.stringify(metaPayload),
      },
    );

    const metaData = await metaRes.json();

    if (!metaRes.ok) {
      return json({
        error: "Meta API error",
        detail: metaData?.error?.message ?? JSON.stringify(metaData),
        meta_response: metaData,
      }, 502);
    }

    // Update template status
    const { error: updateErr } = await supabase
      .from("whatsapp_templates")
      .update({
        status: "PENDING",
        meta_template_id: metaData.id ?? null,
        submitted_at: new Date().toISOString(),
        rejection_reason: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", template_id);

    if (updateErr) {
      return json({ error: "Template submitted to Meta but failed to update DB", detail: updateErr.message }, 500);
    }

    return json({
      success: true,
      meta_template_id: metaData.id,
      status: "PENDING",
    });
  } catch (err: any) {
    return json({ error: "Internal server error", detail: err?.message ?? String(err) }, 500);
  }
});
