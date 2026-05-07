import { useState, useEffect, useRef } from 'react';
import { Layout } from '../components/Layout';
import {
  Package, CheckCircle2, Copy, X, ChevronRight,
  Mail, FileText, Zap, Globe, ShieldCheck, ExternalLink,
} from 'lucide-react';

/* ── Connector manifest types ──────────────────────────────────────── */

interface ConnectorParam {
  key: string;
  field_path: string;
  label: string;
  type: 'string' | 'text' | 'object' | 'array' | 'select';
  required: boolean;
  description?: string;
  options?: { value: string; label: string }[];
  placeholder?: string;
}

interface ConnectorAction {
  id: string;
  name: string;
  description: string;
  method: string;
  endpoint: string;
  params: ConnectorParam[];
  request_example: Record<string, unknown>;
}

interface ConnectorManifest {
  id: string;
  name: string;
  tagline: string;
  description: string;
  category: 'email' | 'pdf' | 'automation';
  version: string;
  author: string;
  icon: 'mail' | 'pdf' | 'automation';
  color: string;
  gradient: string;
  badge?: string;
  stats: { label: string; value: string }[];
  auth: {
    type: 'api_key';
    header: string;
    label: string;
    placeholder: string;
    hint: string;
  };
  baseUrl: string;
  actions: ConnectorAction[];
  features: string[];
}

/* ── Connector definitions ─────────────────────────────────────────── */

const BASE_URL = 'https://drhbcmithlrldtjlhnee.supabase.co/functions/v1';

