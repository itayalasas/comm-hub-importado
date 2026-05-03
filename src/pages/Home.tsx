import {
  Mail,
  Zap,
  CheckCircle,
  BarChart2,
  Lock,
  ArrowRight,
  Sparkles,
  Globe,
  Bell,
  FileText,
  TrendingUp,
  Users,
  Clock,
  ChevronRight,
  Star,
  Check,
  Minus,
  MessageSquare,
  Send,
  Activity,
  MousePointer,
  Eye,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/* ─── Data ─────────────────────────────────────────────────────── */
const STATS = [
  { value: '99.9%', label: 'Uptime garantizado', icon: Activity },
  { value: '10M+', label: 'Emails enviados', icon: Send },
  { value: '500+', label: 'Empresas activas', icon: Users },
  { value: '<2s', label: 'Tiempo de entrega', icon: Clock },
];

const FEATURES = [
  { icon: Mail, title: 'Gestion de Emails', description: 'Envia y rastrea emails transaccionales y de marketing con seguimiento en tiempo real de entregas, aperturas y clics.', color: 'cyan' },
  { icon: Zap, title: 'Templates Dinamicos', description: 'Crea y personaliza templates con variables dinamicas y preview en tiempo real para distintos tipos de comunicacion.', color: 'blue' },
  { icon: BarChart2, title: 'Analitica Avanzada', description: 'Dashboards interactivos con metricas detalladas, reportes de rendimiento y tendencias de tus comunicaciones.', color: 'teal' },
  { icon: FileText, title: 'Generacion de PDFs', description: 'Convierte tus templates en documentos PDF profesionales listos para enviar o descargar automaticamente.', color: 'cyan' },
  { icon: Bell, title: 'Webhooks Automaticos', description: 'Recibe notificaciones de eventos en tiempo real y mantiene tus sistemas sincronizados sin esfuerzo.', color: 'blue' },
  { icon: Globe, title: 'API RESTful Completa', description: 'Integra SendCraft con tus sistemas existentes usando nuestra API bien documentada y facil de usar.', color: 'teal' },
  { icon: Lock, title: 'Seguridad Empresarial', description: 'Autenticacion robusta con gestion de permisos, roles y cifrado de extremo a extremo.', color: 'cyan' },
  { icon: MessageSquare, title: 'Comunicaciones Pendientes', description: 'Gestiona colas de comunicaciones, reprograma envios y monitorea el estado de cada mensaje.', color: 'blue' },
  { icon: TrendingUp, title: 'Optimizacion Continua', description: 'Sugerencias inteligentes para mejorar tasas de apertura, entregabilidad y engagement general.', color: 'teal' },
];

const TESTIMONIALS = [
  { name: 'Carlos Mendoza', role: 'CTO, TechCorp Mexico', text: 'SendCraft transformo nuestra infraestructura de comunicaciones. La entregabilidad mejoro un 40% en el primer mes.', initials: 'CM', color: 'from-cyan-500 to-blue-600', stars: 5 },
  { name: 'Ana Gomez', role: 'Directora de Operaciones, Finanza360', text: 'La generacion automatica de PDFs y el sistema de templates nos ahorra horas cada semana. Increible plataforma.', initials: 'AG', color: 'from-teal-500 to-cyan-600', stars: 5 },
  { name: 'Roberto Silva', role: 'Gerente IT, LogiExpress', text: 'La integracion via API fue muy sencilla y el soporte tecnico es excepcional. Totalmente recomendado.', initials: 'RS', color: 'from-blue-500 to-teal-600', stars: 5 },
];

const colorMap: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  cyan: { bg: 'bg-cyan-500/10', border: 'border-cyan-500/20', text: 'text-cyan-400', glow: 'group-hover:shadow-cyan-500/20' },
  blue: { bg: 'bg-blue-500/10', border: 'border-blue-500/20', text: 'text-blue-400', glow: 'group-hover:shadow-blue-500/20' },
  teal: { bg: 'bg-teal-500/10', border: 'border-teal-500/20', text: 'text-teal-400', glow: 'group-hover:shadow-teal-500/20' },
};

