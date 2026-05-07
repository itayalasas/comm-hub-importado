import { useState } from 'react';
import { Layout } from '../components/Layout';
import {
  Package, CheckCircle2, Copy, X, ChevronRight,
  Mail, FileText, Zap, Globe, ShieldCheck,
} from 'lucide-react';

/* ── Connector manifest types ──────────────────────────────────────── */

interface ConnectorParam {
  key: string;
  label: string;
  type: 'string' | 'text' | 'select';
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

const CONNECTORS: ConnectorManifest[] = [
  {
    id: 'sendcraft-email',
    name: 'SendCraft Email',
    tagline: 'Envío de emails transaccionales',
    description: 'Conector oficial para enviar emails transaccionales y de campaña directamente desde tu CRM. Soporta templates HTML, variables dinámicas y seguimiento de aperturas y clics.',
    category: 'email',
    version: '1.0.0',
    author: 'SendCraft',
    icon: 'mail',
    color: 'text-cyan-400',
    gradient: 'from-cyan-500/20 to-blue-500/20',
    badge: 'Oficial',
    stats: [
      { label: 'Versión', value: '1.0.0' },
      { label: 'Protocolo', value: 'REST/HTTPS' },
      { label: 'Auth', value: 'API Key' },
    ],
    auth: {
      type: 'api_key',
      header: 'x-api-key',
      label: 'API Key de la aplicación',
      placeholder: 'sk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      hint: 'La encontrás en Configuración → Aplicaciones → tu app',
    },
    baseUrl: 'https://[project].supabase.co/functions/v1',
    actions: [
      {
        id: 'send_email',
        name: 'Enviar Email',
        description: 'Envía un email a uno o más destinatarios',
        method: 'POST',
        endpoint: '/send-email',
        params: [
          { key: 'to', label: 'Destinatario', type: 'string', required: true, placeholder: 'nombre@ejemplo.com', description: 'Email del destinatario' },
          { key: 'subject', label: 'Asunto', type: 'string', required: true, placeholder: 'Hola {{nombre}}', description: 'Asunto del email. Soporta variables {{variable}}' },
          { key: 'body', label: 'Cuerpo HTML', type: 'text', required: true, placeholder: '<p>Hola {{nombre}}</p>', description: 'Cuerpo del email en HTML' },
          { key: 'from_name', label: 'Nombre del remitente', type: 'string', required: false, placeholder: 'Mi Empresa', description: 'Nombre que verá el destinatario' },
          { key: 'reply_to', label: 'Responder a', type: 'string', required: false, placeholder: 'soporte@empresa.com' },
        ],
      },
      {
        id: 'send_email_template',
        name: 'Enviar Email con Template',
        description: 'Envía un email usando un template guardado en SendCraft',
        method: 'POST',
        endpoint: '/send-email',
        params: [
          { key: 'to', label: 'Destinatario', type: 'string', required: true, placeholder: 'nombre@ejemplo.com' },
          { key: 'template_id', label: 'ID del Template', type: 'string', required: true, placeholder: 'uuid-del-template', description: 'El ID del template en SendCraft' },
          { key: 'variables', label: 'Variables JSON', type: 'text', required: false, placeholder: '{"nombre": "Juan", "monto": "1500"}', description: 'Variables para reemplazar en el template' },
        ],
      },
    ],
    features: [
      'Templates HTML con variables dinámicas',
      'Seguimiento de aperturas y clics',
      'Soporte para múltiples aplicaciones por API Key',
      'Logs de envío en tiempo real',
      'Reintentos automáticos',
    ],
  },
  {
    id: 'sendcraft-email-pdf',
    name: 'SendCraft Email + PDF',
    tagline: 'Email adjuntando PDF generado al vuelo',
    description: 'Genera un PDF desde un template HTML y lo envía adjunto al email en una sola llamada. Ideal para facturas, cotizaciones, contratos y reportes personalizados.',
    category: 'pdf',
    version: '1.0.0',
    author: 'SendCraft',
    icon: 'pdf',
    color: 'text-blue-400',
    gradient: 'from-blue-500/20 to-slate-500/20',
    badge: 'Oficial',
    stats: [
      { label: 'Versión', value: '1.0.0' },
      { label: 'Formato', value: 'PDF/A' },
      { label: 'Auth', value: 'API Key' },
    ],
    auth: {
      type: 'api_key',
      header: 'x-api-key',
      label: 'API Key de la aplicación',
      placeholder: 'sk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      hint: 'La misma API Key que usás para el conector de Email',
    },
    baseUrl: 'https://[project].supabase.co/functions/v1',
    actions: [
      {
        id: 'send_email_with_pdf',
        name: 'Enviar Email con PDF adjunto',
        description: 'Genera un PDF desde un template y lo adjunta al email',
        method: 'POST',
        endpoint: '/send-email-with-pdf',
        params: [
          { key: 'to', label: 'Destinatario', type: 'string', required: true, placeholder: 'nombre@ejemplo.com' },
          { key: 'subject', label: 'Asunto del email', type: 'string', required: true, placeholder: 'Tu factura #{{numero}}' },
          { key: 'email_body', label: 'Cuerpo del email', type: 'text', required: true, placeholder: '<p>Adjuntamos tu factura.</p>' },
          { key: 'pdf_template_id', label: 'ID del Template PDF', type: 'string', required: true, placeholder: 'uuid-del-template-pdf', description: 'Template HTML para generar el PDF' },
          { key: 'pdf_filename', label: 'Nombre del archivo PDF', type: 'string', required: false, placeholder: 'factura-{{numero}}.pdf' },
          { key: 'variables', label: 'Variables JSON', type: 'text', required: false, placeholder: '{"numero": "0001", "cliente": "Juan"}' },
        ],
      },
    ],
    features: [
      'Generación de PDF en tiempo real desde templates HTML',
      'Envío y adjunto en una sola llamada API',
      'Soporte para variables dinámicas en email y PDF',
      'Nombres de archivo personalizados',
      'PDF de alta calidad con CSS completo',
    ],
  },
  {
    id: 'sendcraft-pdf',
    name: 'SendCraft PDF Generator',
    tagline: 'Generación y almacenamiento de PDFs',
    description: 'Genera PDFs desde templates HTML y obtené una URL pública para descarga o visualización. Perfecto para generar documentos bajo demanda sin enviar email.',
    category: 'pdf',
    version: '1.0.0',
    author: 'SendCraft',
    icon: 'pdf',
    color: 'text-emerald-400',
    gradient: 'from-emerald-500/20 to-cyan-500/20',
    badge: 'Oficial',
    stats: [
      { label: 'Versión', value: '1.0.0' },
      { label: 'Salida', value: 'URL pública' },
      { label: 'Auth', value: 'API Key' },
    ],
    auth: {
      type: 'api_key',
      header: 'x-api-key',
      label: 'API Key de la aplicación',
      placeholder: 'sk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      hint: 'La misma API Key de tu aplicación en SendCraft',
    },
    baseUrl: 'https://[project].supabase.co/functions/v1',
    actions: [
      {
        id: 'generate_pdf',
        name: 'Generar PDF',
        description: 'Genera un PDF desde un template y devuelve la URL de descarga',
        method: 'POST',
        endpoint: '/generate-pdf',
        params: [
          { key: 'template_id', label: 'ID del Template', type: 'string', required: true, placeholder: 'uuid-del-template', description: 'Template HTML registrado en SendCraft' },
          { key: 'variables', label: 'Variables JSON', type: 'text', required: false, placeholder: '{"nombre": "Juan", "fecha": "2026-01-15"}' },
          { key: 'filename', label: 'Nombre del archivo', type: 'string', required: false, placeholder: 'reporte-{{fecha}}.pdf' },
        ],
      },
    ],
    features: [
      'URL pública de descarga con expiración configurable',
      'CSS completo soportado (fuentes, imágenes, tablas)',
      'Variables dinámicas en todo el documento',
      'Almacenamiento seguro en Supabase Storage',
      'Compatible con cualquier frontend o backend',
    ],
  },
  {
    id: 'sendcraft-webhook',
    name: 'SendCraft Webhooks',
    tagline: 'Eventos en tiempo real hacia tu CRM',
    description: 'Recibí notificaciones en tiempo real cuando un email es abierto, cuando se hace clic en un enlace, o cuando ocurre un rebote. Mantené tu CRM sincronizado automáticamente.',
    category: 'automation',
    version: '0.9.0',
    author: 'SendCraft',
    icon: 'automation',
    color: 'text-amber-400',
    gradient: 'from-amber-500/20 to-orange-500/20',
    badge: 'Beta',
    stats: [
      { label: 'Versión', value: '0.9.0' },
      { label: 'Eventos', value: '5 tipos' },
      { label: 'Auth', value: 'API Key' },
    ],
    auth: {
      type: 'api_key',
      header: 'x-api-key',
      label: 'API Key de la aplicación',
      placeholder: 'sk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      hint: 'Usá la misma API Key para filtrar eventos por aplicación',
    },
    baseUrl: 'https://[project].supabase.co/functions/v1',
    actions: [
      {
        id: 'register_webhook',
        name: 'Registrar Webhook',
        description: 'Registra una URL para recibir eventos de SendCraft',
        method: 'POST',
        endpoint: '/track-email',
        params: [
          { key: 'callback_url', label: 'URL de tu CRM', type: 'string', required: true, placeholder: 'https://tucrm.com/webhooks/sendcraft' },
          {
            key: 'events', label: 'Eventos a escuchar', type: 'select', required: true,
            options: [
              { value: 'all', label: 'Todos los eventos' },
              { value: 'email.opened', label: 'Email abierto' },
              { value: 'email.clicked', label: 'Clic en enlace' },
              { value: 'email.bounced', label: 'Email rebotado' },
              { value: 'email.delivered', label: 'Email entregado' },
            ],
          },
        ],
      },
    ],
    features: [
      'Eventos: abierto, clic, entregado, rebotado, fallido',
      'Reintentos automáticos con backoff exponencial',
      'Firma HMAC para verificar autenticidad',
      'Filtrado por aplicación con API Key',
      'Historial de entregas en el dashboard',
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

  const samplePayload = action.params
    .filter(p => p.required)
    .reduce<Record<string, string>>((acc, p) => {
      acc[p.key] = p.placeholder || `valor_${p.key}`;
      return acc;
    }, {});

  const curlExample = `curl -X ${action.method} \\
  "${connector.baseUrl}${action.endpoint}" \\
  -H "Content-Type: application/json" \\
  -H "${connector.auth.header}: TU_API_KEY" \\
  -d '${JSON.stringify(samplePayload, null, 2)}'`;

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
                      <code className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${p.required ? 'bg-cyan-500/15 text-cyan-400' : 'bg-slate-700/50 text-slate-400'}`}>
                        {p.key}
                      </code>
                      <div className="flex-1">
                        <span className="text-slate-300">{p.label}</span>
                        {p.description && <span className="text-slate-500 ml-1">— {p.description}</span>}
                        {!p.required && <span className="text-slate-600 ml-1">(opcional)</span>}
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
            <div className="flex items-center gap-3 bg-slate-800/30 rounded-xl border border-slate-700/50 px-4 py-3">
              <Globe className="w-4 h-4 text-slate-500 flex-shrink-0" />
              <p className="text-xs text-slate-500">
                El manifiesto JSON de este conector está disponible en{' '}
                <code className="text-slate-400">/api/connectors/{connector.id}</code> para que tu CRM lo consuma automáticamente.
              </p>
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
                auth: connector.auth,
                base_url: connector.baseUrl,
                actions: connector.actions.map(a => ({ id: a.id, method: a.method, endpoint: a.endpoint, params: a.params.map(p => ({ key: p.key, required: p.required })) })),
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

/* ── Main page ─────────────────────────────────────────────────────── */

export const Marketplace = () => {
  const [filter, setFilter] = useState<'all' | 'email' | 'pdf' | 'automation'>('all');
  const [selected, setSelected] = useState<ConnectorManifest | null>(null);

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

        {/* How it works banner */}
        <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 rounded-xl p-4">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-xs font-bold text-cyan-400">1</div>
              <span className="text-slate-300">Elegí un conector</span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-600 hidden sm:block" />
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-xs font-bold text-cyan-400">2</div>
              <span className="text-slate-300">Copiá el manifiesto JSON</span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-600 hidden sm:block" />
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-xs font-bold text-cyan-400">3</div>
              <span className="text-slate-300">Instalalo en tu CRM</span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-600 hidden sm:block" />
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-xs font-bold text-cyan-400">4</div>
              <span className="text-slate-300">Pegá tu API Key → listo</span>
            </div>
          </div>
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