const CONNECTORS: ConnectorManifest[] = [
  {
    id: 'sendcraft-email',
    name: 'SendCraft Email',
    tagline: 'Envío de emails transaccionales',
    description: 'Conector oficial para enviar emails transaccionales usando templates HTML con variables dinámicas. Soporta seguimiento de aperturas y clics, logos y códigos QR automáticos.',
    category: 'email',
    version: '1.0.0',
    author: 'SendCraft',
    icon: 'mail',
    color: 'text-cyan-400',
    gradient: 'from-cyan-500/20 to-blue-500/20',
    badge: 'Oficial',
    stats: [
      { label: 'Versión', value: '1.0.0' },
      { label: 'Endpoint', value: 'POST /send-email' },
      { label: 'Auth', value: 'API Key' },
    ],
    auth: {
      type: 'api_key',
      header: 'x-api-key',
      label: 'API Key de la aplicación',
      placeholder: 'sk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      hint: 'La encontrás en Configuración → Aplicaciones → tu app',
    },
    baseUrl: BASE_URL,
    actions: [
      {
        id: 'send_email',
        name: 'Enviar Email con Template',
        description: 'Envía un email usando un template guardado en SendCraft. El template define el HTML; data inyecta las variables.',
        method: 'POST',
        endpoint: '/send-email',
        params: [
          {
            key: 'template_name',
            field_path: 'template_name',
            label: 'Nombre del template',
            type: 'string',
            required: true,
            placeholder: 'welcome',
            description: 'Nombre exacto del template configurado en SendCraft',
          },
          {
            key: 'recipient_email',
            field_path: 'recipient_email',
            label: 'Email del destinatario',
            type: 'string',
            required: true,
            placeholder: 'cliente@ejemplo.com',
            description: 'Dirección de email del destinatario',
          },
          {
            key: 'data',
            field_path: 'data',
            label: 'Variables del template',
            type: 'object',
            required: false,
            placeholder: '{"nombre": "Juan", "cta_url": "https://..."}',
            description: 'Objeto JSON con las variables a inyectar en el template ({{nombre}}, etc.)',
          },
          {
            key: 'subject',
            field_path: 'subject',
            label: 'Asunto (override)',
            type: 'string',
            required: false,
            placeholder: 'Tu confirmación de pedido',
            description: 'Reemplaza el asunto definido en el template',
          },
          {
            key: 'order_id',
            field_path: 'order_id',
            label: 'ID de orden',
            type: 'string',
            required: false,
            placeholder: 'ORD-2024-001',
            description: 'Referencia de orden para deduplicación y auditoría',
          },
        ],
        request_example: {
          template_name: 'welcome',
          recipient_email: 'cliente@ejemplo.com',
          data: {
            nombre: 'Juan Pérez',
            cta_url: 'https://app.ejemplo.com/perfil',
          },
        },
      },
    ],
    features: [
      'Templates HTML con variables dinámicas ({{variable}})',
      'Seguimiento de aperturas y clics',
      'Logos y códigos QR automáticos',
      'Soporte para múltiples aplicaciones por API Key',
      'Logs de envío en tiempo real',
    ],
  },
  {
    id: 'sendcraft-email-pdf',
    name: 'SendCraft Email + PDF',
    tagline: 'Email adjuntando PDF generado al vuelo',
    description: 'Genera un PDF desde un template HTML y lo adjunta al email en una sola llamada. Los datos del email y del PDF son independientes. Si el PDF supera 1 MB se incluye un link de descarga en el cuerpo.',
    category: 'pdf',
    version: '1.0.0',
    author: 'SendCraft',
    icon: 'pdf',
    color: 'text-blue-400',
    gradient: 'from-blue-500/20 to-slate-500/20',
    badge: 'Oficial',
    stats: [
      { label: 'Versión', value: '1.0.0' },
      { label: 'Endpoint', value: 'POST /send-email-with-pdf' },
      { label: 'Auth', value: 'API Key' },
    ],
    auth: {
      type: 'api_key',
      header: 'x-api-key',
      label: 'API Key de la aplicación',
      placeholder: 'sk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      hint: 'La misma API Key que usás para el conector de Email',
    },
    baseUrl: BASE_URL,
    actions: [
      {
        id: 'send_email_with_pdf',
        name: 'Enviar Email con PDF adjunto',
        description: 'Genera PDF y envía email en una sola llamada. email.* controla el mensaje; attachment.* controla el PDF adjunto.',
        method: 'POST',
        endpoint: '/send-email-with-pdf',
        params: [
          {
            key: 'recipient_email',
            field_path: 'recipient_email',
            label: 'Email del destinatario',
            type: 'string',
            required: true,
            placeholder: 'cliente@ejemplo.com',
            description: 'Dirección de email del destinatario',
          },
          {
            key: 'email.template_name',
            field_path: 'email.template_name',
            label: 'Template del email',
            type: 'string',
            required: true,
            placeholder: 'factura_email',
            description: 'Nombre del template de email en SendCraft',
          },
          {
            key: 'email.data',
            field_path: 'email.data',
            label: 'Variables del email',
            type: 'object',
            required: false,
            placeholder: '{"nombre": "Juan"}',
            description: 'Variables a inyectar en el template de email',
          },
          {
            key: 'attachment.pdf_template_name',
            field_path: 'attachment.pdf_template_name',
            label: 'Template del PDF',
            type: 'string',
            required: true,
            placeholder: 'factura_pdf',
            description: 'Nombre del template PDF en SendCraft',
          },
          {
            key: 'attachment.filename',
            field_path: 'attachment.filename',
            label: 'Nombre del archivo PDF',
            type: 'string',
            required: false,
            placeholder: 'factura-{{order_id}}.pdf',
            description: 'Nombre del adjunto. Soporta variables {{order_id}} etc.',
          },
          {
            key: 'attachment.data',
            field_path: 'attachment.data',
            label: 'Variables del PDF',
            type: 'object',
            required: false,
            placeholder: '{"cliente": "Juan", "total": 1220}',
            description: 'Variables a inyectar en el template PDF (independientes del email)',
          },
          {
            key: 'order_id',
            field_path: 'order_id',
            label: 'ID de orden',
            type: 'string',
            required: false,
            placeholder: 'ORD-2024-001',
            description: 'Referencia de orden para deduplicación y auditoría',
          },
        ],
        request_example: {
          recipient_email: 'cliente@ejemplo.com',
          order_id: 'ORD-2024-001',
          email: {
            template_name: 'factura_email',
            data: { nombre: 'Juan Pérez', empresa: 'Acme SA' },
          },
          attachment: {
            pdf_template_name: 'factura_pdf',
            filename: 'factura-{{order_id}}.pdf',
            data: {
              cliente: 'Juan Pérez',
              rut: '211234560018',
              items: [{ descripcion: 'Servicio A', total: 1000 }],
              subtotal: 1000,
              iva: 220,
              total: 1220,
            },
          },
        },
      },
    ],
    features: [
      'PDF generado en tiempo real desde templates HTML',
      'Email y PDF en una sola llamada API',
      'Variables independientes para email y PDF',
      'Nombre de archivo personalizado con variables',
      'Fallback a link de descarga si PDF > 1 MB',
    ],
  },
  {
    id: 'sendcraft-pdf',
    name: 'SendCraft PDF Generator',
    tagline: 'Generación y almacenamiento de PDFs',
    description: 'Genera PDFs desde templates HTML usando Chromium. Devuelve el PDF en base64 y URL pública de descarga con expiración configurable. CSS completo soportado incluyendo fuentes, imágenes y tablas.',
    category: 'pdf',
    version: '1.0.0',
    author: 'SendCraft',
    icon: 'pdf',
    color: 'text-emerald-400',
    gradient: 'from-emerald-500/20 to-cyan-500/20',
    badge: 'Oficial',
    stats: [
      { label: 'Versión', value: '1.0.0' },
      { label: 'Endpoint', value: 'POST /generate-pdf' },
      { label: 'Auth', value: 'API Key' },
    ],
    auth: {
      type: 'api_key',
      header: 'x-api-key',
      label: 'API Key de la aplicación',
      placeholder: 'sk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      hint: 'La misma API Key de tu aplicación en SendCraft',
    },
    baseUrl: BASE_URL,
    actions: [
      {
        id: 'generate_pdf',
        name: 'Generar PDF',
        description: 'Genera un PDF desde un template y devuelve base64 + URL pública de descarga.',
        method: 'POST',
        endpoint: '/generate-pdf',
        params: [
          {
            key: 'pdf_template_name',
            field_path: 'pdf_template_name',
            label: 'Nombre del template PDF',
            type: 'string',
            required: true,
            placeholder: 'factura_pdf',
            description: 'Nombre del template PDF en SendCraft (alternativa a template_id)',
          },
          {
            key: 'data',
            field_path: 'data',
            label: 'Variables del template',
            type: 'object',
            required: true,
            placeholder: '{"cliente": "Juan", "total": 1220}',
            description: 'Objeto JSON con las variables a inyectar en el template',
          },
          {
            key: 'order_id',
            field_path: 'order_id',
            label: 'ID de orden',
            type: 'string',
            required: false,
            placeholder: 'ORD-2024-001',
            description: 'ID para deduplicación — si ya existe un PDF para este order_id, se reutiliza',
          },
        ],
        request_example: {
          pdf_template_name: 'factura_pdf',
          data: {
            cliente: 'Juan Pérez',
            rut: '211234560018',
            fecha: '2026-05-07',
            items: [
              { descripcion: 'Servicio A', cantidad: 1, precio_unitario: 1000, total: 1000 },
            ],
            subtotal: 1000,
            iva: 220,
            total: 1220,
          },
        },
      },
    ],
    features: [
      'URL pública de descarga con expiración configurable',
      'CSS completo soportado (fuentes, imágenes, tablas)',
      'Variables dinámicas en todo el documento',
      'Respuesta en base64 para uso directo',
      'Deduplicación automática por order_id',
    ],
  },
  {
    id: 'sendcraft-notify',
    name: 'SendCraft Notify',
    tagline: 'Campañas y notificaciones masivas asíncronas',
    description: 'Envía emails, PDFs o ambos a una lista de destinatarios en una sola llamada. El procesamiento es asíncrono: recibís un job_id de inmediato y podés consultar el progreso en cualquier momento. Ideal para campañas, facturas en lote y notificaciones masivas.',
    category: 'automation',
    version: '1.0.0',
    author: 'SendCraft',
    icon: 'automation',
    color: 'text-rose-400',
    gradient: 'from-rose-500/20 to-orange-500/20',
    badge: 'Oficial',
    stats: [
      { label: 'Versión', value: '1.0.0' },
      { label: 'Endpoint', value: 'POST /notify' },
      { label: 'Modo', value: 'Async' },
    ],
    auth: {
      type: 'api_key',
      header: 'x-api-key',
      label: 'API Key de la aplicación',
      placeholder: 'sk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      hint: 'La misma API Key de tu aplicación en SendCraft',
    },
    baseUrl: BASE_URL,
    actions: [
      {
        id: 'create_campaign',
        name: 'Crear campaña',
        description: 'Dispara una campaña asíncrona para una lista de destinatarios. Devuelve un job_id en < 200 ms para consultar el progreso.',
        method: 'POST',
        endpoint: '/notify',
        params: [
          {
            key: 'type',
            field_path: 'type',
            label: 'Tipo de notificación',
            type: 'select',
            required: true,
            description: 'Define qué se envía a cada destinatario',
            options: [
              { value: 'email', label: 'Solo email' },
              { value: 'email_pdf', label: 'Email + PDF adjunto' },
              { value: 'pdf', label: 'Solo generar PDF' },
            ],
          },
          {
            key: 'template_name',
            field_path: 'template_name',
            label: 'Template de email',
            type: 'string',
            required: false,
            placeholder: 'factura_email',
            description: "Requerido para type 'email' y 'email_pdf'",
          },
          {
            key: 'recipients',
            field_path: 'recipients',
            label: 'Lista de destinatarios',
            type: 'array',
            required: true,
            placeholder: '[{"email":"juan@empresa.com","data":{"nombre":"Juan"}}]',
            description: 'Array de objetos con email y data opcional por destinatario',
          },
          {
            key: 'shared_data',
            field_path: 'shared_data',
            label: 'Datos compartidos',
            type: 'object',
            required: false,
            placeholder: '{"empresa":"Acme SA","año":2026}',
            description: 'Se fusiona con el data de cada destinatario (el destinatario tiene prioridad)',
          },
          {
            key: 'pdf_template_name',
            field_path: 'attachment.pdf_template_name',
            label: 'Template del PDF',
            type: 'string',
            required: false,
            placeholder: 'factura_pdf',
            description: "Requerido para type 'email_pdf' y 'pdf'",
          },
          {
            key: 'pdf_filename',
            field_path: 'attachment.filename',
            label: 'Nombre del archivo PDF',
            type: 'string',
            required: false,
            placeholder: 'factura-{{order_id}}.pdf',
            description: 'Patrón de nombre con variables {{}}',
          },
          {
            key: 'concurrency',
            field_path: 'options.concurrency',
            label: 'Concurrencia',
            type: 'string',
            required: false,
            placeholder: '5',
            description: 'Destinatarios procesados en paralelo (1-20, default 5)',
          },
        ],
        request_example: {
          type: 'email_pdf',
          template_name: 'factura_email',
          shared_data: { empresa: 'Acme SA', año: 2026 },
          recipients: [
            { email: 'juan@empresa.com', data: { nombre: 'Juan Pérez', total: 1220 } },
            { email: 'ana@empresa.com',  data: { nombre: 'Ana López',  total: 980  } },
          ],
          attachment: { pdf_template_name: 'factura_pdf', filename: 'factura-{{nombre}}.pdf' },
          options: { concurrency: 5, stop_on_error: false },
        },
      },
      {
        id: 'get_campaign_status',
        name: 'Estado de campaña',
        description: 'Consulta el progreso de un job por su ID. Devuelve totales y resultado por destinatario.',
        method: 'GET',
        endpoint: '/notify/:job_id',
        params: [
          {
            key: 'job_id',
            field_path: 'path.job_id',
            label: 'ID del job',
            type: 'string',
            required: true,
            placeholder: 'uuid-del-job',
            description: 'El job_id devuelto al crear la campaña',
          },
        ],
        request_example: {
          _note: 'GET — reemplazá :job_id en la URL con el valor devuelto al crear la campaña',
          url: `${BASE_URL}/notify/uuid-del-job`,
        },
      },
    ],
    features: [
      'Procesamiento asíncrono — job_id en < 200 ms',
      'Tipos: email, email + PDF adjunto, solo PDF',
      'Datos compartidos + override por destinatario',
      'Concurrencia configurable hasta 20 en paralelo',
      'Progreso consultable en tiempo real por job_id',
    ],
  },
  {
    id: 'sendcraft-webhook',
    name: 'SendCraft Webhooks',
    tagline: 'Tracking de emails en tiempo real',
    description: 'Pixel de tracking y redirección de clicks para monitorear aperturas y clics en emails enviados. Se configura automáticamente en los templates — no requiere llamadas manuales.',
    category: 'automation',
    version: '1.0.0',
    author: 'SendCraft',
    icon: 'automation',
    color: 'text-amber-400',
    gradient: 'from-amber-500/20 to-orange-500/20',
    badge: 'Oficial',
    stats: [
      { label: 'Versión', value: '1.0.0' },
      { label: 'Eventos', value: 'opened / clicked' },
      { label: 'Auth', value: 'Automático' },
    ],
    auth: {
      type: 'api_key',
      header: 'x-api-key',
      label: 'No requiere autenticación',
      placeholder: '',
      hint: 'El tracking se configura automáticamente al enviar emails con SendCraft',
    },
    baseUrl: BASE_URL,
    actions: [
      {
        id: 'track_open',
        name: 'Pixel de apertura',
        description: 'GET automático cuando el destinatario abre el email. Registra opened_at en los logs. No requiere llamada manual.',
        method: 'GET',
        endpoint: '/track-email/open?log_id={log_id}',
        params: [
          {
            key: 'log_id',
            field_path: 'query.log_id',
            label: 'ID del log de email',
            type: 'string',
            required: true,
            placeholder: 'uuid-del-log',
            description: 'ID del registro de envío — SendCraft lo inyecta automáticamente en el template',
          },
        ],
        request_example: {
          _note: 'Endpoint GET — SendCraft lo inyecta automáticamente como pixel 1x1 en el email',
          url: `${BASE_URL}/track-email/open?log_id=<log_id>`,
          response: '1x1 GIF transparente',
        },
      },
      {
        id: 'track_click',
        name: 'Tracking de clics',
        description: 'GET automático al hacer clic en un enlace del email. Registra clicked_at y redirige al destino. No requiere llamada manual.',
        method: 'GET',
        endpoint: '/track-email/click?log_id={log_id}&url={url}',
        params: [
          {
            key: 'log_id',
            field_path: 'query.log_id',
            label: 'ID del log de email',
            type: 'string',
            required: true,
            placeholder: 'uuid-del-log',
            description: 'ID del registro de envío',
          },
          {
            key: 'url',
            field_path: 'query.url',
            label: 'URL de destino',
            type: 'string',
            required: true,
            placeholder: 'https://app.ejemplo.com/destino',
            description: 'URL codificada a la que se redirige al usuario (302)',
          },
        ],
        request_example: {
          _note: 'Endpoint GET — SendCraft envuelve los links del email automáticamente',
          url: `${BASE_URL}/track-email/click?log_id=<log_id>&url=<encoded_url>`,
          response: 'HTTP 302 redirect al destino original',
        },
      },
    ],
    features: [
      'Pixel de apertura 1×1 inyectado automáticamente',
      'Tracking de clics con redirección transparente',
      'Registra opened_at y clicked_at en los logs',
      'Sin configuración manual — funciona con todos los templates',
      'Visible en el dashboard de estadísticas',
    ],
  },
];

