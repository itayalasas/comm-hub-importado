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
  Check,
  Minus,
  Loader2,
  MessageSquare,
  Send,
  Activity,
  MousePointer,
  Eye,
  X,
  Star,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { sortPlansByOrder, usePlans, type Plan } from '../hooks/usePlans';
import { configManager } from '../lib/config';
import { buildLegacyRegisterUrl } from '../lib/subscriptionCheckout';
import { Seo } from '../components/Seo';

/* ─── Data ─────────────────────────────────────────────────────── */
const STATS = [
  { value: '99.9%', label: 'Uptime garantizado', icon: Activity },
  { value: '10M+', label: 'Emails enviados', icon: Send },
  { value: '500+', label: 'Empresas activas', icon: Users },
  { value: '<2s', label: 'Tiempo de entrega', icon: Clock },
];

const FEATURES = [
  { icon: Mail, title: 'Gestión de emails', description: 'Envía y rastrea emails transaccionales y de marketing con seguimiento en tiempo real de entregas, aperturas y clics.', color: 'cyan' },
  { icon: Zap, title: 'Templates dinámicos', description: 'Crea y personaliza templates con variables dinámicas y preview en tiempo real para distintos tipos de comunicación.', color: 'blue' },
  { icon: BarChart2, title: 'Analítica avanzada', description: 'Dashboards interactivos con métricas detalladas, reportes de rendimiento y tendencias de tus comunicaciones.', color: 'teal' },
  { icon: FileText, title: 'Generación de PDFs', description: 'Convierte tus templates en documentos PDF profesionales listos para enviar o descargar automáticamente.', color: 'cyan' },
  { icon: Bell, title: 'Webhooks automáticos', description: 'Recibe notificaciones de eventos en tiempo real y mantiene tus sistemas sincronizados sin esfuerzo.', color: 'blue' },
  { icon: Globe, title: 'API RESTful completa', description: 'Integra SendCraft con tus sistemas existentes usando nuestra API bien documentada y fácil de usar.', color: 'teal' },
  { icon: Lock, title: 'Seguridad empresarial', description: 'Autenticación robusta con gestión de permisos, roles y cifrado de extremo a extremo.', color: 'cyan' },
  { icon: MessageSquare, title: 'Comunicaciones pendientes', description: 'Gestiona colas de comunicaciones, reprograma envíos y monitorea el estado de cada mensaje.', color: 'blue' },
  { icon: TrendingUp, title: 'Optimización continua', description: 'Sugerencias inteligentes para mejorar tasas de apertura, entregabilidad y engagement general.', color: 'teal' },
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
            <div className="text-[10px] text-slate-500">Hoy, 3 de mayo de 2026</div>
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
        <div className="text-[9px] text-slate-500 mb-3 flex items-center gap-1"><Eye className="w-3 h-3" /> Vista previa</div>
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
            <div className="mt-2 h-4 bg-cyan-500 rounded text-[6px] text-white flex items-center justify-center">Ver más</div>
          </div>
        </div>
      </div>
    ),
  },
  {
    step: '02',
    title: 'Configura el envío',
    desc: 'Define destinatarios, programación inteligente y reglas de entrega desde el dashboard central.',
    icon: Send,
    visual: (
      <div className="w-full h-32 bg-[#0a1628] rounded-xl border border-white/8 p-3 overflow-hidden">
        <div className="text-[8px] text-slate-500 mb-2">Nuevo envío</div>
        <div className="space-y-2">
          {[
            { label: 'Para', value: 'clientes@empresa.com (2,401)', color: 'border-cyan-500/40' },
            { label: 'Template', value: 'Factura mensual v2', color: 'border-white/10' },
            { label: 'Envío', value: 'Hoy 10:00 AM', color: 'border-white/10' },
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
    desc: 'Monitorea entregas, aperturas, clics y genera reportes PDF automáticamente con datos en vivo.',
    icon: BarChart2,
    visual: (
      <div className="w-full h-32 bg-[#0a1628] rounded-xl border border-white/8 p-3 overflow-hidden">
        <div className="text-[8px] text-slate-500 mb-2">Resultados campaña</div>
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

/* ─── Pricing helpers ───────────────────────────────────────────── */
const PLAN_STYLE: Record<number, { accentClass: string; borderClass: string; bgClass: string; btnClass: string; highlight: boolean; badge: string | null }> = {
  0: { accentClass: 'text-slate-300',   borderClass: 'border-white/8',         bgClass: 'bg-white/[0.03]',                                    btnClass: 'bg-slate-600 hover:bg-slate-500 text-white',                         highlight: false, badge: null },
  1: { accentClass: 'text-cyan-400',    borderClass: 'border-cyan-500/20',      bgClass: 'bg-white/[0.03]',                                    btnClass: 'bg-cyan-500 hover:bg-cyan-400 text-white shadow-lg shadow-cyan-500/20',  highlight: false, badge: null },
  2: { accentClass: 'text-blue-400',    borderClass: 'border-blue-400/50',      bgClass: 'bg-gradient-to-b from-blue-500/10 to-blue-500/5',    btnClass: 'bg-blue-500 hover:bg-blue-400 text-white shadow-lg shadow-blue-500/30',  highlight: true,  badge: 'Más popular' },
  3: { accentClass: 'text-emerald-400', borderClass: 'border-emerald-400/25',   bgClass: 'bg-white/[0.03]',                                    btnClass: 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/20', highlight: false, badge: 'Máximo poder' },
};

const FEATURE_LABEL: Record<string, string> = {
  total_de_correos_mensuales: 'Emails / mes',
  pdf_generations_monthly:    'PDFs / mes',
  max_applications:           'Aplicaciones',
  templates:                  'Templates',
  api_access:                 'Acceso API',
  two_factor_auth:            '2FA',
  priority_support:           'Soporte prioritario',
  advanced_reports:           'Reportes avanzados',
  custom_domain:              'Dominio personalizado',
};

// Feature display order for the cards
const FEATURE_ORDER = [
  'total_de_correos_mensuales',
  'pdf_generations_monthly',
  'max_applications',
  'templates',
  'api_access',
  'two_factor_auth',
  'advanced_reports',
  'custom_domain',
  'priority_support',
];

function formatNumber(val: string): string {
  const n = parseInt(val, 10);
  if (isNaN(n)) return val;
  return n.toLocaleString('es-UY');
}

function buildRegisterUrl(planId: string): string {
  return buildLegacyRegisterUrl(planId);
}

function PlanCard({ plan, index }: { plan: Plan; index: number }) {
  const style = PLAN_STYLE[index] ?? PLAN_STYLE[1];
  const isFreePlan = plan.price === 0;
  const isDefaultPlan = plan.is_default === true;
  const badgeLabel = isDefaultPlan ? 'Predeterminado' : style.badge;
  const badgeClassName = isDefaultPlan
    ? 'border border-cyan-400/30 bg-cyan-500/15 text-cyan-200 shadow-lg shadow-cyan-500/15'
    : index === 2
    ? 'bg-gradient-to-r from-blue-500 to-cyan-400 text-white shadow-lg shadow-cyan-500/30 ring-1 ring-white/20'
    : 'bg-gradient-to-r from-emerald-500 to-teal-400 text-white shadow-lg shadow-cyan-500/30 ring-1 ring-white/20';
  const [isRedirecting, setIsRedirecting] = useState(false);
  const cardHighlightClass = isDefaultPlan
    ? 'ring-1 ring-cyan-400/40 shadow-lg shadow-cyan-500/10'
    : style.highlight
    ? 'ring-1 ring-blue-400/30'
    : '';

  // Sort features by our preferred display order; unknown features go to the end
  const sortedFeatures = [...(plan.entitlements?.features ?? [])].sort((a, b) => {
    const ia = FEATURE_ORDER.indexOf(a.code);
    const ib = FEATURE_ORDER.indexOf(b.code);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  const handleCta = () => {
    if (isRedirecting) return;

    setIsRedirecting(true);
    void (async () => {
      try {
        await configManager.loadConfig();
        window.location.href = buildRegisterUrl(plan.id);
      } catch (error) {
        console.error(error);
        setIsRedirecting(false);
      }
    })();
  };

  return (
    <div className={`relative rounded-2xl border ${style.borderClass} ${style.bgClass} flex flex-col overflow-hidden card-hover ${cardHighlightClass}`}>
      <div className="p-6 flex flex-col flex-1">
        <div className="mb-5">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className={`text-xl font-extrabold ${style.accentClass}`}>{plan.name}</h3>
            {badgeLabel && (
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] backdrop-blur ${badgeClassName}`}>
                <Star className="w-3 h-3 fill-current" />
                {badgeLabel}
              </span>
            )}
          </div>
          <p className="text-slate-500 text-xs">{plan.description}</p>
        </div>

        <div className="mb-6 flex items-baseline gap-1">
          {isFreePlan ? (
            <>
              <span className="text-3xl font-extrabold text-white">Gratis</span>
              {plan.trial_days > 0 && (
                <span className="text-slate-400 text-sm">· {plan.trial_days} días</span>
              )}
            </>
          ) : (
            <>
              <span className="text-3xl font-extrabold text-white">
                {plan.currency} {plan.price.toLocaleString('es-UY')}
              </span>
              <span className="text-slate-400 text-sm">/mes</span>
            </>
          )}
        </div>

        <div className="h-px bg-white/6 mb-5" />

        <ul className="space-y-3 flex-1 mb-6">
          {sortedFeatures.map((f) => {
            const label = FEATURE_LABEL[f.code] ?? f.name;
            const isBool = f.value_type === 'boolean';
            const boolOn = isBool && (f.value === 'true' || f.value === '1');
            return (
              <li key={f.code} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-slate-400">{label}</span>
                {isBool ? (
                  boolOn ? (
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center">
                      <Check className="w-3 h-3 text-emerald-400" />
                    </span>
                  ) : (
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-white/5 border border-white/8 flex items-center justify-center">
                      <Minus className="w-3 h-3 text-slate-600" />
                    </span>
                  )
                ) : (
                  <span className={`flex-shrink-0 font-bold text-xs ${style.accentClass}`}>{formatNumber(f.value)}</span>
                )}
              </li>
            );
          })}
        </ul>

        <button
          onClick={handleCta}
          disabled={isRedirecting}
          className={`w-full py-2.5 rounded-xl font-bold text-sm transition-all disabled:opacity-80 disabled:cursor-not-allowed ${isRedirecting ? 'scale-100' : 'hover:scale-[1.02] active:scale-95'} ${style.btnClass}`}
        >
          {isRedirecting ? (
            <span className="inline-flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Iniciando...
            </span>
          ) : isFreePlan ? 'Comenzar gratis' : 'Suscribirse'}
        </button>
      </div>
    </div>
  );
}

const SUPPORT_API_URL = 'https://api.flowbridge.site/functions/v1/api-gateway/dcd7ec42-e7fb-46fa-93d3-ccdf3e053795';
const SUPPORT_API_KEY = 'pub_5bc238047db11edae7d4ecb2805f0057a2505c706e625c9a243b6e95bf33cd67';

/* ─── Support Modal ─────────────────────────────────────────────── */
type SupportForm = { name: string; email: string; phone: string; subject: string; message: string };
const EMPTY_FORM: SupportForm = { name: '', email: '', phone: '', subject: '', message: '' };

function SupportModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState<SupportForm>(EMPTY_FORM);
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(SUPPORT_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Integration-Key': SUPPORT_API_KEY,
        },
        body: JSON.stringify({
          session_id: `sess_${Date.now()}`,
          message: `[${form.subject}] ${form.message}`,
          visitor: {
            name: form.name,
            email: form.email,
            ...(form.phone ? { phone: form.phone } : {}),
          },
          page_url: window.location.href,
          source_domain: window.location.hostname,
        }),
      });
      if (!res.ok) throw new Error('Error al enviar');
      setSent(true);
    } catch {
      setError('No se pudo enviar el mensaje. Por favor intentá de nuevo.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative bg-[#071428] border border-white/10 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-px bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent" />
        <div className="p-7">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-white">Contactar Soporte</h2>
              <p className="text-slate-500 text-sm mt-0.5">Te respondemos en menos de 24 horas hábiles.</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all">
              <X className="w-4 h-4" />
            </button>
          </div>

          {sent ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-emerald-400" />
              </div>
              <h3 className="text-white font-bold text-lg mb-2">Mensaje enviado</h3>
              <p className="text-slate-400 text-sm">Gracias por contactarnos. Nos pondremos en contacto a la brevedad.</p>
              <button onClick={onClose} className="mt-6 px-6 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-white rounded-xl font-semibold text-sm transition-all">
                Cerrar
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Nombre</label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Tu nombre"
                    className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 focus:bg-white/[0.06] transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Email</label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="tu@empresa.com"
                    className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 focus:bg-white/[0.06] transition-all"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Teléfono <span className="text-slate-600">(opcional)</span></label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="+598 99 000 000"
                    className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 focus:bg-white/[0.06] transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Asunto</label>
                  <input
                    type="text"
                    required
                    value={form.subject}
                    onChange={(e) => setForm({ ...form, subject: e.target.value })}
                    placeholder="¿En qué te ayudamos?"
                    className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 focus:bg-white/[0.06] transition-all"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Mensaje</label>
                <textarea
                  required
                  rows={4}
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  placeholder="Describe tu consulta con el mayor detalle posible..."
                  className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 focus:bg-white/[0.06] transition-all resize-none"
                />
              </div>
              {error && (
                <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-gradient-to-r from-cyan-500 to-cyan-600 text-white rounded-xl font-semibold text-sm hover:shadow-lg hover:shadow-cyan-500/30 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</>
                ) : (
                  <><Send className="w-4 h-4" /> Enviar mensaje</>
                )}
              </button>
            </form>
          )}
        </div>
        <div className="h-px bg-gradient-to-r from-transparent via-teal-400/25 to-transparent" />
      </div>
    </div>
  );
}

/* ─── Page ──────────────────────────────────────────────────────── */
export const Home = () => {
  const navigate = useNavigate();
  const { plans, loading: plansLoading } = usePlans();
  const orderedPlans = sortPlansByOrder(plans);
  const [supportOpen, setSupportOpen] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);

  const handleStartTrial = () => {
    if (loginLoading) return;
    setLoginLoading(true);
    window.setTimeout(() => {
      navigate('/login');
    }, 140);
  };

  return (
    <div className="min-h-screen bg-[#050d1a] text-white overflow-x-hidden">
      <Seo
        title="Plataforma de email marketing y correos transaccionales"
        description="SendCraft centraliza email marketing, correos transaccionales, SMTP, API y PDF en una sola plataforma para equipos y SaaS."
        path="/"
        canonicalUrl="https://sendcraft.net/"
        keywords={[
          'email marketing',
          'correos transaccionales',
          'api email',
          'smtp',
          'plataforma de email marketing',
        ]}
        structuredData={{
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          name: 'SendCraft',
          applicationCategory: 'BusinessApplication',
          operatingSystem: 'Web',
          description:
            'Plataforma de email marketing y correos transaccionales con API, SMTP, automatizaciones y PDFs.',
          url: 'https://sendcraft.net/',
        }}
      />

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
            </div>
            <button
              onClick={handleStartTrial}
              disabled={loginLoading}
              className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-cyan-600 text-white rounded-lg font-semibold text-sm hover:shadow-lg hover:shadow-cyan-500/40 transition-all hover:scale-105 active:scale-95 disabled:opacity-80 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loginLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              <span>{loginLoading ? 'Iniciando...' : 'Inicia prueba gratis'}</span>
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
              Plataforma de email marketing y correos transaccionales
            </div>

            <h1 className="slide-up delay-100 text-5xl md:text-6xl lg:text-[72px] font-extrabold mb-6 leading-[1.06] tracking-tight">
              Email marketing y correos transaccionales
              <br />
              <span className="relative inline-block">
                <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-teal-400 bg-clip-text text-transparent">
                  que impulsan tu negocio
                </span>
                <span className="absolute bottom-1 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent" />
              </span>
            </h1>

            <p className="slide-up delay-200 text-lg md:text-xl text-slate-400 mb-10 max-w-2xl mx-auto leading-relaxed">
              SendCraft centraliza email marketing, correos transaccionales, SMTP, API, templates y PDFs en una sola plataforma. Automatiza, rastrea y optimiza cada comunicación empresarial desde un dashboard intuitivo.
            </p>

            <div className="slide-up delay-300 flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={handleStartTrial}
                disabled={loginLoading}
                className="group inline-flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-cyan-500 to-cyan-600 text-white rounded-xl font-semibold text-base hover:shadow-2xl hover:shadow-cyan-500/40 transition-all hover:scale-105 active:scale-95"
              >
                {loginLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                <span>{loginLoading ? 'Iniciando...' : 'Comienza gratis hoy'}</span>
                {!loginLoading && <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />}
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
              {['Sin tarjeta de crédito', '14 días gratis', 'Soporte incluido'].map((badge) => (
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
            <div className="text-xs font-semibold tracking-widest text-cyan-400 uppercase mb-4">Cómo funciona</div>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">De la idea al envío en minutos</h2>
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
              Nuestra plataforma garantiza máxima entregabilidad con autenticación SPF, DKIM y DMARC configurada automáticamente. Tus emails llegan al inbox, nunca al spam.
            </p>
            <ul className="space-y-3">
              {['Autenticación SPF, DKIM y DMARC automática', 'IPs dedicadas de alta reputación', 'Monitoreo de listas negras 24/7', 'Reintentos inteligentes ante fallos', 'Logs detallados por cada mensaje'].map((item) => (
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
            <div className="text-xs font-semibold tracking-widest text-teal-400 uppercase mb-4">Analítica</div>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-6 leading-tight">Datos que informan cada decisión</h2>
            <p className="text-slate-400 mb-8 leading-relaxed text-sm">
              Comprende el comportamiento de tus destinatarios con reportes detallados y visualizaciones claras. Optimiza basándote en datos reales, no en suposiciones.
            </p>
            <ul className="space-y-3">
              {['Métricas en tiempo real por campaña', 'Comparación entre periodos', 'Segmentación avanzada de audiencias', 'Reportes PDF automáticos programables', 'Alertas inteligentes ante anomalías'].map((item) => (
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
              Nuestro editor HTML con vista previa en tiempo real te permite crear comunicaciones impecables. Variables dinámicas, lógica condicional y exportación a PDF integrada.
            </p>
            <ul className="space-y-3">
              {['Editor HTML con resaltado de sintaxis', 'Vista previa instantánea del resultado final', 'Variables dinámicas con autocompletado', 'Exportación directa a PDF profesional', 'Biblioteca de templates prediseñados'].map((item) => (
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

      {/* ── CONTACT ───────────────────────────────────────────────── */}
      <section className="relative z-10 py-24 px-4 sm:px-6 lg:px-8 bg-white/[0.015]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <div className="text-xs font-semibold tracking-widest text-cyan-400 uppercase mb-4">Contacto</div>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">¿Tienes alguna pregunta?</h2>
            <p className="text-slate-400 max-w-lg mx-auto">Nuestro equipo está listo para ayudarte. Escribinos y te respondemos en menos de 24 horas hábiles.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {[
              {
                icon: Mail,
                title: 'Email',
                value: 'soporte@sendcraft.app',
                href: 'mailto:soporte@sendcraft.app',
                desc: 'Respondemos en menos de 24 h',
              },
              {
                icon: MessageSquare,
                title: 'Chat en vivo',
                value: 'Abrir chat',
                href: null,
                desc: 'Lunes a viernes, 9 a 18 hs',
                action: true,
              },
              {
                icon: Globe,
                title: 'Documentación',
                value: 'Ver documentación',
                href: '/docs',
                desc: 'Guías, referencia de API y tutoriales',
              },
            ].map(({ icon: Icon, title, value, href, desc, action }) => (
              <div key={title} className="card-hover group bg-white/[0.03] border border-white/8 rounded-2xl p-6 hover:border-cyan-500/20 hover:bg-white/[0.05] transition-all text-center">
                <div className="w-12 h-12 bg-cyan-500/10 border border-cyan-500/20 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:bg-cyan-500/15 transition-colors">
                  <Icon className="w-6 h-6 text-cyan-400" />
                </div>
                <h3 className="text-white font-bold mb-1">{title}</h3>
                <p className="text-slate-500 text-xs mb-3">{desc}</p>
                {action ? (
                  <button
                    onClick={() => setSupportOpen(true)}
                    className="text-cyan-400 hover:text-cyan-300 text-sm font-semibold transition-colors"
                  >
                    {value} →
                  </button>
                ) : (
                  <a href={href!} className="text-cyan-400 hover:text-cyan-300 text-sm font-semibold transition-colors">
                    {value} →
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ───────────────────────────────────────────────── */}
      <section className="relative z-10 py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <div className="text-xs font-semibold tracking-widest text-cyan-400 uppercase mb-4">Más contenido</div>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Todo lo que necesitas para elegir el flujo correcto
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              Cada sección profundiza en un caso distinto: email marketing, transaccional, API, SMTP, comparativas y precios.
            </p>
          </div>

          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
            {[
              {
                to: '/email-marketing',
                title: 'Email marketing',
                desc: 'Campañas, automatizaciones y segmentación para equipos que quieren crecer.',
              },
              {
                to: '/email-transaccional',
                title: 'Email transaccional',
                desc: 'Confirmaciones, alertas, facturas y PDF con trazabilidad.',
              },
              {
                to: '/api-email',
                title: 'API para email',
                desc: 'Integra tu backend con una API simple y clara.',
              },
              {
                to: '/smtp',
                title: 'SMTP',
                desc: 'Compatibilidad inmediata para sistemas y librerías existentes.',
              },
              {
                to: '/alternativa-mailchimp',
                title: 'Alternativa a Mailchimp',
                desc: 'Comparativa para evaluar una migración con más claridad.',
              },
              {
                to: '/alternativa-sendgrid',
                title: 'Alternativa a SendGrid',
                desc: 'Una comparativa para entender cuándo conviene cambiar de enfoque.',
              },
            ].map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="group card-hover bg-white/[0.03] border border-white/8 rounded-2xl p-6 hover:border-cyan-500/20 hover:bg-white/[0.05] transition-all"
              >
                <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-300 mb-4">
                  <ChevronRight className="w-3.5 h-3.5" />
                  Explorar
                </div>
                <h3 className="text-xl font-bold text-white mb-2 group-hover:text-cyan-300 transition-colors">{item.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{item.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="relative z-10 py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <div className="text-xs font-semibold tracking-widest text-cyan-400 uppercase mb-4">Planes y precios</div>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Elige el plan que se ajusta a tu equipo
            </h2>
            <p className="text-slate-400 max-w-xl mx-auto">
              Todos los planes incluyen acceso multi-tenant. Los límites son compartidos por todo el tenant y solo los administradores pueden actualizarlo.
            </p>
          </div>

          {plansLoading ? (
            <div className="flex justify-center items-center py-20">
              <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
            </div>
          ) : (
            <div className={`grid gap-6 ${
              plans.length === 1 ? 'grid-cols-1 max-w-sm mx-auto' :
              plans.length === 2 ? 'grid-cols-1 sm:grid-cols-2 max-w-2xl mx-auto' :
              plans.length === 3 ? 'grid-cols-1 sm:grid-cols-3 max-w-5xl mx-auto' :
              'grid-cols-1 sm:grid-cols-2 xl:grid-cols-4'
            }`}>
              {orderedPlans.map((plan, i) => (
                <PlanCard key={plan.id} plan={plan} index={i} />
              ))}
            </div>
          )}

          <p className="text-center text-slate-600 text-sm mt-10">
            Límites compartidos por tenant · Solo administradores pueden cambiar el plan
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
                Sin tarjeta de crédito requerida
              </div>
              <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-6 leading-tight">
                ¿Listo para transformar
                <br />tus comunicaciones?
              </h2>
              <p className="text-lg text-slate-300 mb-10 max-w-lg mx-auto">
                Únete a más de 500 empresas que confían en SendCraft para sus comunicaciones críticas.
              </p>
              <button
                onClick={handleStartTrial}
                disabled={loginLoading}
                className="group inline-flex items-center gap-2 px-10 py-4 bg-gradient-to-r from-cyan-500 to-cyan-600 text-white rounded-xl font-bold text-lg hover:shadow-2xl hover:shadow-cyan-500/50 transition-all hover:scale-105 active:scale-95"
              >
                {loginLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                <span>{loginLoading ? 'Iniciando...' : 'Comenzar prueba gratuita'}</span>
                {!loginLoading && <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
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
          <div className="text-slate-600 text-sm">Copyright {new Date().getFullYear()} SendCraft. Todos los derechos reservados.</div>
          <div className="flex gap-6 text-sm text-slate-600">
            <button onClick={() => navigate('/privacy')} className="hover:text-slate-300 transition-colors">Privacidad</button>
            <button onClick={() => navigate('/terms')} className="hover:text-slate-300 transition-colors">Terminos</button>
            <button onClick={() => setSupportOpen(true)} className="hover:text-slate-300 transition-colors">Soporte</button>
          </div>
        </div>
      </footer>

      {supportOpen && <SupportModal onClose={() => setSupportOpen(false)} />}
    </div>
  );
};
