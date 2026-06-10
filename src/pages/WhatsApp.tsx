import { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { db } from '../lib/db';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/Toast';
import { usePermissions } from '../hooks/usePermissions';
import { loadOwnedApplicationsWithKeys } from '../lib/applicationQueries';
import {
  MessageSquare, CheckCircle, XCircle, Clock, Send, Trash2,
  RefreshCw, AlertCircle, Eye, Search, Smartphone,
} from 'lucide-react';

/* ── Types ─────────────────────────────────────────────────────── */

interface Application {
  id: string;
  name: string;
  api_key: string;
}

interface WhatsAppConfig {
  id: string;
  application_id: string;
  phone_number_id: string;
  waba_id: string;
  access_token: string;
  display_name: string;
  is_active: boolean;
}

interface WhatsAppStats {
  totalSent: number;
  totalDelivered: number;
  totalRead: number;
  totalFailed: number;
  totalQueued: number;
}

interface WhatsAppLog {
  id: string;
  wamid: string | null;
  recipient_phone: string;
  status: string;
  error_code: string | null;
  error_message: string | null;
  template_variables: Record<string, string>;
  external_reference_id: string | null;
  whatsapp_template_id: string | null;
  created_at: string;
  updated_at: string;
}

/* ── Helpers ────────────────────────────────────────────────────── */

const LOG_STATUS: Record<string, { label: string; cls: string; icon: any }> = {
  queued:    { label: 'En cola',   cls: 'bg-slate-500/20 text-slate-400',     icon: Clock },
  sent:      { label: 'Enviado',   cls: 'bg-blue-500/20 text-blue-400',       icon: Send },
  delivered: { label: 'Entregado', cls: 'bg-emerald-500/20 text-emerald-400', icon: CheckCircle },
  read:      { label: 'Leído',     cls: 'bg-cyan-500/20 text-cyan-400',       icon: Eye },
  failed:    { label: 'Fallido',   cls: 'bg-red-500/20 text-red-400',         icon: XCircle },
};

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) : '—';

/* ── Component ─────────────────────────────────────────────────── */

