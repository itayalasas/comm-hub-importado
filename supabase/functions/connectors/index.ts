import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const BASE_URL = "https://drhbcmithlrldtjlhnee.supabase.co/functions/v1";

const CONNECTORS = [
  {
    id: "sendcraft-email",
    name: "SendCraft Email",
    tagline: "Envío de emails transaccionales",
    description: "Conector oficial para enviar emails transaccionales y de campaña directamente desde tu CRM. Soporta templates HTML, variables dinámicas y seguimiento de aperturas y clics.",
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
    base_url: BASE_URL,
    actions: [
      {
        id: "send_email",
        name: "Enviar Email",
        description: "Envía un email a uno o más destinatarios",
        method: "POST",
        endpoint: "/send-email",
        full_url: `${BASE_URL}/send-email`,
        params: [
          { key: "to", label: "Destinatario", type: "string", required: true, placeholder: "nombre@ejemplo.com" },
          { key: "subject", label: "Asunto", type: "string", required: true, placeholder: "Hola {{nombre}}" },
          { key: "body", label: "Cuerpo HTML", type: "text", required: true, placeholder: "<p>Hola {{nombre}}</p>" },
          { key: "from_name", label: "Nombre del remitente", type: "string", required: false, placeholder: "Mi Empresa" },
          { key: "reply_to", label: "Responder a", type: "string", required: false, placeholder: "soporte@empresa.com" },
        ],
      },
      {
        id: "send_email_template",
        name: "Enviar Email con Template",
        description: "Envía un email usando un template guardado en SendCraft",
        method: "POST",
        endpoint: "/send-email",
        full_url: `${BASE_URL}/send-email`,
        params: [
          { key: "to", label: "Destinatario", type: "string", required: true, placeholder: "nombre@ejemplo.com" },
          { key: "template_id", label: "ID del Template", type: "string", required: true, placeholder: "uuid-del-template" },
          { key: "variables", label: "Variables JSON", type: "text", required: false, placeholder: '{"nombre": "Juan"}' },
        ],
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
  {
    id: "sendcraft-email-pdf",
    name: "SendCraft Email + PDF",
    tagline: "Email adjuntando PDF generado al vuelo",
    description: "Genera un PDF desde un template HTML y lo envía adjunto al email en una sola llamada. Ideal para facturas, cotizaciones, contratos y reportes personalizados.",
    category: "pdf",
    version: "1.0.0",
    author: "SendCraft",
    badge: "Oficial",
    auth: {
      type: "api_key",
      header: "x-api-key",
      label: "API Key de la aplicación",
      placeholder: "sk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      hint: "La misma API Key que usás para el conector de Email",
    },
    base_url: BASE_URL,
    actions: [
      {
        id: "send_email_with_pdf",
        name: "Enviar Email con PDF adjunto",
        description: "Genera un PDF desde un template y lo adjunta al email",
        method: "POST",
        endpoint: "/send-email-with-pdf",
        full_url: `${BASE_URL}/send-email-with-pdf`,
        params: [
          { key: "to", label: "Destinatario", type: "string", required: true, placeholder: "nombre@ejemplo.com" },
          { key: "subject", label: "Asunto del email", type: "string", required: true, placeholder: "Tu factura #{{numero}}" },
          { key: "email_body", label: "Cuerpo del email", type: "text", required: true, placeholder: "<p>Adjuntamos tu factura.</p>" },
          { key: "pdf_template_id", label: "ID del Template PDF", type: "string", required: true, placeholder: "uuid-del-template-pdf" },
          { key: "pdf_filename", label: "Nombre del archivo PDF", type: "string", required: false, placeholder: "factura-{{numero}}.pdf" },
          { key: "variables", label: "Variables JSON", type: "text", required: false, placeholder: '{"numero": "0001", "cliente": "Juan"}' },
        ],
      },
    ],
    features: [
      "Generación de PDF en tiempo real desde templates HTML",
      "Envío y adjunto en una sola llamada API",
      "Soporte para variables dinámicas en email y PDF",
      "Nombres de archivo personalizados",
      "PDF de alta calidad con CSS completo",
    ],
  },
  {
    id: "sendcraft-pdf",
    name: "SendCraft PDF Generator",
    tagline: "Generación y almacenamiento de PDFs",
    description: "Genera PDFs desde templates HTML y obtené una URL pública para descarga o visualización. Perfecto para generar documentos bajo demanda sin enviar email.",
    category: "pdf",
    version: "1.0.0",
    author: "SendCraft",
    badge: "Oficial",
    auth: {
      type: "api_key",
      header: "x-api-key",
      label: "API Key de la aplicación",
      placeholder: "sk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      hint: "La misma API Key de tu aplicación en SendCraft",
    },
    base_url: BASE_URL,
    actions: [
      {
        id: "generate_pdf",
        name: "Generar PDF",
        description: "Genera un PDF desde un template y devuelve la URL de descarga",
        method: "POST",
        endpoint: "/generate-pdf",
        full_url: `${BASE_URL}/generate-pdf`,
        params: [
          { key: "template_id", label: "ID del Template", type: "string", required: true, placeholder: "uuid-del-template" },
          { key: "variables", label: "Variables JSON", type: "text", required: false, placeholder: '{"nombre": "Juan", "fecha": "2026-01-15"}' },
          { key: "filename", label: "Nombre del archivo", type: "string", required: false, placeholder: "reporte-{{fecha}}.pdf" },
        ],
      },
    ],
    features: [
      "URL pública de descarga con expiración configurable",
      "CSS completo soportado (fuentes, imágenes, tablas)",
      "Variables dinámicas en todo el documento",
      "Almacenamiento seguro en Supabase Storage",
      "Compatible con cualquier frontend o backend",
    ],
  },
  {
    id: "sendcraft-webhook",
    name: "SendCraft Webhooks",
    tagline: "Eventos en tiempo real hacia tu CRM",
    description: "Recibí notificaciones en tiempo real cuando un email es abierto, cuando se hace clic en un enlace, o cuando ocurre un rebote. Mantené tu CRM sincronizado automáticamente.",
    category: "automation",
    version: "0.9.0",
    author: "SendCraft",
    badge: "Beta",
    auth: {
      type: "api_key",
      header: "x-api-key",
      label: "API Key de la aplicación",
      placeholder: "sk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      hint: "Usá la misma API Key para filtrar eventos por aplicación",
    },
    base_url: BASE_URL,
    actions: [
      {
        id: "register_webhook",
        name: "Registrar Webhook",
        description: "Registra una URL para recibir eventos de SendCraft",
        method: "POST",
        endpoint: "/track-email",
        full_url: `${BASE_URL}/track-email`,
        params: [
          { key: "callback_url", label: "URL de tu CRM", type: "string", required: true, placeholder: "https://tucrm.com/webhooks/sendcraft" },
          { key: "events", label: "Eventos a escuchar", type: "select", required: true,
            options: [
              { value: "all", label: "Todos los eventos" },
              { value: "email.opened", label: "Email abierto" },
              { value: "email.clicked", label: "Clic en enlace" },
              { value: "email.bounced", label: "Email rebotado" },
              { value: "email.delivered", label: "Email entregado" },
            ],
          },
        ],
      },
    ],
    features: [
      "Eventos: abierto, clic, entregado, rebotado, fallido",
      "Reintentos automáticos con backoff exponencial",
      "Firma HMAC para verificar autenticidad",
      "Filtrado por aplicación con API Key",
      "Historial de entregas en el dashboard",
    ],
  },
];

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
    const url = new URL(req.url);
    // path looks like /connectors  or  /connectors/sendcraft-email
    const parts = url.pathname.replace(/^\/connectors\/?/, "").split("/").filter(Boolean);
    const connectorId = parts[0] ?? null;

    if (connectorId) {
      const connector = CONNECTORS.find(c => c.id === connectorId);
      if (!connector) {
        return json({ error: "Connector not found" }, 404);
      }
      return json(connector);
    }

    // List all connectors (summary)
    return json({
      registry_url: `${BASE_URL}/connectors`,
      total: CONNECTORS.length,
      connectors: CONNECTORS.map(c => ({
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
    return json({ error: "Internal server error", detail: String(err) }, 500);
  }
});
