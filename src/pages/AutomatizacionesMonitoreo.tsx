import { Fragment, useEffect, useMemo, useState, type ComponentType } from 'react';
import { Layout } from '../components/Layout';
import { PageLoader } from '../components/PageLoader';
import { AutomationPageHeader } from '../components/AutomationPageHeader';
import { useApplicationPicker } from '../hooks/useApplicationPicker';
import { useToast } from '../components/Toast';
import { AutomationMonitoringPayload, loadAutomationMonitoring, runAutomationProgram } from '../lib/automationApi';
import { translateStatus } from '../lib/statusLabels';
import { Activity, AlertTriangle, ChevronDown, ChevronUp, Clock, Eye, Loader2, MousePointerClick, Play, RefreshCw, Server, Send, Workflow } from 'lucide-react';

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

function minutesElapsed(from: string, to: string) {
  return (new Date(to).getTime() - new Date(from).getTime()) / 60000;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('es-UY', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const JOBS_PAGE_SIZE = 25;

type MonitoringJob = AutomationMonitoringPayload['recent_jobs'][number];
type MonitoringProgram = AutomationMonitoringPayload['recent_programs'][number];
type MonitoringQueueItem = NonNullable<AutomationMonitoringPayload['recent_queue_items']>[number];

const JobRow = ({
  job,
  isExpanded,
  onToggle,
  relatedProgram,
  relatedQueueItems,
  runningProgramId,
  onRunProgram,
  generatedAt,
  indent,
}: {
  job: MonitoringJob;
  isExpanded: boolean;
  onToggle: () => void;
  relatedProgram: MonitoringProgram | undefined;
  relatedQueueItems: MonitoringQueueItem[];
  runningProgramId: string | null;
  onRunProgram: (programId: string) => void;
  generatedAt?: string;
  indent?: boolean;
}) => (
  <Fragment>
    <tr className={`hover:bg-slate-800/30 ${indent ? 'bg-slate-950/30' : ''}`}>
      <td className={`px-4 py-3 ${indent ? 'pl-8' : ''}`}>
        <div className="font-medium text-white">{job.type}</div>
        <div className="mt-1 text-xs text-slate-500">{job.template_name || 'Sin template'}</div>
        {job.program_id && (
          <div className="mt-1 text-xs text-slate-500">programa {job.program_id}</div>
        )}
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
          {translateStatus(job.status)}
        </span>
        {(job.status === 'pending' || job.status === 'processing') &&
          generatedAt &&
          minutesElapsed(job.updated_at, generatedAt) > 2 && (
            <div className="mt-1 text-[10px] text-amber-300">
              Sin novedades hace {Math.round(minutesElapsed(job.updated_at, generatedAt))} min — puede haber quedado sin procesar
            </div>
          )}
      </td>
      <td className="px-4 py-3 text-slate-300">
        {job.processed}/{job.total} · {job.sent} ok / {job.failed} fail
        {job.error_message && (
          <div className="mt-1 text-xs text-red-300">{job.error_message}</div>
        )}
      </td>
      <td className="px-4 py-3 text-slate-400">{formatDate(job.created_at)}</td>
      <td className="px-4 py-3 text-right">
        <button
          onClick={onToggle}
          className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900/70 px-2 py-1 text-xs text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
        >
          {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          Ver detalle
        </button>
      </td>
    </tr>
    {isExpanded && (
      <tr>
        <td colSpan={5} className="bg-slate-950/60 px-4 py-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Job</p>
              <pre className="mt-2 max-h-72 overflow-auto rounded-lg border border-slate-800 bg-slate-950/70 p-3 text-xs text-slate-300">
                {JSON.stringify(job, null, 2)}
              </pre>
            </div>
            <div>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Programa de origen</p>
                {relatedProgram && (
                  <button
                    onClick={() => onRunProgram(relatedProgram.id)}
                    disabled={runningProgramId === relatedProgram.id}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {runningProgramId === relatedProgram.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Play className="h-3 w-3" />
                    )}
                    Ejecutar
                  </button>
                )}
              </div>
              {relatedProgram ? (
                <pre className="mt-2 max-h-72 overflow-auto rounded-lg border border-slate-800 bg-slate-950/70 p-3 text-xs text-slate-300">
                  {JSON.stringify(relatedProgram, null, 2)}
                </pre>
              ) : (
                <p className="mt-2 text-xs text-slate-500">Sin programa asociado (envio directo por /notify).</p>
              )}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Items de cola de este job</p>
              {relatedQueueItems.length > 0 ? (
                <pre className="mt-2 max-h-72 overflow-auto rounded-lg border border-slate-800 bg-slate-950/70 p-3 text-xs text-slate-300">
                  {JSON.stringify(relatedQueueItems, null, 2)}
                </pre>
              ) : (
                <p className="mt-2 text-xs text-slate-500">Este job no vino de un item de cola.</p>
              )}
            </div>
          </div>
        </td>
      </tr>
    )}
  </Fragment>
);

export const AutomatizacionesMonitoreo = () => {
  const toast = useToast();
  const { applications, selectedApp, setSelectedApp, selectedApplication, loading } = useApplicationPicker();
  const [payload, setPayload] = useState<AutomationMonitoringPayload | null>(null);
  const [loadingMonitoring, setLoadingMonitoring] = useState(false);
  const [kindFilter, setKindFilter] = useState<'scheduled' | 'batch' | 'all'>('scheduled');
  const [expandedErrorId, setExpandedErrorId] = useState<string | null>(null);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [expandedGroupKey, setExpandedGroupKey] = useState<string | null>(null);
  const [runningProgramId, setRunningProgramId] = useState<string | null>(null);
  const [jobsSearchInput, setJobsSearchInput] = useState('');
  const [jobsSearch, setJobsSearch] = useState('');
  const [jobsDateFrom, setJobsDateFrom] = useState('');
  const [jobsDateTo, setJobsDateTo] = useState('');
  const [jobsOffset, setJobsOffset] = useState(0);

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
      const data = await loadAutomationMonitoring(apiKey, 25, kindFilter === 'all' ? undefined : kindFilter, {
        q: jobsSearch || undefined,
        dateFrom: jobsDateFrom ? new Date(jobsDateFrom).toISOString() : undefined,
        dateTo: jobsDateTo ? new Date(jobsDateTo + 'T23:59:59').toISOString() : undefined,
        jobsLimit: JOBS_PAGE_SIZE,
        jobsOffset,
      });
      setPayload(data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo cargar el monitoreo');
    } finally {
      setLoadingMonitoring(false);
    }
  };

  const handleRunProgram = async (programId: string) => {
    try {
      setRunningProgramId(programId);
      const apiKey = requireApplicationApiKey();
      const result = await runAutomationProgram(apiKey, programId);
      toast.success(`Job creado: ${result.job_id || 'sin id'}`);
      await refreshMonitoring();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo ejecutar el programa');
    } finally {
      setRunningProgramId(null);
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
  }, [selectedApp, selectedApplicationApiKey, kindFilter, jobsSearch, jobsDateFrom, jobsDateTo, jobsOffset]);

  const applyJobsSearch = () => {
    setJobsOffset(0);
    setJobsSearch(jobsSearchInput.trim());
  };

  const recentErrors = useMemo(() => {
    if (!payload) return [];

    type ErrorEntry = {
      id: string;
      kind: 'job' | 'queue_item' | 'program';
      title: string;
      message: string;
      timestamp: string;
      program_id?: string | null;
      raw: unknown;
    };

    const entries: ErrorEntry[] = [
      ...payload.recent_jobs
        .filter((job) => !!job.error_message)
        .map((job) => ({
          id: `job-error-${job.id}`,
          kind: 'job' as const,
          title: `Job ${job.type}`,
          message: job.error_message as string,
          timestamp: job.updated_at,
          program_id: job.program_id,
          raw: job,
        })),
      ...(payload.recent_queue_items || [])
        .filter((item) => !!item.last_error)
        .map((item) => ({
          id: `queue-error-${item.id}`,
          kind: 'queue_item' as const,
          title: item.external_reference_id || item.recipient_email,
          message: item.last_error as string,
          timestamp: item.updated_at,
          program_id: item.program_id,
          raw: item,
        })),
      ...payload.recent_programs
        .filter((program) => !!program.last_error)
        .map((program) => ({
          id: `program-error-${program.id}`,
          kind: 'program' as const,
          title: program.name,
          message: program.last_error as string,
          timestamp: program.updated_at,
          program_id: program.id,
          raw: program,
        })),
    ];

    return entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }, [payload]);

  const ERROR_KIND_LABELS: Record<'job' | 'queue_item' | 'program', string> = {
    job: 'Job',
    queue_item: 'Item de cola (destinatario puntual)',
    program: 'Resumen del programa (la corrida completa)',
  };

  const programsById = useMemo(() => {
    const map = new Map<string, AutomationMonitoringPayload['recent_programs'][number]>();
    (payload?.recent_programs || []).forEach((program) => map.set(program.id, program));
    return map;
  }, [payload]);

  const queueItemsByJobId = useMemo(() => {
    const map = new Map<string, NonNullable<AutomationMonitoringPayload['recent_queue_items']>>();
    (payload?.recent_queue_items || []).forEach((item) => {
      if (!item.last_job_id) return;
      const list = map.get(item.last_job_id) || [];
      list.push(item);
      map.set(item.last_job_id, list);
    });
    return map;
  }, [payload]);

  const jobGroups = useMemo(() => {
    type JobGroup = { key: string; program_id: string | null; jobs: MonitoringJob[] };
    const groups = new Map<string, JobGroup>();

    (payload?.recent_jobs || []).forEach((job) => {
      // Un programa "queued" dispara un /notify por destinatario: agrupamos los jobs que
      // comparten programa y ocurrieron en el mismo minuto como una sola corrida.
      const key = job.program_id ? `${job.program_id}:${job.created_at.slice(0, 16)}` : `single:${job.id}`;
      if (!groups.has(key)) {
        groups.set(key, { key, program_id: job.program_id ?? null, jobs: [] });
      }
      groups.get(key)!.jobs.push(job);
    });

    return Array.from(groups.values()).sort((a, b) => b.jobs[0].created_at.localeCompare(a.jobs[0].created_at));
  }, [payload]);

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

        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-700 bg-slate-900/60 px-4 py-3">
          <span className="text-xs uppercase tracking-[0.14em] text-slate-500">Origen</span>
          {(
            [
              { value: 'scheduled', label: 'Programados' },
              { value: 'batch', label: 'En lote' },
              { value: 'all', label: 'Todo' },
            ] as const
          ).map((option) => (
            <button
              key={option.value}
              onClick={() => setKindFilter(option.value)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                kindFilter === option.value ? 'bg-cyan-500 text-white' : 'bg-slate-800/70 text-slate-400 hover:text-white'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {loadingMonitoring && !payload ? (
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

            {recentErrors.length > 0 && (
              <div className="rounded-3xl border border-red-500/30 bg-red-500/5 p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="flex items-center gap-2 text-lg font-semibold text-red-100">
                      <AlertTriangle className="h-5 w-5" />
                      Errores recientes
                    </h2>
                    <p className="text-sm text-red-200/70">Fallos de jobs, items de cola y programas, mas recientes primero.</p>
                    <p className="mt-1 text-xs text-red-200/50">
                      Una misma falla puede aparecer dos veces: una vez desde el item de cola (el destinatario puntual) y otra desde el resumen del programa (la corrida completa).
                    </p>
                  </div>
                  <div className="rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs text-red-200">
                    {recentErrors.length} registros
                  </div>
                </div>

                <div className="space-y-2">
                  {recentErrors.map((entry) => {
                    const isExpanded = expandedErrorId === entry.id;
                    return (
                      <div key={entry.id} className="rounded-xl border border-red-500/20 bg-slate-950/40 p-3 text-sm">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="font-medium text-white">{entry.title}</p>
                            <p className="mt-1 text-xs text-red-200">{entry.message}</p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <span className="rounded-full bg-slate-900/70 px-2 py-1">{ERROR_KIND_LABELS[entry.kind]}</span>
                            <span>{formatDate(entry.timestamp)}</span>
                            {entry.program_id && (
                              <span className="rounded-full bg-slate-900/70 px-2 py-1">programa {entry.program_id}</span>
                            )}
                            <button
                              onClick={() => setExpandedErrorId(isExpanded ? null : entry.id)}
                              className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900/70 px-2 py-1 text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
                            >
                              {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                              Ver detalle
                            </button>
                          </div>
                        </div>
                        {isExpanded && (
                          <pre className="mt-3 overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/70 p-3 text-xs text-slate-300">
                            {JSON.stringify(entry.raw, null, 2)}
                          </pre>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="rounded-3xl border border-slate-700 bg-slate-900/60 p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-white">Jobs recientes</h2>
                  <p className="text-sm text-slate-400">
                    Estado operativo de los lotes y ejecuciones. Los jobs de un mismo programa ocurridos en el mismo minuto se agrupan como una corrida.
                  </p>
                </div>
                <div className="rounded-full border border-slate-700 bg-slate-800/60 px-3 py-1 text-xs text-slate-400">
                  {payload.jobs_pagination?.total ?? payload.recent_jobs.length} registros
                </div>
              </div>

              <div className="mb-4 flex flex-wrap items-end gap-3">
                <label className="flex-1 min-w-[220px] space-y-1">
                  <span className="text-xs font-medium text-slate-400">Buscar (email, nombre, template)</span>
                  <input
                    value={jobsSearchInput}
                    onChange={(e) => setJobsSearchInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && applyJobsSearch()}
                    placeholder="cliente@ejemplo.com, Juan, confirmar-cuenta..."
                    className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-cyan-500/60"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-medium text-slate-400">Desde</span>
                  <input
                    type="date"
                    value={jobsDateFrom}
                    onChange={(e) => {
                      setJobsOffset(0);
                      setJobsDateFrom(e.target.value);
                    }}
                    className="rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-cyan-500/60"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-medium text-slate-400">Hasta</span>
                  <input
                    type="date"
                    value={jobsDateTo}
                    onChange={(e) => {
                      setJobsOffset(0);
                      setJobsDateTo(e.target.value);
                    }}
                    className="rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-cyan-500/60"
                  />
                </label>
                <button
                  onClick={applyJobsSearch}
                  className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-cyan-400"
                >
                  Buscar
                </button>
                {(jobsSearch || jobsDateFrom || jobsDateTo) && (
                  <button
                    onClick={() => {
                      setJobsSearchInput('');
                      setJobsSearch('');
                      setJobsDateFrom('');
                      setJobsDateTo('');
                      setJobsOffset(0);
                    }}
                    className="rounded-lg border border-slate-700 bg-slate-800/60 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-700 hover:text-white"
                  >
                    Limpiar
                  </button>
                )}
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-700/80">
                <table className="min-w-full divide-y divide-slate-700 text-sm">
                  <thead className="bg-slate-950/40">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-slate-400">Job</th>
                      <th className="px-4 py-3 text-left font-medium text-slate-400">Estado</th>
                      <th className="px-4 py-3 text-left font-medium text-slate-400">Progreso</th>
                      <th className="px-4 py-3 text-left font-medium text-slate-400">Fecha</th>
                      <th className="px-4 py-3 text-right font-medium text-slate-400"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 bg-slate-950/20">
                    {jobGroups.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                          No hay jobs para este filtro.
                        </td>
                      </tr>
                    ) : (
                      jobGroups.map((group) => {
                        if (group.jobs.length === 1) {
                          const job = group.jobs[0];
                          return (
                            <JobRow
                              key={job.id}
                              job={job}
                              isExpanded={expandedJobId === job.id}
                              onToggle={() => setExpandedJobId(expandedJobId === job.id ? null : job.id)}
                              relatedProgram={job.program_id ? programsById.get(job.program_id) : undefined}
                              relatedQueueItems={queueItemsByJobId.get(job.id) || []}
                              runningProgramId={runningProgramId}
                              onRunProgram={(id) => void handleRunProgram(id)}
                              generatedAt={summary?.generated_at}
                            />
                          );
                        }

                        const isGroupExpanded = expandedGroupKey === group.key;
                        const totals = group.jobs.reduce(
                          (acc, job) => ({
                            total: acc.total + job.total,
                            sent: acc.sent + job.sent,
                            failed: acc.failed + job.failed,
                          }),
                          { total: 0, sent: 0, failed: 0 },
                        );
                        const anyPending = group.jobs.some((job) => job.status === 'pending' || job.status === 'processing');
                        const anyFailed = group.jobs.some((job) => job.trace_level === 'error');

                        return (
                          <Fragment key={group.key}>
                            <tr className="cursor-pointer bg-slate-900/40 hover:bg-slate-800/40" onClick={() => setExpandedGroupKey(isGroupExpanded ? null : group.key)}>
                              <td className="px-4 py-3">
                                <div className="font-medium text-white">Corrida de {group.jobs.length} jobs</div>
                                {group.program_id && (
                                  <div className="mt-1 text-xs text-slate-500">programa {group.program_id}</div>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                                  anyFailed
                                    ? 'border-red-500/20 bg-red-500/10 text-red-200'
                                    : anyPending
                                      ? 'border-amber-500/20 bg-amber-500/10 text-amber-200'
                                      : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200'
                                }`}>
                                  {anyFailed ? 'Con fallos' : anyPending ? 'En proceso' : 'Completado'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-slate-300">
                                {totals.total} total · {totals.sent} ok / {totals.failed} fail
                              </td>
                              <td className="px-4 py-3 text-slate-400">{formatDate(group.jobs[0].created_at)}</td>
                              <td className="px-4 py-3 text-right">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setExpandedGroupKey(isGroupExpanded ? null : group.key);
                                  }}
                                  className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900/70 px-2 py-1 text-xs text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
                                >
                                  {isGroupExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                  {isGroupExpanded ? 'Ocultar' : 'Ver'} {group.jobs.length} jobs
                                </button>
                              </td>
                            </tr>
                            {isGroupExpanded && group.jobs.map((job) => (
                              <JobRow
                                key={job.id}
                                job={job}
                                isExpanded={expandedJobId === job.id}
                                onToggle={() => setExpandedJobId(expandedJobId === job.id ? null : job.id)}
                                relatedProgram={job.program_id ? programsById.get(job.program_id) : undefined}
                                relatedQueueItems={queueItemsByJobId.get(job.id) || []}
                                runningProgramId={runningProgramId}
                                onRunProgram={(id) => void handleRunProgram(id)}
                                generatedAt={summary?.generated_at}
                                indent
                              />
                            ))}
                          </Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {payload.jobs_pagination && payload.jobs_pagination.total > payload.jobs_pagination.limit && (
                <div className="mt-4 flex items-center justify-between gap-3 text-sm text-slate-400">
                  <span>
                    {payload.jobs_pagination.offset + 1}-{Math.min(payload.jobs_pagination.offset + payload.jobs_pagination.limit, payload.jobs_pagination.total)} de {payload.jobs_pagination.total}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setJobsOffset((current) => Math.max(0, current - JOBS_PAGE_SIZE))}
                      disabled={payload.jobs_pagination.offset === 0}
                      className="rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Anterior
                    </button>
                    <button
                      onClick={() => setJobsOffset((current) => current + JOBS_PAGE_SIZE)}
                      disabled={payload.jobs_pagination.offset + payload.jobs_pagination.limit >= payload.jobs_pagination.total}
                      className="rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Siguiente
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </Layout>
  );
};

export default AutomatizacionesMonitoreo;
