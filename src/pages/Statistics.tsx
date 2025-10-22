import { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Mail, CheckCircle, XCircle, Clock } from 'lucide-react';

interface Stats {
  totalSent: number;
  totalFailed: number;
  totalPending: number;
}

interface Application {
  id: string;
  name: string;
}

export const Statistics = () => {
  const { user } = useAuth();
  const [applications, setApplications] = useState<Application[]>([]);
  const [selectedApp, setSelectedApp] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats>({ totalSent: 0, totalFailed: 0, totalPending: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadApplications();
    }
  }, [user]);

  useEffect(() => {
    if (selectedApp) {
      loadStats(selectedApp);
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
          </>
        )}
      </div>
    </Layout>
  );
};
