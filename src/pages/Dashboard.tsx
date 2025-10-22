import { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/Toast';
import { Plus, Copy, Trash2, Key } from 'lucide-react';

interface Application {
  id: string;
  name: string;
  app_id: string;
  domain: string | null;
  api_key: string | null;
  created_at: string;
}

export const Dashboard = () => {
  const { user } = useAuth();
  const toast = useToast();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    domain: '',
  });

  useEffect(() => {
    if (user) {
      loadApplications();
    }
  }, [user]);

  const loadApplications = async () => {
    try {
      if (!user?.sub) return;

      const { data, error } = await supabase
        .from('applications')
        .select('*')
        .eq('user_id', user.sub)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setApplications(data || []);
    } catch (error) {
      console.error('Error loading applications:', error);
      toast.error('Error al cargar las aplicaciones');
    } finally {
      setLoading(false);
    }
  };

  const createApplication = async () => {
    if (!formData.name || !user?.sub) return;

    try {
      const appId = `app_${Math.random().toString(36).substr(2, 9)}`;
      const apiKey = `ak_${Math.random().toString(36).substr(2, 32)}`;

      const { error } = await supabase.from('applications').insert({
        user_id: user.sub,
        name: formData.name,
        app_id: appId,
        domain: formData.domain || null,
        api_key: apiKey,
      });

      if (error) throw error;

      toast.success('Aplicación creada exitosamente');
      setShowModal(false);
      setFormData({ name: '', domain: '' });
      loadApplications();
    } catch (error) {
      console.error('Error creating application:', error);
      toast.error('Error al crear la aplicación');
    }
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;

    try {
      const { error } = await supabase
        .from('applications')
        .delete()
        .eq('id', deleteConfirm);

      if (error) throw error;

      toast.success('Aplicación eliminada exitosamente');
      setDeleteConfirm(null);
      loadApplications();
    } catch (error) {
      console.error('Error deleting application:', error);
      toast.error('Error al eliminar la aplicación');
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado al portapapeles`);
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

  return (
    <Layout currentPage="dashboard">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-white">Dashboard</h1>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span>Nueva Aplicación</span>
          </button>
        </div>

        {applications.length === 0 ? (
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 p-12 text-center">
            <p className="text-slate-400 mb-4">No tienes aplicaciones creadas</p>
            <button
              onClick={() => setShowModal(true)}
              className="px-6 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors"
            >
              Crear Primera Aplicación
            </button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {applications.map((app) => (
              <div
                key={app.id}
                className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 p-6"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-semibold text-white mb-1">{app.name}</h3>
                    {app.domain && (
                      <p className="text-sm text-slate-400">{app.domain}</p>
                    )}
                  </div>
                  <button
                    onClick={() => setDeleteConfirm(app.id)}
                    className="p-2 text-slate-400 hover:text-red-400 transition-colors"
                    title="Eliminar"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-3">
                  <div className="bg-slate-900/50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-slate-500 font-medium">App ID</span>
                      <button
                        onClick={() => copyToClipboard(app.app_id, 'App ID')}
                        className="p-1 text-slate-400 hover:text-cyan-400 transition-colors"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                    <code className="text-sm text-cyan-400 font-mono break-all">
                      {app.app_id}
                    </code>
                  </div>

                  {app.api_key && (
                    <div className="bg-slate-900/50 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center space-x-2">
                          <Key className="w-3 h-3 text-slate-500" />
                          <span className="text-xs text-slate-500 font-medium">API Key</span>
                        </div>
                        <button
                          onClick={() => copyToClipboard(app.api_key!, 'API Key')}
                          className="p-1 text-slate-400 hover:text-cyan-400 transition-colors"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                      <code className="text-sm text-cyan-400 font-mono break-all">
                        {app.api_key}
                      </code>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold text-white mb-4">Nueva Aplicación</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Nombre de la Aplicación
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                  placeholder="Mi Aplicación"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Dominio (opcional)
                </label>
                <input
                  type="text"
                  value={formData.domain}
                  onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                  placeholder="example.com"
                />
              </div>
            </div>
            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={createApplication}
                disabled={!formData.name}
                className="flex-1 px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Crear
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-white mb-2">Eliminar Aplicación</h3>
            <p className="text-slate-300 text-sm mb-6">
              ¿Estás seguro de que deseas eliminar esta aplicación? Esta acción no se puede
              deshacer y eliminará todos los templates y logs asociados.
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};
