import { useEffect, useState, type ReactNode } from 'react';
import {
  LayoutDashboard,
  ShieldCheck,
  Fingerprint,
  MapPin,
  Clock3,
  TrendingUp,
  RefreshCw,
  AlertTriangle,
  Loader2,
  Activity,
  CheckCircle2,
  XCircle,
  ArrowUpRight,
  Globe,
  BarChart3,
} from 'lucide-react';
import { Layout } from '../components/Layout';
import { PageLoader } from '../components/PageLoader';
import { useAuth } from '../contexts/AuthContext';
import {
  AccessAnalyticsAttempt,
  AccessAnalyticsCountryStat,
  AccessAnalyticsDailyStat,
  AccessAnalyticsDashboardPayload,
  loadAdminAccessAnalytics,
} from '../lib/webAccessAnalytics';
import { SYSTEM_ADMIN_EMAIL } from '../lib/systemAdmin';

type AnalyticsRange = '7d' | '30d' | '90d' | 'all';
const RECENT_ATTEMPTS_PAGE_SIZE = 10;

const RANGE_OPTIONS: Array<{ value: AnalyticsRange; label: string }> = [
  { value: '7d', label: '7 días' },
  { value: '30d', label: '30 días' },
  { value: '90d', label: '90 días' },
  { value: 'all', label: 'Todo' },
];

const DATE_FORMAT = new Intl.DateTimeFormat('es-UY', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const SHORT_DATE_FORMAT = new Intl.DateTimeFormat('es-UY', {
  day: '2-digit',
  month: 'short',
});

const formatNumber = (value: number) => new Intl.NumberFormat('es-UY').format(value);

const formatDateTime = (value?: string | null) => {
  if (!value) return 'Sin fecha';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return DATE_FORMAT.format(date);
};

const formatShortDate = (value?: string | null) => {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return SHORT_DATE_FORMAT.format(date);
};

const resolveAttemptTone = (attempt: AccessAnalyticsAttempt) => {
  const marker = `${attempt.event_type} ${attempt.status}`.toLowerCase();
  if (marker.includes('fail') || marker.includes('error')) {
    return {
      label: 'Falló',
      className: 'bg-rose-500/10 text-rose-300 border-rose-500/20',
      icon: XCircle,
    };
  }

  if (marker.includes('success') || marker.includes('ok') || marker.includes('complete')) {
    return {
      label: 'Éxito',
      className: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
      icon: CheckCircle2,
    };
  }

  return {
    label: 'Inicio',
    className: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20',
    icon: Activity,
  };
};

const StatCard = ({
  icon: Icon,
  label,
  value,
  helper,
  accent,
}: {
  icon: any;
  label: string;
  value: string;
  helper?: string;
  accent: string;
}) => (
  <div className={`rounded-2xl border ${accent} bg-slate-900/70 p-5 shadow-lg shadow-black/10 backdrop-blur-sm`}>
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</p>
        <div className="mt-2 text-3xl font-black text-white">{value}</div>
      </div>
      <div className="rounded-xl border border-white/10 bg-white/5 p-2.5">
        <Icon className="h-5 w-5 text-slate-200" />
      </div>
    </div>
    {helper && <p className="mt-3 text-xs leading-relaxed text-slate-400">{helper}</p>}
  </div>
);

const SectionCard = ({
  title,
  subtitle,
  icon: Icon,
  children,
  actions,
}: {
  title: string;
  subtitle?: string;
  icon?: any;
  children: ReactNode;
  actions?: ReactNode;
}) => (
  <section className="rounded-3xl border border-slate-700/60 bg-slate-900/70 shadow-2xl shadow-black/20 backdrop-blur-sm overflow-hidden">
    <div className="flex flex-col gap-3 border-b border-slate-700/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        {Icon && (
          <div className="mt-0.5 rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-2">
            <Icon className="h-4 w-4 text-cyan-300" />
          </div>
        )}
        <div>
          <h2 className="text-lg font-bold text-white">{title}</h2>
          {subtitle && <p className="text-sm text-slate-400">{subtitle}</p>}
        </div>
      </div>
      {actions}
    </div>
    <div className="px-5 py-5">{children}</div>
  </section>
);

