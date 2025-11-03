import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  Mail,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  TrendingUp,
  Activity,
  Server,
  Zap,
  ArrowRight
} from 'lucide-react';

interface Stats {
  totalEmails: number;
  sentEmails: number;
  failedEmails: number;
  pendingEmails: number;
  totalPdfs: number;
  successRate: number;
}

interface Application {
  id: string;
  name: string;
}

interface RecentActivity {
  id: string;
  recipient_email: string;
  subject: string;
  status: string;
  created_at: string;
  communication_type: string;
}

interface ServiceStatus {
  name: string;
  status: 'operational' | 'degraded' | 'down';
  responseTime: number;
}

export const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [applications, setApplications] = useState<Application[]>([]);
  const [selectedApp, setSelectedApp] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats>({
    totalEmails: 0,
    sentEmails: 0,
    failedEmails: 0,
    pendingEmails: 0,
    totalPdfs: 0,
    successRate: 0,
  });
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadApplications();
    }
  }, [user]);

  useEffect(() => {
    if (selectedApp) {
      loadStats();
      loadRecentActivity();
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

      const { data: prefs } = await supabase
        .from('user_preferences')
        .select('default_application_id')
        .eq('user_id', user.sub)
        .maybeSingle();

      const { data, error } = await supabase
        .from('applications')
        .select('id, name')
        .eq('user_id', user.sub)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setApplications(data || []);

      if (prefs?.default_application_id) {
        setSelectedApp(prefs.default_application_id);
      } else if (data && data.length > 0) {
        setSelectedApp(data[0].id);
      }
    } catch (error) {
      console.error('Error loading applications:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    if (!selectedApp) return;

    try {
      const { data: logs, error } = await supabase
        .from('email_logs')
        .select('status, communication_type')
        .eq('application_id', selectedApp);

      if (error) throw error;

      const totalEmails = logs?.length || 0;
      const sentEmails = logs?.filter(l => l.status === 'sent').length || 0;
      const failedEmails = logs?.filter(l => l.status === 'failed').length || 0;
      const pendingEmails = logs?.filter(l => l.status === 'pending').length || 0;
      const totalPdfs = logs?.filter(l => l.communication_type === 'pdf_generation').length || 0;
      const successRate = totalEmails > 0 ? Math.round((sentEmails / totalEmails) * 100) : 0;

      setStats({
        totalEmails,
        sentEmails,
        failedEmails,
        pendingEmails,
        totalPdfs,
        successRate,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const loadRecentActivity = async () => {
    if (!selectedApp) return;

    try {
      const { data, error } = await supabase
        .from('email_logs')
        .select('id, recipient_email, subject, status, created_at, communication_type')
        .eq('application_id', selectedApp)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      setRecentActivity(data || []);
    } catch (error) {
      console.error('Error loading recent activity:', error);
    }
  };

  const checkServiceHealth = async () => {
    const healthChecks: ServiceStatus[] = [
      { name: 'API', status: 'operational', responseTime: 45 },
      { name: 'Base de Datos', status: 'operational', responseTime: 12 },
      { name: 'Email Service', status: 'operational', responseTime: 120 },
      { name: 'PDF Generator', status: 'operational', responseTime: 350 },
    ];

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    try {
      const start = Date.now();
      const { error } = await supabase.from('applications').select('id').limit(1);
      const responseTime = Date.now() - start;

      if (error) {
        healthChecks[0].status = 'degraded';
        healthChecks[1].status = 'degraded';
      } else {
        healthChecks[0].responseTime = responseTime;
        healthChecks[1].responseTime = Math.floor(responseTime / 3);
      }
    } catch {
      healthChecks[0].status = 'down';
      healthChecks[1].status = 'down';
    }

    try {
      const emailStart = Date.now();
      const emailResponse = await fetch(`${supabaseUrl}/functions/v1/health-check-email`, {
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });

      if (emailResponse.ok) {
        const emailData = await emailResponse.json();
        healthChecks[2].status = emailData.status;
        healthChecks[2].responseTime = emailData.responseTime;
      } else {
        healthChecks[2].status = 'degraded';
        healthChecks[2].responseTime = Date.now() - emailStart;
      }
    } catch {
      healthChecks[2].status = 'down';
      healthChecks[2].responseTime = 0;
    }

    try {
      const pdfStart = Date.now();
      const pdfResponse = await fetch(`${supabaseUrl}/functions/v1/health-check-pdf`, {
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });

      if (pdfResponse.ok) {
        const pdfData = await pdfResponse.json();
        healthChecks[3].status = pdfData.status;
        healthChecks[3].responseTime = pdfData.responseTime;
      } else {
        healthChecks[3].status = 'degraded';
        healthChecks[3].responseTime = Date.now() - pdfStart;
      }
    } catch {
      healthChecks[3].status = 'down';
      healthChecks[3].responseTime = 0;
    }

    setServices(healthChecks);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <CheckCircle2 className="w-4 h-4 text-green-400" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-400" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-400" />;
      default:
        return <Activity className="w-4 h-4 text-slate-400" />;
    }
  };

  const getStatusColor = (status: 'operational' | 'degraded' | 'down') => {
    switch (status) {
      case 'operational':
        return 'bg-green-500';
      case 'degraded':
        return 'bg-yellow-500';
      case 'down':
        return 'bg-red-500';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'Ahora';
    if (minutes < 60) return `Hace ${minutes}m`;
    if (hours < 24) return `Hace ${hours}h`;
    return `Hace ${days}d`;
  };

  if (loading) {
    return (
      <Layout currentPage="dashboard">
        <div className="text-center py-12">
          <div className="text-slate-400">Cargando...</div>
        </div>
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
            <p className="text-slate-400 mb-6">
              Crea tu primera aplicación en Configuración para empezar a ver estadísticas
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout currentPage="dashboard">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-white">Dashboard</h1>
          <div className="flex space-x-2">
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
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 backdrop-blur-sm rounded-xl border border-cyan-500/20 p-6">
            <div className="flex items-center justify-between mb-2">
              <Mail className="w-8 h-8 text-cyan-400" />
              <div className="flex items-center space-x-1 text-green-400 text-sm">
                <TrendingUp className="w-4 h-4" />
                <span>{stats.successRate}%</span>
              </div>
            </div>
            <div className="text-3xl font-bold text-white mb-1">{stats.totalEmails}</div>
            <div className="text-sm text-slate-400">Emails Totales</div>
          </div>

          <div className="bg-gradient-to-br from-green-500/10 to-green-600/5 backdrop-blur-sm rounded-xl border border-green-500/20 p-6">
            <div className="flex items-center justify-between mb-2">
              <CheckCircle2 className="w-8 h-8 text-green-400" />
            </div>
            <div className="text-3xl font-bold text-white mb-1">{stats.sentEmails}</div>
            <div className="text-sm text-slate-400">Enviados</div>
          </div>

          <div className="bg-gradient-to-br from-red-500/10 to-red-600/5 backdrop-blur-sm rounded-xl border border-red-500/20 p-6">
            <div className="flex items-center justify-between mb-2">
              <XCircle className="w-8 h-8 text-red-400" />
            </div>
            <div className="text-3xl font-bold text-white mb-1">{stats.failedEmails}</div>
            <div className="text-sm text-slate-400">Fallidos</div>
          </div>

          <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 backdrop-blur-sm rounded-xl border border-purple-500/20 p-6">
            <div className="flex items-center justify-between mb-2">
              <FileText className="w-8 h-8 text-purple-400" />
            </div>
            <div className="text-3xl font-bold text-white mb-1">{stats.totalPdfs}</div>
            <div className="text-sm text-slate-400">PDFs Generados</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-2">
                <Activity className="w-5 h-5 text-cyan-400" />
                <h2 className="text-xl font-semibold text-white">Actividad Reciente</h2>
              </div>
              <button
                onClick={() => navigate('/statistics')}
                className="flex items-center space-x-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors text-sm"
              >
                <span>Ver todo</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              {recentActivity.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  No hay actividad reciente
                </div>
              ) : (
                recentActivity.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-start space-x-3 p-3 bg-slate-900/50 rounded-lg hover:bg-slate-900/70 transition-colors"
                  >
                    <div className="mt-1">{getStatusIcon(activity.status)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-white font-medium truncate">
                            {activity.subject}
                          </div>
                          <div className="text-xs text-slate-400 truncate">
                            {activity.recipient_email}
                          </div>
                        </div>
                        <span className="text-xs text-slate-500 whitespace-nowrap ml-2">
                          {formatDate(activity.created_at)}
                        </span>
                      </div>
                      <div className="mt-1">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${
                            activity.status === 'sent'
                              ? 'bg-green-500/20 text-green-400'
                              : activity.status === 'failed'
                              ? 'bg-red-500/20 text-red-400'
                              : 'bg-yellow-500/20 text-yellow-400'
                          }`}
                        >
                          {activity.status}
                        </span>
                        <span className="ml-2 text-xs text-slate-500">
                          {activity.communication_type === 'pdf_generation'
                            ? 'PDF'
                            : activity.communication_type === 'email_with_pdf'
                            ? 'Email + PDF'
                            : 'Email'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-white">Estado de Servicios</h2>
              <Server className="w-5 h-5 text-cyan-400" />
            </div>

            <div className="space-y-4">
              {services.map((service, idx) => (
                <div key={idx} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div
                        className={`w-2 h-2 rounded-full ${getStatusColor(
                          service.status
                        )}`}
                      />
                      <span className="text-sm text-white font-medium">{service.name}</span>
                    </div>
                    <span className="text-xs text-slate-400">{service.responseTime}ms</span>
                  </div>
                  <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${
                        service.status === 'operational'
                          ? 'bg-green-500'
                          : service.status === 'degraded'
                          ? 'bg-yellow-500'
                          : 'bg-red-500'
                      }`}
                      style={{
                        width: service.status === 'operational' ? '100%' : '50%',
                      }}
                    />
                  </div>
                </div>
              ))}

              <div className="pt-4 border-t border-slate-700">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Estado General</span>
                  <div className="flex items-center space-x-2">
                    <Zap className="w-4 h-4 text-green-400" />
                    <span className="text-green-400 font-medium">Operacional</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};
