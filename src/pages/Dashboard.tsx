import { useEffect, useRef, useState } from 'react';
import { Layout } from '../components/Layout';
import { db } from '../lib/db';
import { useAuth } from '../contexts/AuthContext';
import {
  Mail, FileText, CheckCircle2, XCircle, TrendingUp,
  Activity, Server, Zap, RefreshCw, Eye, AlertTriangle,
  MousePointerClick,
} from 'lucide-react';

/* ── Types ───────────────────────────────────────────────────────── */

interface Stats {
  totalEmails: number;
  sentEmails: number;
  failedEmails: number;
  pendingEmails: number;
  totalPdfs: number;
  openedEmails: number;
  clickedEmails: number;
  deliveredEmails: number;
  bouncedEmails: number;
}

interface Application { id: string; name: string; }

interface ServiceStatus {
  name: string;
  status: 'operational' | 'degraded' | 'down' | 'unconfigured';
  responseTime: number;
  message?: string;
}

interface DailyCount { date: string; sent: number; failed: number; }

/* ── Sparkline (simple SVG area chart) ──────────────────────────── */

const Sparkline = ({
  data,
  color = '#22d3ee',
  height = 60,
  fill = true,
}: {
  data: number[];
  color?: string;
  height?: number;
  fill?: boolean;
}) => {
  if (!data.length) return null;
  const w = 300;
  const h = height;
  const pad = 4;
  const max = Math.max(...data, 1);
  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (w - pad * 2);
    const y = h - pad - (v / max) * (h - pad * 2);
    return `${x},${y}`;
  });
  const polyline = pts.join(' ');
  const lastPt = pts[pts.length - 1];
  const firstPt = pts[0];
  const fillPath = `M${firstPt} L${polyline.split(' ').slice(1).join(' ')} L${lastPt.split(',')[0]},${h - pad} L${pad},${h - pad} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height }}>
      {fill && (
        <defs>
          <linearGradient id={`sg-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0.01" />
          </linearGradient>
        </defs>
      )}
      {fill && <path d={fillPath} fill={`url(#sg-${color.replace('#', '')})`} />}
      <polyline
        points={polyline}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {data.map((_, i) => {
        const [x, y] = pts[i].split(',');
        return (
          <circle key={i} cx={x} cy={y} r="3" fill={color} opacity={i === data.length - 1 ? 1 : 0.4} />
        );
      })}
    </svg>
  );
};

/* ── Bar chart (daily volumes) ───────────────────────────────────── */

