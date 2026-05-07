import { useState } from 'react';
import {
  Mail, FileText, Zap, X, CheckCircle2, Eye, EyeOff, Loader2, ShieldCheck, Lock,
} from 'lucide-react';

/* ── Constants ─────────────────────────────────────────────────────── */

const BASE_URL = 'https://drhbcmithlrldtjlhnee.supabase.co/functions/v1';

/* ── SHA-256 helper (Web Crypto API — available in browsers) ────────── */

const sha256 = async (text: string): Promise<string> => {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
};

/* ── Connector definitions ─────────────────────────────────────────── */

interface ConnectorDef {
  id: string;
  name: string;
  description: string;
  category: 'email' | 'pdf' | 'automation';
  icon: 'mail' | 'pdf' | 'automation';
  iconBg: string;
  iconColor: string;
  badge?: string;
  auth: { header: string; label: string; placeholder: string; hint: string };
  actions: { id: string; method: string; endpoint: string; params: { key: string; required: boolean }[] }[];
  features: string[];
}

const CONNECTORS: ConnectorDef[] = [
  {
    id: 'sendcraft-email',
    name: 'SendCraft Email',
    description: 'Envía correos transaccionales y de campaña',
    category: 'email',
    icon: 'mail',
    iconBg: 'bg-cyan-500',
    iconColor: 'text-white',
    badge: 'Oficial',
    auth: { header: 'x-api-key', label: 'API Key de tu aplicación en SendCraft', placeholder: 'sk_xxxx...', hint: 'Configuración → Aplicaciones → tu app → API Key' },
    actions: [{ id: 'send_email', method: 'POST', endpoint: `${BASE_URL}/send-email`, params: [{ key: 'to', required: true }, { key: 'subject', required: true }, { key: 'body', required: true }, { key: 'from_name', required: false }, { key: 'reply_to', required: false }] }],
    features: ['Templates HTML con variables dinámicas', 'Seguimiento de aperturas y clics', 'Logs de envío en tiempo real'],
  },
  {
    id: 'sendcraft-email-pdf',
    name: 'SendCraft Email + PDF',
    description: 'Email con PDF adjunto generado al vuelo',
    category: 'pdf',
    icon: 'pdf',
    iconBg: 'bg-blue-500',
    iconColor: 'text-white',
    badge: 'Oficial',
    auth: { header: 'x-api-key', label: 'API Key de tu aplicación en SendCraft', placeholder: 'sk_xxxx...', hint: 'La misma API Key que usás para Email' },
    actions: [{ id: 'send_email_with_pdf', method: 'POST', endpoint: `${BASE_URL}/send-email-with-pdf`, params: [{ key: 'to', required: true }, { key: 'subject', required: true }, { key: 'email_body', required: true }, { key: 'pdf_template_id', required: true }, { key: 'pdf_filename', required: false }, { key: 'variables', required: false }] }],
    features: ['PDF generado desde template HTML', 'Una sola llamada API', 'Variables dinámicas en email y PDF'],
  },
  {
    id: 'sendcraft-pdf',
    name: 'SendCraft PDF Generator',
    description: 'Genera PDFs con URL pública de descarga',
    category: 'pdf',
    icon: 'pdf',
    iconBg: 'bg-emerald-500',
    iconColor: 'text-white',
    badge: 'Oficial',
    auth: { header: 'x-api-key', label: 'API Key de tu aplicación en SendCraft', placeholder: 'sk_xxxx...', hint: 'Configuración → Aplicaciones → tu app → API Key' },
    actions: [{ id: 'generate_pdf', method: 'POST', endpoint: `${BASE_URL}/generate-pdf`, params: [{ key: 'template_id', required: true }, { key: 'variables', required: false }, { key: 'filename', required: false }] }],
    features: ['URL pública con expiración configurable', 'CSS completo soportado', 'Variables dinámicas'],
  },
  {
    id: 'sendcraft-webhook',
    name: 'SendCraft Webhooks',
    description: 'Recibí eventos de email en tiempo real',
    category: 'automation',
    icon: 'automation',
    iconBg: 'bg-amber-500',
    iconColor: 'text-white',
    badge: 'Beta',
    auth: { header: 'x-api-key', label: 'API Key de tu aplicación en SendCraft', placeholder: 'sk_xxxx...', hint: 'Para filtrar eventos por aplicación' },
    actions: [{ id: 'register_webhook', method: 'POST', endpoint: `${BASE_URL}/track-email`, params: [{ key: 'callback_url', required: true }, { key: 'events', required: true }] }],
    features: ['Eventos: abierto, clic, rebotado, entregado', 'Firma HMAC incluida', 'Reintentos automáticos'],
  },
];

