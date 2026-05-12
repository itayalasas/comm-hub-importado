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
 * Sends a WhatsApp message using an APPROVED template via Meta Cloud API.
 *
 * POST body:
 * {
 *   api_key: string,                  // Application API key (x-api-key header OR body)
 *   application_id: string,
 *   template_name: string,            // meta_template_name of the APPROVED template
 *   language_code: string,            // e.g. "es", "en_US" (default: "es")
 *   recipient_phone: string,          // E.164 format, e.g. "+5491123456789"
 *   variables: string[],              // Positional body variables: ["value1", "value2", ...]
 *   external_reference_id?: string,   // Optional reference for tracking
 * }
 *
 * Returns:
 * {
 *   success: true,
 *   wamid: string,           // WhatsApp message ID from Meta
 *   log_id: string,          // whatsapp_logs.id
 * }
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
    const {
      application_id,
      template_name,
      language_code = "es",
      recipient_phone,
      variables = [],
      external_reference_id,
    } = body;

    // Accept api_key from body or header
    const apiKey = body.api_key || req.headers.get("x-api-key") || "";

    if (!application_id || !template_name || !recipient_phone) {
      return json({ error: "application_id, template_name and recipient_phone are required" }, 400);
    }

    // Validate API key against application
    const { data: app, error: appErr } = await supabase
      .from("applications")
      .select("id, api_key")
      .eq("id", application_id)
      .maybeSingle();

    if (appErr || !app) {
      return json({ error: "Application not found" }, 404);
    }

    if (app.api_key !== apiKey) {
      return json({ error: "Invalid API key" }, 401);
    }

    // Load WhatsApp config
    const { data: config, error: cfgErr } = await supabase
      .from("whatsapp_configs")
      .select("*")
      .eq("application_id", application_id)
      .maybeSingle();

    if (cfgErr || !config) {
      return json({ error: "WhatsApp not configured for this application" }, 404);
    }

    if (!config.is_active) {
      return json({ error: "WhatsApp config is disabled" }, 400);
    }

    // Find the approved template
    const { data: tpl, error: tplErr } = await supabase
      .from("whatsapp_templates")
      .select("id, status, category")
      .eq("application_id", application_id)
      .eq("meta_template_name", template_name)
      .eq("status", "APPROVED")
      .maybeSingle();

    if (tplErr || !tpl) {
      return json({ error: `No approved template found with name: ${template_name}` }, 404);
    }

    // Build Meta message payload
    const bodyComponents: any[] = [];
    if (variables.length > 0) {
      bodyComponents.push({
        type: "body",
        parameters: variables.map((v: string) => ({ type: "text", text: v })),
      });
    }

    const metaPayload = {
      messaging_product: "whatsapp",
      to: recipient_phone.replace(/\D/g, ""),
      type: "template",
      template: {
        name: template_name,
        language: { code: language_code },
        components: bodyComponents,
      },
    };

    // Create log entry (queued)
    const { data: log, error: logErr } = await supabase
      .from("whatsapp_logs")
      .insert({
        application_id,
        whatsapp_template_id: tpl.id,
        recipient_phone,
        status: "queued",
        template_variables: variables.reduce((acc: any, v: string, i: number) => {
          acc[`${i + 1}`] = v;
          return acc;
        }, {}),
        external_reference_id: external_reference_id ?? null,
      })
      .select("id")
      .single();

    if (logErr) {
      return json({ error: "Failed to create log entry", detail: logErr.message }, 500);
    }

    // Send via Meta Cloud API
    const metaRes = await fetch(
      `https://graph.facebook.com/v19.0/${config.phone_number_id}/messages`,
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
      // Update log to failed
      await supabase
        .from("whatsapp_logs")
        .update({
          status: "failed",
          error_code: String(metaData?.error?.code ?? ""),
          error_message: metaData?.error?.message ?? JSON.stringify(metaData),
          updated_at: new Date().toISOString(),
        })
        .eq("id", log.id);

      return json({
        error: "Meta API error",
        detail: metaData?.error?.message ?? JSON.stringify(metaData),
        log_id: log.id,
      }, 502);
    }

    const wamid = metaData?.messages?.[0]?.id ?? null;

    // Update log to sent
    await supabase
      .from("whatsapp_logs")
      .update({
        status: "sent",
        wamid,
        updated_at: new Date().toISOString(),
      })
      .eq("id", log.id);

    return json({ success: true, wamid, log_id: log.id });
  } catch (err: any) {
    return json({ error: "Internal server error", detail: err?.message ?? String(err) }, 500);
  }
});