/* ─── Animated Dashboard Mockup ────────────────────────────────── */
const DashboardMockup = () => (
  <div className="relative w-full rounded-2xl overflow-hidden border border-white/10 bg-[#0a1628] shadow-2xl shadow-cyan-500/10">
    {/* Window chrome */}
    <div className="flex items-center gap-1.5 px-4 py-3 border-b border-white/6 bg-white/[0.02]">
      <div className="w-3 h-3 rounded-full bg-red-500/60" />
      <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
      <div className="w-3 h-3 rounded-full bg-green-500/60" />
      <div className="ml-4 flex-1 h-5 bg-white/5 rounded-md max-w-xs" />
    </div>

    <div className="flex" style={{ height: '340px' }}>
      {/* Sidebar */}
      <div className="w-14 border-r border-white/6 flex flex-col items-center py-4 gap-4 bg-white/[0.01]">
        {[Mail, BarChart2, FileText, Bell, Lock].map((Icon, i) => (
          <div key={i} className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${i === 0 ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-600 hover:text-slate-400'}`}>
            <Icon className="w-4 h-4" />
          </div>
        ))}
      </div>

      {/* Main area */}
      <div className="flex-1 p-5 overflow-hidden">
        {/* Header row */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="text-xs font-semibold text-white">Dashboard</div>
            <div className="text-[10px] text-slate-500">Hoy, 3 mayo 2026</div>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-[10px] text-green-400 font-medium">Activo</span>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { label: 'Enviados', value: '24,891', delta: '+12%', color: 'text-cyan-400' },
            { label: 'Tasa apertura', value: '68.4%', delta: '+4%', color: 'text-teal-400' },
            { label: 'Entregados', value: '99.2%', delta: '→', color: 'text-green-400' },
          ].map(({ label, value, delta, color }) => (
            <div key={label} className="bg-white/[0.04] border border-white/6 rounded-xl p-3">
              <div className="text-[9px] text-slate-500 mb-1">{label}</div>
              <div className={`text-sm font-bold ${color}`}>{value}</div>
              <div className="text-[9px] text-slate-500">{delta}</div>
            </div>
          ))}
        </div>

        {/* Chart bars */}
        <div className="bg-white/[0.02] border border-white/6 rounded-xl p-3 mb-3">
          <div className="text-[9px] text-slate-500 mb-3">Emails enviados — ultimos 7 dias</div>
          <div className="flex items-end gap-1.5" style={{ height: '52px' }}>
            {[45, 72, 58, 90, 68, 84, 95].map((h, i) => (
              <div key={i} className="flex-1 rounded-sm bg-gradient-to-t from-cyan-600/80 to-cyan-400/40 transition-all"
                style={{ height: `${h}%`, animationDelay: `${i * 80}ms` }} />
            ))}
          </div>
          <div className="flex justify-between mt-1">
            {['L','M','X','J','V','S','D'].map(d => (
              <div key={d} className="flex-1 text-center text-[8px] text-slate-600">{d}</div>
            ))}
          </div>
        </div>

        {/* Email list preview */}
        <div className="space-y-1.5">
          {[
            { to: 'cliente@empresa.com', subject: 'Factura #2891', status: 'entregado' },
            { to: 'admin@corp.mx', subject: 'Reporte mensual', status: 'abierto' },
          ].map(({ to, subject, status }) => (
            <div key={to} className="flex items-center gap-2 bg-white/[0.02] rounded-lg px-3 py-2 border border-white/4">
              <div className="w-5 h-5 rounded-full bg-cyan-500/15 flex items-center justify-center flex-shrink-0">
                <Mail className="w-2.5 h-2.5 text-cyan-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[9px] text-white font-medium truncate">{subject}</div>
                <div className="text-[8px] text-slate-500 truncate">{to}</div>
              </div>
              <div className={`px-1.5 py-0.5 rounded text-[8px] font-medium ${status === 'entregado' ? 'bg-green-500/15 text-green-400' : 'bg-cyan-500/15 text-cyan-400'}`}>
                {status}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

/* ─── Template Editor Mockup ────────────────────────────────────── */
const TemplateMockup = () => (
  <div className="relative w-full rounded-2xl overflow-hidden border border-white/10 bg-[#0a1628] shadow-2xl">
    <div className="flex items-center gap-1.5 px-4 py-3 border-b border-white/6 bg-white/[0.02]">
      <div className="w-3 h-3 rounded-full bg-red-500/60" />
      <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
      <div className="w-3 h-3 rounded-full bg-green-500/60" />
      <span className="ml-4 text-[10px] text-slate-500">Template Editor — Factura.html</span>
    </div>
    <div className="flex" style={{ height: '280px' }}>
      {/* Code panel */}
      <div className="w-1/2 border-r border-white/6 p-4 font-mono text-[9px] leading-relaxed overflow-hidden">
        <div className="text-slate-600">&lt;!-- Template SendCraft --&gt;</div>
        <div><span className="text-blue-400">&lt;div</span> <span className="text-cyan-400">class</span>=<span className="text-green-400">"header"</span><span className="text-blue-400">&gt;</span></div>
        <div className="pl-4"><span className="text-blue-400">&lt;h1&gt;</span><span className="text-white">Hola, <span className="bg-cyan-500/20 text-cyan-300 px-1 rounded">{'{{nombre}}'}</span></span><span className="text-blue-400">&lt;/h1&gt;</span></div>
        <div><span className="text-blue-400">&lt;/div&gt;</span></div>
        <div className="mt-2"><span className="text-blue-400">&lt;table</span> <span className="text-cyan-400">class</span>=<span className="text-green-400">"invoice"</span><span className="text-blue-400">&gt;</span></div>
        <div className="pl-4 text-slate-500">&lt;!-- items --&gt;</div>
        <div className="pl-4"><span className="text-blue-400">&lt;tr&gt;&lt;td&gt;</span><span className="bg-cyan-500/20 text-cyan-300 px-1 rounded">{'{{producto}}'}</span><span className="text-blue-400">&lt;/td&gt;</span></div>
        <div className="pl-4"><span className="text-blue-400">&lt;td&gt;</span><span className="bg-teal-500/20 text-teal-300 px-1 rounded">{'{{precio}}'}</span><span className="text-blue-400">&lt;/td&gt;&lt;/tr&gt;</span></div>
        <div><span className="text-blue-400">&lt;/table&gt;</span></div>
        <div className="mt-2 flex items-center gap-1">
          <div className="w-2 h-3 bg-cyan-400/80 animate-pulse rounded-sm" />
        </div>
      </div>
      {/* Preview panel */}
      <div className="w-1/2 p-4 bg-white/[0.01]">
        <div className="text-[9px] text-slate-500 mb-3 flex items-center gap-1"><Eye className="w-3 h-3" /> Preview</div>
        <div className="bg-white rounded-lg p-3 shadow-inner" style={{ fontSize: '9px' }}>
          <div className="bg-gradient-to-r from-cyan-600 to-blue-700 text-white p-2 rounded mb-2 text-center font-bold text-[10px]">SendCraft Invoice</div>
          <div className="text-slate-800 font-semibold mb-1">Hola, <span className="text-cyan-600">Juan Garcia</span></div>
          <div className="border-t border-slate-200 pt-2 space-y-1">
            {[['Servicio Pro', '$299'], ['Emails Extra', '$49']].map(([k, v]) => (
              <div key={k} className="flex justify-between text-slate-700">
                <span>{k}</span><span className="font-bold">{v}</span>
              </div>
            ))}
            <div className="flex justify-between text-cyan-700 font-bold border-t border-slate-200 pt-1">
              <span>Total</span><span>$348</span>
            </div>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <div className="flex-1 h-6 bg-cyan-500/20 border border-cyan-500/30 rounded text-[8px] text-cyan-400 flex items-center justify-center gap-1 cursor-pointer hover:bg-cyan-500/30 transition-colors">
            <Send className="w-2.5 h-2.5" /> Enviar
          </div>
          <div className="flex-1 h-6 bg-white/5 border border-white/10 rounded text-[8px] text-slate-400 flex items-center justify-center gap-1">
            <FileText className="w-2.5 h-2.5" /> PDF
          </div>
        </div>
      </div>
    </div>
  </div>
);

/* ─── Analytics Mockup ──────────────────────────────────────────── */
const AnalyticsMockup = () => {
  const bars = [62, 78, 55, 91, 74, 88, 96, 70, 83, 65, 92, 85];
  return (
    <div className="relative w-full rounded-2xl overflow-hidden border border-white/10 bg-[#0a1628] shadow-2xl">
      <div className="flex items-center gap-1.5 px-4 py-3 border-b border-white/6 bg-white/[0.02]">
        <div className="w-3 h-3 rounded-full bg-red-500/60" />
        <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
        <div className="w-3 h-3 rounded-full bg-green-500/60" />
        <span className="ml-4 text-[10px] text-slate-500">Analytics — Campanas activas</span>
      </div>
      <div className="p-5" style={{ height: '280px' }}>
        {/* KPI row */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {[
            { label: 'Enviados', value: '94,231', icon: Send, color: 'text-cyan-400' },
            { label: 'Abiertos', value: '68.4%', icon: Eye, color: 'text-teal-400' },
            { label: 'Clicks', value: '24.1%', icon: MousePointer, color: 'text-blue-400' },
            { label: 'Rebotes', value: '0.8%', icon: Activity, color: 'text-green-400' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-white/[0.04] border border-white/6 rounded-xl p-2.5 text-center">
              <Icon className={`w-3 h-3 ${color} mx-auto mb-1`} />
              <div className={`text-sm font-bold ${color}`}>{value}</div>
              <div className="text-[8px] text-slate-500">{label}</div>
            </div>
          ))}
        </div>

        {/* Line chart simulation */}
        <div className="bg-white/[0.02] border border-white/6 rounded-xl p-3 mb-3">
          <div className="text-[9px] text-slate-400 font-medium mb-3">Tasa de apertura — 12 semanas</div>
          <div className="relative" style={{ height: '60px' }}>
            <svg width="100%" height="100%" viewBox="0 0 300 60" preserveAspectRatio="none">
              <defs>
                <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d={`M ${bars.map((v, i) => `${(i / (bars.length - 1)) * 300},${60 - (v / 100) * 50}`).join(' L ')}`}
                fill="none" stroke="#06b6d4" strokeWidth="2" strokeLinecap="round"
              />
              <path
                d={`M 0,60 L ${bars.map((v, i) => `${(i / (bars.length - 1)) * 300},${60 - (v / 100) * 50}`).join(' L ')} L 300,60 Z`}
                fill="url(#lineGrad)"
              />
            </svg>
          </div>
        </div>

        {/* Campaign list */}
        <div className="space-y-1.5">
          {[
            { name: 'Bienvenida onboarding', sent: '12,441', open: '71%', color: 'bg-cyan-500' },
            { name: 'Newsletter semanal', sent: '8,230', open: '58%', color: 'bg-teal-500' },
          ].map(({ name, sent, open, color }) => (
            <div key={name} className="flex items-center gap-3 bg-white/[0.02] rounded-lg px-3 py-2 border border-white/4">
              <div className={`w-1.5 h-6 rounded-full ${color}/60`} />
              <div className="flex-1 min-w-0">
                <div className="text-[9px] text-white font-medium truncate">{name}</div>
              </div>
              <div className="text-[8px] text-slate-500">{sent} enviados</div>
              <div className="text-[8px] font-bold text-cyan-400">{open}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ─── Deliverability Mockup ─────────────────────────────────────── */
const DeliverabilityMockup = () => (
  <div className="relative w-full rounded-2xl overflow-hidden border border-white/10 bg-[#0a1628] shadow-2xl">
    <div className="flex items-center gap-1.5 px-4 py-3 border-b border-white/6 bg-white/[0.02]">
      <div className="w-3 h-3 rounded-full bg-red-500/60" />
      <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
      <div className="w-3 h-3 rounded-full bg-green-500/60" />
      <span className="ml-4 text-[10px] text-slate-500">Infraestructura — Estado del sistema</span>
    </div>
    <div className="p-5" style={{ height: '280px' }}>
      {/* Uptime ring */}
      <div className="flex items-center gap-6 mb-5">
        <div className="relative flex-shrink-0" style={{ width: '80px', height: '80px' }}>
          <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
            <circle cx="40" cy="40" r="32" fill="none" stroke="rgba(6,182,212,0.1)" strokeWidth="6" />
            <circle cx="40" cy="40" r="32" fill="none" stroke="#06b6d4" strokeWidth="6"
              strokeDasharray={`${2 * Math.PI * 32 * 0.999} ${2 * Math.PI * 32}`}
              strokeLinecap="round" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-sm font-bold text-white">99.9%</div>
            <div className="text-[8px] text-slate-500">uptime</div>
          </div>
        </div>
        <div className="flex-1 space-y-2">
          {[
            { label: 'SPF', status: 'Activo', ok: true },
            { label: 'DKIM', status: 'Activo', ok: true },
            { label: 'DMARC', status: 'Activo', ok: true },
          ].map(({ label, status, ok }) => (
            <div key={label} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full ${ok ? 'bg-green-400' : 'bg-red-400'} animate-pulse`} />
                <span className="text-[9px] text-slate-300 font-mono font-semibold">{label}</span>
              </div>
              <span className="text-[8px] text-green-400">{status}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Region nodes */}
      <div className="bg-white/[0.02] border border-white/6 rounded-xl p-3 mb-3">
        <div className="text-[9px] text-slate-400 mb-2">Nodos activos</div>
        <div className="grid grid-cols-3 gap-2">
          {['US-East', 'EU-West', 'LATAM'].map((region) => (
            <div key={region} className="text-center bg-white/[0.03] rounded-lg p-2 border border-green-500/15">
              <div className="w-2 h-2 rounded-full bg-green-400 mx-auto mb-1 animate-pulse" />
              <div className="text-[8px] text-green-400">{region}</div>
              <div className="text-[7px] text-slate-600">Online</div>
            </div>
          ))}
        </div>
      </div>

      {/* Activity feed */}
      <div className="space-y-1.5">
        {[
          { msg: 'Email entregado → gmail.com', time: 'hace 2s', color: 'text-green-400' },
          { msg: 'Webhook disparado → CRM', time: 'hace 5s', color: 'text-cyan-400' },
          { msg: 'PDF generado #FAC-2891', time: 'hace 9s', color: 'text-teal-400' },
        ].map(({ msg, time, color }) => (
          <div key={msg} className="flex items-center gap-2">
            <div className={`w-1 h-1 rounded-full ${color} flex-shrink-0`} />
            <div className={`text-[8px] ${color} flex-1 truncate`}>{msg}</div>
            <div className="text-[7px] text-slate-600">{time}</div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

/* ─── Step cards ─────────────────────────────────────────────────── */
const STEPS = [
  {
    step: '01',
    title: 'Crea tu template',
    desc: 'Diseña templates HTML con variables dinamicas usando nuestro editor visual con preview en tiempo real.',
    icon: FileText,
    visual: (
      <div className="w-full h-32 bg-[#0a1628] rounded-xl border border-white/8 p-3 overflow-hidden">
        <div className="flex gap-2 h-full">
          <div className="flex-1 space-y-1">
            <div className="text-[8px] text-slate-500 mb-1 font-mono">template.html</div>
            {['<h1>{{nombre}}</h1>', '<p>{{mensaje}}</p>', '<a href="{{url}}">'].map((line, i) => (
              <div key={i} className="flex items-center gap-1">
                <span className="text-[7px] text-slate-600 w-3">{i + 1}</span>
                <div className="text-[7px] font-mono text-blue-400 truncate">{line.replace(/{{.*?}}/g, (m) => `<span style="color:#22d3ee">${m}</span>`)}</div>
              </div>
            ))}
            <div className="flex items-center gap-1 mt-1">
              <span className="text-[7px] text-slate-600 w-3">4</span>
              <div className="w-1.5 h-3 bg-cyan-400/80 rounded-sm animate-pulse" />
            </div>
          </div>
          <div className="w-px bg-white/5" />
          <div className="flex-1 bg-white rounded-md p-2">
            <div className="w-full h-3 bg-cyan-600 rounded mb-1.5" />
            <div className="space-y-1">
              <div className="h-1.5 bg-slate-300 rounded w-3/4" />
              <div className="h-1.5 bg-slate-200 rounded w-1/2" />
              <div className="h-1.5 bg-slate-200 rounded w-2/3" />
            </div>
            <div className="mt-2 h-4 bg-cyan-500 rounded text-[6px] text-white flex items-center justify-center">Ver mas</div>
          </div>
        </div>
      </div>
    ),
  },
  {
    step: '02',
    title: 'Configura el envio',
    desc: 'Define destinatarios, programacion inteligente y reglas de entrega desde el dashboard central.',
    icon: Send,
    visual: (
      <div className="w-full h-32 bg-[#0a1628] rounded-xl border border-white/8 p-3 overflow-hidden">
        <div className="text-[8px] text-slate-500 mb-2">Nuevo envio</div>
        <div className="space-y-2">
          {[
            { label: 'Para', value: 'clientes@empresa.com (2,401)', color: 'border-cyan-500/40' },
            { label: 'Template', value: 'Factura mensual v2', color: 'border-white/10' },
            { label: 'Envio', value: 'Hoy 10:00 AM', color: 'border-white/10' },
          ].map(({ label, value, color }) => (
            <div key={label} className={`flex items-center gap-2 bg-white/[0.03] border ${color} rounded-lg px-2 py-1.5`}>
              <span className="text-[7px] text-slate-500 w-10">{label}</span>
              <span className="text-[8px] text-white font-medium truncate">{value}</span>
            </div>
          ))}
          <div className="flex gap-1.5 mt-1">
            <div className="flex-1 h-6 bg-gradient-to-r from-cyan-500 to-cyan-600 rounded-lg text-[8px] text-white flex items-center justify-center gap-1 font-semibold">
              <Send className="w-2.5 h-2.5" /> Programar
            </div>
            <div className="h-6 px-2 bg-white/5 border border-white/10 rounded-lg text-[8px] text-slate-400 flex items-center">Test</div>
          </div>
        </div>
      </div>
    ),
  },
  {
    step: '03',
    title: 'Analiza resultados',
    desc: 'Monitorea entregas, aperturas, clics y genera reportes PDF automaticamente con datos en vivo.',
    icon: BarChart2,
    visual: (
      <div className="w-full h-32 bg-[#0a1628] rounded-xl border border-white/8 p-3 overflow-hidden">
        <div className="text-[8px] text-slate-500 mb-2">Resultados campana</div>
        <div className="grid grid-cols-3 gap-1.5 mb-2">
          {[{ l: 'Enviados', v: '2,401', c: 'text-white' }, { l: 'Abiertos', v: '71%', c: 'text-cyan-400' }, { l: 'Clicks', v: '28%', c: 'text-teal-400' }].map(({ l, v, c }) => (
            <div key={l} className="bg-white/[0.04] rounded-lg p-1.5 text-center border border-white/5">
              <div className={`text-xs font-bold ${c}`}>{v}</div>
              <div className="text-[7px] text-slate-600">{l}</div>
            </div>
          ))}
        </div>
        <div className="flex items-end gap-1 h-8">
          {[55, 80, 62, 91, 74, 88, 70].map((h, i) => (
            <div key={i} className="flex-1 rounded-sm bg-gradient-to-t from-cyan-600/70 to-cyan-400/30" style={{ height: `${h}%` }} />
          ))}
        </div>
        <div className="mt-1.5 flex items-center justify-between">
          <div className="text-[7px] text-slate-600">Lun → Dom</div>
          <div className="flex items-center gap-1 text-[7px] text-green-400">
            <TrendingUp className="w-2.5 h-2.5" /> +18% vs semana anterior
          </div>
        </div>
      </div>
    ),
  },
];

/* ─── Pricing Data ──────────────────────────────────────────────── */
const PLANS = [
  {
    key: 'trial',
    name: 'Trial',
    tagline: '14 días gratis',
    priceLabel: 'Gratis',
    priceSub: '14 días',
    highlight: false,
    badge: null,
    accentClass: 'text-slate-300',
    borderClass: 'border-white/8',
    bgClass: 'bg-white/[0.03]',
    btnClass: 'bg-slate-600 hover:bg-slate-500 text-white',
    features: [
      { label: 'Emails / mes',          value: '100' },
      { label: 'PDFs / mes',            value: '20' },
      { label: 'Aplicaciones',          value: '1' },
      { label: 'Templates',             value: '3' },
      { label: 'Acceso API',            bool: false },
      { label: '2FA',                   bool: false },
      { label: 'Soporte prioritario',   bool: false },
    ],
  },
  {
    key: 'starter',
    name: 'Starter',
    tagline: 'Para comenzar',
    priceLabel: 'UYU 890',
    priceSub: '/mes',
    highlight: false,
    badge: null,
    accentClass: 'text-cyan-400',
    borderClass: 'border-cyan-500/20',
    bgClass: 'bg-white/[0.03]',
    btnClass: 'bg-cyan-500 hover:bg-cyan-400 text-white shadow-lg shadow-cyan-500/20',
    features: [
      { label: 'Emails / mes',          value: '1.000' },
      { label: 'PDFs / mes',            value: '200' },
      { label: 'Aplicaciones',          value: '1' },
      { label: 'Templates',             value: '10' },
      { label: 'Acceso API',            bool: false },
      { label: '2FA',                   bool: false },
      { label: 'Soporte prioritario',   bool: false },
    ],
  },
  {
    key: 'business',
    name: 'Business',
    tagline: 'Para empresas en crecimiento',
    priceLabel: 'UYU 1.890',
    priceSub: '/mes',
    highlight: true,
    badge: 'Más popular',
    accentClass: 'text-blue-400',
    borderClass: 'border-blue-400/50',
    bgClass: 'bg-gradient-to-b from-blue-500/10 to-blue-500/5',
    btnClass: 'bg-blue-500 hover:bg-blue-400 text-white shadow-lg shadow-blue-500/30',
    features: [
      { label: 'Emails / mes',          value: '10.000' },
      { label: 'PDFs / mes',            value: '3.000' },
      { label: 'Aplicaciones',          value: '5' },
      { label: 'Templates',             value: '50' },
      { label: 'Acceso API',            bool: true },
      { label: '2FA',                   bool: true },
      { label: 'Reportes avanzados',    bool: true },
      { label: 'Soporte prioritario',   bool: false },
    ],
  },
  {
    key: 'pro',
    name: 'Pro',
    tagline: 'Alto volumen · Multi-tenant',
    priceLabel: 'UYU 3.900',
    priceSub: '/mes',
    highlight: false,
    badge: 'Máximo poder',
    accentClass: 'text-emerald-400',
    borderClass: 'border-emerald-400/25',
    bgClass: 'bg-white/[0.03]',
    btnClass: 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/20',
    features: [
      { label: 'Emails / mes',          value: '50.000' },
      { label: 'PDFs / mes',            value: '20.000' },
      { label: 'Aplicaciones',          value: '20' },
      { label: 'Templates',             value: '200' },
      { label: 'Acceso API',            bool: true },
      { label: '2FA',                   bool: true },
      { label: 'Reportes avanzados',    bool: true },
      { label: 'Dominio personalizado', bool: true },
      { label: 'Soporte prioritario',   bool: true },
    ],
  },
] as const;

/* ─── Page ──────────────────────────────────────────────────────── */
export const Home = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#050d1a] text-white overflow-x-hidden">
      {/* Global CSS animations */}
      <style>{`
        @keyframes float { 0%,100% { transform: translateY(0px); } 50% { transform: translateY(-12px); } }
        @keyframes float-slow { 0%,100% { transform: translateY(0px); } 50% { transform: translateY(-6px); } }
        @keyframes slide-up { from { opacity:0; transform:translateY(24px); } to { opacity:1; transform:translateY(0); } }
        @keyframes fade-in { from { opacity:0; } to { opacity:1; } }
        @keyframes glow-pulse { 0%,100% { opacity:0.06; } 50% { opacity:0.12; } }
        @keyframes scan { 0% { transform:translateY(-100%); } 100% { transform:translateY(400%); } }
        .float { animation: float 5s ease-in-out infinite; }
        .float-slow { animation: float-slow 7s ease-in-out infinite; }
        .slide-up { animation: slide-up 0.7s ease-out both; }
        .fade-in { animation: fade-in 1s ease-out both; }
        .glow-pulse { animation: glow-pulse 4s ease-in-out infinite; }
        .scan-line { animation: scan 3s linear infinite; }
        .delay-100 { animation-delay: 0.1s; }
        .delay-200 { animation-delay: 0.2s; }
        .delay-300 { animation-delay: 0.3s; }
        .delay-400 { animation-delay: 0.4s; }
        .delay-500 { animation-delay: 0.5s; }
        .delay-600 { animation-delay: 0.6s; }
        .card-hover { transition: transform 0.3s ease, box-shadow 0.3s ease; }
        .card-hover:hover { transform: translateY(-4px); }
      `}</style>

      {/* Ambient background glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="glow-pulse absolute top-[-10%] left-[20%] w-[700px] h-[700px] bg-cyan-500 rounded-full blur-[140px]" />
        <div className="glow-pulse absolute top-[40%] right-[10%] w-[500px] h-[500px] bg-blue-500 rounded-full blur-[120px]" style={{ animationDelay: '2s' }} />
        <div className="glow-pulse absolute bottom-[10%] left-[30%] w-[600px] h-[600px] bg-teal-500 rounded-full blur-[140px]" style={{ animationDelay: '4s' }} />
        {/* Grid overlay */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'linear-gradient(rgba(6,182,212,1) 1px, transparent 1px), linear-gradient(90deg, rgba(6,182,212,1) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
      </div>

      {/* NAV */}
      <nav className="relative z-50 border-b border-white/5 backdrop-blur-xl bg-[#050d1a]/80 sticky top-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="relative">
                <div className="absolute inset-0 bg-cyan-500 blur-lg opacity-25" />
                <img src="/logo.svg" alt="SendCraft" className="h-8 relative" />
              </div>
            </div>
            <div className="hidden md:flex items-center space-x-8 text-sm text-slate-400">
              <a href="#how" className="hover:text-white transition-colors hover:text-cyan-300">Como funciona</a>
              <a href="#features" className="hover:text-white transition-colors hover:text-cyan-300">Funcionalidades</a>
              <a href="#pricing" className="hover:text-white transition-colors hover:text-cyan-300">Precios</a>
              <a href="#testimonials" className="hover:text-white transition-colors hover:text-cyan-300">Testimonios</a>
            </div>
            <button
              onClick={() => navigate('/login')}
              className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-cyan-600 text-white rounded-lg font-semibold text-sm hover:shadow-lg hover:shadow-cyan-500/40 transition-all hover:scale-105 active:scale-95"
            >
              Inicia prueba gratis
            </button>
          </div>
        </div>
      </nav>

      {/* ── HERO ──────────────────────────────────────────────────── */}
      <section className="relative z-10 pt-20 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <div className="slide-up inline-flex items-center gap-2 px-4 py-1.5 mb-6 rounded-full border border-cyan-400/25 bg-cyan-400/8 text-cyan-300 text-xs font-semibold tracking-widest uppercase">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              Plataforma de Comunicaciones Empresariales
            </div>

            <h1 className="slide-up delay-100 text-5xl md:text-6xl lg:text-[72px] font-extrabold mb-6 leading-[1.06] tracking-tight">
              Comunicaciones que
              <br />
              <span className="relative inline-block">
                <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-teal-400 bg-clip-text text-transparent">
                  impulsan tu negocio
                </span>
                <span className="absolute bottom-1 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent" />
              </span>
            </h1>

            <p className="slide-up delay-200 text-lg md:text-xl text-slate-400 mb-10 max-w-2xl mx-auto leading-relaxed">
              SendCraft centraliza emails, templates, PDFs y analitica en una sola plataforma. Automatiza, rastrea y optimiza cada comunicacion empresarial desde un dashboard intuitivo.
            </p>

            <div className="slide-up delay-300 flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => navigate('/login')}
                className="group inline-flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-cyan-500 to-cyan-600 text-white rounded-xl font-semibold text-base hover:shadow-2xl hover:shadow-cyan-500/40 transition-all hover:scale-105 active:scale-95"
              >
                Comienza gratis hoy
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
              <a
                href="#features"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 border border-white/12 text-white rounded-xl font-semibold text-base hover:bg-white/6 hover:border-white/25 transition-all"
              >
                Ver funcionalidades
                <ChevronRight className="w-4 h-4" />
              </a>
            </div>

            {/* Trust badges */}
            <div className="slide-up delay-400 flex flex-wrap gap-6 justify-center mt-8">
              {['Sin tarjeta de credito', '14 dias gratis', 'Soporte incluido'].map((badge) => (
                <div key={badge} className="flex items-center gap-2 text-sm text-slate-500">
                  <CheckCircle className="w-4 h-4 text-cyan-500/70" />
                  <span>{badge}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Hero Dashboard */}
          <div className="slide-up delay-500 relative max-w-5xl mx-auto">
            <div className="absolute -inset-px bg-gradient-to-r from-cyan-500/30 via-blue-500/15 to-teal-500/30 rounded-2xl blur-xl" />
            <div className="float">
              <DashboardMockup />
            </div>
            {/* Floating badges */}
            <div className="float-slow absolute -left-6 top-1/3 bg-slate-900 border border-white/10 rounded-xl px-4 py-3 shadow-xl hidden lg:block"
              style={{ animationDelay: '1s' }}>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-green-500/20 border border-green-500/30 flex items-center justify-center">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-white">Entregado</div>
                  <div className="text-[10px] text-slate-500">cliente@empresa.com</div>
                </div>
              </div>
            </div>
            <div className="float-slow absolute -right-6 bottom-1/3 bg-slate-900 border border-white/10 rounded-xl px-4 py-3 shadow-xl hidden lg:block">
              <div className="text-[10px] text-slate-500 mb-1">Tasa de entrega</div>
              <div className="text-xl font-bold text-cyan-400">99.2%</div>
              <div className="flex gap-0.5 mt-1">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="w-2 h-1 rounded-full bg-cyan-500/50" style={{ opacity: 0.3 + i * 0.09 }} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS ─────────────────────────────────────────────────── */}
      <section className="relative z-10 py-14 px-4 sm:px-6 lg:px-8 border-y border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {STATS.map(({ value, label, icon: Icon }, i) => (
              <div key={label} className={`text-center group slide-up delay-${(i + 1) * 100}`}>
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 mb-3 group-hover:bg-cyan-500/20 group-hover:scale-110 transition-all">
                  <Icon className="w-5 h-5 text-cyan-400" />
                </div>
                <div className="text-3xl font-extrabold text-white mb-1">{value}</div>
                <div className="text-sm text-slate-500">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ──────────────────────────────────────────── */}
      <section id="how" className="relative z-10 py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="text-xs font-semibold tracking-widest text-cyan-400 uppercase mb-4">Como funciona</div>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">De la idea al envio en minutos</h2>
            <p className="text-slate-400 max-w-lg mx-auto">Un flujo simplificado para que tu equipo se enfoque en lo que importa, no en la infraestructura.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 relative">
            {/* connector */}
            <div className="hidden md:block absolute top-10 left-[calc(33%+1rem)] right-[calc(33%+1rem)] h-px">
              <div className="h-full bg-gradient-to-r from-cyan-500/50 via-blue-500/50 to-cyan-500/50" />
              <div className="absolute left-0 top-[-3px] w-1.5 h-1.5 rounded-full bg-cyan-400" />
              <div className="absolute right-0 top-[-3px] w-1.5 h-1.5 rounded-full bg-cyan-400" />
            </div>

            {STEPS.map(({ step, title, desc, icon: Icon, visual }, i) => (
              <div key={step} className={`card-hover group slide-up delay-${(i + 1) * 200}`}>
                <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-6 hover:border-cyan-500/30 hover:bg-white/[0.05] transition-all group-hover:shadow-xl group-hover:shadow-cyan-500/5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/25 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-cyan-400" />
                    </div>
                    <div className="text-2xl font-extrabold text-white/10 font-mono">{step}</div>
                  </div>
                  {visual}
                  <div className="mt-4">
                    <h3 className="text-base font-bold text-white mb-2">{title}</h3>
                    <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ──────────────────────────────────────────────── */}
      <section id="features" className="relative z-10 py-24 px-4 sm:px-6 lg:px-8 bg-white/[0.015]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="text-xs font-semibold tracking-widest text-cyan-400 uppercase mb-4">Funcionalidades</div>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Todo lo que necesitas para comunicarte</h2>
            <p className="text-slate-400 max-w-lg mx-auto">Una suite completa de herramientas empresariales, lista desde el primer dia.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map(({ icon: Icon, title, description, color }) => {
              const c = colorMap[color];
              return (
                <div key={title} className={`card-hover group border border-white/6 rounded-2xl p-6 bg-white/[0.02] hover:border-opacity-100 transition-all duration-300 hover:shadow-xl ${c.glow}`}
                  style={{ ['--tw-shadow-color' as string]: 'transparent' }}>
                  <div className={`w-11 h-11 ${c.bg} border ${c.border} rounded-xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform`}>
                    <Icon className={`w-5 h-5 ${c.text}`} />
                  </div>
                  <h3 className="text-sm font-bold text-white mb-2">{title}</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">{description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── DEEP DIVE: Deliverability ─────────────────────────────── */}
      <section className="relative z-10 py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <div className="text-xs font-semibold tracking-widest text-cyan-400 uppercase mb-4">Entregabilidad</div>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-6 leading-tight">Infraestructura diseñada para no fallar</h2>
            <p className="text-slate-400 mb-8 leading-relaxed text-sm">
              Nuestra plataforma garantiza maxima entregabilidad con autenticacion SPF, DKIM y DMARC configurada automaticamente. Tus emails llegan al inbox, nunca al spam.
            </p>
            <ul className="space-y-3">
              {['Autenticacion SPF, DKIM y DMARC automatica', 'IPs dedicadas de alta reputacion', 'Monitoreo de listas negras 24/7', 'Reintentos inteligentes ante fallos', 'Logs detallados por cada mensaje'].map((item) => (
                <li key={item} className="flex items-center gap-3 text-sm text-slate-300">
                  <div className="w-5 h-5 rounded-full bg-cyan-500/15 border border-cyan-500/25 flex items-center justify-center flex-shrink-0">
                    <Check className="w-3 h-3 text-cyan-400" />
                  </div>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="relative">
            <div className="absolute -inset-6 bg-gradient-to-r from-cyan-500/8 to-blue-500/8 rounded-3xl blur-2xl" />
            <div className="float-slow relative">
              <DeliverabilityMockup />
            </div>
          </div>
        </div>
      </section>

      {/* ── DEEP DIVE: Analytics ──────────────────────────────────── */}
      <section className="relative z-10 py-24 px-4 sm:px-6 lg:px-8 bg-white/[0.015]">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
          <div className="order-2 lg:order-1 relative">
            <div className="absolute -inset-6 bg-gradient-to-r from-teal-500/8 to-cyan-500/8 rounded-3xl blur-2xl" />
            <div className="float-slow relative">
              <AnalyticsMockup />
            </div>
          </div>
          <div className="order-1 lg:order-2">
            <div className="text-xs font-semibold tracking-widest text-teal-400 uppercase mb-4">Analitica</div>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-6 leading-tight">Datos que informan cada decision</h2>
            <p className="text-slate-400 mb-8 leading-relaxed text-sm">
              Comprende el comportamiento de tus destinatarios con reportes detallados y visualizaciones claras. Optimiza basandote en datos reales, no en suposiciones.
            </p>
            <ul className="space-y-3">
              {['Metricas en tiempo real por campana', 'Comparacion entre periodos', 'Segmentacion avanzada de audiencias', 'Reportes PDF automaticos programables', 'Alertas inteligentes ante anomalias'].map((item) => (
                <li key={item} className="flex items-center gap-3 text-sm text-slate-300">
                  <div className="w-5 h-5 rounded-full bg-teal-500/15 border border-teal-500/25 flex items-center justify-center flex-shrink-0">
                    <Check className="w-3 h-3 text-teal-400" />
                  </div>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── DEEP DIVE: Template Editor ────────────────────────────── */}
      <section className="relative z-10 py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <div className="text-xs font-semibold tracking-widest text-blue-400 uppercase mb-4">Editor de Templates</div>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-6 leading-tight">Templates profesionales en minutos</h2>
            <p className="text-slate-400 mb-8 leading-relaxed text-sm">
              Nuestro editor HTML con preview en tiempo real te permite crear comunicaciones impecables. Variables dinamicas, logica condicional y exportacion a PDF integrada.
            </p>
            <ul className="space-y-3">
              {['Editor HTML con resaltado de sintaxis', 'Preview instantaneo del resultado final', 'Variables dinamicas con autocompletado', 'Exportacion directa a PDF profesional', 'Biblioteca de templates prediseñados'].map((item) => (
                <li key={item} className="flex items-center gap-3 text-sm text-slate-300">
                  <div className="w-5 h-5 rounded-full bg-blue-500/15 border border-blue-500/25 flex items-center justify-center flex-shrink-0">
                    <Check className="w-3 h-3 text-blue-400" />
                  </div>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="relative">
            <div className="absolute -inset-6 bg-gradient-to-r from-blue-500/8 to-cyan-500/8 rounded-3xl blur-2xl" />
            <div className="float-slow relative">
              <TemplateMockup />
            </div>
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ──────────────────────────────────────────── */}
      <section id="testimonials" className="relative z-10 py-24 px-4 sm:px-6 lg:px-8 bg-white/[0.015]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="text-xs font-semibold tracking-widest text-cyan-400 uppercase mb-4">Testimonios</div>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Lo que dicen nuestros clientes</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {TESTIMONIALS.map(({ name, role, text, initials, color, stars }, i) => (
              <div key={name} className={`card-hover bg-white/[0.03] border border-white/8 rounded-2xl p-6 hover:border-cyan-500/20 hover:bg-white/[0.05] transition-all slide-up delay-${(i + 1) * 100}`}>
                <div className="flex gap-1 mb-4">
                  {[...Array(stars)].map((_, j) => (
                    <Star key={j} className="w-4 h-4 text-amber-400 fill-amber-400" />
                  ))}
                </div>
                <p className="text-slate-300 text-sm leading-relaxed mb-6">"{text}"</p>
                <div className="flex items-center gap-3 pt-4 border-t border-white/6">
                  <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${color} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                    {initials}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">{name}</div>
                    <div className="text-xs text-slate-500">{role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ───────────────────────────────────────────────── */}
      <section id="pricing" className="relative z-10 py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <div className="text-xs font-semibold tracking-widest text-cyan-400 uppercase mb-4">Planes y Precios</div>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Elige el plan que se ajusta a tu equipo
            </h2>
            <p className="text-slate-400 max-w-xl mx-auto">
              Todos los planes incluyen acceso multi-tenant. Los límites son compartidos por todo el tenant y solo los administradores pueden actualizarlo.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
            {PLANS.map((plan) => (
              <div
                key={plan.key}
                className={`relative rounded-2xl border ${plan.borderClass} ${plan.bgClass} flex flex-col overflow-hidden card-hover ${plan.highlight ? 'ring-1 ring-blue-400/30' : ''}`}
              >
                {/* Badge */}
                {plan.badge && (
                  <div className="absolute top-0 left-0 right-0 flex justify-center">
                    <span className={`text-xs font-bold px-4 py-1 rounded-b-lg ${plan.key === 'business' ? 'bg-blue-500 text-white' : 'bg-emerald-500 text-white'}`}>
                      {plan.badge}
                    </span>
                  </div>
                )}

                <div className={`p-6 flex flex-col flex-1 ${plan.badge ? 'pt-10' : ''}`}>
                  {/* Header */}
                  <div className="mb-5">
                    <h3 className={`text-xl font-extrabold mb-1 ${plan.accentClass}`}>{plan.name}</h3>
                    <p className="text-slate-500 text-xs">{plan.tagline}</p>
                  </div>

                  {/* Price */}
                  <div className="mb-6 flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold text-white">{plan.priceLabel}</span>
                    <span className="text-slate-400 text-sm">{plan.priceSub}</span>
                  </div>

                  {/* Divider */}
                  <div className="h-px bg-white/6 mb-5" />

                  {/* Features */}
                  <ul className="space-y-3 flex-1 mb-6">
                    {plan.features.map((f) => (
                      <li key={f.label} className="flex items-center justify-between gap-2 text-sm">
                        <span className="text-slate-400">{f.label}</span>
                        {'bool' in f ? (
                          f.bool ? (
                            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center">
                              <Check className="w-3 h-3 text-emerald-400" />
                            </span>
                          ) : (
                            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-white/5 border border-white/8 flex items-center justify-center">
                              <Minus className="w-3 h-3 text-slate-600" />
                            </span>
                          )
                        ) : (
                          <span className={`flex-shrink-0 font-bold text-xs ${plan.accentClass}`}>{f.value}</span>
                        )}
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <button
                    onClick={() => navigate('/login')}
                    className={`w-full py-2.5 rounded-xl font-bold text-sm transition-all hover:scale-[1.02] active:scale-95 ${plan.btnClass}`}
                  >
                    {plan.key === 'trial' ? 'Comenzar gratis' : 'Suscribirse'}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <p className="text-center text-slate-600 text-sm mt-10">
            Precios en pesos uruguayos (UYU) · Límites compartidos por tenant · Solo administradores pueden cambiar el plan
          </p>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────── */}
      <section className="relative z-10 py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="relative rounded-3xl overflow-hidden border border-white/8">
            {/* Animated background */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#071a2e] via-[#0a1f35] to-[#071a2e]" />
            <div className="absolute inset-0">
              <div className="glow-pulse absolute top-[-30%] left-[-10%] w-[500px] h-[500px] bg-cyan-500 rounded-full blur-[100px]" />
              <div className="glow-pulse absolute bottom-[-30%] right-[-10%] w-[400px] h-[400px] bg-blue-500 rounded-full blur-[100px]" style={{ animationDelay: '2s' }} />
              <div className="absolute inset-0 opacity-[0.04]"
                style={{ backgroundImage: 'linear-gradient(rgba(6,182,212,1) 1px, transparent 1px), linear-gradient(90deg, rgba(6,182,212,1) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
            </div>
            <div className="relative z-10 text-center p-12 md:p-20">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-6 rounded-full border border-cyan-400/20 bg-cyan-400/10 text-cyan-300 text-xs font-semibold tracking-widest uppercase">
                <CheckCircle className="w-3.5 h-3.5" />
                Sin tarjeta de credito requerida
              </div>
              <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-6 leading-tight">
                Listo para transformar
                <br />tus comunicaciones?
              </h2>
              <p className="text-lg text-slate-300 mb-10 max-w-lg mx-auto">
                Unete a mas de 500 empresas que confian en SendCraft para sus comunicaciones criticas.
              </p>
              <button
                onClick={() => navigate('/login')}
                className="group inline-flex items-center gap-2 px-10 py-4 bg-gradient-to-r from-cyan-500 to-cyan-600 text-white rounded-xl font-bold text-lg hover:shadow-2xl hover:shadow-cyan-500/50 transition-all hover:scale-105 active:scale-95"
              >
                Comenzar prueba gratuita
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
              <div className="flex flex-wrap gap-8 justify-center mt-10">
                {['14 dias gratis', 'Sin compromiso', 'Soporte incluido', 'Setup en minutos'].map((item) => (
                  <div key={item} className="flex items-center gap-2 text-sm text-slate-400">
                    <CheckCircle className="w-4 h-4 text-cyan-500/70" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────────── */}
      <footer className="relative z-10 border-t border-white/5 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative">
            <div className="absolute inset-0 bg-cyan-500 blur-lg opacity-15" />
            <img src="/logo.svg" alt="SendCraft" className="h-7 relative" />
          </div>
          <div className="text-slate-600 text-sm">Copyright 2024 SendCraft. Todos los derechos reservados.</div>
          <div className="flex gap-6 text-sm text-slate-600">
            {['Privacidad', 'Terminos', 'Soporte'].map((link) => (
              <a key={link} href="#" className="hover:text-slate-300 transition-colors">{link}</a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
};
