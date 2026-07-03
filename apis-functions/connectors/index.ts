
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const FUNCTIONS_BASE_URL =
  Deno.env.get("FUNCTIONS_BASE_URL");
  
function normalizeFunctionsBaseUrl(value: string): string {
  const trimmed = String(value || "").trim().replace(/\/+$/, "");

  if (!trimmed) return FUNCTIONS_BASE_URL;

  return `${trimmed
      .replace(/\/functions\/v1$/i, "")
      .replace(/\/functions$/i, "")
      .replace(/\/v1$/i, "")
    }/functions/v1`;
}

function getBaseUrl(): string {
  return normalizeFunctionsBaseUrl(
    Deno.env.get("FUNCTIONS_BASE_URL") ||
    Deno.env.get("PUBLIC_FUNCTIONS_URL") ||
    Deno.env.get("VITE_FUNCTIONS_BASE_URL") ||
    FUNCTIONS_BASE_URL,
  );
}

const BASE_URL = getBaseUrl();

// DEJA AQUÍ TU ARRAY COMPLETO CONNECTORS SIN CAMBIOS.
// Solo asegúrate de que todas las URLs usen BASE_URL:
//
// full_url: `${BASE_URL}/send-email`
// full_url: `${BASE_URL}/send-email-with-pdf`
// full_url: `${BASE_URL}/generate-pdf`
// full_url: `${BASE_URL}/notify`
// full_url: `${BASE_URL}/automation-programs`
// full_url: `${BASE_URL}/automation-monitoring`

const CONNECTORS = [
  {
    id: "sendcraft-email",
    name: "SendCraft Email",
    tagline: "Envío de emails transaccionales",
    description:
      "Conector oficial para enviar emails transaccionales y de campaña directamente desde tu CRM. Soporta templates HTML, variables dinámicas y seguimiento de aperturas y clics.",
    category: "email",
    version: "1.0.0",
    author: "SendCraft",
    badge: "Oficial",
    auth: {
      type: "api_key",
      header: "x-api-key",
      label: "API Key de la aplicación",
      placeholder: "sk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      hint: "La encontrás en Configuración → Aplicaciones → tu app",
    },
    base_url: FUNCTIONS_BASE_URL,
    actions: [
      {
        id: "send_email",
        name: "Enviar Email con Template",
        description:
          "Envía un email usando un template guardado en SendCraft",
        method: "POST",
        endpoint: "/send-email",
        full_url: `${FUNCTIONS_BASE_URL}/send-email`,
        body_template: {
          template_name: "{{template_name}}",
          recipient_email: "{{recipient_email}}",
          data: "{{data}}",
        },
        params: [
          {
            key: "template_name",
            field_path: "template_name",
            label: "Nombre del template",
            type: "string",
            required: true,
            placeholder: "welcome",
            description:
              "Nombre exacto del template configurado en SendCraft",
          },
          {
            key: "recipient_email",
            field_path: "recipient_email",
            label: "Email del destinatario",
            type: "string",
            required: true,
            placeholder: "cliente@ejemplo.com",
            description: "Email del destinatario del mensaje",
          },
          {
            key: "data",
            field_path: "data",
            label: "Variables del template (JSON)",
            type: "object",
            required: false,
            placeholder:
              '{"nombre": "Juan", "cta_url": "https://..."}',
            description:
              "Objeto JSON con las variables a inyectar en el template",
          },
        ],
        request_example: {
          template_name: "welcome",
          recipient_email: "cliente@ejemplo.com",
          data: {
            nombre: "Juan Pérez",
            cta_url: "https://app.ejemplo.com/perfil",
          },
        },
        response_example: {
          success: true,
          message: "Email sent successfully",
          log_id: "uuid-123",
          processing_time_ms: 1234,
        },
      },
    ],
    features: [
      "Templates HTML con variables dinámicas",
      "Seguimiento de aperturas y clics",
      "Soporte para múltiples aplicaciones por API Key",
      "Logs de envío en tiempo real",
      "Reintentos automáticos",
    ],
  },
];

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    if (req.method !== "GET") {
      return json(
        {
          error: "Method not allowed",
        },
        405,
      );
    }

    const url = new URL(req.url);

    const parts = url.pathname
      .replace(/^\/connectors\/?/, "")
      .split("/")
      .filter(Boolean);

    const connectorId = parts[0] ?? null;

    if (connectorId) {
      const connector = CONNECTORS.find((c: any) => c.id === connectorId);

      if (!connector) {
        return json(
          {
            error: "Connector not found",
          },
          404,
        );
      }

      return json(connector);
    }

    return json({
      registry_url: `${BASE_URL}/connectors`,
      total: CONNECTORS.length,
      connectors: CONNECTORS.map((c: any) => ({
        id: c.id,
        name: c.name,
        tagline: c.tagline,
        category: c.category,
        version: c.version,
        badge: c.badge,
        manifest_url: `${BASE_URL}/connectors/${c.id}`,
        auth_header: c.auth.header,
      })),
    });
  } catch (err) {
    return json(
      {
        error: "Internal server error",
        detail: String(err),
      },
      500,
    );
  }
});
