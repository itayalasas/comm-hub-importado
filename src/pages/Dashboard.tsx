import { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { PageLoader } from '../components/PageLoader';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { querySelect } from '../lib/queryApi';
import { buildFunctionsUrl, configManager } from '../lib/config';
import { loadOwnedApplicationsWithKeys } from '../lib/applicationQueries';
import {
  Mail, FileText, CheckCircle2, XCircle, TrendingUp,
  Activity, Server, Zap, Eye, AlertTriangle,
  MousePointerClick,
  MessageSquare, Send, Smartphone,
} from 'lucide-react';

/* ── Types ───────────────────────────────────────────────────────── */

interface EmailStats {
  total: number;
  sent: number;
  failed: number;
  pending: number;
  pdfs: number;
  opened: number;
  clicked: number;
  delivered: number;
  bounced: number;
}

interface WhatsAppStats {
  total: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  queued: number;
}

interface Application { id: string; name: string; }

interface ServiceStatus {
  name: string;
  status: 'operational' | 'degraded' | 'down' | 'unconfigured';
  responseTime: number;
  message?: string;
}

interface DailyCount { date: string; sent: number; failed: number; }

type Channel = 'all' | 'email' | 'whatsapp';

/* ── Sparkline ───────────────────────────────────────────────────── */

const Sparkline = ({
  data, color = '#22d3ee', height = 60, fill = true,
}: { data: number[]; color?: string; height?: number; fill?: boolean }) => {
  if (!data.length) return null;
  const w = 300; const h = height; const pad = 4;
  const max = Math.max(...data, 1);
  const pts = data.map((v, i) => {
    const x = pad + (i / Math.max(data.length - 1, 1)) * (w - pad * 2);
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
      <polyline points={polyline} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {data.map((_, i) => {
        const [x, y] = pts[i].split(',');
        return <circle key={i} cx={x} cy={y} r="3" fill={color} opacity={i === data.length - 1 ? 1 : 0.4} />;
      })}
    </svg>
  );
};

/* ── Bar chart ───────────────────────────────────────────────────── */

const BarChart = ({ data, sentColor = '#22d3ee' }: { data: DailyCount[]; sentColor?: string }) => {
  const maxVal = Math.max(...data.map(d => d.sent + d.failed), 1);
  return (
    <div className="flex items-end gap-px h-28 w-full">
      {data.map((d, i) => {
        const total = d.sent + d.failed;
        const sentH = (d.sent / maxVal) * 100;
        const failH = (d.failed / maxVal) * 100;
        return (
          <div key={i} className="group relative flex flex-col justify-end flex-1" style={{ height: '100%' }} title={`${d.date}: ${d.sent} enviados, ${d.failed} fallidos`}>
            <div className="flex flex-col justify-end h-full gap-px">
              {failH > 0 && <div className="w-full rounded-t-[2px] bg-red-500/60 group-hover:bg-red-400/80 transition-colors" style={{ height: `${failH}%` }} />}
              <div className="w-full rounded-t-[2px] transition-colors" style={{ height: `${sentH}%`, minHeight: total > 0 ? 2 : 0, backgroundColor: sentColor + 'b3' }} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

/* ── Donut ring ──────────────────────────────────────────────────── */

const DonutRing = ({ pct, color, size = 72 }: { pct: number; color: string; size?: number }) => {
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="8"
        strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: 'stroke-dasharray 0.6s ease' }} />
    </svg>
  );
};

/* ── Stat card ───────────────────────────────────────────────────── */

const StatCard = ({ icon: Icon, label, value, sub, color, trend }: {
  icon: any; label: string; value: string | number; sub?: string; color: string; trend?: string;
}) => (
  <div className={`bg-slate-800/50 backdrop-blur-sm rounded-xl border p-5 flex flex-col gap-3 ${color}`}>
    <div className="flex items-center justify-between">
      <Icon className="w-5 h-5 opacity-80" />
      {trend && (
        <span className="flex items-center gap-1 text-xs font-semibold text-emerald-400">
          <TrendingUp className="w-3 h-3" />{trend}
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
  const { user, isSystemAdmin } = useAuth();
  const [applications, setApplications] = useState<Application[]>([]);
  const [selectedApp, setSelectedApp] = useState<string | null>(null);
  const [channel, setChannel] = useState<Channel>('all');

  const [emailStats, setEmailStats] = useState<EmailStats>({
    total: 0, sent: 0, failed: 0, pending: 0, pdfs: 0,
    opened: 0, clicked: 0, delivered: 0, bounced: 0,
  });
  const [waStats, setWaStats] = useState<WhatsAppStats>({
    total: 0, sent: 0, delivered: 0, read: 0, failed: 0, queued: 0,
  });
  const [hasWhatsApp, setHasWhatsApp] = useState(false);

  const [emailDailyData, setEmailDailyData] = useState<DailyCount[]>([]);
  const [waDailyData, setWaDailyData] = useState<DailyCount[]>([]);
  const [weeklyActivity, setWeeklyActivity] = useState<number[]>([]);
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkoutSessionId = params.get('checkout_session_id');
    const subscriptionId = params.get('subscription_id');
    const externalReference = params.get('external_reference');

    if (checkoutSessionId || subscriptionId || externalReference) {
      window.location.replace(`/subscription/result${window.location.search}`);
    }
  }, []);
  useEffect(() => { if (user) loadApplications(); }, [user, isSystemAdmin]);
  useEffect(() => {
    if (selectedApp) { loadEmailStats(); loadWhatsAppStats(); loadChartData(); }
  }, [selectedApp]);
  useEffect(() => { checkServiceHealth(); const iv = setInterval(checkServiceHealth, 60000); return () => clearInterval(iv); }, []);

  const loadApplications = async () => {
    try {
      if (!user?.sub) return;

      const { data: prefs, error: prefsError } = await querySelect<{ default_application_id: string | null }>({
        table: 'user_preferences',
        operation: 'select',
        select: 'default_application_id',
        filters: [{ column: 'user_id', op: 'eq', value: user.sub }],
        limit: 1,
      });

      if (prefsError) throw prefsError;

      const rows = await loadOwnedApplicationsWithKeys(user.sub, user.tenant_id, isSystemAdmin);
      const appList = rows.map(({ id, name }) => ({ id, name }));
      setApplications(appList);

      const defaultApplicationId = prefs?.[0]?.default_application_id || null;
      if (defaultApplicationId) setSelectedApp(defaultApplicationId);
      else if (appList.length > 0) setSelectedApp(appList[0].id);
    } catch { } finally { setLoading(false); }
  };

  const loadEmailStats = async () => {
    if (!selectedApp) return;
    try {
      const { data: logs, error } = await querySelect<{
        status: string;
        communication_type: string;
        opened_at: string | null;
        clicked_at: string | null;
        delivery_status: string | null;
        bounce_type: string | null;
      }>({
        table: 'email_logs',
        operation: 'select',
        select: 'status, communication_type, opened_at, clicked_at, delivery_status, bounce_type',
        filters: [{ column: 'application_id', op: 'eq', value: selectedApp }],
      });
      if (error) throw error;
      const all = logs || [];
      setEmailStats({
        total: all.length,
        sent: all.filter((l) => l.status === 'sent').length,
        failed: all.filter((l) => l.status === 'failed').length,
        pending: all.filter((l) => l.status === 'pending').length,
        pdfs: all.filter((l) => l.communication_type === 'pdf_generation').length,
        opened: all.filter((l) => l.opened_at).length,
        clicked: all.filter((l) => l.clicked_at).length,
        delivered: all.filter((l) => l.delivery_status === 'delivered').length,
        bounced: all.filter((l) => l.bounce_type).length,
      });
    } catch { }
  };

  const loadWhatsAppStats = async () => {
    if (!selectedApp) {
      setHasWhatsApp(false);
      return;
    }
    try {
      const { data: logs, error } = await querySelect<{
        status: string;
        created_at: string;
      }>({
        table: 'whatsapp_logs',
        operation: 'select',
        select: 'status, created_at',
        filters: [{ column: 'application_id', op: 'eq', value: selectedApp }],
      });
      if (error) throw error;
      const all = logs || [];
      setHasWhatsApp(all.length > 0);
      setWaStats({
        total: all.length,
        sent: all.filter((row) => ['sent', 'delivered', 'read'].includes(row.status)).length,
        delivered: all.filter((row) => row.status === 'delivered').length,
        read: all.filter((row) => row.status === 'read').length,
        failed: all.filter((row) => row.status === 'failed').length,
        queued: all.filter((row) => row.status === 'queued').length,
      });
    } catch {
      setHasWhatsApp(false);
    }
  };

  const loadChartData = async () => {
    if (!selectedApp) return;
    try {
      const since = new Date();
      since.setDate(since.getDate() - 29);

      const [emailResult, waResult] = await Promise.all([
        querySelect<{ status: string; created_at: string }>({
          table: 'email_logs',
          operation: 'select',
          select: 'status, created_at',
          filters: [
            { column: 'application_id', op: 'eq', value: selectedApp },
            { column: 'created_at', op: 'gte', value: since.toISOString() },
          ],
          order: { column: 'created_at', ascending: true },
        }),
        querySelect<{ status: string; created_at: string }>({
          table: 'whatsapp_logs',
          operation: 'select',
          select: 'status, created_at',
          filters: [
            { column: 'application_id', op: 'eq', value: selectedApp },
            { column: 'created_at', op: 'gte', value: since.toISOString() },
          ],
          order: { column: 'created_at', ascending: true },
        }),
      ]);

      if (emailResult.error) throw emailResult.error;
      if (waResult.error) throw waResult.error;

      const emailBuckets: Record<string, DailyCount> = {};
      const waBuckets: Record<string, DailyCount> = {};

      for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        emailBuckets[key] = { date: key, sent: 0, failed: 0 };
        waBuckets[key] = { date: key, sent: 0, failed: 0 };
      }

      (emailResult.data || []).forEach((row) => {
        const key = new Date(row.created_at).toISOString().slice(0, 10);
        if (emailBuckets[key]) {
          if (row.status === 'sent') emailBuckets[key].sent++;
          else if (row.status === 'failed') emailBuckets[key].failed++;
        }
      });

      (waResult.data || []).forEach((row) => {
        const key = new Date(row.created_at).toISOString().slice(0, 10);
        if (waBuckets[key]) {
          if (['sent', 'delivered', 'read'].includes(row.status)) waBuckets[key].sent++;
          else if (row.status === 'failed') waBuckets[key].failed++;
        }
      });

      setEmailDailyData(Object.values(emailBuckets));
      setWaDailyData(Object.values(waBuckets));
      setWeeklyActivity(Object.values(emailBuckets).slice(-7).map((d, i) => d.sent + d.failed + (Object.values(waBuckets).slice(-7)[i]?.sent || 0) + (Object.values(waBuckets).slice(-7)[i]?.failed || 0)));
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
      throw new Error('Empty');
    };

    const normalizeStatus = (status: unknown): ServiceStatus['status'] => {
      switch (String(status || '').toLowerCase()) {
        case 'operational':
        case 'healthy':
          return 'operational';
        case 'degraded':
          return 'degraded';
        case 'unconfigured':
          return 'unconfigured';
        default:
          return 'down';
      }
    };

    try {
      await configManager.loadConfig();
      const healthUrl = buildFunctionsUrl('health');
      const t = Date.now();
      const res = await fetch(healthUrl, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      const rt = Date.now() - t;
      const data = await res.json().catch(() => ({}));
      const d = parse(data);
      const apiStatus = normalizeStatus(d.status);

      if (!res.ok || apiStatus === 'down') {
        healthChecks[0].status = apiStatus;
        healthChecks[0].responseTime = d.responseTime || rt;
        healthChecks[0].message = d.version ? `v${String(d.version)}` : 'API sin respuesta';

        healthChecks[1].status = apiStatus;
        healthChecks[1].responseTime = d.responseTime || rt;
        healthChecks[1].message = d.database ? String(d.database) : 'Base de datos sin respuesta';
      } else {
        healthChecks[0].status = apiStatus;
        healthChecks[0].responseTime = d.responseTime || rt;
        healthChecks[0].message = [d.provider, d.version].filter(Boolean).join(' · ') || 'API operativa';

        healthChecks[1].status = apiStatus;
        healthChecks[1].responseTime = d.responseTime || rt;
        healthChecks[1].message = d.database ? String(d.database) : 'Base de datos OK';
      }
    } catch {
      healthChecks[0].status = 'down';
      healthChecks[0].message = 'API sin respuesta';
      healthChecks[1].status = 'down';
      healthChecks[1].message = 'Base de datos sin respuesta';
    }

    try {
      const t = Date.now();
      const { data, error } = await supabase.functions.invoke('health-check-email', {
        method: 'GET',
        includeApiKey: false,
      });
      const rt = Date.now() - t;
      if (error) throw error;
      const d = parse(data);
      healthChecks[2].status = d.status === 'operational' ? (d.configured ? 'operational' : 'unconfigured') : d.status === 'down' ? 'down' : 'degraded';
      healthChecks[2].message = d.configured ? `${d.provider?.toUpperCase() || 'Email'} configurado` : 'No configurado';
      healthChecks[2].responseTime = d.responseTime || rt;
    } catch { healthChecks[2].status = 'down'; }
    try {
      const t = Date.now();
      const { data, error } = await supabase.functions.invoke('health-check-pdf', {
        method: 'GET',
        includeApiKey: false,
      });
      const rt = Date.now() - t;
      if (error) throw error;
      const d = parse(data);
      healthChecks[3].status = d.status === 'operational' || d.status === 'healthy' ? 'operational' : d.status === 'down' ? 'down' : 'degraded';
      healthChecks[3].responseTime = d.responseTime || rt;
    } catch { healthChecks[3].status = 'down'; }
    setServices(healthChecks);
  };

  const pct = (n: number, total: number) => total > 0 ? Math.round((n / total) * 100) : 0;

  // Derived combined / per-channel metrics
  const totalMessages = emailStats.total + waStats.total;
  const totalSent = emailStats.sent + waStats.sent + waStats.delivered + waStats.read;
  const totalFailed = emailStats.failed + waStats.failed;

  const activeDailyData = channel === 'whatsapp' ? waDailyData : channel === 'email' ? emailDailyData
    : emailDailyData.map((d, i) => ({ date: d.date, sent: d.sent + (waDailyData[i]?.sent || 0), failed: d.failed + (waDailyData[i]?.failed || 0) }));
  const chartColor = channel === 'whatsapp' ? '#34d399' : '#22d3ee';

  const showChannelTabs = hasWhatsApp;

  const ServiceStatusPanel = () => {
    const overall = services.some(s => s.status === 'down')
      ? { icon: XCircle, label: 'Fuera de Servicio', text: 'text-red-400' }
      : services.some(s => s.status === 'degraded')
      ? { icon: Activity, label: 'Degradado', text: 'text-amber-400' }
      : services.some(s => s.status === 'unconfigured')
      ? { icon: Zap, label: 'Config. Pendiente', text: 'text-slate-400' }
      : { icon: Zap, label: 'Operacional', text: 'text-emerald-400' };

    const cards = services.length ? services : [
      { name: 'API', status: 'down', responseTime: 0, message: 'Sin respuesta' },
      { name: 'Base de Datos', status: 'down', responseTime: 0, message: 'Sin respuesta' },
      { name: 'Email Service', status: 'down', responseTime: 0, message: 'Sin respuesta' },
      { name: 'PDF Generator', status: 'down', responseTime: 0, message: 'Sin respuesta' },
    ] as ServiceStatus[];

    return (
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-cyan-400" />
            <h2 className="text-base font-semibold text-white">Estado de Servicios</h2>
          </div>
          <div className={`flex items-center gap-1.5 text-xs ${overall.text}`}>
            <overall.icon className="w-3.5 h-3.5" />
            <span className="font-medium">{overall.label}</span>
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {cards.map((svc, i) => {
            const dotColor = svc.status === 'operational'
              ? 'bg-emerald-500'
              : svc.status === 'degraded'
              ? 'bg-amber-500'
              : svc.status === 'unconfigured'
              ? 'bg-slate-500'
              : 'bg-red-500';
            const textColor = svc.status === 'operational'
              ? 'text-emerald-400'
              : svc.status === 'degraded'
              ? 'text-amber-400'
              : svc.status === 'unconfigured'
              ? 'text-slate-400'
              : 'text-red-400';
            const borderColor = svc.status === 'operational'
              ? 'border-emerald-500/20'
              : svc.status === 'degraded'
              ? 'border-amber-500/20'
              : svc.status === 'unconfigured'
              ? 'border-slate-600/40'
              : 'border-red-500/20';
            const label = svc.status === 'operational'
              ? 'Operacional'
              : svc.status === 'degraded'
              ? 'Degradado'
              : svc.status === 'unconfigured'
              ? 'No config.'
              : 'Caído';

            return (
              <div key={i} className={`bg-slate-900/50 rounded-lg border ${borderColor} px-4 py-3 flex items-center gap-3`}>
                <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dotColor} ${svc.status === 'operational' ? 'animate-pulse' : ''}`} />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-white truncate">{svc.name}</div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`text-[10px] font-medium ${textColor}`}>{svc.message || label}</span>
                    {svc.responseTime > 0 && <span className="text-[10px] text-slate-600">{svc.responseTime}ms</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (loading) {
    return (<Layout currentPage="dashboard"><PageLoader /></Layout>);
  }

  if (applications.length === 0) {
    return (
      <Layout currentPage="dashboard">
        <div className="space-y-6">
          <h1 className="text-3xl font-bold text-white">Dashboard</h1>
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 p-12 text-center">
            <Mail className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No tienes aplicaciones</h3>
          </div>
          <ServiceStatusPanel />
        </div>
      </Layout>
    );
  }

  const dayLabels = activeDailyData.filter((_, i) => i % 5 === 0).map(d => {
    const dt = new Date(d.date);
    return `${dt.getDate()}/${dt.getMonth() + 1}`;
  });

  return (
    <Layout currentPage="dashboard">
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Dashboard</h1>
          <div className="flex flex-wrap gap-2">
            {applications.map(app => (
              <button key={app.id} onClick={() => setSelectedApp(app.id)}
                className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors text-sm font-medium ${selectedApp === app.id ? 'bg-cyan-500 text-white' : 'bg-slate-800/60 text-slate-400 hover:bg-slate-700 hover:text-white'}`}>
                {app.name}
              </button>
            ))}
          </div>
        </div>

        {/* Channel tabs — only shown when WhatsApp has data */}
        {showChannelTabs && (
          <div className="flex items-center gap-1 bg-slate-800/60 rounded-xl p-1 w-fit border border-slate-700/60">
            {([
              { id: 'all',       label: 'Todos los canales', icon: Activity },
              { id: 'email',     label: 'Email',             icon: Mail },
              { id: 'whatsapp',  label: 'WhatsApp',          icon: MessageSquare },
            ] as { id: Channel; label: string; icon: any }[]).map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setChannel(id)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  channel === id
                    ? id === 'whatsapp' ? 'bg-emerald-500 text-white shadow' : 'bg-cyan-500 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}>
                <Icon className="w-3.5 h-3.5" />{label}
              </button>
            ))}
          </div>
        )}

        {/* ── EMAIL channel KPIs ── */}
        {(channel === 'all' || channel === 'email') && (
          <div className="space-y-3">
            {channel === 'all' && (
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-cyan-400" />
                <span className="text-sm font-semibold text-slate-300">Email</span>
                <span className="h-px flex-1 bg-slate-700/60" />
              </div>
            )}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard icon={Mail} label="Emails Totales" value={emailStats.total}
                sub={`${emailStats.pending} pendientes`} color="border-cyan-500/20 text-cyan-400"
                trend={emailStats.total > 0 ? `${pct(emailStats.sent, emailStats.total)}%` : undefined} />
              <StatCard icon={CheckCircle2} label="Enviados" value={emailStats.sent}
                color="border-emerald-500/20 text-emerald-400"
                sub={`Tasa ${pct(emailStats.sent, emailStats.total)}%`} />
              <StatCard icon={XCircle} label="Fallidos" value={emailStats.failed}
                color="border-red-500/20 text-red-400"
                sub={`Rebote ${pct(emailStats.bounced, emailStats.total)}%`} />
              <StatCard icon={FileText} label="PDFs Generados" value={emailStats.pdfs}
                color="border-blue-500/20 text-blue-400" />
            </div>

            {/* Email engagement donuts */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { pct: pct(emailStats.opened, emailStats.sent), color: '#22d3ee', icon: Eye, label: 'Tasa de Apertura', value: emailStats.opened, sub: `de ${emailStats.sent} enviados`, valueColor: 'text-cyan-400' },
                { pct: pct(emailStats.clicked, emailStats.sent), color: '#34d399', icon: MousePointerClick, label: 'Tasa de Clics', value: emailStats.clicked, sub: `de ${emailStats.sent} enviados`, valueColor: 'text-emerald-400' },
                { pct: pct(emailStats.delivered || emailStats.sent, emailStats.total), color: '#60a5fa', icon: AlertTriangle, label: 'Tasa de Entrega', value: `${pct(emailStats.delivered || emailStats.sent, emailStats.total)}%`, sub: `Rebote: ${pct(emailStats.bounced, emailStats.total)}%`, valueColor: 'text-blue-400' },
              ].map(({ pct: p, color, icon: Icon, label, value, sub, valueColor }) => (
                <div key={label} className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 p-5 flex items-center gap-4">
                  <div className="relative flex-shrink-0">
                    <DonutRing pct={p} color={color} />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-sm font-bold text-white">{p}%</span>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className="w-4 h-4" style={{ color }} />
                      <span className="text-sm font-semibold text-white">{label}</span>
                    </div>
                    <div className={`text-2xl font-extrabold ${valueColor}`}>{value}</div>
                    <div className="text-xs text-slate-500">{sub}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── WHATSAPP channel KPIs ── */}
        {(channel === 'all' || channel === 'whatsapp') && hasWhatsApp && (
          <div className="space-y-3">
            {channel === 'all' && (
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-semibold text-slate-300">WhatsApp</span>
                <span className="h-px flex-1 bg-slate-700/60" />
              </div>
            )}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <StatCard icon={MessageSquare} label="Total Mensajes" value={waStats.total}
                color="border-emerald-500/20 text-emerald-400"
                sub={`${waStats.queued} en cola`} />
              <StatCard icon={Send} label="Enviados" value={waStats.sent}
                color="border-cyan-500/20 text-cyan-400"
                sub={`${pct(waStats.sent, waStats.total)}%`} />
              <StatCard icon={CheckCircle2} label="Entregados" value={waStats.delivered}
                color="border-teal-500/20 text-teal-400"
                sub={`${pct(waStats.delivered, waStats.total)}%`} />
              <StatCard icon={Eye} label="Leídos" value={waStats.read}
                color="border-blue-500/20 text-blue-400"
                sub={`${pct(waStats.read, waStats.total)}%`} />
              <StatCard icon={XCircle} label="Fallidos" value={waStats.failed}
                color="border-red-500/20 text-red-400"
                sub={`${pct(waStats.failed, waStats.total)}%`} />
            </div>

            {/* WA delivery donut row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { pct: pct(waStats.delivered + waStats.read, waStats.total), color: '#34d399', icon: Smartphone, label: 'Tasa de Entrega', value: `${pct(waStats.delivered + waStats.read, waStats.total)}%`, sub: 'Entregados + leídos', valueColor: 'text-emerald-400' },
                { pct: pct(waStats.read, waStats.total), color: '#22d3ee', icon: Eye, label: 'Tasa de Lectura', value: `${pct(waStats.read, waStats.total)}%`, sub: `${waStats.read} mensajes leídos`, valueColor: 'text-cyan-400' },
                { pct: pct(waStats.failed, waStats.total), color: '#f87171', icon: XCircle, label: 'Tasa de Error', value: `${pct(waStats.failed, waStats.total)}%`, sub: `${waStats.failed} fallidos`, valueColor: 'text-red-400' },
              ].map(({ pct: p, color, icon: Icon, label, value, sub, valueColor }) => (
                <div key={label} className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 p-5 flex items-center gap-4">
                  <div className="relative flex-shrink-0">
                    <DonutRing pct={p} color={color} />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-sm font-bold text-white">{p}%</span>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className="w-4 h-4" style={{ color }} />
                      <span className="text-sm font-semibold text-white">{label}</span>
                    </div>
                    <div className={`text-2xl font-extrabold ${valueColor}`}>{value}</div>
                    <div className="text-xs text-slate-500">{sub}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Combined totals row (only on "all" tab when WA has data) */}
        {channel === 'all' && hasWhatsApp && (
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total mensajes', value: totalMessages, color: 'border-slate-600 text-slate-300', icon: Activity },
              { label: 'Total enviados', value: totalSent, color: 'border-emerald-500/20 text-emerald-400', icon: CheckCircle2 },
              { label: 'Total fallidos', value: totalFailed, color: 'border-red-500/20 text-red-400', icon: XCircle },
            ].map(({ label, value, color, icon: Icon }) => (
              <div key={label} className={`bg-slate-800/50 backdrop-blur-sm rounded-xl border ${color} px-5 py-4 flex items-center gap-3`}>
                <Icon className="w-5 h-5 opacity-70" />
                <div>
                  <div className="text-xl font-extrabold text-white">{value}</div>
                  <div className="text-xs text-slate-500">{label}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-white">Volumen de Envíos</h2>
                <p className="text-xs text-slate-500 mt-0.5">Últimos 30 días · {channel === 'all' ? 'Todos los canales' : channel === 'whatsapp' ? 'WhatsApp' : 'Email'}</p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5 text-slate-300">
                  <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: chartColor }} />Enviados
                </span>
                <span className="flex items-center gap-1.5 text-slate-400"><span className="w-2.5 h-2.5 rounded-sm bg-red-500/60 inline-block" />Fallidos</span>
              </div>
            </div>
            {activeDailyData.length > 0 ? (
              <>
                <BarChart data={activeDailyData} sentColor={chartColor} />
                <div className="flex justify-between mt-1.5">
                  {dayLabels.map((l, i) => <span key={i} className="text-[10px] text-slate-600">{l}</span>)}
                </div>
              </>
            ) : (
              <div className="h-28 flex items-center justify-center text-slate-600 text-sm">Sin datos aún</div>
            )}
          </div>

          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 p-5">
            <div className="mb-4">
              <h2 className="text-base font-semibold text-white">Actividad Semanal</h2>
              <p className="text-xs text-slate-500 mt-0.5">Últimos 7 días · Todos los canales</p>
            </div>
            {weeklyActivity.some(v => v > 0) ? (
              <>
                <Sparkline data={weeklyActivity} color="#22d3ee" height={80} />
                <div className="flex justify-between mt-1.5">
                  {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d, i) => <span key={i} className="text-[10px] text-slate-600">{d}</span>)}
                </div>
                <div className="mt-3 pt-3 border-t border-slate-700/50">
                  <div className="text-xl font-extrabold text-cyan-400">{weeklyActivity.reduce((a, b) => a + b, 0)}</div>
                  <div className="text-xs text-slate-500">total esta semana</div>
                </div>
              </>
            ) : (
              <div className="h-28 flex items-center justify-center text-slate-600 text-sm">Sin datos esta semana</div>
            )}
          </div>
        </div>

        {/* Services */}
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
                      {svc.responseTime > 0 && <span className="text-[10px] text-slate-600">{svc.responseTime}ms</span>}
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