const CountryRow = ({ item }: { item: AccessAnalyticsCountryStat }) => {
  const percent = Math.max(0, Math.min(100, item.share || 0));

  return (
    <div className="space-y-2 rounded-2xl border border-slate-700/60 bg-slate-950/40 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-white">{item.country_name}</div>
          <div className="text-xs text-slate-500">{item.country_code}</div>
        </div>
        <div className="text-right">
          <div className="text-sm font-bold text-white">{formatNumber(item.attempts)}</div>
          <div className="text-xs text-slate-500">{percent.toFixed(1)}%</div>
        </div>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/5">
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-sky-500"
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.16em] text-slate-500">
        <span>{formatNumber(item.successful_attempts)} éxitos</span>
        <span>{formatNumber(item.failed_attempts)} fallos</span>
      </div>
    </div>
  );
};

const DailyBars = ({ data }: { data: AccessAnalyticsDailyStat[] }) => {
  if (!data.length) {
    return (
      <div className="flex h-56 items-center justify-center rounded-2xl border border-dashed border-slate-700 bg-slate-950/30 text-sm text-slate-500">
        No hay datos suficientes para mostrar tendencia.
      </div>
    );
  }

  const maxValue = Math.max(
    ...data.map((item) => item.successful_attempts + item.failed_attempts),
    1,
  );

  return (
    <div className="flex h-56 items-end gap-2">
      {data.map((item) => {
        const total = item.successful_attempts + item.failed_attempts;
        const successHeight = (item.successful_attempts / maxValue) * 100;
        const failHeight = (item.failed_attempts / maxValue) * 100;

        return (
          <div key={item.date} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-2">
            <div className="flex h-full w-full items-end overflow-hidden rounded-t-2xl bg-slate-950/35">
              <div className="flex h-full w-full flex-col justify-end gap-[2px] p-[2px]">
                <div
                  className="w-full rounded-t-xl bg-gradient-to-t from-emerald-500/80 to-emerald-400/95"
                  style={{ height: `${Math.max(successHeight, total > 0 ? 2 : 0)}%` }}
                  title={`${item.date}: ${item.successful_attempts} éxitos`}
                />
                <div
                  className="w-full rounded-t-xl bg-gradient-to-t from-rose-500/85 to-rose-400/95"
                  style={{ height: `${Math.max(failHeight, item.failed_attempts > 0 ? 2 : 0)}%` }}
                  title={`${item.date}: ${item.failed_attempts} fallos`}
                />
              </div>
            </div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              {formatShortDate(item.date)}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export const AdminDashboard = () => {
  const { user } = useAuth();
  const [range, setRange] = useState<AnalyticsRange>('30d');
  const [reloadToken, setReloadToken] = useState(0);
  const [recentPage, setRecentPage] = useState(1);
  const [payload, setPayload] = useState<AccessAnalyticsDashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (payload) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError(null);

      try {
        const data = await loadAdminAccessAnalytics(range);
        if (!cancelled) {
          setPayload(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'No pudimos cargar las estadísticas del panel.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [range, reloadToken]);

  useEffect(() => {
    setRecentPage(1);
  }, [range]);

  const summary = payload?.summary;
  const countries = [...(payload?.countries ?? [])].sort((a, b) => b.attempts - a.attempts);
  const daily = payload?.daily ?? [];
  const recentAttempts = payload?.recent_attempts ?? [];
  const recentPageCount = Math.max(1, Math.ceil(recentAttempts.length / RECENT_ATTEMPTS_PAGE_SIZE));
  const safeRecentPage = Math.min(recentPage, recentPageCount);
  const recentAttemptsPage = recentAttempts.slice(
    (safeRecentPage - 1) * RECENT_ATTEMPTS_PAGE_SIZE,
    safeRecentPage * RECENT_ATTEMPTS_PAGE_SIZE,
  );
  const latestDaily = daily[daily.length - 1] ?? null;
  const previousDaily = daily[daily.length - 2] ?? null;
  const dailyTrendDelta = latestDaily && previousDaily && previousDaily.attempts > 0
    ? Math.round(((latestDaily.attempts - previousDaily.attempts) / previousDaily.attempts) * 100)
    : null;
  const dailyTrendLabel = latestDaily
    ? dailyTrendDelta !== null
      ? `${formatNumber(latestDaily.attempts)} hoy - ${dailyTrendDelta >= 0 ? '+' : ''}${dailyTrendDelta}% vs ayer`
      : `${formatNumber(latestDaily.attempts)} hoy`
    : 'Sin actividad';

  const totalAttempts = summary?.total_attempts ?? 0;
  const successRate = totalAttempts > 0
    ? Math.round(((summary?.successful_attempts ?? 0) / totalAttempts) * 100)
    : 0;
  const failRate = totalAttempts > 0
    ? Math.round(((summary?.failed_attempts ?? 0) / totalAttempts) * 100)
    : 0;

  useEffect(() => {
    setRecentPage((current) => Math.min(current, recentPageCount));
  }, [recentPageCount]);

  if (loading && !payload) {
    return (
      <Layout currentPage="admin-dashboard">
        <PageLoader />
      </Layout>
    );
  }

  return (
    <Layout currentPage="admin-dashboard">
      <div className="space-y-6">
        <section className="rounded-3xl border border-rose-500/20 bg-gradient-to-br from-slate-950 via-slate-900 to-rose-950/25 p-6 shadow-2xl shadow-black/20">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-rose-500/20 bg-rose-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-rose-200">
                <ShieldCheck className="h-3.5 w-3.5" />
                Panel privado
              </div>
              <div>
                <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
                  Panel de accesos web
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">
                  Seguimiento de intentos de acceso, éxito/fallo y distribución por país leyendo directamente
                  desde <span className="text-cyan-300">/query</span> sobre <span className="text-cyan-300">web_access_attempts</span>.
                  La segmentación geográfica se resuelve por IP en el backend.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-slate-400">
                <span className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1">
                  Solo {SYSTEM_ADMIN_EMAIL}
                </span>
                <span className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1">
                  Sesión: {user?.email || 'No disponible'}
                </span>
                <span className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1">
                  Última actualización: {summary ? formatDateTime(summary.generated_at) : 'Sin datos'}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {RANGE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setRange(option.value)}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                    range === option.value
                      ? 'border-cyan-400/40 bg-cyan-500/15 text-cyan-200'
                      : 'border-slate-700 bg-slate-950/40 text-slate-400 hover:border-slate-600 hover:text-white'
                  }`}
                >
                  {option.label}
                </button>
              ))}
              <button
                onClick={() => setReloadToken((value) => value + 1)}
                className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950/40 px-4 py-2 text-sm font-semibold text-slate-300 transition-colors hover:border-cyan-500/30 hover:text-white"
              >
                {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Actualizar
              </button>
            </div>
          </div>

          {error && (
            <div className="mt-6 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              <div className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="h-4 w-4" />
                No pudimos cargar el panel
              </div>
              <p className="mt-1 text-rose-100/80">{error}</p>
            </div>
          )}
        </section>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <StatCard
            icon={LayoutDashboard}
            label="Intentos totales"
            value={formatNumber(summary?.total_attempts ?? 0)}
            helper="Eventos registrados en el servicio de accesos."
            accent="border-cyan-500/15"
          />
          <StatCard
            icon={CheckCircle2}
            label="Éxitos"
            value={formatNumber(summary?.successful_attempts ?? 0)}
            helper={`Tasa estimada: ${successRate}%`}
            accent="border-emerald-500/15"
          />
          <StatCard
            icon={XCircle}
            label="Fallos"
            value={formatNumber(summary?.failed_attempts ?? 0)}
            helper={`Tasa estimada: ${failRate}%`}
            accent="border-rose-500/15"
          />
          <StatCard
            icon={Globe}
            label="Países"
            value={formatNumber(summary?.unique_countries ?? countries.length)}
            helper="Agrupado por IP del intento de acceso."
            accent="border-amber-500/15"
          />
          <StatCard
            icon={Fingerprint}
            label="IPs únicas"
            value={formatNumber(summary?.unique_ips ?? 0)}
            helper="Direcciones distintas detectadas por el backend."
            accent="border-sky-500/15"
          />
          <StatCard
            icon={Clock3}
            label="Últimas 24h"
            value={formatNumber(summary?.last_24h_attempts ?? 0)}
            helper="Intentos recientes dentro de la última jornada."
            accent="border-violet-500/15"
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <SectionCard
            title="Tendencia diaria"
            subtitle="Comparativa entre intentos exitosos y fallidos en el rango seleccionado."
            icon={BarChart3}
            actions={
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950/40 px-3 py-1 text-xs text-slate-400">
                  <TrendingUp className="h-3.5 w-3.5 text-cyan-300" />
                  {totalAttempts > 0 ? `${successRate}% éxito` : 'Sin actividad'}
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950/40 px-3 py-1 text-xs text-slate-400">
                  <ArrowUpRight className="h-3.5 w-3.5 text-emerald-300" />
                  {dailyTrendLabel}
                </div>
              </div>
            }
          >
            <DailyBars data={daily} />
          </SectionCard>

          <SectionCard
            title="Distribución por país"
            subtitle="Los países se calculan en el backend a partir del IP del request."
            icon={MapPin}
            actions={
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950/40 px-3 py-1 text-xs text-slate-400">
                <MapPin className="h-3.5 w-3.5 text-amber-300" />
                {countries.length} países
              </div>
            }
          >
            <div className="space-y-3">
              {countries.length > 0 ? (
                countries.slice(0, 8).map((item) => (
                  <CountryRow key={`${item.country_code}-${item.country_name}`} item={item} />
                ))
              ) : (
                <div className="flex h-56 items-center justify-center rounded-2xl border border-dashed border-slate-700 bg-slate-950/30 text-sm text-slate-500">
                  Aún no hay datos geográficos para mostrar.
                </div>
              )}
            </div>
          </SectionCard>
        </div>

        <SectionCard
          title="Últimos intentos"
          subtitle="Vista operativa de los accesos más recientes, útil para auditoría y depuración."
          icon={Activity}
          actions={
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950/40 px-3 py-1 text-xs text-slate-400">
              <ArrowUpRight className="h-3.5 w-3.5 text-cyan-300" />
              {recentAttempts.length} registros
            </div>
          }
        >
          {recentAttempts.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-700/60 text-left">
                  <thead>
                    <tr className="text-xs uppercase tracking-[0.16em] text-slate-500">
                      <th className="pb-3 pr-4 font-semibold">Fecha</th>
                      <th className="pb-3 pr-4 font-semibold">Estado</th>
                      <th className="pb-3 pr-4 font-semibold">País</th>
                      <th className="pb-3 pr-4 font-semibold">IP</th>
                      <th className="pb-3 pr-4 font-semibold">Email / ruta</th>
                      <th className="pb-3 font-semibold">Detalle</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70">
                    {recentAttemptsPage.map((attempt) => {
                      const tone = resolveAttemptTone(attempt);
                      const ToneIcon = tone.icon;

                      return (
                        <tr key={attempt.id} className="align-top">
                          <td className="py-4 pr-4 text-sm text-slate-300">
                            {formatDateTime(attempt.created_at)}
                          </td>
                          <td className="py-4 pr-4">
                            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${tone.className}`}>
                              <ToneIcon className="h-3.5 w-3.5" />
                              {tone.label}
                            </span>
                          </td>
                          <td className="py-4 pr-4 text-sm text-slate-300">
                            <div className="font-medium text-white">
                              {attempt.country_name || 'Desconocido'}
                            </div>
                            <div className="text-xs text-slate-500">
                              {attempt.country_code || '--'}
                            </div>
                          </td>
                          <td className="py-4 pr-4 text-sm text-slate-300">
                            {attempt.ip || 'Sin IP'}
                          </td>
                          <td className="py-4 pr-4 text-sm text-slate-300">
                            <div className="font-medium text-white">
                              {attempt.email || 'Acceso anónimo'}
                            </div>
                            <div className="text-xs text-slate-500">
                              {attempt.path || 'Sin ruta'}
                            </div>
                          </td>
                          <td className="py-4 text-sm text-slate-400">
                            <div className="max-w-md whitespace-pre-wrap rounded-xl border border-slate-700/70 bg-slate-950/30 p-3">
                              {attempt.error_message || 'Sin error'}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 flex flex-col gap-3 border-t border-slate-800/70 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-slate-500">
                  Mostrando {formatNumber((safeRecentPage - 1) * RECENT_ATTEMPTS_PAGE_SIZE + 1)}-
                  {formatNumber(Math.min(recentAttempts.length, safeRecentPage * RECENT_ATTEMPTS_PAGE_SIZE))} de{' '}
                  {formatNumber(recentAttempts.length)}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setRecentPage((current) => Math.max(1, current - 1))}
                    disabled={safeRecentPage <= 1}
                    className="rounded-full border border-slate-700 bg-slate-950/40 px-3 py-1.5 text-xs font-semibold text-slate-300 transition-colors hover:border-cyan-500/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Anterior
                  </button>
                  <span className="rounded-full border border-slate-700 bg-slate-950/40 px-3 py-1.5 text-xs font-semibold text-slate-400">
                    Pagina {formatNumber(safeRecentPage)} / {formatNumber(recentPageCount)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setRecentPage((current) => Math.min(recentPageCount, current + 1))}
                    disabled={safeRecentPage >= recentPageCount}
                    className="rounded-full border border-slate-700 bg-slate-950/40 px-3 py-1.5 text-xs font-semibold text-slate-300 transition-colors hover:border-cyan-500/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex h-40 items-center justify-center rounded-2xl border border-dashed border-slate-700 bg-slate-950/30 text-sm text-slate-500">
              No hay intentos registrados en este rango.
            </div>
          )}
        </SectionCard>
      </div>
    </Layout>
  );
};