const BarChart = ({ data }: { data: DailyCount[] }) => {
  const maxVal = Math.max(...data.map(d => d.sent + d.failed), 1);
  return (
    <div className="flex items-end gap-px h-28 w-full">
      {data.map((d, i) => {
        const total = d.sent + d.failed;
        const sentH = (d.sent / maxVal) * 100;
        const failH = (d.failed / maxVal) * 100;
        return (
          <div
            key={i}
            className="group relative flex flex-col justify-end flex-1"
            style={{ height: '100%' }}
            title={`${d.date}: ${d.sent} enviados, ${d.failed} fallidos`}
          >
            <div className="flex flex-col justify-end h-full gap-px">
              {failH > 0 && (
                <div
                  className="w-full rounded-t-[2px] bg-red-500/60 group-hover:bg-red-400/80 transition-colors"
                  style={{ height: `${failH}%` }}
                />
              )}
              <div
                className="w-full rounded-t-[2px] bg-cyan-500/70 group-hover:bg-cyan-400 transition-colors"
                style={{ height: `${sentH}%`, minHeight: total > 0 ? 2 : 0 }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

/* ── Donut ring ─────────────────────────────────────────────────── */

const DonutRing = ({ pct, color, size = 72 }: { pct: number; color: string; size?: number }) => {
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={color} strokeWidth="8"
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dasharray 0.6s ease' }}
      />
    </svg>
  );
};

/* ── Stat card ───────────────────────────────────────────────────── */

const StatCard = ({
  icon: Icon, label, value, sub, color, trend,
}: {
  icon: any; label: string; value: string | number; sub?: string; color: string; trend?: string;
}) => (
  <div className={`bg-slate-800/50 backdrop-blur-sm rounded-xl border p-5 flex flex-col gap-3 ${color}`}>
    <div className="flex items-center justify-between">
      <Icon className="w-5 h-5 opacity-80" />
      {trend && (
        <span className="flex items-center gap-1 text-xs font-semibold text-emerald-400">
          <TrendingUp className="w-3 h-3" />
          {trend}
        </span>
      )}
    </div>
    <div>
      <div className="text-2xl font-extrabold text-white">{value}</div>
      <div className="text-xs text-slate-400 mt-0.5">{label}</div>
      {sub && <div className="text-xs text-slate-500 mt-0.5">{sub}</div>}
    </div>
  </div>
);

/* ── Main component ──────────────────────────────────────────────── */

export const Dashboard = () => {
  const { user, refreshSubscription } = useAuth();
  const [applications, setApplications] = useState<Application[]>([]);
  const [selectedApp, setSelectedApp] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats>({
    totalEmails: 0, sentEmails: 0, failedEmails: 0, pendingEmails: 0,
    totalPdfs: 0, openedEmails: 0, clickedEmails: 0, deliveredEmails: 0, bouncedEmails: 0,
  });
  const [dailyData, setDailyData] = useState<DailyCount[]>([]);
  const [weeklyActivity, setWeeklyActivity] = useState<number[]>([]);
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [mpActivating, setMpActivating] = useState(false);
  const [mpPlanName, setMpPlanName] = useState<string | null>(null);
  const mpHandled = useRef(false);

  useEffect(() => {
    if (mpHandled.current) return;
    const params = new URLSearchParams(window.location.search);
    const subscriptionId = params.get('subscription_id');
    const planName = params.get('plan_name');
    if (!subscriptionId) return;
    mpHandled.current = true;
    setMpPlanName(planName);
    setMpActivating(true);
    window.history.replaceState({}, '', window.location.pathname);
    const timer = setTimeout(async () => {
      await refreshSubscription();
      setMpActivating(false);
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => { if (user) loadApplications(); }, [user]);
  useEffect(() => {
    if (selectedApp) {
      loadStats();
      loadChartData();
    }
  }, [selectedApp]);
  useEffect(() => {
    checkServiceHealth();
    const interval = setInterval(checkServiceHealth, 60000);
    return () => clearInterval(interval);
  }, []);

  const loadApplications = async () => {
    try {
      if (!user?.sub) return;
      const { data: prefs } = await db
        .from('user_preferences').select('default_application_id')
        .eq('user_id', user.sub).maybeSingle();
      const appsQuery = db.from('applications').select('id, name').order('created_at', { ascending: false });
      const { data, error } = await (user.tenant_id ? appsQuery.eq('tenant_id', user.tenant_id) : appsQuery.eq('user_id', user.sub));
      if (error) throw error;
      setApplications((data as Application[]) || []);
      if (prefs?.default_application_id) setSelectedApp((prefs as any).default_application_id);
      else if (data && (data as any[]).length > 0) setSelectedApp((data as any[])[0].id);
    } catch { } finally { setLoading(false); }
  };

  const loadStats = async () => {
    if (!selectedApp) return;
    try {
      const { data: logs, error } = await db
        .from('email_logs')
        .select('status, communication_type, opened_at, clicked_at, delivery_status, bounce_type')
        .eq('application_id', selectedApp);
      if (error) throw error;
      const all: any[] = logs || [];
      const totalEmails = all.length;
      const sentEmails = all.filter((l: any) => l.status === 'sent').length;
      const failedEmails = all.filter((l: any) => l.status === 'failed').length;
      const pendingEmails = all.filter((l: any) => l.status === 'pending').length;
      const totalPdfs = all.filter((l: any) => l.communication_type === 'pdf_generation').length;
      const openedEmails = all.filter((l: any) => l.opened_at).length;
      const clickedEmails = all.filter((l: any) => l.clicked_at).length;
      const deliveredEmails = all.filter((l: any) => l.delivery_status === 'delivered').length;
      const bouncedEmails = all.filter((l: any) => l.bounce_type).length;
      setStats({ totalEmails, sentEmails, failedEmails, pendingEmails, totalPdfs, openedEmails, clickedEmails, deliveredEmails, bouncedEmails });
    } catch { }
  };

  const loadChartData = async () => {
    if (!selectedApp) return;
    try {
      const since = new Date();
      since.setDate(since.getDate() - 29);
      const { data, error } = await db
        .from('email_logs')
        .select('status, created_at')
        .eq('application_id', selectedApp)
        .gte('created_at', since.toISOString())
        .order('created_at', { ascending: true });
      if (error) throw error;

      // Build 30-day buckets
      const buckets: Record<string, DailyCount> = {};
      for (let i = 29; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        buckets[key] = { date: key, sent: 0, failed: 0 };
      }
      ((data as any[]) || []).forEach((row: any) => {
        const key = new Date(row.created_at).toISOString().slice(0, 10);
        if (buckets[key]) {
          if (row.status === 'sent') buckets[key].sent++;
          else if (row.status === 'failed') buckets[key].failed++;
        }
      });
      setDailyData(Object.values(buckets));

      // Weekly activity (last 7 days)
      const weekly = Object.values(buckets).slice(-7).map(d => d.sent + d.failed);
      setWeeklyActivity(weekly);
    } catch { }
  };

  const checkServiceHealth = async () => {
    const healthChecks: ServiceStatus[] = [
      { name: 'API', status: 'down', responseTime: 0 },
      { name: 'Base de Datos', status: 'down', responseTime: 0 },
      { name: 'Email Service', status: 'down', responseTime: 0 },
      { name: 'PDF Generator', status: 'down', responseTime: 0 },
    ];

    const parse = (raw: unknown) => {
      if (raw && typeof raw === 'object') return raw as Record<string, any>;
      if (typeof raw === 'string') return JSON.parse(raw) as Record<string, any>;
      throw new Error('Empty response');
    };

    try {
      const t = Date.now();
      const { error } = await db.from('applications').select('id').limit(1);
      const rt = Date.now() - t;
      if (error) {
        healthChecks[0].status = 'degraded'; healthChecks[0].responseTime = rt;
        healthChecks[1].status = 'degraded'; healthChecks[1].responseTime = rt;
      } else {
        healthChecks[0].status = 'operational'; healthChecks[0].responseTime = rt;
        healthChecks[1].status = 'operational'; healthChecks[1].responseTime = Math.floor(rt / 3);
      }
    } catch { }

    try {
      const t = Date.now();
      const res = await fetch('https://ffihaeatoundrjzgtpzk.supabase.co/functions/v1/health-check-email', { method: 'GET' });
      const rt = Date.now() - t;
      if (!res.ok) throw new Error();
      const d = parse(await res.json());
      healthChecks[2].status = d.status === 'operational' ? (d.configured ? 'operational' : 'unconfigured') : d.status === 'down' ? 'down' : 'degraded';
      healthChecks[2].message = d.configured ? `${d.provider?.toUpperCase() || 'Email'} configurado` : 'No configurado';
      healthChecks[2].responseTime = d.responseTime || rt;
    } catch { healthChecks[2].status = 'down'; }

    try {
      const t = Date.now();
      const res = await fetch('https://ffihaeatoundrjzgtpzk.supabase.co/functions/v1/health-check-pdf', { method: 'GET' });
      const rt = Date.now() - t;
      if (!res.ok) throw new Error();
      const d = parse(await res.json());
      healthChecks[3].status = d.status === 'operational' || d.status === 'healthy' ? 'operational' : d.status === 'down' ? 'down' : 'degraded';
      healthChecks[3].responseTime = d.responseTime || rt;
    } catch { healthChecks[3].status = 'down'; }

    setServices(healthChecks);
  };

  const pct = (n: number, total: number) => total > 0 ? Math.round((n / total) * 100) : 0;
  const openRate = pct(stats.openedEmails, stats.sentEmails);
  const clickRate = pct(stats.clickedEmails, stats.sentEmails);
  const deliveryRate = pct(stats.deliveredEmails || stats.sentEmails, stats.totalEmails);
  const bounceRate = pct(stats.bouncedEmails, stats.totalEmails);
  const successRate = pct(stats.sentEmails, stats.totalEmails);

  if (loading) {
    return (
      <Layout currentPage="dashboard">
        <div className="text-center py-12"><div className="text-slate-400">Cargando...</div></div>
      </Layout>
    );
  }

  if (applications.length === 0) {
    return (
      <Layout currentPage="dashboard">
        <div className="space-y-6">
          <h1 className="text-3xl font-bold text-white">Dashboard</h1>
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 p-12 text-center">
            <Mail className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No tienes aplicaciones</h3>
            <p className="text-slate-400 mb-6">Crea tu primera aplicación en Configuración para empezar a ver estadísticas</p>
          </div>
        </div>
      </Layout>
    );
  }

  const dayLabels = dailyData.filter((_, i) => i % 5 === 0).map(d => {
    const dt = new Date(d.date);
    return `${dt.getDate()}/${dt.getMonth() + 1}`;
  });

  return (
    <Layout currentPage="dashboard">
      {/* MP activation overlay */}
      {mpActivating && (
        <div className="fixed inset-0 z-[300] bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center gap-6">
          <div className="relative">
            <div className="w-20 h-20 rounded-2xl border border-cyan-500/20 absolute inset-0 animate-ping opacity-20" />
            <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shadow-2xl shadow-cyan-500/30">
              <RefreshCw className="w-9 h-9 text-white animate-spin" />
            </div>
          </div>
          <div className="text-center space-y-1.5">
            <p className="text-white font-semibold text-lg">Activando tu suscripción</p>
            <p className="text-slate-400 text-sm">{mpPlanName ? `Plan ${mpPlanName} · ` : ''}Actualizando tu sesión…</p>
          </div>
          <div className="w-48 h-0.5 bg-white/5 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full animate-[loading_1.4s_ease-in-out_infinite]" style={{ width: '40%' }} />
          </div>
          <style>{`@keyframes loading { 0% { transform: translateX(-200%); } 100% { transform: translateX(400%); } }`}</style>
        </div>
      )}

      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Dashboard</h1>
          <div className="flex flex-wrap gap-2">
            {applications.map((app) => (
              <button
                key={app.id}
                onClick={() => setSelectedApp(app.id)}
                className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors text-sm font-medium ${
                  selectedApp === app.id ? 'bg-cyan-500 text-white' : 'bg-slate-800/60 text-slate-400 hover:bg-slate-700 hover:text-white'
                }`}
              >
                {app.name}
              </button>
            ))}
          </div>
        </div>

        {/* Primary KPI row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            icon={Mail} label="Emails Totales" value={stats.totalEmails}
            sub={`${stats.pendingEmails} pendientes`} color="border-cyan-500/20 text-cyan-400"
            trend={successRate > 0 ? `${successRate}%` : undefined}
          />
          <StatCard
            icon={CheckCircle2} label="Enviados" value={stats.sentEmails}
            color="border-emerald-500/20 text-emerald-400"
            sub={`Tasa de envío ${successRate}%`}
          />
          <StatCard
            icon={XCircle} label="Fallidos" value={stats.failedEmails}
            color="border-red-500/20 text-red-400"
            sub={`Rebote ${bounceRate}%`}
          />
          <StatCard
            icon={FileText} label="PDFs Generados" value={stats.totalPdfs}
            color="border-blue-500/20 text-blue-400"
          />
        </div>

        {/* Engagement metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Open rate */}
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 p-5 flex items-center gap-4">
            <div className="relative flex-shrink-0">
              <DonutRing pct={openRate} color="#22d3ee" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm font-bold text-white">{openRate}%</span>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Eye className="w-4 h-4 text-cyan-400" />
                <span className="text-sm font-semibold text-white">Tasa de Apertura</span>
              </div>
              <div className="text-2xl font-extrabold text-cyan-400">{stats.openedEmails}</div>
              <div className="text-xs text-slate-500">de {stats.sentEmails} enviados</div>
            </div>
          </div>

          {/* Click rate */}
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 p-5 flex items-center gap-4">
            <div className="relative flex-shrink-0">
              <DonutRing pct={clickRate} color="#34d399" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm font-bold text-white">{clickRate}%</span>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <MousePointerClick className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-semibold text-white">Tasa de Clics</span>
              </div>
              <div className="text-2xl font-extrabold text-emerald-400">{stats.clickedEmails}</div>
              <div className="text-xs text-slate-500">de {stats.sentEmails} enviados</div>
            </div>
          </div>

          {/* Bounce / delivery */}
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 p-5 flex items-center gap-4">
            <div className="relative flex-shrink-0">
              <DonutRing pct={deliveryRate} color="#60a5fa" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm font-bold text-white">{deliveryRate}%</span>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-semibold text-white">Tasa de Entrega</span>
              </div>
              <div className="text-2xl font-extrabold text-blue-400">{deliveryRate}%</div>
              <div className="text-xs text-slate-500">Rebote: {bounceRate}%</div>
            </div>
          </div>
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Bar chart — 30-day volume */}
          <div className="lg:col-span-2 bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-white">Volumen de Envíos</h2>
                <p className="text-xs text-slate-500 mt-0.5">Últimos 30 días</p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-cyan-500/70 inline-block" />Enviados</span>
                <span className="flex items-center gap-1.5 text-slate-400"><span className="w-2.5 h-2.5 rounded-sm bg-red-500/60 inline-block" />Fallidos</span>
              </div>
            </div>
            {dailyData.length > 0 ? (
              <>
                <BarChart data={dailyData} />
                <div className="flex justify-between mt-1.5">
                  {dayLabels.map((l, i) => (
                    <span key={i} className="text-[10px] text-slate-600">{l}</span>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-28 flex items-center justify-center text-slate-600 text-sm">Sin datos aún</div>
            )}
          </div>

          {/* Weekly sparkline */}
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 p-5">
            <div className="mb-4">
              <h2 className="text-base font-semibold text-white">Actividad Semanal</h2>
              <p className="text-xs text-slate-500 mt-0.5">Últimos 7 días</p>
            </div>
            {weeklyActivity.some(v => v > 0) ? (
              <>
                <Sparkline data={weeklyActivity} color="#22d3ee" height={80} />
                <div className="flex justify-between mt-1.5">
                  {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d, i) => (
                    <span key={i} className="text-[10px] text-slate-600">{d}</span>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t border-slate-700/50">
                  <div className="text-xl font-extrabold text-cyan-400">
                    {weeklyActivity.reduce((a, b) => a + b, 0)}
                  </div>
                  <div className="text-xs text-slate-500">total esta semana</div>
                </div>
              </>
            ) : (
              <div className="h-28 flex items-center justify-center text-slate-600 text-sm">Sin datos esta semana</div>
            )}
          </div>
        </div>

        {/* Services — horizontal grid cards */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-cyan-400" />
              <h2 className="text-base font-semibold text-white">Estado de Servicios</h2>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              {services.some(s => s.status === 'down') ? (
                <><XCircle className="w-3.5 h-3.5 text-red-400" /><span className="text-red-400 font-medium">Fuera de Servicio</span></>
              ) : services.some(s => s.status === 'degraded') ? (
                <><Activity className="w-3.5 h-3.5 text-amber-400" /><span className="text-amber-400 font-medium">Degradado</span></>
              ) : services.some(s => s.status === 'unconfigured') ? (
                <><Activity className="w-3.5 h-3.5 text-slate-400" /><span className="text-slate-400 font-medium">Config. Pendiente</span></>
              ) : (
                <><Zap className="w-3.5 h-3.5 text-emerald-400" /><span className="text-emerald-400 font-medium">Operacional</span></>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {services.map((svc, i) => {
              const dotColor = svc.status === 'operational' ? 'bg-emerald-500' : svc.status === 'degraded' ? 'bg-amber-500' : svc.status === 'unconfigured' ? 'bg-slate-500' : 'bg-red-500';
              const textColor = svc.status === 'operational' ? 'text-emerald-400' : svc.status === 'degraded' ? 'text-amber-400' : svc.status === 'unconfigured' ? 'text-slate-400' : 'text-red-400';
              const borderColor = svc.status === 'operational' ? 'border-emerald-500/20' : svc.status === 'degraded' ? 'border-amber-500/20' : svc.status === 'unconfigured' ? 'border-slate-600/40' : 'border-red-500/20';
              const label = svc.status === 'operational' ? 'Operacional' : svc.status === 'degraded' ? 'Degradado' : svc.status === 'unconfigured' ? 'No config.' : 'Caído';
              return (
                <div key={i} className={`bg-slate-900/50 rounded-lg border ${borderColor} px-4 py-3 flex items-center gap-3`}>
                  <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dotColor} ${svc.status === 'operational' ? 'animate-pulse' : ''}`} />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-white truncate">{svc.name}</div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`text-[10px] font-medium ${textColor}`}>{svc.message || label}</span>
                      {svc.responseTime > 0 && (
                        <span className="text-[10px] text-slate-600">{svc.responseTime}ms</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Layout>
  );
};
