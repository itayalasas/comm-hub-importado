import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ShieldCheck,
  Search,
  Filter,
  RefreshCw,
  Loader2,
  X,
  ChevronLeft,
  ChevronRight,
  LogIn,
  LogOut,
  PlusCircle,
  PencilLine,
  Trash2,
  UserCog,
  Lock,
  Clock3,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSubscriptionLimits } from '../hooks/useSubscriptionLimits';
import { querySelect, type QueryFilter } from '../lib/queryApi';

interface AuditLogRow {
  id: string;
  tenant_id: string | null;
  application_id: string | null;
  actor_user_id: string | null;
  actor_email: string | null;
  actor_name: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  entity_label: string | null;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

const PAGE_SIZE = 20;
const FETCH_BATCH_SIZE = 250;
const FETCH_MAX_ROWS = 2000;

const ACTION_META: Record<string, { label: string; icon: any; className: string }> = {
  login: { label: 'Inicio de sesión', icon: LogIn, className: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20' },
  logout: { label: 'Cierre de sesión', icon: LogOut, className: 'bg-slate-500/10 text-slate-300 border-slate-500/20' },
  create: { label: 'Creación', icon: PlusCircle, className: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' },
  update: { label: 'Edición', icon: PencilLine, className: 'bg-sky-500/10 text-sky-300 border-sky-500/20' },
  delete: { label: 'Eliminación', icon: Trash2, className: 'bg-rose-500/10 text-rose-300 border-rose-500/20' },
  impersonation_start: { label: 'Acceso de soporte', icon: UserCog, className: 'bg-amber-500/10 text-amber-300 border-amber-500/20' },
  impersonation_end: { label: 'Fin de acceso de soporte', icon: UserCog, className: 'bg-amber-500/10 text-amber-200 border-amber-500/20' },
};

const ENTITY_LABELS: Record<string, string> = {
  session: 'Sesión',
  account_access: 'Acceso a la cuenta',
  application: 'Aplicación',
  template: 'Template de email',
  whatsapp_template: 'Template de WhatsApp',
  email_credentials: 'Credenciales de email',
  embed_credential: 'Credencial de embed',
  whatsapp_config: 'Configuración de WhatsApp',
  automation_program: 'Automatización',
};

const ACTION_OPTIONS = Object.keys(ACTION_META);
const ENTITY_OPTIONS = Object.keys(ENTITY_LABELS);

const DATE_FORMAT = new Intl.DateTimeFormat('es-UY', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return DATE_FORMAT.format(date);
}

function actionMeta(action: string) {
  return ACTION_META[action] || { label: action, icon: ShieldCheck, className: 'bg-slate-500/10 text-slate-300 border-slate-500/20' };
}

function entityLabel(entityType: string): string {
  return ENTITY_LABELS[entityType] || entityType;
}

const StatTile = ({ label, value, icon: Icon, accent }: { label: string; value: number; icon: any; accent: string }) => (
  <div className={`rounded-2xl border ${accent} bg-slate-900/70 p-4 shadow-lg shadow-black/10 backdrop-blur-sm`}>
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{label}</p>
        <p className="mt-1 text-2xl font-black text-white">{value.toLocaleString('es-UY')}</p>
      </div>
      <div className="rounded-xl border border-white/10 bg-white/5 p-2">
        <Icon className="h-4 w-4 text-slate-200" />
      </div>
    </div>
  </div>
);

export const AuditLogPanel = () => {
  const { user, isSystemAdmin } = useAuth();
  const { hasFeature } = useSubscriptionLimits();
  const hasAccess = isSystemAdmin || hasFeature('audit_logs');

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [actionFilters, setActionFilters] = useState<string[]>([]);
  const [entityFilters, setEntityFilters] = useState<string[]>([]);
  const [actorSearch, setActorSearch] = useState('');

  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [reloadToken, setReloadToken] = useState(0);
  const [page, setPage] = useState(1);
  const [selectedRow, setSelectedRow] = useState<AuditLogRow | null>(null);

  useEffect(() => {
    if (!hasAccess) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setRows((prev) => (prev.length ? prev : []));
      if (rows.length) setRefreshing(true); else setLoading(true);
      setError('');

      try {
        const filters: QueryFilter[] = [];

        if (!isSystemAdmin) {
          filters.push({ column: 'tenant_id', op: 'eq', value: user?.tenant_id || '' });
        }

        if (dateFrom) {
          filters.push({ column: 'created_at', op: 'gte', value: new Date(dateFrom).toISOString() });
        }
        if (dateTo) {
          const end = new Date(dateTo);
          end.setHours(23, 59, 59, 999);
          filters.push({ column: 'created_at', op: 'lte', value: end.toISOString() });
        }
        if (actionFilters.length === 1) {
          filters.push({ column: 'action', op: 'eq', value: actionFilters[0] });
        }
        if (entityFilters.length === 1) {
          filters.push({ column: 'entity_type', op: 'eq', value: entityFilters[0] });
        }

        const collected: AuditLogRow[] = [];
        let offset = 0;

        while (collected.length < FETCH_MAX_ROWS) {
          const { data, error: queryError } = await querySelect<AuditLogRow>({
            table: 'audit_logs',
            operation: 'select',
            filters,
            order: { column: 'created_at', ascending: false },
            limit: FETCH_BATCH_SIZE,
            offset,
          });

          if (queryError) throw new Error(queryError.message);

          const batch = data || [];
          collected.push(...batch);

          if (batch.length < FETCH_BATCH_SIZE) break;
          offset += batch.length;
        }

        if (!cancelled) {
          setRows(collected);
          setPage(1);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'No pudimos cargar la auditoría.');
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasAccess, isSystemAdmin, user?.tenant_id, dateFrom, dateTo, actionFilters.join(','), entityFilters.join(','), reloadToken]);

  const filteredRows = useMemo(() => {
    let result = rows;

    if (actionFilters.length > 1) {
      result = result.filter((row) => actionFilters.includes(row.action));
    }
    if (entityFilters.length > 1) {
      result = result.filter((row) => entityFilters.includes(row.entity_type));
    }
    if (actorSearch.trim()) {
      const needle = actorSearch.trim().toLowerCase();
      result = result.filter((row) =>
        (row.actor_email || '').toLowerCase().includes(needle) ||
        (row.actor_name || '').toLowerCase().includes(needle),
      );
    }

    return result;
  }, [rows, actionFilters, entityFilters, actorSearch]);

  const stats = useMemo(() => {
    const total = filteredRows.length;
    const logins = filteredRows.filter((r) => r.action === 'login').length;
    const changes = filteredRows.filter((r) => ['create', 'update', 'delete'].includes(r.action)).length;
    const supportAccess = filteredRows.filter((r) => r.action === 'impersonation_start').length;
    return { total, logins, changes, supportAccess };
  }, [filteredRows]);

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = filteredRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const toggleAction = (action: string) => {
    setActionFilters((prev) => (prev.includes(action) ? prev.filter((a) => a !== action) : [...prev, action]));
  };

  const toggleEntity = (entity: string) => {
    setEntityFilters((prev) => (prev.includes(entity) ? prev.filter((e) => e !== entity) : [...prev, entity]));
  };

  const clearFilters = () => {
    setDateFrom('');
    setDateTo('');
    setActionFilters([]);
    setEntityFilters([]);
    setActorSearch('');
  };

  if (!hasAccess) {
    return (
      <div className="rounded-2xl border border-slate-700 bg-slate-900/50 p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-400">
            <Lock className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-white">Auditoría</h2>
            <p className="mt-1 text-sm text-slate-400">
              Esta funcionalidad requiere actualizar a un plan superior para habilitarla.
            </p>
            <p className="mt-1 text-xs text-slate-500">
              El registro de auditoría (accesos, cambios y accesos de soporte) está disponible en planes superiores.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-700/60 bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950/20 p-6 shadow-2xl shadow-black/20">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-200">
              <ShieldCheck className="h-3.5 w-3.5" />
              Auditoría
            </div>
            <h1 className="mt-3 text-2xl font-black text-white sm:text-3xl">Registro de actividad</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-400">
              Quién inició sesión, quién creó/editó/eliminó qué, desde qué IP y cuándo — incluyendo accesos de soporte a tu cuenta.
            </p>
          </div>
          <button
            onClick={() => setReloadToken((v) => v + 1)}
            className="inline-flex items-center gap-2 self-start rounded-full border border-slate-700 bg-slate-950/40 px-4 py-2 text-sm font-semibold text-slate-300 transition-colors hover:border-cyan-500/30 hover:text-white"
          >
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Actualizar
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile label="Eventos" value={stats.total} icon={ShieldCheck} accent="border-cyan-500/15" />
        <StatTile label="Inicios de sesión" value={stats.logins} icon={LogIn} accent="border-emerald-500/15" />
        <StatTile label="Cambios de datos" value={stats.changes} icon={PencilLine} accent="border-sky-500/15" />
        <StatTile label="Accesos de soporte" value={stats.supportAccess} icon={UserCog} accent="border-amber-500/15" />
      </div>

      <div className="rounded-3xl border border-slate-700/60 bg-slate-900/70 p-5 shadow-2xl shadow-black/20 backdrop-blur-sm">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-300">
          <Filter className="h-4 w-4 text-cyan-300" />
          Filtros
          {(dateFrom || dateTo || actionFilters.length > 0 || entityFilters.length > 0 || actorSearch) && (
            <button onClick={clearFilters} className="ml-auto text-xs font-semibold text-cyan-300 hover:text-cyan-200">
              Limpiar filtros
            </button>
          )}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-[11px] uppercase tracking-wide text-slate-500">Desde</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-white focus:border-cyan-500/40 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] uppercase tracking-wide text-slate-500">Hasta</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-white focus:border-cyan-500/40 focus:outline-none"
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-2">
            <label className="mb-1 block text-[11px] uppercase tracking-wide text-slate-500">Buscar por actor</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={actorSearch}
                onChange={(e) => setActorSearch(e.target.value)}
                placeholder="Nombre o email..."
                className="w-full rounded-xl border border-slate-700 bg-slate-950/40 py-2 pl-10 pr-3 text-sm text-white placeholder:text-slate-600 focus:border-cyan-500/40 focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {ACTION_OPTIONS.map((action) => {
            const meta = actionMeta(action);
            const active = actionFilters.includes(action);
            return (
              <button
                key={action}
                onClick={() => toggleAction(action)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                  active ? meta.className : 'border-slate-700 bg-slate-950/30 text-slate-500 hover:text-slate-300'
                }`}
              >
                {meta.label}
              </button>
            );
          })}
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {ENTITY_OPTIONS.map((entity) => {
            const active = entityFilters.includes(entity);
            return (
              <button
                key={entity}
                onClick={() => toggleEntity(entity)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  active
                    ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-200'
                    : 'border-slate-800 bg-slate-950/30 text-slate-600 hover:text-slate-400'
                }`}
              >
                {entityLabel(entity)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-3xl border border-slate-700/60 bg-slate-900/70 shadow-2xl shadow-black/20 backdrop-blur-sm overflow-hidden">
        {loading ? (
          <div className="flex h-56 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-cyan-400" />
          </div>
        ) : pageRows.length === 0 ? (
          <div className="flex h-40 items-center justify-center px-6 text-center text-sm text-slate-500">
            No hay eventos de auditoría para los filtros seleccionados.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-700/60 text-left">
                <thead>
                  <tr className="text-xs uppercase tracking-[0.14em] text-slate-500">
                    <th className="px-5 py-3 font-semibold">Fecha / hora</th>
                    <th className="px-5 py-3 font-semibold">Acción</th>
                    <th className="px-5 py-3 font-semibold">Quién</th>
                    <th className="px-5 py-3 font-semibold">Qué</th>
                    <th className="px-5 py-3 font-semibold">IP</th>
                    <th className="px-5 py-3 font-semibold text-right">Detalle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {pageRows.map((row) => {
                    const meta = actionMeta(row.action);
                    const ActionIcon = meta.icon;
                    return (
                      <tr key={row.id} className="align-top">
                        <td className="whitespace-nowrap px-5 py-3.5 text-sm text-slate-300">
                          <div className="flex items-center gap-1.5">
                            <Clock3 className="h-3.5 w-3.5 text-slate-600" />
                            {formatDateTime(row.created_at)}
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${meta.className}`}>
                            <ActionIcon className="h-3.5 w-3.5" />
                            {meta.label}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-sm text-slate-300">
                          <div className="font-medium text-white">{row.actor_name || row.actor_email || 'Desconocido'}</div>
                          {row.actor_name && row.actor_email && (
                            <div className="text-xs text-slate-500">{row.actor_email}</div>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-sm text-slate-300">
                          <div className="font-medium text-white">{row.entity_label || '—'}</div>
                          <div className="text-xs text-slate-500">{entityLabel(row.entity_type)}</div>
                        </td>
                        <td className="px-5 py-3.5 text-sm text-slate-400">{row.ip_address || '—'}</td>
                        <td className="px-5 py-3.5 text-right">
                          <button
                            onClick={() => setSelectedRow(row)}
                            className="rounded-full border border-slate-700 bg-slate-950/40 px-3 py-1.5 text-xs font-semibold text-slate-300 transition-colors hover:border-cyan-500/30 hover:text-white"
                          >
                            Ver detalle
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-800/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-slate-500">
                Mostrando {(safePage - 1) * PAGE_SIZE + 1}-{Math.min(filteredRows.length, safePage * PAGE_SIZE)} de {filteredRows.length}
                {rows.length >= FETCH_MAX_ROWS ? ` (limitado a los últimos ${FETCH_MAX_ROWS.toLocaleString('es-UY')})` : ''}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-950/40 px-3 py-1.5 text-xs font-semibold text-slate-300 transition-colors hover:border-cyan-500/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Anterior
                </button>
                <span className="rounded-full border border-slate-700 bg-slate-950/40 px-3 py-1.5 text-xs font-semibold text-slate-400">
                  Página {safePage} / {pageCount}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                  disabled={safePage >= pageCount}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-950/40 px-3 py-1.5 text-xs font-semibold text-slate-300 transition-colors hover:border-cyan-500/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Siguiente
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {selectedRow && createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-white">Detalle del evento</h3>
                <p className="mt-1 text-xs text-slate-500">{formatDateTime(selectedRow.created_at)}</p>
              </div>
              <button type="button" onClick={() => setSelectedRow(null)} className="text-slate-500 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2">
                <span className="text-slate-500">Acción</span>
                <span className="font-semibold text-white">{actionMeta(selectedRow.action).label}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2">
                <span className="text-slate-500">Entidad</span>
                <span className="font-semibold text-white">{entityLabel(selectedRow.entity_type)}{selectedRow.entity_label ? ` · ${selectedRow.entity_label}` : ''}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2">
                <span className="text-slate-500">Actor</span>
                <span className="font-semibold text-white">{selectedRow.actor_name || selectedRow.actor_email || '—'}</span>
              </div>
              {selectedRow.actor_email && (
                <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2">
                  <span className="text-slate-500">Email</span>
                  <span className="font-mono text-xs text-slate-300">{selectedRow.actor_email}</span>
                </div>
              )}
              <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2">
                <span className="text-slate-500">IP</span>
                <span className="font-mono text-xs text-slate-300">{selectedRow.ip_address || '—'}</span>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2">
                <span className="text-slate-500">User agent</span>
                <p className="mt-1 break-words font-mono text-xs text-slate-400">{selectedRow.user_agent || '—'}</p>
              </div>
              {selectedRow.entity_id && (
                <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2">
                  <span className="text-slate-500">ID de entidad</span>
                  <span className="font-mono text-xs text-slate-300">{selectedRow.entity_id}</span>
                </div>
              )}
              {selectedRow.metadata && Object.keys(selectedRow.metadata).length > 0 && (
                <div className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2">
                  <span className="text-slate-500">Metadata</span>
                  <pre className="mt-1 whitespace-pre-wrap break-words font-mono text-xs text-slate-400">
                    {JSON.stringify(selectedRow.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
};