export const WhatsApp = () => {
  const { user, isSystemAdmin } = useAuth();
  const toast = useToast();
  const { canDelete } = usePermissions('statistics.jobs_whatsapp');

  const [applications, setApplications] = useState<Application[]>([]);
  const [selectedApp, setSelectedApp] = useState<string | null>(null);
  const [config, setConfig] = useState<WhatsAppConfig | null>(null);
  const [stats, setStats] = useState<WhatsAppStats>({
    totalSent: 0, totalDelivered: 0, totalRead: 0, totalFailed: 0, totalQueued: 0,
  });
  const [logs, setLogs] = useState<WhatsAppLog[]>([]);

  // Filters
  const [searchPhone, setSearchPhone] = useState('');
  const [searchStatus, setSearchStatus] = useState('');
  const [searchDateStart, setSearchDateStart] = useState('');
  const [searchDateEnd, setSearchDateEnd] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Delete confirm
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Refresh
  const [refreshing, setRefreshing] = useState(false);

  /* ── Load ── */
  useEffect(() => {
    if (user) loadApplications();
  }, [user, isSystemAdmin]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchPhone, searchStatus, searchDateStart, searchDateEnd]);

  useEffect(() => {
    if (selectedApp) {
      loadConfig();
      loadLogs();
      const interval = setInterval(() => { loadLogs(); }, 30000);
      return () => clearInterval(interval);
    }
  }, [selectedApp]);

  const loadApplications = async () => {
    try {
      if (!user?.sub) return;
      const { data: prefs } = await db
        .from('user_preferences')
        .select('default_application_id')
        .eq('user_id', user.sub)
        .maybeSingle();

      const rows = await loadOwnedApplicationsWithKeys(user.sub, user.tenant_id, isSystemAdmin);
      setApplications(rows);
      const defaultId = (prefs as any)?.default_application_id;
      if (defaultId) setSelectedApp(defaultId);
      else if (rows.length > 0) setSelectedApp(rows[0].id);
    } catch {
      // ignore
    }
  };

  const loadConfig = async () => {
    if (!selectedApp) return;
    const { data } = await db
      .from('whatsapp_configs')
      .select('*')
      .eq('application_id', selectedApp)
      .maybeSingle();
    setConfig((data as WhatsAppConfig) || null);
  };

  const loadLogs = async () => {
    if (!selectedApp) return;
    const { data } = await db
      .from('whatsapp_logs')
      .select('*')
      .eq('application_id', selectedApp)
      .order('created_at', { ascending: false })
      .limit(500);

    const rows = (data as WhatsAppLog[]) || [];
    setLogs(rows);
    computeStats(rows);
  };

  const computeStats = (rows: WhatsAppLog[]) => {
    const s: WhatsAppStats = { totalSent: 0, totalDelivered: 0, totalRead: 0, totalFailed: 0, totalQueued: 0 };
    for (const r of rows) {
      if (r.status === 'sent')      s.totalSent++;
      if (r.status === 'delivered') s.totalDelivered++;
      if (r.status === 'read')      s.totalRead++;
      if (r.status === 'failed')    s.totalFailed++;
      if (r.status === 'queued')    s.totalQueued++;
    }
    setStats(s);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadLogs();
    setRefreshing(false);
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      const { error } = await db.from('whatsapp_logs').delete().eq('id', deleteConfirm);
      if (error) throw error;
      toast.success('Registro eliminado');
      setDeleteConfirm(null);
      loadLogs();
    } catch {
      toast.error('Error al eliminar el registro');
    } finally {
      setDeleting(false);
    }
  };

  /* ── Filtered logs ── */
  const filteredLogs = logs.filter(log => {
    const phoneMatch = !searchPhone || log.recipient_phone.toLowerCase().includes(searchPhone.toLowerCase());
    const statusMatch = !searchStatus || log.status === searchStatus;
    let dateMatch = true;
    if (searchDateStart || searchDateEnd) {
      const logDate = new Date(log.created_at);
      if (searchDateStart) dateMatch = dateMatch && logDate >= new Date(searchDateStart);
      if (searchDateEnd) {
        const end = new Date(searchDateEnd);
        end.setHours(23, 59, 59, 999);
        dateMatch = dateMatch && logDate <= end;
      }
    }
    return phoneMatch && statusMatch && dateMatch;
  });

  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);
  const paginatedLogs = filteredLogs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  /* ── Render ── */
  return (
    <Layout currentPage="whatsapp">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Jobs — WhatsApp</h1>
          <p className="text-sm text-slate-400 mt-1">Historial de mensajes y transacciones WhatsApp Business</p>
        </div>

        {applications.length === 0 ? (
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 p-8 text-center">
            <p className="text-slate-400 mb-4">Primero debes crear una aplicación</p>
            <a href="/dashboard" className="inline-block px-6 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors">
              Ir al Dashboard
            </a>
          </div>
        ) : (
          <>
            {/* App selector */}
            <div className="flex space-x-2 overflow-x-auto pb-2">
              {applications.map(app => (
                <button
                  key={app.id}
                  onClick={() => setSelectedApp(app.id)}
                  className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
                    selectedApp === app.id ? 'bg-emerald-500 text-white' : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  {app.name}
                </button>
              ))}
            </div>

            {/* Config warning */}
            {!config && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-amber-300 font-medium text-sm">Credenciales de Meta no configuradas</p>
                  <p className="text-amber-400/70 text-sm mt-0.5">
                    Configura las credenciales en{' '}
                    <a href="/settings/whatsapp" className="underline hover:text-amber-300 transition-colors">
                      Configuración → WhatsApp Business
                    </a>.
                  </p>
                </div>
              </div>
            )}

            {config && (
              <div className={`rounded-xl p-3 flex items-center justify-between border ${config.is_active ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-slate-800/50 border-slate-700'}`}>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${config.is_active ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                  <span className={`text-sm ${config.is_active ? 'text-emerald-300' : 'text-slate-400'}`}>
                    {config.is_active ? 'WhatsApp Cloud API activo' : 'WhatsApp Cloud API desactivado'}
                    {config.display_name ? ` · ${config.display_name}` : ''}
                  </span>
                </div>
                <a href="/settings/whatsapp" className="text-xs text-slate-500 hover:text-white transition-colors">
                  Editar configuración
                </a>
              </div>
            )}

            {/* Stats cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[
                { label: 'Enviados',   value: stats.totalSent,      icon: Send,         color: 'text-emerald-400' },
                { label: 'Entregados', value: stats.totalDelivered,  icon: CheckCircle,  color: 'text-cyan-400' },
                { label: 'Leídos',     value: stats.totalRead,       icon: Eye,          color: 'text-blue-400' },
                { label: 'Fallidos',   value: stats.totalFailed,     icon: XCircle,      color: 'text-red-400' },
                { label: 'En cola',    value: stats.totalQueued,     icon: Clock,        color: 'text-amber-400' },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 p-6">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-slate-400">{label}</h3>
                    <Icon className={`w-5 h-5 ${color}`} />
                  </div>
                  <p className="text-3xl font-bold text-white">{value}</p>
                </div>
              ))}
            </div>

            {/* Additional stats */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-emerald-500/10 backdrop-blur-sm rounded-xl border border-emerald-500/30 p-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-emerald-300">Total mensajes</h3>
                  <MessageSquare className="w-5 h-5 text-emerald-400" />
                </div>
                <p className="text-3xl font-bold text-white">{logs.length}</p>
                <p className="text-xs text-emerald-300/70 mt-1">Total de mensajes registrados</p>
              </div>
              <div className="bg-cyan-500/10 backdrop-blur-sm rounded-xl border border-cyan-500/30 p-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-cyan-300">Tasa de entrega</h3>
                  <Smartphone className="w-5 h-5 text-cyan-400" />
                </div>
                <p className="text-3xl font-bold text-white">
                  {logs.length > 0
                    ? `${Math.round(((stats.totalDelivered + stats.totalRead) / logs.length) * 100)}%`
                    : '—'}
                </p>
                <p className="text-xs text-cyan-300/70 mt-1">Entregados + leídos sobre total</p>
              </div>
            </div>

            {/* Log history */}
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700">
              <div className="p-4 sm:p-6 border-b border-slate-700">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-white">Historial de Mensajes</h2>
                  <button
                    onClick={handleRefresh}
                    className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                  >
                    <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="text"
                      value={searchPhone}
                      onChange={e => setSearchPhone(e.target.value)}
                      placeholder="Buscar por teléfono..."
                      className="w-full pl-9 pr-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                  </div>
                  <input
                    type="date"
                    value={searchDateStart}
                    onChange={e => setSearchDateStart(e.target.value)}
                    className="px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                  <select
                    value={searchStatus}
                    onChange={e => setSearchStatus(e.target.value)}
                    className="px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-emerald-500 transition-colors"
                  >
                    <option value="">Todos los estados</option>
                    <option value="queued">En cola</option>
                    <option value="sent">Enviado</option>
                    <option value="delivered">Entregado</option>
                    <option value="read">Leído</option>
                    <option value="failed">Fallido</option>
                  </select>
                  <input
                    type="date"
                    value={searchDateEnd}
                    onChange={e => setSearchDateEnd(e.target.value)}
                    className="px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Estado</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Destinatario</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">WAMID</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Referencia</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Fecha</th>
                      {canDelete && <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Acciones</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {paginatedLogs.length === 0 ? (
                      <tr>
                        <td colSpan={canDelete ? 6 : 5} className="px-4 py-12 text-center">
                          <MessageSquare className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                          <p className="text-slate-500 text-sm">No hay mensajes registrados</p>
                        </td>
                      </tr>
                    ) : paginatedLogs.map(log => {
                      const s = LOG_STATUS[log.status] || LOG_STATUS['queued'];
                      const StatusIcon = s.icon;
                      return (
                        <tr key={log.id} className="hover:bg-slate-700/20 transition-colors">
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${s.cls}`}>
                              <StatusIcon className="w-3 h-3" />
                              {s.label}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-sm text-white font-mono">{log.recipient_phone}</span>
                            {log.error_message && (
                              <p className="text-xs text-red-400 mt-0.5 truncate max-w-[200px]">{log.error_message}</p>
                            )}
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell">
                            <span className="text-xs text-slate-500 font-mono truncate max-w-[120px] block">
                              {log.wamid ? log.wamid.slice(-16) : '—'}
                            </span>
                          </td>
                          <td className="px-4 py-3 hidden lg:table-cell">
                            <span className="text-xs text-slate-400">{log.external_reference_id || '—'}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-sm text-slate-400">{fmtDate(log.created_at)}</span>
                          </td>
                          {canDelete && (
                            <td className="px-4 py-3">
                              <button
                                onClick={() => setDeleteConfirm(log.id)}
                                className="p-1.5 text-slate-500 hover:text-red-400 transition-colors rounded"
                                title="Eliminar"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="px-4 py-3 border-t border-slate-700 flex items-center justify-between">
                  <p className="text-xs text-slate-500">
                    Mostrando {((currentPage - 1) * itemsPerPage) + 1}–{Math.min(currentPage * itemsPerPage, filteredLogs.length)} de {filteredLogs.length}
                  </p>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1.5 text-xs bg-slate-800 text-slate-400 rounded-lg hover:bg-slate-700 disabled:opacity-40 transition-colors"
                    >
                      Anterior
                    </button>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const page = currentPage <= 3 ? i + 1 : currentPage + i - 2;
                      if (page < 1 || page > totalPages) return null;
                      return (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${currentPage === page ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                        >
                          {page}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1.5 text-xs bg-slate-800 text-slate-400 rounded-lg hover:bg-slate-700 disabled:opacity-40 transition-colors"
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

      {/* Delete confirm modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold text-white mb-2">Eliminar registro</h3>
            <p className="text-slate-400 text-sm mb-6">Esta acción no se puede deshacer.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white rounded-lg text-sm transition-colors"
              >
                {deleting ? 'Eliminando…' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};
