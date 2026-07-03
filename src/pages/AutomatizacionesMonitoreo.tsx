import { useEffect, useMemo, useState, type ComponentType } from 'react';
import { Layout } from '../components/Layout';
import { PageLoader } from '../components/PageLoader';
import { AutomationPageHeader } from '../components/AutomationPageHeader';
import { useApplicationPicker } from '../hooks/useApplicationPicker';
import { useToast } from '../components/Toast';
import { AutomationMonitoringPayload, loadAutomationMonitoring } from '../lib/automationApi';
import { Activity, AlertTriangle, Clock, Eye, Loader2, MousePointerClick, RefreshCw, Server, Send, Workflow } from 'lucide-react';

const StatCard = ({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  tone: string;
}) => (
  <div className={`rounded-2xl border p-4 ${tone} bg-slate-900/50`}>
    <div className="flex items-center justify-between">
      <Icon className="h-5 w-5 opacity-80" />
      <span className="text-[10px] uppercase tracking-[0.14em] text-slate-500">stats</span>
    </div>
    <div className="mt-3 text-2xl font-bold text-white">{value}</div>
    <div className="mt-1 text-sm text-slate-400">{label}</div>
  </div>
);

function formatDate(value: string) {
  return new Date(value).toLocaleString('es-UY', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const AutomatizacionesMonitoreo = () => {
  const toast = useToast();
  const { applications, selectedApp, setSelectedApp, selectedApplication, loading } = useApplicationPicker();
  const [payload, setPayload] = useState<AutomationMonitoringPayload | null>(null);
  const [loadingMonitoring, setLoadingMonitoring] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'warning' | 'error' | 'info'>('all');

  const selectedApplicationLabel = useMemo(() => selectedApplication?.name || 'Selecciona una aplicacion', [selectedApplication]);
  const selectedApplicationApiKey = selectedApplication?.api_key?.trim() || '';

  const requireApplicationApiKey = () => {
    if (!selectedApplication) {
      throw new Error('Selecciona una aplicacion primero');
    }

    if (!selectedApplicationApiKey) {
      throw new Error('La aplicacion seleccionada no tiene api_key');
    }

    return selectedApplicationApiKey;
  };

  const refreshMonitoring = async () => {
    if (!selectedApplicationApiKey) {
      setPayload(null);
      return;
    }

    try {
      setLoadingMonitoring(true);
      const apiKey = requireApplicationApiKey();
      const data = await loadAutomationMonitoring(apiKey, 25);
      setPayload(data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo cargar el monitoreo');
    } finally {
      setLoadingMonitoring(false);
    }
  };

  useEffect(() => {
    if (selectedApplicationApiKey) {
      void refreshMonitoring();
      const interval = window.setInterval(() => {
        void refreshMonitoring();
      }, 30000);

      return () => window.clearInterval(interval);
    }

    setPayload(null);
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedApp, selectedApplicationApiKey]);

  const traces = (payload?.traces || []).filter((trace) => statusFilter === 'all' || trace.level === statusFilter);

  if (loading) {
    return <Layout currentPage="automatizaciones-monitoreo"><PageLoader /></Layout>;
  }

  const summary = payload?.summary;

  return (
    <Layout currentPage="automatizaciones-monitoreo">
      <div className="space-y-6">
        <AutomationPageHeader
          title="Monitoreo"
          description="Sigue la salud de los programas, los jobs de lote y las trazas de ejecucion desde una vista especifica para automatizaciones."
        />

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-700 bg-slate-900/60 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-white">{selectedApplicationLabel}</p>
            <p className="text-xs text-slate-500">La vista se actualiza cada 30 segundos cuando hay una aplicacion seleccionada.</p>
            {selectedApplication && !selectedApplicationApiKey && (
              <p className="mt-1 text-xs text-amber-300">La aplicacion seleccionada no tiene api_key configurada.</p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {applications.map((app) => (
              <button
                key={app.id}
                onClick={() => setSelectedApp(app.id)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  selectedApp === app.id ? 'bg-cyan-500 text-white' : 'bg-slate-800/70 text-slate-400 hover:text-white'
                }`}
              >
                {app.name}
              </button>
            ))}
            <button
              onClick={() => void refreshMonitoring()}
              disabled={loadingMonitoring || !selectedApplicationApiKey}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${loadingMonitoring ? 'animate-spin' : ''}`} />
              Actualizar
            </button>
          </div>
        </div>

        {loadingMonitoring ? (
          <div className="flex items-center justify-center rounded-3xl border border-slate-700 bg-slate-900/60 py-16 text-slate-400">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Cargando monitoreo...
          </div>
        ) : !payload ? (
          <div className="rounded-3xl border border-dashed border-slate-700 bg-slate-900/40 p-8 text-sm text-slate-500">
            No hay datos de monitoreo para mostrar todavia.
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard icon={Workflow} label="Programas totales" value={summary?.programs_total ?? 0} tone="border-cyan-500/20 text-cyan-300" />
              <StatCard icon={Clock} label="Programas programados" value={summary?.scheduled_programs ?? 0} tone="border-amber-500/20 text-amber-300" />
              <StatCard icon={Send} label="Jobs enviados" value={summary?.jobs_sent ?? 0} tone="border-emerald-500/20 text-emerald-300" />
              <StatCard icon={AlertTriangle} label="Jobs fallidos" value={summary?.jobs_failed ?? 0} tone="border-red-500/20 text-red-300" />
              <StatCard icon={Activity} label="Jobs en proceso" value={summary?.jobs_processing ?? 0} tone="border-blue-500/20 text-blue-300" />
              <StatCard icon={Eye} label="Aperturas" value={summary?.emails_opened ?? 0} tone="border-cyan-500/20 text-cyan-300" />
              <StatCard icon={MousePointerClick} label="Clicks" value={summary?.emails_clicked ?? 0} tone="border-emerald-500/20 text-emerald-300" />
              <StatCard icon={Server} label="Programas listos" value={summary?.due_programs ?? 0} tone="border-slate-500/20 text-slate-300" />
              <StatCard icon={Workflow} label="Items en cola" value={summary?.queue_total ?? 0} tone="border-cyan-500/20 text-cyan-300" />
              <StatCard icon={Clock} label="Cola pendiente" value={summary?.queue_queued ?? 0} tone="border-amber-500/20 text-amber-300" />
              <StatCard icon={Activity} label="Cola en proceso" value={summary?.queue_processing ?? 0} tone="border-blue-500/20 text-blue-300" />
              <StatCard icon={AlertTriangle} label="Cola fallida" value={summary?.queue_failed ?? 0} tone="border-red-500/20 text-red-300" />
            </div>

            <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
              <div className="rounded-3xl border border-slate-700 bg-slate-900/60 p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-white">Jobs recientes</h2>
                    <p className="text-sm text-slate-400">Estado operativo de los lotes y ejecuciones.</p>
                  </div>
                  <div className="rounded-full border border-slate-700 bg-slate-800/60 px-3 py-1 text-xs text-slate-400">
                    {payload.recent_jobs.length} registros
                  </div>
                </div>

                <div className="overflow-hidden rounded-2xl border border-slate-700/80">
                  <table className="min-w-full divide-y divide-slate-700 text-sm">
                    <thead className="bg-slate-950/40">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-slate-400">Job</th>
                        <th className="px-4 py-3 text-left font-medium text-slate-400">Estado</th>
                        <th className="px-4 py-3 text-left font-medium text-slate-400">Progreso</th>
                        <th className="px-4 py-3 text-left font-medium text-slate-400">Fecha</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 bg-slate-950/20">
                      {payload.recent_jobs.map((job) => (
                        <tr key={job.id} className="hover:bg-slate-800/30">
                          <td className="px-4 py-3">
                            <div className="font-medium text-white">{job.type}</div>
                            <div className="mt-1 text-xs text-slate-500">{job.template_name || 'Sin template'}</div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                              job.trace_level === 'error'
                                ? 'border-red-500/20 bg-red-500/10 text-red-200'
                                : job.trace_level === 'success'
                                  ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200'
                                  : job.trace_level === 'info'
                                    ? 'border-cyan-500/20 bg-cyan-500/10 text-cyan-200'
                                    : 'border-amber-500/20 bg-amber-500/10 text-amber-200'
                            }`}>
                              {job.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-300">
                            {job.processed}/{job.total} · {job.sent} ok / {job.failed} fail
                          </td>
                          <td className="px-4 py-3 text-slate-400">{formatDate(job.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-700 bg-slate-900/60 p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-white">Trazas</h2>
                    <p className="text-sm text-slate-400">Cronologia compacta para programas, jobs y logs.</p>
                  </div>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                    className="rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none"
                  >
                    <option value="all">Todas</option>
                    <option value="success">Exito</option>
                    <option value="warning">Avisos</option>
                    <option value="error">Errores</option>
                    <option value="info">Informativas</option>
                  </select>
                </div>

                <div className="space-y-3">
                  {traces.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/40 p-6 text-sm text-slate-500">
                      No hay trazas para este filtro.
                    </div>
                  ) : (
                    traces.map((trace) => (
                      <div key={trace.id} className="rounded-2xl border border-slate-700 bg-slate-950/40 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-white">{trace.title}</p>
                            <p className="mt-1 text-xs text-slate-500">{trace.message}</p>
                          </div>
                          <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                            trace.level === 'error'
                              ? 'border-red-500/20 bg-red-500/10 text-red-200'
                              : trace.level === 'success'
                                ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200'
                                : trace.level === 'info'
                                  ? 'border-cyan-500/20 bg-cyan-500/10 text-cyan-200'
                                  : 'border-amber-500/20 bg-amber-500/10 text-amber-200'
                          }`}>
                            {trace.level}
                          </span>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span className="rounded-full bg-slate-900/70 px-2 py-1">#{trace.kind}</span>
                          <span>{formatDate(trace.created_at)}</span>
                          {trace.job_id && <span className="rounded-full bg-slate-900/70 px-2 py-1">job {trace.job_id}</span>}
                          {trace.program_id && <span className="rounded-full bg-slate-900/70 px-2 py-1">program {trace.program_id}</span>}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-700 bg-slate-900/60 p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-white">Cola reciente</h2>
                  <p className="text-sm text-slate-400">Items en espera, en proceso o ya enviados para programas con delivery_mode queued.</p>
                </div>
                <div className="rounded-full border border-slate-700 bg-slate-800/60 px-3 py-1 text-xs text-slate-400">
                  {(payload.recent_queue_items || []).length} registros
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-700/80">
                <table className="min-w-full divide-y divide-slate-700 text-sm">
                  <thead className="bg-slate-950/40">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-slate-400">Item</th>
                      <th className="px-4 py-3 text-left font-medium text-slate-400">Estado</th>
                      <th className="px-4 py-3 text-left font-medium text-slate-400">Programa</th>
                      <th className="px-4 py-3 text-left font-medium text-slate-400">Fecha</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 bg-slate-950/20">
                    {(payload.recent_queue_items || []).length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-10 text-center text-slate-500">
                          No hay items recientes en cola.
                        </td>
                      </tr>
                    ) : (
                      (payload.recent_queue_items || []).map((item) => (
                        <tr key={item.id} className="hover:bg-slate-800/30">
                          <td className="px-4 py-3">
                            <div className="font-medium text-white">{item.external_reference_id || item.recipient_email}</div>
                            <div className="mt-1 text-xs text-slate-500">{item.recipient_email}</div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                              item.status === 'sent'
                                ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200'
                                : item.status === 'processing'
                                  ? 'border-cyan-500/20 bg-cyan-500/10 text-cyan-200'
                                  : item.status === 'failed'
                                    ? 'border-red-500/20 bg-red-500/10 text-red-200'
                                    : 'border-amber-500/20 bg-amber-500/10 text-amber-200'
                            }`}>
                              {item.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-300">
                            <div className="font-medium text-white truncate">{item.program_id}</div>
                            <div className="mt-1 text-xs text-slate-500">{item.application_id}</div>
                          </td>
                          <td className="px-4 py-3 text-slate-400">{formatDate(item.created_at)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-700 bg-slate-900/60 p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-white">Programas recientes</h2>
                  <p className="text-sm text-slate-400">Recetas y programaciones activas, pausadas o finalizadas.</p>
                </div>
                <div className="rounded-full border border-slate-700 bg-slate-800/60 px-3 py-1 text-xs text-slate-400">
                  {payload.recent_programs.length} registros
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                {payload.recent_programs.map((program) => (
                  <div key={program.id} className="rounded-2xl border border-slate-700 bg-slate-950/40 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">{program.name}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {program.kind} · {program.channel} · {program.status}
                        </p>
                      </div>
                      <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                        program.last_error
                          ? 'border-red-500/20 bg-red-500/10 text-red-200'
                          : program.status === 'paused'
                            ? 'border-amber-500/20 bg-amber-500/10 text-amber-200'
                            : program.status === 'done'
                              ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200'
                              : 'border-cyan-500/20 bg-cyan-500/10 text-cyan-200'
                      }`}>
                        {program.last_error ? 'error' : program.status}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                      <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                        <p className="text-slate-500">Recipientes</p>
                        <p className="mt-1 font-semibold text-white">{program.recipients_count ?? program.recipients.length}</p>
                      </div>
                      <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                        <p className="text-slate-500">Ejecuciones</p>
                        <p className="mt-1 font-semibold text-white">{program.run_count ?? 0}</p>
                      </div>
                      <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                        <p className="text-slate-500">Siguiente</p>
                        <p className="mt-1 font-semibold text-white">{program.next_run_at ? formatDate(program.next_run_at) : 'Sin fecha'}</p>
                      </div>
                      <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                        <p className="text-slate-500">Ultima ejecucion</p>
                        <p className="mt-1 font-semibold text-white">{program.last_run_at ? formatDate(program.last_run_at) : 'Sin datos'}</p>
                      </div>
                    </div>
                    {program.last_error && (
                      <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                        {program.last_error}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
};

export default AutomatizacionesMonitoreo;
