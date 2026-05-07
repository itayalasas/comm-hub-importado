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
        name: "Enviar Email con Template",
        description: "Envía un email usando un template guardado en SendCraft",
        method: "POST",
        endpoint: "/send-email",
        full_url: `${BASE_URL}/send-email`,
        // body_template: estructura exacta del JSON que se envía a la API
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
            description: "Nombre exacto del template configurado en SendCraft",
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
            placeholder: '{"nombre": "Juan", "cta_url": "https://..."}',
            description: "Objeto JSON con las variables a inyectar en el template",
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
        description: "Genera un PDF desde un template y lo adjunta al email en una sola llamada",
        method: "POST",
        endpoint: "/send-email-with-pdf",
        full_url: `${BASE_URL}/send-email-with-pdf`,
        body_template: {
          recipient_email: "{{recipient_email}}",
          order_id: "{{order_id}}",
          email: {
            template_name: "{{email_template_name}}",
            data: "{{email_data}}",
          },
          attachment: {
            pdf_template_name: "{{pdf_template_name}}",
            filename: "{{pdf_filename}}",
            data: "{{pdf_data}}",
          },
        },
        params: [
          {
            key: "recipient_email",
            field_path: "recipient_email",
            label: "Email del destinatario",
            type: "string",
            required: true,
            placeholder: "cliente@ejemplo.com",
            description: "Email del destinatario",
          },
          {
            key: "email_template_name",
            field_path: "email.template_name",
            label: "Template del email",
            type: "string",
            required: true,
            placeholder: "factura_email",
            description: "Nombre del template de email en SendCraft",
          },
          {
            key: "email_data",
            field_path: "email.data",
            label: "Variables del email (JSON)",
            type: "object",
            required: false,
            placeholder: '{"nombre": "Juan"}',
            description: "Variables a inyectar en el template de email",
          },
          {
            key: "pdf_template_name",
            field_path: "attachment.pdf_template_name",
            label: "Template del PDF",
            type: "string",
            required: true,
            placeholder: "factura_pdf",
            description: "Nombre del template PDF en SendCraft",
          },
          {
            key: "pdf_filename",
            field_path: "attachment.filename",
            label: "Nombre del archivo PDF",
            type: "string",
            required: false,
            placeholder: "factura-{{order_id}}.pdf",
            description: "Nombre del archivo adjunto (soporta variables con {{}})",
          },
          {
            key: "pdf_data",
            field_path: "attachment.data",
            label: "Variables del PDF (JSON)",
            type: "object",
            required: false,
            placeholder: '{"cliente": "Juan", "total": 1220}',
            description: "Variables a inyectar en el template PDF",
          },
          {
            key: "order_id",
            field_path: "order_id",
            label: "ID de orden",
            type: "string",
            required: false,
            placeholder: "ORD-2024-001",
            description: "ID de referencia de la orden (opcional)",
          },
        ],
        request_example: {
          recipient_email: "cliente@ejemplo.com",
          order_id: "ORD-2024-001",
          email: {
            template_name: "factura_email",
            data: { nombre: "Juan Pérez", empresa: "Acme SA" },
          },
          attachment: {
            pdf_template_name: "factura_pdf",
            filename: "factura-{{order_id}}.pdf",
            data: { cliente: "Juan Pérez", total: 1220 },
          },
        },
        response_example: {
          success: true,
          message: "Email with PDF attachment sent successfully",
          log_id: "uuid-123",
          pdf_filename: "factura-ORD-2024-001.pdf",
          pdf_size_bytes: 48320,
          processing_time_ms: 1240,
        },
      },
    ],
    features: [
      "Generación de PDF en tiempo real desde templates HTML",
      "Envío y adjunto en una sola llamada API",
      "Soporte para variables dinámicas en email y PDF",
      "Nombres de archivo personalizados con variables",
      "Fallback a link de descarga si el PDF supera 1 MB",
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
        description: "Genera un PDF desde un template y devuelve base64 y URL pública de descarga",
        method: "POST",
        endpoint: "/generate-pdf",
        full_url: `${BASE_URL}/generate-pdf`,
        body_template: {
          pdf_template_name: "{{pdf_template_name}}",
          data: "{{data}}",
          order_id: "{{order_id}}",
        },
        params: [
          {
            key: "pdf_template_name",
            field_path: "pdf_template_name",
            label: "Nombre del template PDF",
            type: "string",
            required: true,
            placeholder: "factura_pdf",
            description: "Nombre del template PDF en SendCraft (alternativa a template_id)",
          },
          {
            key: "data",
            field_path: "data",
            label: "Variables del template (JSON)",
            type: "object",
            required: true,
            placeholder: '{"cliente": "Juan", "total": 1220}',
            description: "Objeto JSON con las variables a inyectar en el template",
          },
          {
            key: "order_id",
            field_path: "order_id",
            label: "ID de orden",
            type: "string",
            required: false,
            placeholder: "ORD-2024-001",
            description: "ID de referencia para asociar el PDF generado",
          },
        ],
        request_example: {
          pdf_template_name: "factura_pdf",
          data: {
            cliente: "Juan Pérez",
            rut: "211234560018",
            items: [{ descripcion: "Servicio A", total: 1000 }],
            total: 1220,
          },
        },
        response_example: {
          success: true,
          message: "PDF generated successfully",
          data: {
            pdf_id: "uuid-abc",
            pdf_base64: "JVBERi0x...",
            filename: "factura_pdf.pdf",
            size_bytes: 8245,
          },
        },
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
    id: "sendcraft-notify",
    name: "SendCraft Notify",
    tagline: "Campañas y notificaciones masivas asíncronas",
    description: "Envía emails, PDFs o ambos a una lista de destinatarios en una sola llamada. El procesamiento es asíncrono: recibís un job_id de inmediato y podés consultar el progreso en cualquier momento. Ideal para campañas, facturas en lote y notificaciones masivas.",
    category: "automation",
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
        id: "create_campaign",
        name: "Crear campaña",
        description: "Dispara una campaña asíncrona para una lista de destinatarios. Devuelve un job_id para consultar el progreso.",
        method: "POST",
        endpoint: "/notify",
        full_url: `${BASE_URL}/notify`,
        body_template: {
          type: "{{type}}",
          template_name: "{{template_name}}",
          recipients: "{{recipients}}",
          shared_data: "{{shared_data}}",
          attachment: {
            pdf_template_name: "{{pdf_template_name}}",
            filename: "{{pdf_filename}}",
          },
          options: {
            concurrency: "{{concurrency}}",
            stop_on_error: "{{stop_on_error}}",
          },
        },
        params: [
          {
            key: "type",
            field_path: "type",
            label: "Tipo de notificación",
            type: "select",
            required: true,
            description: "Define qué se envía a cada destinatario",
            options: [
              { value: "email", label: "Solo email" },
              { value: "email_pdf", label: "Email + PDF adjunto" },
              { value: "pdf", label: "Solo generar PDF" },
            ],
          },
          {
            key: "template_name",
            field_path: "template_name",
            label: "Template de email",
            type: "string",
            required: false,
            placeholder: "factura_email",
            description: "Requerido para type 'email' y 'email_pdf'",
          },
          {
            key: "recipients",
            field_path: "recipients",
            label: "Lista de destinatarios",
            type: "array",
            required: true,
            placeholder: '[{"email":"juan@empresa.com","data":{"nombre":"Juan"}}]',
            description: "Array de objetos con email y data opcionales por destinatario",
          },
          {
            key: "shared_data",
            field_path: "shared_data",
            label: "Datos compartidos",
            type: "object",
            required: false,
            placeholder: '{"empresa":"Acme SA","año":2026}',
            description: "Se fusiona con el data de cada destinatario (el destinatario tiene prioridad)",
          },
          {
            key: "pdf_template_name",
            field_path: "attachment.pdf_template_name",
            label: "Template del PDF",
            type: "string",
            required: false,
            placeholder: "factura_pdf",
            description: "Requerido para type 'email_pdf' y 'pdf'",
          },
          {
            key: "pdf_filename",
            field_path: "attachment.filename",
            label: "Nombre del archivo PDF",
            type: "string",
            required: false,
            placeholder: "factura-{{order_id}}.pdf",
            description: "Patrón de nombre con variables. Por defecto usa el nombre del template.",
          },
          {
            key: "concurrency",
            field_path: "options.concurrency",
            label: "Concurrencia",
            type: "string",
            required: false,
            placeholder: "5",
            description: "Cuántos destinatarios se procesan en paralelo (1-20, default 5)",
          },
          {
            key: "stop_on_error",
            field_path: "options.stop_on_error",
            label: "Detener al primer error",
            type: "string",
            required: false,
            placeholder: "false",
            description: "Si true, aborta la campaña al primer fallo. Default false.",
          },
        ],
        request_example: {
          type: "email_pdf",
          template_name: "factura_email",
          shared_data: { empresa: "Acme SA", año: 2026 },
          recipients: [
            { email: "juan@empresa.com", data: { nombre: "Juan Pérez", total: 1220 } },
            { email: "ana@empresa.com",  data: { nombre: "Ana López",  total: 980  } },
          ],
          attachment: {
            pdf_template_name: "factura_pdf",
            filename: "factura-{{nombre}}.pdf",
          },
          options: { concurrency: 5, stop_on_error: false },
        },
        response_example: {
          job_id: "uuid-abc",
          status: "pending",
          total: 2,
          message: "Campaign job created. Use GET /notify/uuid-abc to check progress.",
        },
      },
      {
        id: "get_campaign_status",
        name: "Estado de campaña",
        description: "Consulta el progreso de un job de campaña por su ID.",
        method: "GET",
        endpoint: "/notify/:job_id",
        full_url: `${BASE_URL}/notify/:job_id`,
        body_template: {},
        params: [
          {
            key: "job_id",
            field_path: "path.job_id",
            label: "ID del job",
            type: "string",
            required: true,
            placeholder: "uuid-del-job",
            description: "El job_id devuelto al crear la campaña",
          },
        ],
        request_example: {
          _note: "GET request — reemplazá :job_id en la URL",
          url: `${BASE_URL}/notify/uuid-del-job`,
          headers: { "x-api-key": "sk_xxx" },
        },
        response_example: {
          id: "uuid-abc",
          type: "email_pdf",
          status: "done",
          total: 2,
          processed: 2,
          sent: 2,
          failed: 0,
          results: [
            { email: "juan@empresa.com", status: "sent", log_id: "uuid-1", pdf_log_id: "uuid-2" },
            { email: "ana@empresa.com",  status: "sent", log_id: "uuid-3", pdf_log_id: "uuid-4" },
          ],
        },
      },
    ],
    features: [
      "Procesamiento asíncrono — recibís job_id en < 200 ms",
      "Tipos: solo email, email + PDF adjunto, solo PDF",
      "Datos compartidos + override por destinatario",
      "Concurrencia configurable (hasta 20 en paralelo)",
      "Progreso consultable en tiempo real por job_id",
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
        description: "Registra una URL para recibir eventos de email en tiempo real",
        method: "POST",
        endpoint: "/track-email",
        full_url: `${BASE_URL}/track-email`,
        body_template: {
          callback_url: "{{callback_url}}",
          events: "{{events}}",
        },
        params: [
          {
            key: "callback_url",
            field_path: "callback_url",
            label: "URL de tu CRM",
            type: "string",
            required: true,
            placeholder: "https://tucrm.com/webhooks/sendcraft",
            description: "Endpoint de tu sistema que recibirá los eventos POST",
          },
          {
            key: "events",
            field_path: "events",
            label: "Eventos a escuchar",
            type: "array",
            required: true,
            placeholder: '["opened", "clicked", "delivered", "bounced"]',
            description: "Array de eventos: opened, clicked, delivered, bounced, failed",
            options: [
              { value: "opened", label: "Email abierto" },
              { value: "clicked", label: "Clic en enlace" },
              { value: "delivered", label: "Email entregado" },
              { value: "bounced", label: "Email rebotado" },
              { value: "failed", label: "Fallo de envío" },
            ],
          },
        ],
        request_example: {
          callback_url: "https://tucrm.com/webhooks/sendcraft",
          events: ["opened", "clicked", "delivered", "bounced"],
        },
        response_example: {
          success: true,
          message: "Webhook registered successfully",
          webhook_id: "uuid-xyz",
        },
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
