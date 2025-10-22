import { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Mail, CheckCircle, XCircle, Clock, Eye } from 'lucide-react';

interface Stats {
  totalSent: number;
  totalFailed: number;
  totalPending: number;
}

interface Application {
  id: string;
  name: string;
}

interface EmailLog {
  id: string;
  recipient_email: string;
  subject: string;
  status: string;
  sent_at: string | null;
  error_message: string | null;
  metadata: any;
  created_at: string;
}

export const Statistics = () => {
  const { user } = useAuth();
  const [applications, setApplications] = useState<Application[]>([]);
  const [selectedApp, setSelectedApp] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats>({ totalSent: 0, totalFailed: 0, totalPending: 0 });
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [selectedLog, setSelectedLog] = useState<EmailLog | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadApplications();
    }
  }, [user]);

  useEffect(() => {
    if (selectedApp) {
      loadStats(selectedApp);
      loadLogs(selectedApp);

      const channel = supabase
        .channel(`email_logs_${selectedApp}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'email_logs',
            filter: `application_id=eq.${selectedApp}`,
          },
          (payload) => {
            if (payload.eventType === 'INSERT') {
              setLogs((prev) => [payload.new as EmailLog, ...prev.slice(0, 49)]);
              loadStats(selectedApp);
            } else if (payload.eventType === 'UPDATE') {
              setLogs((prev) =>
                prev.map((log) =>
                  log.id === payload.new.id ? (payload.new as EmailLog) : log
                )
              );
              loadStats(selectedApp);
            } else if (payload.eventType === 'DELETE') {
              setLogs((prev) => prev.filter((log) => log.id !== payload.old.id));
              loadStats(selectedApp);
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [selectedApp]);

  const loadApplications = async () => {
    try {
      if (!user?.sub) return;

      const { data, error } = await supabase
        .from('applications')
        .select('id, name')
        .eq('user_id', user.sub)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setApplications(data || []);
      if (data && data.length > 0) {
        setSelectedApp(data[0].id);
      }
    } catch (error) {
      console.error('Error loading applications:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async (appId: string) => {
    try {
      const { data: logs, error } = await supabase
        .from('email_logs')
        .select('status')
        .eq('application_id', appId);

      if (error) throw error;

      const sent = logs?.filter((l) => l.status === 'sent').length || 0;
      const failed = logs?.filter((l) => l.status === 'failed').length || 0;
      const pending = logs?.filter((l) => l.status === 'pending').length || 0;

      setStats({ totalSent: sent, totalFailed: failed, totalPending: pending });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const loadLogs = async (appId: string) => {
    try {
      const { data, error } = await supabase
        .from('email_logs')
        .select('*')
        .eq('application_id', appId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error('Error loading logs:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent':
        return 'text-emerald-400 bg-emerald-500/10';
      case 'failed':
        return 'text-red-400 bg-red-500/10';
      case 'pending':
        return 'text-amber-400 bg-amber-500/10';
      default:
        return 'text-slate-400 bg-slate-500/10';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <CheckCircle className="w-4 h-4" />;
      case 'failed':
        return <XCircle className="w-4 h-4" />;
      case 'pending':
        return <Clock className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <Layout currentPage="statistics">
        <div className="text-center py-12">
          <div className="text-slate-400">Cargando...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout currentPage="statistics">
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-white">Estadísticas</h1>

        {applications.length === 0 ? (
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 p-8 text-center">
            <p className="text-slate-400 mb-4">Primero debes crear una aplicación</p>
            <a
              href="/dashboard"
              className="inline-block px-6 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors"
            >
              Ir al Dashboard
            </a>
          </div>
        ) : (
          <>
            <div className="flex space-x-2 overflow-x-auto pb-2">
              {applications.map((app) => (
                <button
                  key={app.id}
                  onClick={() => setSelectedApp(app.id)}
                  className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
                    selectedApp === app.id
                      ? 'bg-cyan-500 text-white'
                      : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  {app.name}
                </button>
              ))}
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 p-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-slate-400">Enviados</h3>
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                </div>
                <p className="text-3xl font-bold text-white">{stats.totalSent}</p>
              </div>

              <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 p-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-slate-400">Fallidos</h3>
                  <XCircle className="w-5 h-5 text-red-400" />
                </div>
                <p className="text-3xl font-bold text-white">{stats.totalFailed}</p>
              </div>

              <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 p-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-slate-400">Pendientes</h3>
                  <Clock className="w-5 h-5 text-amber-400" />
                </div>
                <p className="text-3xl font-bold text-white">{stats.totalPending}</p>
              </div>
            </div>

            <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 p-6">
              <div className="flex items-center space-x-2 mb-4">
                <Mail className="w-5 h-5 text-cyan-400" />
                <h3 className="text-lg font-semibold text-white">Resumen</h3>
              </div>
              <p className="text-slate-400">
                Total de comunicaciones: {stats.totalSent + stats.totalFailed + stats.totalPending}
              </p>
            </div>

            <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 overflow-hidden">
              <div className="p-6 border-b border-slate-700">
                <h3 className="text-lg font-semibold text-white">Historial de Comunicaciones</h3>
              </div>
              <div className="overflow-x-auto">
                {logs.length === 0 ? (
                  <div className="p-8 text-center text-slate-400">
                    No hay comunicaciones registradas
                  </div>
                ) : (
                  <table className="w-full">
                    <thead className="bg-slate-900/50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                          Destinatario
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                          Asunto
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                          Estado
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                          Fecha
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                          Acciones
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                      {logs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-900/30 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-white">{log.recipient_email}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-white max-w-xs truncate">{log.subject}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(
                                log.status
                              )}`}
                            >
                              {getStatusIcon(log.status)}
                              <span className="capitalize">{log.status}</span>
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-slate-400">
                              {formatDate(log.sent_at || log.created_at)}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <button
                              onClick={() => setSelectedLog(log)}
                              className="p-2 text-slate-400 hover:text-cyan-400 transition-colors"
                              title="Ver detalles"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {selectedLog && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-700 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Detalles de Comunicación</h2>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-2 text-slate-400 hover:text-white transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Estado</label>
                <span
                  className={`inline-flex items-center space-x-2 px-3 py-1.5 rounded-lg text-sm font-medium ${getStatusColor(
                    selectedLog.status
                  )}`}
                >
                  {getStatusIcon(selectedLog.status)}
                  <span className="capitalize">{selectedLog.status}</span>
                </span>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Destinatario</label>
                <div className="px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white">
                  {selectedLog.recipient_email}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Asunto</label>
                <div className="px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white">
                  {selectedLog.subject}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Fecha de Creación</label>
                <div className="px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white">
                  {formatDate(selectedLog.created_at)}
                </div>
              </div>

              {selectedLog.sent_at && (
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Fecha de Envío</label>
                  <div className="px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white">
                    {formatDate(selectedLog.sent_at)}
                  </div>
                </div>
              )}

              {selectedLog.error_message && (
                <div>
                  <label className="block text-sm font-medium text-red-400 mb-2">Error</label>
                  <div className="px-4 py-2 bg-red-900/20 border border-red-700/50 rounded-lg text-red-300">
                    {selectedLog.error_message}
                  </div>
                </div>
              )}

              {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Metadata</label>
                  <div className="px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg">
                    <pre className="text-sm text-slate-300 overflow-x-auto">
                      {JSON.stringify(selectedLog.metadata, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-700 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-6 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};