/* ── Icon component ────────────────────────────────────────────────── */

const ConnIcon = ({ type, size = 'md' }: { type: string; size?: 'sm' | 'md' }) => {
  const cls = size === 'sm' ? 'w-4 h-4' : 'w-6 h-6';
  if (type === 'mail') return <Mail className={cls} />;
  if (type === 'pdf') return <FileText className={cls} />;
  return <Zap className={cls} />;
};

/* ── Login screen ──────────────────────────────────────────────────── */

interface LoginProps {
  onLogin: (label: string) => void;
}

const LoginScreen = ({ onLogin }: LoginProps) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) { setError('Completá usuario y contraseña.'); return; }
    setLoading(true);
    setError('');
    try {
      const hash = await sha256(password);
      const res = await fetch(`${BASE_URL}/verify-embed-credentials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password_hash: hash }),
      });
      const data = await res.json();
      if (data.valid) {
        onLogin(data.label || username);
      } else {
        setError('Usuario o contraseña incorrectos.');
      }
    } catch {
      setError('Error de conexión. Intentá de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0d1117] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-cyan-500/20">
            <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
              <rect x="5" y="8" width="22" height="16" rx="3" stroke="white" strokeWidth="2"/>
              <path d="M6 11L16 18.5L26 11" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 className="text-lg font-bold text-white">SendCraft</h1>
          <p className="text-xs text-gray-600 mt-1">Marketplace de conectores</p>
        </div>

        {/* Card */}
        <form onSubmit={handleSubmit} className="bg-[#111827] border border-[#1f2937] rounded-2xl p-6 space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Usuario</label>
            <input
              type="text"
              value={username}
              onChange={e => { setUsername(e.target.value); setError(''); }}
              placeholder="usuario"
              autoComplete="username"
              className="w-full bg-[#0d1117] border border-[#1f2937] rounded-xl px-4 py-3 text-sm text-white placeholder-gray-700 focus:outline-none focus:border-[#374151] transition-colors"
              autoFocus
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Contraseña</label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={e => { setPassword(e.target.value); setError(''); }}
                placeholder="••••••••"
                autoComplete="current-password"
                className="w-full bg-[#0d1117] border border-[#1f2937] rounded-xl px-4 py-3 text-sm text-white placeholder-gray-700 pr-10 focus:outline-none focus:border-[#374151] transition-colors"
              />
              <button type="button" onClick={() => setShowPass(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400">
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:bg-[#1f2937] disabled:text-gray-600 text-white text-sm font-bold transition-all flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
            {loading ? 'Verificando...' : 'Ingresar'}
          </button>
        </form>

        <p className="text-center text-[11px] text-gray-700 mt-4">
          Las credenciales se generan desde SendCraft → Configuración
        </p>
      </div>
    </div>
  );
};

/* ── API Key validation ─────────────────────────────────────────────── */

const validateApiKey = async (apiKey: string): Promise<{ valid: boolean; appName?: string }> => {
  try {
    const res = await fetch(`${BASE_URL}/health-check-email`, { method: 'GET', headers: { 'x-api-key': apiKey } });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      return { valid: true, appName: data?.app_name || data?.name };
    }
    return { valid: false };
  } catch {
    return { valid: false };
  }
};

/* ── Connect modal ─────────────────────────────────────────────────── */

type ModalState = 'idle' | 'loading' | 'success' | 'error';

const ConnectModal = ({ connector, onClose, onSuccess }: { connector: ConnectorDef; onClose: () => void; onSuccess: (id: string) => void }) => {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [state, setState] = useState<ModalState>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleConnect = async () => {
    if (!apiKey.trim()) { setErrorMsg('Ingresá tu API Key para continuar.'); return; }
    setState('loading');
    setErrorMsg('');
    const { valid, appName } = await validateApiKey(apiKey.trim());
    if (!valid) {
      setState('error');
      setErrorMsg('API Key inválida. Verificá que sea correcta.');
      return;
    }
    setState('success');
    onSuccess(connector.id);
    const manifest = {
      connector_id: connector.id,
      name: connector.name,
      description: connector.description,
      category: connector.category,
      auth: { type: 'api_key', header: connector.auth.header, value: apiKey.trim() },
      base_url: BASE_URL,
      registry_url: `${BASE_URL}/connectors/${connector.id}`,
      actions: connector.actions.map(a => ({ id: a.id, method: a.method, endpoint: a.endpoint, params: a.params })),
    };
    window.parent.postMessage({
      type: 'SENDCRAFT_CONNECTOR_INSTALLED',
      connector_id: connector.id,
      connector_name: connector.name,
      app_name: appName,
      api_key: apiKey.trim(),
      auth_header: connector.auth.header,
      manifest,
      timestamp: new Date().toISOString(),
    }, '*');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-[#111827] border border-[#1f2937] rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1f2937]">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl ${connector.iconBg} flex items-center justify-center ${connector.iconColor}`}>
              <ConnIcon type={connector.icon} />
            </div>
            <div>
              <p className="text-sm font-bold text-white">{connector.name}</p>
              <p className="text-xs text-gray-500">{connector.description}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-[#1f2937] flex items-center justify-center text-gray-500 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-5 space-y-4">
          {state === 'success' ? (
            <div className="text-center py-4 space-y-3">
              <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-7 h-7 text-emerald-400" />
              </div>
              <div>
                <p className="text-white font-semibold text-base">Conector instalado</p>
                <p className="text-gray-500 text-sm mt-1"><span className="text-gray-300 font-medium">{connector.name}</span> quedó conectado.</p>
              </div>
              <p className="text-xs text-gray-600 bg-[#0d1117] border border-[#1f2937] rounded-lg px-3 py-2">
                El manifiesto y la API Key fueron enviados a tu aplicación.
              </p>
              <button onClick={onClose} className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold transition-colors">
                Cerrar
              </button>
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{connector.auth.label}</label>
                <div className="relative">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={e => { setApiKey(e.target.value); setErrorMsg(''); setState('idle'); }}
                    placeholder={connector.auth.placeholder}
                    className="w-full bg-[#0d1117] border border-[#1f2937] rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 pr-10 focus:outline-none focus:border-[#374151] transition-colors font-mono"
                    onKeyDown={e => e.key === 'Enter' && state !== 'loading' && handleConnect()}
                    autoFocus
                  />
                  <button type="button" onClick={() => setShowKey(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400">
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-gray-600 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />{connector.auth.hint}
                </p>
              </div>

              {(errorMsg || state === 'error') && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  <p className="text-xs text-red-400">{errorMsg || 'Error al validar la API Key.'}</p>
                </div>
              )}

              <div className="bg-[#0d1117] border border-[#1f2937] rounded-xl p-3 space-y-1.5">
                <p className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold mb-2">Lo que se instala</p>
                {connector.features.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-gray-400">
                    <CheckCircle2 className="w-3 h-3 text-emerald-500/70 flex-shrink-0" />{f}
                  </div>
                ))}
              </div>

              <button
                onClick={handleConnect}
                disabled={state === 'loading' || !apiKey.trim()}
                className="w-full py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:bg-[#1f2937] disabled:text-gray-600 text-white text-sm font-bold transition-all flex items-center justify-center gap-2"
              >
                {state === 'loading' ? <><Loader2 className="w-4 h-4 animate-spin" />Verificando...</> : <><Zap className="w-4 h-4" />Conectar</>}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

/* ── Connector card ────────────────────────────────────────────────── */

const ConnCard = ({ connector, installed, onConnect }: { connector: ConnectorDef; installed: boolean; onConnect: () => void }) => (
  <div className="bg-[#111827] border border-[#1f2937] rounded-2xl p-5 flex flex-col gap-4 hover:border-[#374151] transition-colors">
    <div className="flex items-start justify-between">
      <div className={`w-12 h-12 rounded-2xl ${connector.iconBg} flex items-center justify-center ${connector.iconColor}`}>
        <ConnIcon type={connector.icon} />
      </div>
      <div className="flex items-center gap-1.5">
        {connector.badge && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${connector.badge === 'Oficial' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
            {connector.badge}
          </span>
        )}
        {installed && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
            <CheckCircle2 className="w-2.5 h-2.5" /> Instalado
          </span>
        )}
      </div>
    </div>
    <div className="flex-1">
      <h3 className="text-sm font-bold text-white mb-1">{connector.name}</h3>
      <p className="text-xs text-gray-500 leading-relaxed">{connector.description}</p>
    </div>
    <button
      onClick={onConnect}
      className={`w-full py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${installed ? 'bg-[#1f2937] text-gray-400 hover:bg-[#374151] hover:text-white' : 'bg-cyan-500 hover:bg-cyan-400 text-white'}`}
    >
      <Zap className="w-3.5 h-3.5" />
      {installed ? 'Reconectar' : 'Conectar'}
    </button>
  </div>
);

/* ── Main embed page ───────────────────────────────────────────────── */

type FilterType = 'all' | 'email' | 'pdf' | 'automation';
const FILTER_LABELS: Record<FilterType, string> = { all: 'Todos', email: 'Email', pdf: 'PDF', automation: 'Automatización' };

export const MarketplaceEmbed = () => {
  const [authed, setAuthed] = useState(false);
  const [sessionLabel, setSessionLabel] = useState('');
  const [active, setActive] = useState<ConnectorDef | null>(null);
  const [installed, setInstalled] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<FilterType>('all');

  const filtered = filter === 'all' ? CONNECTORS : CONNECTORS.filter(c => c.category === filter);

  if (!authed) {
    return (
      <LoginScreen
        onLogin={label => { setAuthed(true); setSessionLabel(label); }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#0d1117] text-white p-4 sm:p-6">
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.15em] text-gray-600 font-semibold">Disponibles</p>
          {sessionLabel && <p className="text-[11px] text-gray-700 mt-0.5">Sesión: {sessionLabel}</p>}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {(['all', 'email', 'pdf', 'automation'] as FilterType[]).map(cat => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${filter === cat ? 'bg-[#1f2937] text-white' : 'text-gray-600 hover:text-gray-400'}`}
            >
              {FILTER_LABELS[cat]}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map(connector => (
          <ConnCard
            key={connector.id}
            connector={connector}
            installed={installed.has(connector.id)}
            onConnect={() => setActive(connector)}
          />
        ))}
      </div>

      {/* Footer */}
      <div className="mt-6 text-center">
        <p className="text-[10px] text-gray-700">
          Powered by <span className="text-gray-500 font-semibold">SendCraft</span>
        </p>
      </div>

      {active && (
        <ConnectModal
          connector={active}
          onClose={() => setActive(null)}
          onSuccess={id => setInstalled(prev => new Set(prev).add(id))}
        />
      )}
    </div>
  );
};

export default MarketplaceEmbed;