/* ── Icon components ───────────────────────────────────────────────── */

const ConnectorIcon = ({ type, size = 'md' }: { type: string; size?: 'sm' | 'md' | 'lg' }) => {
  const sz = size === 'lg' ? 'w-10 h-10' : size === 'sm' ? 'w-5 h-5' : 'w-7 h-7';
  if (type === 'mail') return <Mail className={sz} />;
  if (type === 'pdf') return <FileText className={sz} />;
  return <Zap className={sz} />;
};

/* ── Detail modal ──────────────────────────────────────────────────── */

const ConnectorModal = ({
  connector,
  onClose,
}: {
  connector: ConnectorManifest;
  onClose: () => void;
}) => {
  const [copied, setCopied] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState(0);

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const action = connector.actions[activeAction];

  const isGetEndpoint = action.method === 'GET';
  const curlExample = isGetEndpoint
    ? `curl -X GET \\\n  "${connector.baseUrl}${action.endpoint}"`
    : `curl -X POST \\\n  "${connector.baseUrl}${action.endpoint}" \\\n  -H "Content-Type: application/json" \\\n  -H "${connector.auth.header}: TU_API_KEY" \\\n  -d '${JSON.stringify(action.request_example, null, 2)}'`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className={`bg-gradient-to-r ${connector.gradient} border-b border-slate-700/60 px-6 py-5`}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-center ${connector.color}`}>
                <ConnectorIcon type={connector.icon} size="lg" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <h2 className="text-xl font-bold text-white">{connector.name}</h2>
                  {connector.badge && (
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      connector.badge === 'Oficial' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                      : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    }`}>{connector.badge}</span>
                  )}
                </div>
                <p className="text-slate-400 text-sm">{connector.tagline}</p>
                <div className="flex items-center gap-3 mt-2">
                  {connector.stats.map((s, i) => (
                    <span key={i} className="text-xs text-slate-500">
                      <span className="text-slate-300">{s.value}</span> {s.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-700/50 text-slate-400 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1">
          <div className="p-6 space-y-6">
            {/* Description */}
            <p className="text-slate-300 text-sm leading-relaxed">{connector.description}</p>

            {/* Features */}
            <div>
              <h3 className="text-sm font-semibold text-white mb-3">Características</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {connector.features.map((f, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-slate-400">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />
                    {f}
                  </div>
                ))}
              </div>
            </div>

            {/* Auth */}
            <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4">
              <div className="flex items-center gap-2 mb-3">
                <ShieldCheck className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-semibold text-white">Autenticación</h3>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Header</span>
                  <code className="text-cyan-400 bg-slate-900/60 px-2 py-0.5 rounded text-xs">{connector.auth.header}</code>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Tipo</span>
                  <span className="text-slate-300 text-xs">API Key</span>
                </div>
                <p className="text-xs text-slate-500 pt-1 border-t border-slate-700/50">{connector.auth.hint}</p>
              </div>
            </div>

            {/* Actions */}
            <div>
              <h3 className="text-sm font-semibold text-white mb-3">Acciones disponibles</h3>
              {connector.actions.length > 1 && (
                <div className="flex gap-2 mb-4 flex-wrap">
                  {connector.actions.map((a, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveAction(i)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        activeAction === i
                          ? 'bg-cyan-500 text-white'
                          : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                      }`}
                    >
                      {a.name}
                    </button>
                  ))}
                </div>
              )}

              <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">{action.method}</span>
                  <code className="text-sm text-slate-300">{action.endpoint}</code>
                </div>
                <p className="text-xs text-slate-500 mb-4">{action.description}</p>

                <div className="space-y-2 mb-4">
                  {action.params.map((p, i) => (
                    <div key={i} className="flex items-start gap-3 text-xs">
                      <div className="flex flex-col gap-0.5 flex-shrink-0">
                        <code className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${p.required ? 'bg-cyan-500/15 text-cyan-400' : 'bg-slate-700/50 text-slate-400'}`}>
                          {p.field_path}
                        </code>
                        <span className="text-[9px] text-slate-600 pl-0.5">{p.type}{p.required ? ' · req.' : ' · opt.'}</span>
                      </div>
                      <div className="flex-1">
                        <span className="text-slate-300">{p.label}</span>
                        {p.description && <span className="text-slate-500 ml-1">— {p.description}</span>}
                      </div>
                    </div>
                  ))}
                </div>

                {/* cURL example */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-slate-500">Ejemplo cURL</span>
                    <button
                      onClick={() => copy(curlExample, 'curl')}
                      className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      {copied === 'curl' ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      {copied === 'curl' ? 'Copiado' : 'Copiar'}
                    </button>
                  </div>
                  <pre className="bg-slate-950/60 rounded-lg p-3 text-[11px] text-slate-300 overflow-x-auto leading-relaxed border border-slate-700/40">
                    {curlExample}
                  </pre>
                </div>
              </div>
            </div>

            {/* Manifest JSON download hint */}
            <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 px-4 py-3 space-y-2">
              <div className="flex items-center gap-2">
                <Globe className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                <span className="text-xs font-semibold text-white">URL pública del manifiesto</span>
              </div>
              <div className="flex items-center gap-2 bg-slate-950/50 border border-slate-700/50 rounded-lg px-3 py-2">
                <code className="flex-1 text-[11px] text-cyan-300 break-all">
                  {`https://drhbcmithlrldtjlhnee.supabase.co/functions/v1/connectors/${connector.id}`}
                </code>
                <button
                  onClick={() => copy(`https://drhbcmithlrldtjlhnee.supabase.co/functions/v1/connectors/${connector.id}`, 'url')}
                  className="flex-shrink-0 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {copied === 'url' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <p className="text-[11px] text-slate-600">Tu CRM puede hacer GET a esta URL para leer el manifiesto completo y saber cómo conectarse — sin autenticación.</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-700/60 px-6 py-4 bg-slate-900/50 flex items-center justify-between gap-3">
          <span className="text-xs text-slate-500">v{connector.version} · por {connector.author}</span>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors">
              Cerrar
            </button>
            <button
              onClick={() => copy(JSON.stringify({
                connector_id: connector.id,
                name: connector.name,
                version: connector.version,
                auth: { type: connector.auth.type, header: connector.auth.header },
                base_url: connector.baseUrl,
                actions: connector.actions.map(a => ({
                  id: a.id,
                  method: a.method,
                  endpoint: a.endpoint,
                  params: a.params.map(p => ({ key: p.key, field_path: p.field_path, type: p.type, required: p.required })),
                  request_example: a.request_example,
                })),
              }, null, 2), 'manifest')}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {copied === 'manifest' ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied === 'manifest' ? 'Copiado!' : 'Copiar manifiesto JSON'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ── Category badge ────────────────────────────────────────────────── */

const CATEGORY_LABELS: Record<string, string> = {
  email: 'Email',
  pdf: 'PDF',
  automation: 'Automatización',
};

const CATEGORY_COLORS: Record<string, string> = {
  email: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
  pdf: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  automation: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
};

/* ── Connector card ────────────────────────────────────────────────── */

const ConnectorCard = ({
  connector,
  onDetails,
}: {
  connector: ConnectorManifest;
  onDetails: () => void;
}) => {
  return (
    <div className="group bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700 hover:border-slate-600 transition-all duration-200 overflow-hidden flex flex-col">
      {/* Card top gradient band */}
      <div className={`h-1 w-full bg-gradient-to-r ${connector.gradient.replace('/20', '')}`} />

      <div className="p-5 flex-1 flex flex-col">
        {/* Header row */}
        <div className="flex items-start justify-between mb-4">
          <div className={`w-12 h-12 rounded-xl bg-slate-900/70 border border-slate-700 flex items-center justify-center ${connector.color} group-hover:scale-105 transition-transform`}>
            <ConnectorIcon type={connector.icon} size="md" />
          </div>
          <div className="flex items-center gap-2">
            {connector.badge && (
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                connector.badge === 'Oficial'
                  ? 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30'
                  : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
              }`}>{connector.badge}</span>
            )}
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${CATEGORY_COLORS[connector.category]}`}>
              {CATEGORY_LABELS[connector.category]}
            </span>
          </div>
        </div>

        {/* Name + tagline */}
        <h3 className="text-base font-bold text-white mb-1">{connector.name}</h3>
        <p className="text-xs text-slate-400 mb-3 leading-relaxed">{connector.tagline}</p>

        {/* Features preview */}
        <ul className="space-y-1.5 mb-4 flex-1">
          {connector.features.slice(0, 3).map((f, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-slate-500">
              <CheckCircle2 className="w-3 h-3 text-emerald-400/70 mt-0.5 flex-shrink-0" />
              {f}
            </li>
          ))}
        </ul>

        {/* Stats strip */}
        <div className="flex items-center gap-3 pt-3 border-t border-slate-700/50 mb-4">
          {connector.stats.map((s, i) => (
            <div key={i} className="flex flex-col">
              <span className="text-[10px] text-slate-500">{s.label}</span>
              <span className="text-xs font-semibold text-slate-300">{s.value}</span>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={onDetails}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all bg-gradient-to-r ${connector.gradient.replace('/20', '/30')} hover:${connector.gradient.replace('/20', '/50')} border border-slate-600/50 hover:border-slate-500 text-white`}
          >
            Ver detalles
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

/* ── Embed section ─────────────────────────────────────────────────── */

const EMBED_URL = 'https://drhbcmithlrldtjlhnee.supabase.co/embed/marketplace';

const EMBED_CODE = `<!-- SendCraft Marketplace — con fallback popup si el iframe es bloqueado -->
<div id="sendcraft-wrapper"></div>

<script>
(function () {
  var MARKET_URL = '${EMBED_URL}';
  var wrapper = document.getElementById('sendcraft-wrapper');

  function onMessage(event) {
    if (event.data && event.data.type === 'SENDCRAFT_CONNECTOR_INSTALLED') {
      var data = event.data;
      console.log('Conector instalado:', data.connector_id);
      // data.api_key      → API Key del usuario
      // data.auth_header  → 'x-api-key'
      // data.manifest     → manifiesto completo con URLs y params
      // data.app_name     → nombre de la app en SendCraft
      saveConnector(data);
    }
  }
  window.addEventListener('message', onMessage);

  // Intenta iframe; si se bloquea muestra botón popup
  var iframe = document.createElement('iframe');
  iframe.src = MARKET_URL;
  iframe.id = 'sendcraft-marketplace';
  iframe.width = '100%';
  iframe.height = '600';
  iframe.style.cssText = 'border:none;border-radius:12px;display:block;';

  var blocked = false;
  iframe.addEventListener('error', showFallback);

  // Timeout: si a los 4 s el iframe sigue en blanco, asumimos bloqueo
  var timer = setTimeout(function () {
    try {
      var doc = iframe.contentDocument || iframe.contentWindow.document;
      if (!doc || doc.URL === 'about:blank') showFallback();
    } catch (_) { showFallback(); }
  }, 4000);

  iframe.addEventListener('load', function () {
    clearTimeout(timer);
  });

  function showFallback() {
    if (blocked) return;
    blocked = true;
    iframe.remove();
    var btn = document.createElement('button');
    btn.textContent = '⚡  Abrir marketplace SendCraft';
    btn.style.cssText = [
      'display:flex;align-items:center;justify-content:center;gap:8px;',
      'width:100%;padding:14px 20px;border:none;border-radius:12px;',
      'background:#06b6d4;color:#fff;font-size:14px;font-weight:700;',
      'cursor:pointer;transition:background .2s;'
    ].join('');
    btn.onmouseover = function () { btn.style.background = '#22d3ee'; };
    btn.onmouseout  = function () { btn.style.background = '#06b6d4'; };
    btn.onclick = openPopup;
    wrapper.appendChild(btn);
  }

  function openPopup() {
    var w = 480, h = 660;
    var left = Math.round(screen.width  / 2 - w / 2);
    var top  = Math.round(screen.height / 2 - h / 2);
    window.open(
      MARKET_URL,
      'sendcraft_marketplace',
      'width=' + w + ',height=' + h + ',left=' + left + ',top=' + top +
      ',toolbar=0,menubar=0,scrollbars=1,resizable=1'
    );
  }

  wrapper.appendChild(iframe);
})();
</script>`;

/* ── EmbedSection live preview ─────────────────────────────────────── */

const EmbedSection = () => {
  const [copied, setCopied] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeBlocked, setIframeBlocked] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Detect if the iframe is blocked by checking for blank content after load
    timerRef.current = setTimeout(() => {
      const iframe = iframeRef.current;
      if (!iframe) return;
      try {
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!doc || doc.URL === 'about:blank') setIframeBlocked(true);
      } catch (_) {
        setIframeBlocked(true);
      }
    }, 4000);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  const handleIframeLoad = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const iframe = iframeRef.current;
    if (!iframe) return;
    try {
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc || doc.URL === 'about:blank') setIframeBlocked(true);
    } catch (_) {
      setIframeBlocked(true);
    }
  };

  const openPopup = () => {
    const w = 480, h = 660;
    const left = Math.round(screen.width / 2 - w / 2);
    const top  = Math.round(screen.height / 2 - h / 2);
    window.open(
      EMBED_URL,
      'sendcraft_marketplace',
      `width=${w},height=${h},left=${left},top=${top},toolbar=0,menubar=0,scrollbars=1,resizable=1`,
    );
  };

  const copy = () => {
    navigator.clipboard.writeText(EMBED_CODE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="border border-slate-700 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="bg-slate-800/60 px-5 py-4 border-b border-slate-700 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-white">Embeber en tu CRM</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Pegá este código en tu sistema. El usuario instala el conector y tu CRM recibe todo via <code className="text-slate-400">postMessage</code> (iframe o popup).
          </p>
        </div>
        <a
          href={EMBED_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white rounded-lg text-xs font-medium transition-colors flex-shrink-0"
        >
          <Globe className="w-3.5 h-3.5" />
          Vista previa
        </a>
      </div>

      {/* Live preview */}
      <div className="bg-slate-900/60 border-b border-slate-700/50 p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Vista previa en vivo</span>
          {iframeBlocked && (
            <span className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
              iframe bloqueado — modo popup activo
            </span>
          )}
        </div>
        {iframeBlocked ? (
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 flex flex-col items-center gap-4">
            <div className="text-center">
              <p className="text-sm text-slate-300 font-medium mb-1">El iframe está bloqueado por cabeceras del servidor</p>
              <p className="text-xs text-slate-500">En producción se muestra este botón; al hacer clic se abre una ventana popup centrada.</p>
            </div>
            <button
              onClick={openPopup}
              className="flex items-center gap-2 px-5 py-3 bg-cyan-500 hover:bg-cyan-400 text-white text-sm font-bold rounded-xl transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Abrir marketplace SendCraft
            </button>
            <p className="text-[10px] text-slate-600">Cuando el usuario instala un conector en la ventana popup, tu página recibe el evento via <code className="text-slate-500">postMessage</code></p>
          </div>
        ) : (
          <div className="rounded-xl overflow-hidden border border-slate-700/50" style={{ height: 420 }}>
            <iframe
              ref={iframeRef}
              src={EMBED_URL}
              width="100%"
              height="100%"
              style={{ border: 'none', display: 'block' }}
              onLoad={handleIframeLoad}
              onError={() => setIframeBlocked(true)}
              title="SendCraft Marketplace"
            />
          </div>
        )}
      </div>

      {/* Code block */}
      <div className="relative bg-slate-950/50">
        <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800/60">
          <span className="text-[10px] text-slate-600 font-mono uppercase tracking-wider">HTML</span>
          <button
            onClick={copy}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copiado' : 'Copiar código'}
          </button>
        </div>
        <pre className="px-5 py-4 text-[11px] text-slate-300 overflow-x-auto leading-relaxed">{EMBED_CODE}</pre>
      </div>

      {/* postMessage payload doc */}
      <div className="px-5 py-4 bg-slate-800/20 border-t border-slate-700/50">
        <p className="text-xs font-semibold text-slate-400 mb-3">Payload que recibís en <code className="text-slate-300">event.data</code> (iframe y popup)</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            { key: 'type', desc: 'Siempre "SENDCRAFT_CONNECTOR_INSTALLED"' },
            { key: 'connector_id', desc: 'ID del conector instalado' },
            { key: 'api_key', desc: 'API Key ingresada por el usuario' },
            { key: 'auth_header', desc: 'Header a usar en las llamadas (x-api-key)' },
            { key: 'manifest', desc: 'Manifiesto completo con URLs y params' },
            { key: 'app_name', desc: 'Nombre de la app en SendCraft' },
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-2 text-xs">
              <code className="text-cyan-400 bg-slate-900/60 px-1.5 py-0.5 rounded text-[10px] flex-shrink-0">{item.key}</code>
              <span className="text-slate-500">{item.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ── Main page ─────────────────────────────────────────────────────── */

const REGISTRY_URL = 'https://drhbcmithlrldtjlhnee.supabase.co/functions/v1/connectors';

export const Marketplace = () => {
  const [filter, setFilter] = useState<'all' | 'email' | 'pdf' | 'automation'>('all');
  const [selected, setSelected] = useState<ConnectorManifest | null>(null);
  const [copiedRegistry, setCopiedRegistry] = useState(false);

  const copyRegistry = () => {
    navigator.clipboard.writeText(REGISTRY_URL);
    setCopiedRegistry(true);
    setTimeout(() => setCopiedRegistry(false), 2000);
  };

  const filtered = filter === 'all' ? CONNECTORS : CONNECTORS.filter(c => c.category === filter);

  const counts = {
    all: CONNECTORS.length,
    email: CONNECTORS.filter(c => c.category === 'email').length,
    pdf: CONNECTORS.filter(c => c.category === 'pdf').length,
    automation: CONNECTORS.filter(c => c.category === 'automation').length,
  };

  return (
    <Layout currentPage="marketplace">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Package className="w-5 h-5 text-cyan-400" />
              <h1 className="text-2xl sm:text-3xl font-bold text-white">Marketplace</h1>
            </div>
            <p className="text-slate-400 text-sm">
              Conectores listos para instalar en tu CRM. Usá la API Key de tu aplicación para autenticarte.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            Todos los conectores usan <code className="text-slate-300 mx-0.5">x-api-key</code> en el header
          </div>
        </div>

        {/* Registry URL — the main integration point */}
        <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-cyan-400 flex-shrink-0" />
            <span className="text-sm font-semibold text-white">Registry público — apuntá tu CRM a esta URL</span>
          </div>
          <div className="flex items-center gap-2 bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2.5">
            <code className="flex-1 text-xs text-cyan-300 break-all">{REGISTRY_URL}</code>
            <button
              onClick={copyRegistry}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg text-xs font-medium transition-colors flex-shrink-0"
            >
              {copiedRegistry ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedRegistry ? 'Copiado' : 'Copiar'}
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-slate-500">
            <span className="flex items-center gap-1"><ChevronRight className="w-3 h-3 text-cyan-500" /><code className="text-slate-400">GET /connectors</code> lista todos los conectores</span>
            <span className="flex items-center gap-1"><ChevronRight className="w-3 h-3 text-cyan-500" /><code className="text-slate-400">GET /connectors/:id</code> devuelve el manifiesto completo</span>
            <span className="flex items-center gap-1"><ChevronRight className="w-3 h-3 text-cyan-500" />Sin autenticación — acceso público</span>
          </div>
        </div>

        {/* How it works steps */}
        <div className="flex flex-wrap items-center gap-3 text-sm px-1">
          {[
            'Tu CRM hace GET al registry',
            'Muestra los conectores disponibles',
            'Usuario instala y pega su API Key',
            'Campaña dispara → tu CRM llama la API → listo',
          ].map((step, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-[10px] font-bold text-cyan-400 flex-shrink-0">{i + 1}</div>
              <span className="text-slate-400">{step}</span>
              {i < 3 && <ChevronRight className="w-3.5 h-3.5 text-slate-700 hidden sm:block" />}
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          {(['all', 'email', 'pdf', 'automation'] as const).map(cat => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === cat
                  ? 'bg-cyan-500 text-white'
                  : 'bg-slate-800/60 text-slate-400 hover:bg-slate-700 hover:text-white'
              }`}
            >
              {cat === 'all' ? 'Todos' : CATEGORY_LABELS[cat]}
              <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${filter === cat ? 'bg-white/20' : 'bg-slate-700 text-slate-500'}`}>
                {counts[cat]}
              </span>
            </button>
          ))}
        </div>

        {/* Connector grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {filtered.map(connector => (
            <ConnectorCard
              key={connector.id}
              connector={connector}
              onDetails={() => setSelected(connector)}
            />
          ))}
        </div>

        {/* Embed section */}
        <EmbedSection />

        {/* Footer note */}
        <div className="text-center pt-2">
          <p className="text-xs text-slate-600">
            ¿Necesitás un conector personalizado?{' '}
            <span className="text-slate-500">Contactanos para integraciones a medida.</span>
          </p>
        </div>
      </div>

      {/* Detail modal */}
      {selected && (
        <ConnectorModal connector={selected} onClose={() => setSelected(null)} />
      )}
    </Layout>
  );
};

export default Marketplace;
