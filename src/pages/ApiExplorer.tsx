import { useState, useCallback } from 'react';
import {
  Zap, Copy, Check, ChevronDown, ChevronRight, Play,
  AlertCircle, CheckCircle, Clock, Send, FileText, Mail,
  Webhook, Activity, Eye, Code2, Lock, BookOpen, Terminal
} from 'lucide-react';
import { Layout } from '../components/Layout';
import { configManager } from '../lib/config';
import { useAuth } from '../contexts/AuthContext';

// ─── Types ───────────────────────────────────────────────────────────────────

type HttpMethod = 'GET' | 'POST';

interface Field {
  name: string;
  type: string;
  required: boolean;
  description: string;
  example?: string | number | boolean | object;
}

interface ResponseExample {
  code: number;
  label: string;
  body: object;
}

interface EndpointDef {
  id: string;
  group: string;
  title: string;
  method: HttpMethod;
  path: string;
  description: string;
  authType: 'api-key' | 'none';
  fields: Field[];
  responses: ResponseExample[];
  icon: React.FC<{ className?: string }>;
}

// ─── Endpoint Definitions ────────────────────────────────────────────────────

const ENDPOINTS: EndpointDef[] = [
  {
    id: 'send-email',
    group: 'Email',
    title: 'Enviar Email',
    method: 'POST',
    path: '/functions/v1/send-email',
    description: 'Envía un email utilizando un template HTML predefinido. Soporta adjuntos PDF, datos de template dinámicos y control de duplicados.',
    authType: 'api-key',
    icon: Mail,
    fields: [
      { name: 'recipient_email', type: 'string', required: true, description: 'Email del destinatario', example: 'cliente@empresa.com' },
      { name: 'template_name', type: 'string', required: true, description: 'Nombre exacto del template a utilizar', example: 'bienvenida-cliente' },
      { name: 'data', type: 'object', required: true, description: 'Variables del template. Las claves deben coincidir con los placeholders {{variable}} del template.', example: { nombre: 'Juan Pérez', numero_pedido: '12345', total: '1500.00' } },
      { name: 'subject', type: 'string', required: false, description: 'Asunto personalizado. Si se omite, usa el asunto definido en el template.', example: 'Tu pedido #12345 fue confirmado' },
      { name: 'order_id', type: 'string', required: false, description: 'ID externo del pedido. Se usa para evitar envíos duplicados.', example: 'ORD-2024-001' },
    ],
    responses: [
      {
        code: 200, label: 'Éxito',
        body: { success: true, message: 'Email enviado exitosamente', log_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', resend_email_id: 're_abc123', processing_time_ms: 342 }
      },
      {
        code: 400, label: 'Solicitud inválida',
        body: { success: false, error: 'Missing required fields: recipient_email, template_name' }
      },
      {
        code: 401, label: 'No autorizado',
        body: { success: false, error: 'Invalid or missing API key' }
      },
      {
        code: 404, label: 'Template no encontrado',
        body: { success: false, error: 'Template "nombre-template" not found' }
      },
      {
        code: 500, label: 'Error del servidor',
        body: { success: false, error: 'Email credentials not configured for this application' }
      },
    ],
  },
  {
    id: 'send-email-with-pdf',
    group: 'Email',
    title: 'Enviar Email con PDF Adjunto',
    method: 'POST',
    path: '/functions/v1/send-email-with-pdf',
    description: 'Genera un PDF y lo envía como adjunto en un solo llamado. Define el template de email y el template del PDF por separado, cada uno con sus propios datos. Si el PDF supera 1MB se adjunta un link de descarga en el cuerpo del email.',
    authType: 'api-key',
    icon: FileText,
    fields: [
      { name: 'recipient_email', type: 'string', required: true, description: 'Email del destinatario', example: 'cliente@empresa.com' },
      { name: 'order_id', type: 'string', required: false, description: 'ID del pedido para auditoría y deduplicación', example: 'ORD-2024-001' },
      { name: 'email', type: 'object', required: true, description: 'Sección del email: template_name (required), subject (optional), data (optional)', example: { template_name: 'email_envioi_pdf', subject: 'Tu factura está lista', data: { nombre: 'Juan Pérez', empresa: 'Acme SA' } } },
      { name: 'attachment', type: 'object', required: true, description: 'Sección del PDF adjunto: pdf_template_name (required), filename (optional, soporta {{variables}}), data (optional)', example: { pdf_template_name: 'invoice_pdf', filename: 'factura-{{order_id}}.pdf', data: { cliente: 'Juan Pérez', total: '1500.00', items: [] } } },
    ],
    responses: [
      {
        code: 200, label: 'Email enviado con PDF',
        body: { success: true, message: 'Email with PDF attachment sent successfully', log_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', pdf_log_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901', pdf_filename: 'factura-ORD-001.pdf', pdf_size_bytes: 48320, pdf_attached_inline: true, pdf_public_url: 'https://...', resend_email_id: 're_abc123', processing_time_ms: 1240 }
      },
      {
        code: 400, label: 'Campos faltantes',
        body: { success: false, error: 'attachment.pdf_template_name is required' }
      },
      {
        code: 401, label: 'No autorizado',
        body: { success: false, error: 'Invalid or missing API key' }
      },
      {
        code: 404, label: 'Template no encontrado',
        body: { success: false, error: "PDF template 'invoice_pdf' not found" }
      },
      {
        code: 500, label: 'Error del servidor',
        body: { success: false, error: 'Failed to send email', details: 'Gotenberg service unreachable' }
      },
    ],
  },
  {
    id: 'pending-communication',
    group: 'Comunicaciones Pendientes',
    title: 'Crear Comunicación Pendiente',
    method: 'POST',
    path: '/functions/v1/pending-communication',
    description: 'Crea una comunicación en estado de espera. Útil cuando necesitas enviar un email pero aún no tienes todos los datos (ej: esperar a que se genere una factura PDF).',
    authType: 'api-key',
    icon: Clock,
    fields: [
      { name: 'template_name', type: 'string', required: true, description: 'Nombre del template de email', example: 'factura-cliente' },
      { name: 'recipient_email', type: 'string', required: true, description: 'Email del destinatario', example: 'cliente@empresa.com' },
      { name: 'data', type: 'object', required: false, description: 'Datos iniciales del template disponibles al momento de la creación', example: { nombre: 'Juan Pérez', empresa: 'Acme SA' } },
      { name: 'order_id', type: 'string', required: false, description: 'ID externo para relacionar la comunicación con un pedido/factura', example: 'FACT-2024-0123' },
      { name: 'wait_for_invoice', type: 'boolean', required: false, description: 'Si true, el sistema esperará a que se genere el PDF antes de enviar el email', example: true },
    ],
    responses: [
      {
        code: 200, label: 'Creada exitosamente',
        body: { success: true, message: 'Comunicación pendiente creada', pending_communication_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901', log_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', status: 'queued' }
      },
      {
        code: 400, label: 'Solicitud inválida',
        body: { success: false, error: 'Missing required fields' }
      },
      {
        code: 401, label: 'No autorizado',
        body: { success: false, error: 'Invalid API key' }
      },
    ],
  },
  {
    id: 'complete-pending-communication',
    group: 'Comunicaciones Pendientes',
    title: 'Completar Comunicación Pendiente',
    method: 'POST',
    path: '/functions/v1/complete-pending-communication',
    description: 'Completa una comunicación pendiente con los datos faltantes y dispara el envío del email. Se usa cuando ya tienes toda la información necesaria.',
    authType: 'api-key',
    icon: Send,
    fields: [
      { name: 'pending_communication_id', type: 'string', required: false, description: 'UUID de la comunicación pendiente (obtenido en la respuesta de creación)', example: 'b2c3d4e5-f6a7-8901-bcde-f12345678901' },
      { name: 'external_reference_id', type: 'string', required: false, description: 'ID externo del pedido (alternativa a pending_communication_id). Se debe proporcionar al menos uno.', example: 'FACT-2024-0123' },
      { name: 'completed_data', type: 'object', required: false, description: 'Datos adicionales para completar el template', example: { numero_factura: 'F-001', total: '2500.00', vencimiento: '2024-12-31' } },
    ],
    responses: [
      {
        code: 200, label: 'Email enviado',
        body: { success: true, message: 'Comunicación completada y email enviado', pending_communication_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901', log_id: 'c3d4e5f6-a7b8-9012-cdef-123456789012' }
      },
      {
        code: 400, label: 'Ya fue enviada',
        body: { success: false, error: 'Communication already sent', status: 'sent' }
      },
      {
        code: 404, label: 'No encontrada',
        body: { success: false, error: 'Pending communication not found' }
      },
    ],
  },
  {
    id: 'generate-pdf',
    group: 'PDF',
    title: 'Generar PDF',
    method: 'POST',
    path: '/functions/v1/generate-pdf',
    description: 'Genera un PDF desde un template HTML usando Chromium. El PDF se guarda en la base de datos y se retorna en base64 junto con una URL pública temporal de 90 días.',
    authType: 'api-key',
    icon: FileText,
    fields: [
      { name: 'template_id', type: 'string (UUID)', required: false, description: 'UUID del template PDF. Alternativa a pdf_template_name.', example: 'd4e5f6a7-b8c9-0123-defa-234567890123' },
      { name: 'pdf_template_name', type: 'string', required: false, description: 'Nombre del template PDF. Alternativa a template_id. Se debe proporcionar al menos uno.', example: 'factura-pdf' },
      { name: 'data', type: 'object', required: true, description: 'Variables para renderizar el template PDF. Incluye todos los placeholders {{variable}} definidos en el template.', example: { cliente: 'Empresa XYZ', numero_factura: 'F-001', items: [{ descripcion: 'Servicio A', monto: 1000 }], total: 1000 } },
      { name: 'order_id', type: 'string', required: false, description: 'ID de pedido para deduplicación. Si ya existe un PDF con este order_id, se retorna el existente.', example: 'ORD-2024-001' },
      { name: 'pending_communication_id', type: 'string', required: false, description: 'UUID de una comunicación pendiente a vincular con este PDF generado', example: 'b2c3d4e5-f6a7-8901-bcde-f12345678901' },
    ],
    responses: [
      {
        code: 200, label: 'PDF generado',
        body: {
          success: true,
          message: 'PDF generado exitosamente',
          data: {
            pdf_id: 'e5f6a7b8-c9d0-1234-efab-345678901234',
            pdf_base64: 'JVBERi0xLjQKJcOkw7zDtsOfCjIgMCBvYmoKPDwvTGVuZ3Ro...',
            filename: 'factura_F-001.pdf',
            size_bytes: 48320,
            public_url: 'https://your-project.supabase.co/functions/v1/view-pdf?token=abc123xyz'
          }
        }
      },
      {
        code: 404, label: 'Template no encontrado',
        body: { success: false, error: 'PDF template not found' }
      },
      {
        code: 409, label: 'Duplicado prevenido',
        body: { success: true, message: 'PDF ya generado previamente', duplicate_prevented: true, data: { pdf_id: 'e5f6a7b8-c9d0-1234-efab-345678901234', public_url: 'https://...' } }
      },
    ],
  },
  {
    id: 'view-pdf',
    group: 'PDF',
    title: 'Ver / Descargar PDF',
    method: 'GET',
    path: '/functions/v1/view-pdf',
    description: 'Endpoint público para visualizar o descargar un PDF generado. Accesible sin autenticación mediante un token temporal. Los links expiran a los 90 días.',
    authType: 'none',
    icon: Eye,
    fields: [
      { name: 'token', type: 'string (query param)', required: true, description: 'Token de acceso incluido en la public_url retornada por generate-pdf', example: 'abc123xyz456def789' },
      { name: 'action', type: 'string (query param)', required: false, description: '"view" para visualizar en el navegador (por defecto) o "download" para forzar la descarga', example: 'download' },
    ],
    responses: [
      { code: 200, label: 'PDF retornado', body: { note: 'Retorna el archivo PDF binario con Content-Type: application/pdf' } },
      { code: 400, label: 'Token faltante', body: { error: 'No access token provided' } },
      { code: 404, label: 'No encontrado', body: { error: 'PDF not found or link unavailable' } },
      { code: 410, label: 'Link expirado', body: { error: 'PDF link has expired' } },
    ],
  },
  {
    id: 'health-check-email',
    group: 'Monitoreo',
    title: 'Health Check Email',
    method: 'GET',
    path: '/functions/v1/health-check-email',
    description: 'Verifica el estado del servicio de email. Retorna el proveedor configurado y si está operativo.',
    authType: 'none',
    icon: Activity,
    fields: [
      { name: 'x-api-key', type: 'string (header)', required: false, description: 'API key de la aplicación para verificar credenciales específicas de la app', example: 'sk_live_abc123...' },
    ],
    responses: [
      { code: 200, label: 'Operativo', body: { status: 'operational', responseTime: 145, provider: 'resend', configured: true, timestamp: '2024-01-15T10:30:00Z' } },
      { code: 200, label: 'Degradado', body: { status: 'degraded', responseTime: 2100, provider: 'smtp', configured: true, error: 'Slow connection', timestamp: '2024-01-15T10:30:00Z' } },
    ],
  },
  {
    id: 'health-check-pdf',
    group: 'Monitoreo',
    title: 'Health Check PDF',
    method: 'GET',
    path: '/functions/v1/health-check-pdf',
    description: 'Verifica el estado del servicio de generación de PDF (Gotenberg). Genera un PDF de prueba y mide el tiempo de respuesta.',
    authType: 'none',
    icon: Activity,
    fields: [],
    responses: [
      { code: 200, label: 'Operativo', body: { status: 'operational', responseTime: 890, pdf_size_bytes: 4123, timestamp: '2024-01-15T10:30:00Z' } },
      { code: 200, label: 'Caído', body: { status: 'down', responseTime: 0, error: 'Gotenberg service unreachable', timestamp: '2024-01-15T10:30:00Z' } },
    ],
  },
  {
    id: 'resend-webhook',
    group: 'Webhooks',
    title: 'Webhook Resend',
    method: 'POST',
    path: '/functions/v1/resend-webhook',
    description: 'Recibe eventos del proveedor de email Resend. Actualiza el estado de los logs de email (entregado, rebotado, queja). Configura esta URL en tu panel de Resend.',
    authType: 'none',
    icon: Webhook,
    fields: [
      { name: 'type', type: 'string', required: true, description: 'Tipo de evento Resend', example: 'email.delivered' },
      { name: 'created_at', type: 'string (ISO 8601)', required: true, description: 'Timestamp del evento', example: '2024-01-15T10:30:00Z' },
      { name: 'data', type: 'object', required: true, description: 'Datos del evento', example: { email_id: 're_abc123', from: 'noreply@empresa.com', to: ['cliente@empresa.com'], subject: 'Tu pedido fue confirmado' } },
    ],
    responses: [
      { code: 200, label: 'Procesado', body: { success: true, message: 'Webhook processed', email_log_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' } },
      { code: 200, label: 'Sin matching', body: { success: true, message: 'No matching email log found for this event' } },
    ],
  },
];

const GROUPS = ['Email', 'Comunicaciones Pendientes', 'PDF', 'Monitoreo', 'Webhooks'];

const GROUP_ICONS: Record<string, React.FC<{ className?: string }>> = {
  'Email': Mail,
  'Comunicaciones Pendientes': Clock,
  'PDF': FileText,
  'Monitoreo': Activity,
  'Webhooks': Webhook,
};

// ─── Method badge ─────────────────────────────────────────────────────────────

const MethodBadge = ({ method }: { method: HttpMethod }) => (
  <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-bold tracking-wide ${
    method === 'GET' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
  }`}>
    {method}
  </span>
);

const StatusBadge = ({ code }: { code: number }) => {
  const color = code < 300 ? 'text-green-400 bg-green-500/10 border-green-500/20'
    : code < 500 ? 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20'
    : 'text-red-400 bg-red-500/10 border-red-500/20';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-semibold border ${color}`}>
      {code}
    </span>
  );
};

// ─── Code Block ──────────────────────────────────────────────────────────────

const CodeBlock = ({ code, id, onCopy, copied }: { code: string; id: string; onCopy: (code: string, id: string) => void; copied: string | null }) => (
  <div className="relative group">
    <pre className="bg-slate-950 border border-slate-700/50 rounded-lg p-4 text-xs text-slate-300 overflow-x-auto font-mono leading-relaxed">
      {code}
    </pre>
    <button
      onClick={() => onCopy(code, id)}
      className="absolute top-2 right-2 p-1.5 rounded bg-slate-800 border border-slate-700 text-slate-400 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
    >
      {copied === id ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  </div>
);

// ─── Try-it panel ─────────────────────────────────────────────────────────────

interface TryItPanelProps {
  endpoint: EndpointDef;
  baseUrl: string;
}

const TryItPanel = ({ endpoint, baseUrl }: TryItPanelProps) => {
  const [apiKey, setApiKey] = useState('');
  const [bodyJson, setBodyJson] = useState(() => {
    if (endpoint.method === 'GET') return '';
    const example: Record<string, unknown> = {};
    endpoint.fields.forEach(f => {
      if (f.example !== undefined && !f.name.includes('header') && !f.name.includes('query param')) {
        example[f.name] = f.example;
      }
    });
    return JSON.stringify(example, null, 2);
  });
  const [queryParams, setQueryParams] = useState(() => {
    if (endpoint.method !== 'GET') return '';
    const params: string[] = [];
    endpoint.fields.forEach(f => {
      if (f.example !== undefined) params.push(`${f.name.replace(' (query param)', '')}=${f.example}`);
    });
    return params.join('&');
  });
  const [response, setResponse] = useState<{ status: number; body: string; time: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [jsonError, setJsonError] = useState('');

  const validateJson = (val: string) => {
    try { JSON.parse(val); setJsonError(''); } catch { setJsonError('JSON inválido'); }
  };

  const run = useCallback(async () => {
    setLoading(true);
    setResponse(null);
    const start = Date.now();
    try {
      const url = endpoint.method === 'GET' && queryParams
        ? `${baseUrl}${endpoint.path}?${queryParams}`
        : `${baseUrl}${endpoint.path}`;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (endpoint.authType === 'api-key' && apiKey) headers['x-api-key'] = apiKey;
      const opts: RequestInit = { method: endpoint.method, headers };
      if (endpoint.method === 'POST' && bodyJson) opts.body = bodyJson;
      const res = await fetch(url, opts);
      const text = await res.text();
      let pretty = text;
      try { pretty = JSON.stringify(JSON.parse(text), null, 2); } catch {}
      setResponse({ status: res.status, body: pretty, time: Date.now() - start });
    } catch (err: any) {
      setResponse({ status: 0, body: `Network error: ${err.message}`, time: Date.now() - start });
    } finally {
      setLoading(false);
    }
  }, [endpoint, baseUrl, apiKey, bodyJson, queryParams]);

  return (
    <div className="space-y-4">
      {endpoint.authType === 'api-key' && (
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">API Key</label>
          <input
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder="sk_live_..."
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
          />
        </div>
      )}

      {endpoint.method === 'GET' && endpoint.fields.length > 0 && (
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">Query Parameters</label>
          <input
            value={queryParams}
            onChange={e => setQueryParams(e.target.value)}
            placeholder="token=abc123&action=view"
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
          />
        </div>
      )}

      {endpoint.method === 'POST' && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide">Request Body (JSON)</label>
            {jsonError && <span className="text-xs text-red-400">{jsonError}</span>}
          </div>
          <textarea
            value={bodyJson}
            onChange={e => { setBodyJson(e.target.value); validateJson(e.target.value); }}
            rows={8}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-300 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono resize-none"
          />
        </div>
      )}

      <button
        onClick={run}
        disabled={loading || !!jsonError}
        className="flex items-center gap-2 px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg font-semibold text-sm transition-colors"
      >
        {loading ? (
          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          <Play className="w-4 h-4" />
        )}
        {loading ? 'Ejecutando...' : 'Ejecutar'}
      </button>

      {response && (
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <StatusBadge code={response.status} />
            <span className="text-xs text-slate-500">{response.time}ms</span>
            {response.status >= 200 && response.status < 300
              ? <CheckCircle className="w-4 h-4 text-green-400" />
              : <AlertCircle className="w-4 h-4 text-red-400" />
            }
          </div>
          <pre className="bg-slate-950 border border-slate-700/50 rounded-lg p-4 text-xs text-slate-300 overflow-x-auto font-mono max-h-72 overflow-y-auto leading-relaxed">
            {response.body}
          </pre>
        </div>
      )}
    </div>
  );
};

// ─── Endpoint Card ────────────────────────────────────────────────────────────

const EndpointCard = ({
  endpoint, baseUrl, expanded, onToggle, copiedCode, onCopy
}: {
  endpoint: EndpointDef;
  baseUrl: string;
  expanded: boolean;
  onToggle: () => void;
  copiedCode: string | null;
  onCopy: (code: string, id: string) => void;
}) => {
  const [activeTab, setActiveTab] = useState<'docs' | 'try'>('docs');
  const Icon = endpoint.icon;

  const curlExample = endpoint.method === 'POST'
    ? `curl -X POST "${baseUrl}${endpoint.path}" \\
  -H "Content-Type: application/json" \\${endpoint.authType === 'api-key' ? '\n  -H "x-api-key: YOUR_API_KEY" \\' : ''}
  -d '${JSON.stringify(
      Object.fromEntries(endpoint.fields.filter(f => f.required && !f.name.includes('header')).map(f => [f.name, f.example ?? ''])),
      null, 2
    ).replace(/\n/g, '\n  ')}'`
    : `curl -X GET "${baseUrl}${endpoint.path}${endpoint.fields.length ? '?' + endpoint.fields.map(f => `${f.name.replace(' (query param)', '')}=VALOR`).join('&') : ''}"${endpoint.authType === 'api-key' ? ` \\\n  -H "x-api-key: YOUR_API_KEY"` : ''}`;

  return (
    <div className="border border-slate-700/70 rounded-xl overflow-hidden bg-slate-800/30">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-slate-800/50 transition-colors text-left"
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="p-2 rounded-lg bg-slate-700/50">
            <Icon className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <MethodBadge method={endpoint.method} />
              <span className="text-sm font-mono text-slate-400 truncate">{endpoint.path}</span>
            </div>
            <p className="text-white font-semibold text-sm mt-0.5">{endpoint.title}</p>
          </div>
        </div>
        {expanded
          ? <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
          : <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
        }
      </button>

      {expanded && (
        <div className="border-t border-slate-700/50">
          {/* Tabs */}
          <div className="flex border-b border-slate-700/50">
            {(['docs', 'try'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-5 py-3 text-sm font-medium transition-colors flex items-center gap-1.5 ${
                  activeTab === tab
                    ? 'text-cyan-400 border-b-2 border-cyan-400 bg-cyan-500/5'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tab === 'docs' ? <BookOpen className="w-3.5 h-3.5" /> : <Terminal className="w-3.5 h-3.5" />}
                {tab === 'docs' ? 'Documentación' : 'Probar'}
              </button>
            ))}
          </div>

          <div className="p-5 space-y-6">
            {activeTab === 'docs' ? (
              <>
                <p className="text-slate-300 text-sm leading-relaxed">{endpoint.description}</p>

                {/* Auth */}
                <div className="flex items-center gap-2 text-sm">
                  <Lock className="w-4 h-4 text-slate-400" />
                  {endpoint.authType === 'api-key'
                    ? <span className="text-slate-300">Requiere header <code className="text-cyan-400 bg-slate-900 px-1.5 py-0.5 rounded text-xs">x-api-key</code> con tu API key de aplicación</span>
                    : <span className="text-slate-400">Sin autenticación requerida</span>
                  }
                </div>

                {/* Fields */}
                {endpoint.fields.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
                      {endpoint.method === 'POST' ? 'Parámetros del Body' : 'Parámetros'}
                    </h4>
                    <div className="space-y-2">
                      {endpoint.fields.map(field => (
                        <div key={field.name} className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-3">
                          <div className="flex items-start gap-2 flex-wrap">
                            <code className="text-cyan-400 text-sm font-mono font-semibold">{field.name}</code>
                            <span className="text-xs text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded font-mono">{field.type}</span>
                            {field.required
                              ? <span className="text-xs text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20">requerido</span>
                              : <span className="text-xs text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">opcional</span>
                            }
                          </div>
                          <p className="text-sm text-slate-400 mt-1.5">{field.description}</p>
                          {field.example !== undefined && (
                            <p className="text-xs text-slate-500 mt-1 font-mono">
                              Ejemplo: <span className="text-slate-400">{typeof field.example === 'object' ? JSON.stringify(field.example) : String(field.example)}</span>
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* cURL */}
                <div>
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                    <Code2 className="w-3.5 h-3.5" /> Ejemplo cURL
                  </h4>
                  <CodeBlock code={curlExample} id={`curl-${endpoint.id}`} onCopy={onCopy} copied={copiedCode} />
                </div>

                {/* Responses */}
                <div>
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Respuestas</h4>
                  <div className="space-y-3">
                    {endpoint.responses.map(resp => (
                      <div key={resp.code} className="bg-slate-900/50 border border-slate-700/50 rounded-lg overflow-hidden">
                        <div className="flex items-center gap-2 px-3 py-2 bg-slate-900/70 border-b border-slate-700/30">
                          <StatusBadge code={resp.code} />
                          <span className="text-sm text-slate-400">{resp.label}</span>
                        </div>
                        <CodeBlock
                          code={JSON.stringify(resp.body, null, 2)}
                          id={`resp-${endpoint.id}-${resp.code}`}
                          onCopy={onCopy}
                          copied={copiedCode}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <TryItPanel endpoint={endpoint} baseUrl={baseUrl} />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ApiExplorer() {
  const [expandedEndpoints, setExpandedEndpoints] = useState<string[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<string[]>(GROUPS);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [filterGroup, setFilterGroup] = useState<string>('all');
  useAuth();

  const baseUrl = configManager.isLoaded() ? configManager.functionsBaseUrl : 'https://your-project.supabase.co';

  const copyToClipboard = useCallback((text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  }, []);

  const toggleEndpoint = (id: string) => {
    setExpandedEndpoints(prev =>
      prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]
    );
  };

  const toggleGroup = (group: string) => {
    setExpandedGroups(prev =>
      prev.includes(group) ? prev.filter(g => g !== group) : [...prev, group]
    );
  };

  const visibleEndpoints = filterGroup === 'all'
    ? ENDPOINTS
    : ENDPOINTS.filter(e => e.group === filterGroup);

  const visibleGroups = filterGroup === 'all' ? GROUPS : [filterGroup];

  return (
    <Layout currentPage="api-explorer">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
                <Zap className="w-6 h-6 text-cyan-400" />
              </div>
              <h1 className="text-2xl font-bold text-white">API Explorer</h1>
            </div>
            <p className="text-slate-400 text-sm">Documentación interactiva — prueba los endpoints directamente desde el navegador</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="font-mono truncate max-w-xs">{baseUrl}</span>
          </div>
        </div>

        {/* Auth note */}
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex gap-3">
          <Lock className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="text-amber-300 font-semibold mb-1">Autenticación por API Key</p>
            <p className="text-slate-400">
              Todos los endpoints de integración requieren el header <code className="text-cyan-400 bg-slate-900 px-1.5 py-0.5 rounded">x-api-key</code> con
              la API Key de tu aplicación. Encuéntrala en <strong className="text-white">Configuración → Aplicaciones → API Key</strong>.
            </p>
          </div>
        </div>

        {/* Base URL */}
        <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Base URL</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-sm text-cyan-400 font-mono bg-slate-900 px-3 py-2 rounded-lg border border-slate-700/50 overflow-x-auto">
              {baseUrl}
            </code>
            <button
              onClick={() => copyToClipboard(baseUrl, 'base-url')}
              className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors text-slate-400 hover:text-white flex-shrink-0"
            >
              {copiedCode === 'base-url' ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex flex-wrap gap-2">
          {['all', ...GROUPS].map(group => {
            const GroupIcon = group === 'all' ? Zap : GROUP_ICONS[group];
            return (
              <button
                key={group}
                onClick={() => setFilterGroup(group)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  filterGroup === group
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                    : 'bg-slate-800/50 text-slate-400 border border-slate-700/50 hover:text-white'
                }`}
              >
                <GroupIcon className="w-3.5 h-3.5" />
                {group === 'all' ? 'Todos' : group}
                <span className="text-xs opacity-60">
                  {group === 'all' ? ENDPOINTS.length : ENDPOINTS.filter(e => e.group === group).length}
                </span>
              </button>
            );
          })}
        </div>

        {/* Endpoint groups */}
        <div className="space-y-4">
          {visibleGroups.map(group => {
            const groupEndpoints = visibleEndpoints.filter(e => e.group === group);
            if (groupEndpoints.length === 0) return null;
            const GroupIcon = GROUP_ICONS[group];
            const isGroupExpanded = expandedGroups.includes(group);

            return (
              <div key={group} className="bg-slate-800/20 border border-slate-700/40 rounded-xl overflow-hidden">
                <button
                  onClick={() => toggleGroup(group)}
                  className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-slate-800/40 transition-colors text-left"
                >
                  <GroupIcon className="w-4 h-4 text-cyan-400" />
                  <span className="font-semibold text-white flex-1">{group}</span>
                  <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">
                    {groupEndpoints.length} endpoint{groupEndpoints.length !== 1 ? 's' : ''}
                  </span>
                  {isGroupExpanded
                    ? <ChevronDown className="w-4 h-4 text-slate-400" />
                    : <ChevronRight className="w-4 h-4 text-slate-400" />
                  }
                </button>

                {isGroupExpanded && (
                  <div className="border-t border-slate-700/40 p-4 space-y-3">
                    {groupEndpoints.map(endpoint => (
                      <EndpointCard
                        key={endpoint.id}
                        endpoint={endpoint}
                        baseUrl={baseUrl}
                        expanded={expandedEndpoints.includes(endpoint.id)}
                        onToggle={() => toggleEndpoint(endpoint.id)}
                        copiedCode={copiedCode}
                        onCopy={copyToClipboard}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Flow diagram */}
        <div className="bg-slate-800/20 border border-slate-700/40 rounded-xl p-6">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-cyan-400" />
            Flujo de Integración Recomendado
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { step: '1', title: 'Email Directo', desc: 'Cuando tienes todos los datos disponibles, usa send-email para enviar de inmediato.', endpoint: 'send-email', color: 'cyan' },
              { step: '2', title: 'Email con PDF', desc: 'Usa generate-pdf primero, luego incluye el pdf_base64 en el envío del email.', endpoint: 'generate-pdf → send-email', color: 'blue' },
              { step: '3', title: 'Flujo Diferido', desc: 'Crea una comunicación pendiente y complétala cuando tengas todos los datos del pedido.', endpoint: 'pending → complete', color: 'teal' },
            ].map(flow => (
              <div key={flow.step} className={`bg-slate-900/50 border border-${flow.color}-500/20 rounded-xl p-4`}>
                <div className={`w-8 h-8 rounded-full bg-${flow.color}-500/20 text-${flow.color}-400 flex items-center justify-center font-bold text-sm mb-3`}>
                  {flow.step}
                </div>
                <h4 className="text-white font-semibold mb-1">{flow.title}</h4>
                <p className="text-slate-400 text-sm mb-2">{flow.desc}</p>
                <code className={`text-xs text-${flow.color}-400 bg-slate-950 px-2 py-1 rounded font-mono`}>{flow.endpoint}</code>
              </div>
            ))}
          </div>
        </div>

        {/* SDK example */}
        <div className="bg-slate-800/20 border border-slate-700/40 rounded-xl p-6">
          <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
            <Code2 className="w-5 h-5 text-cyan-400" />
            Integración rápida con fetch (JavaScript)
          </h3>
          <p className="text-slate-400 text-sm mb-4">Ejemplo completo para enviar un email desde cualquier sistema externo</p>
          <CodeBlock
            code={`const BASE_URL = "${baseUrl}";
const API_KEY  = "sk_live_TU_API_KEY";

async function sendEmail({ recipient, template, data }) {
  const res = await fetch(\`\${BASE_URL}/functions/v1/send-email\`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY,
    },
    body: JSON.stringify({
      recipient_email: recipient,
      template_name: template,
      data,
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Error al enviar email");
  }

  return res.json(); // { success, log_id, ... }
}

// Uso:
await sendEmail({
  recipient: "cliente@empresa.com",
  template: "bienvenida-cliente",
  data: { nombre: "Juan Pérez", plan: "Pro" },
});`}
            id="sdk-example"
            onCopy={copyToClipboard}
            copied={copiedCode}
          />
        </div>
      </div>
    </Layout>
  );
}
