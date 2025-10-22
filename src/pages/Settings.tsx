import { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/Toast';
import { User, Mail, Server, Eye, EyeOff, Plus } from 'lucide-react';

interface Application {
  id: string;
  name: string;
}

interface SMTPCredentials {
  id?: string;
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_password: string;
  from_email: string;
  from_name: string;
  is_active: boolean;
}

export const Settings = () => {
  const { user } = useAuth();
  const toast = useToast();
  const [applications, setApplications] = useState<Application[]>([]);
  const [selectedApp, setSelectedApp] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<SMTPCredentials | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState<SMTPCredentials>({
    smtp_host: '',
    smtp_port: 587,
    smtp_user: '',
    smtp_password: '',
    from_email: '',
    from_name: '',
    is_active: true,
  });

  useEffect(() => {
    if (user) {
      loadApplications();
    }
  }, [user]);

  useEffect(() => {
    if (selectedApp) {
      loadCredentials(selectedApp);
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

  const loadCredentials = async (appId: string) => {
    try {
      const { data, error } = await supabase
        .from('email_credentials')
        .select('*')
        .eq('application_id', appId)
        .eq('is_active', true)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;

      setCredentials(data);
      if (data) {
        setFormData({
          id: data.id,
          smtp_host: data.smtp_host,
          smtp_port: data.smtp_port,
          smtp_user: data.smtp_user,
          smtp_password: data.smtp_password,
          from_email: data.from_email,
          from_name: data.from_name || '',
          is_active: data.is_active,
        });
      }
    } catch (error) {
      console.error('Error loading credentials:', error);
    }
  };

  const saveCredentials = async () => {
    if (!selectedApp) return;

    try {
      if (credentials?.id) {
        const { error } = await supabase
          .from('email_credentials')
          .update({
            smtp_host: formData.smtp_host,
            smtp_port: formData.smtp_port,
            smtp_user: formData.smtp_user,
            smtp_password: formData.smtp_password,
            from_email: formData.from_email,
            from_name: formData.from_name || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', credentials.id);

        if (error) throw error;
        toast.success('Credenciales actualizadas exitosamente');
      } else {
        const { error } = await supabase.from('email_credentials').insert({
          application_id: selectedApp,
          smtp_host: formData.smtp_host,
          smtp_port: formData.smtp_port,
          smtp_user: formData.smtp_user,
          smtp_password: formData.smtp_password,
          from_email: formData.from_email,
          from_name: formData.from_name || null,
          is_active: true,
        });

        if (error) throw error;
        toast.success('Credenciales creadas exitosamente');
      }

      setShowModal(false);
      loadCredentials(selectedApp);
    } catch (error) {
      console.error('Error saving credentials:', error);
      toast.error('Error al guardar las credenciales');
    }
  };

  const openModal = () => {
    if (credentials) {
      setFormData({
        id: credentials.id,
        smtp_host: credentials.smtp_host,
        smtp_port: credentials.smtp_port,
        smtp_user: credentials.smtp_user,
        smtp_password: credentials.smtp_password,
        from_email: credentials.from_email,
        from_name: credentials.from_name,
        is_active: credentials.is_active,
      });
    } else {
      setFormData({
        smtp_host: '',
        smtp_port: 587,
        smtp_user: '',
        smtp_password: '',
        from_email: '',
        from_name: '',
        is_active: true,
      });
    }
    setShowModal(true);
  };

  if (loading) {
    return (
      <Layout currentPage="settings">
        <div className="text-center py-12">
          <div className="text-slate-400">Cargando...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout currentPage="settings">
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-white">Configuración</h1>

        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 p-6">
          <div className="flex items-center space-x-2 mb-6">
            <User className="w-5 h-5 text-cyan-400" />
            <h3 className="text-lg font-semibold text-white">Perfil de Usuario</h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Nombre</label>
              <div className="px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white">
                {user?.name || 'N/A'}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Email</label>
              <div className="flex items-center space-x-2 px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white">
                <Mail className="w-4 h-4 text-slate-500" />
                <span>{user?.email || 'N/A'}</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">User ID</label>
              <div className="px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg">
                <code className="text-sm text-cyan-400 font-mono break-all">
                  {user?.sub || 'N/A'}
                </code>
              </div>
            </div>
          </div>
        </div>

        {applications.length > 0 && (
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-2">
                <Server className="w-5 h-5 text-cyan-400" />
                <h3 className="text-lg font-semibold text-white">Credenciales SMTP</h3>
              </div>
              <button
                onClick={openModal}
                className="flex items-center space-x-2 px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors text-sm"
              >
                {credentials ? (
                  <>
                    <Server className="w-4 h-4" />
                    <span>Editar</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    <span>Configurar SMTP</span>
                  </>
                )}
              </button>
            </div>

            <div className="mb-4 flex space-x-2 overflow-x-auto pb-2">
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

            {credentials ? (
              <div className="space-y-3">
                <div className="grid md:grid-cols-2 gap-3">
                  <div className="bg-slate-900/50 rounded-lg p-3">
                    <div className="text-xs text-slate-500 mb-1">Host SMTP</div>
                    <div className="text-sm text-white font-mono">{credentials.smtp_host}</div>
                  </div>
                  <div className="bg-slate-900/50 rounded-lg p-3">
                    <div className="text-xs text-slate-500 mb-1">Puerto</div>
                    <div className="text-sm text-white font-mono">{credentials.smtp_port}</div>
                  </div>
                  <div className="bg-slate-900/50 rounded-lg p-3">
                    <div className="text-xs text-slate-500 mb-1">Usuario SMTP</div>
                    <div className="text-sm text-white font-mono">{credentials.smtp_user}</div>
                  </div>
                  <div className="bg-slate-900/50 rounded-lg p-3">
                    <div className="text-xs text-slate-500 mb-1">Email Remitente</div>
                    <div className="text-sm text-white font-mono">{credentials.from_email}</div>
                  </div>
                </div>
                {credentials.from_name && (
                  <div className="bg-slate-900/50 rounded-lg p-3">
                    <div className="text-xs text-slate-500 mb-1">Nombre Remitente</div>
                    <div className="text-sm text-white">{credentials.from_name}</div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-slate-400 mb-4">
                  No hay credenciales SMTP configuradas para esta aplicación
                </p>
                <button
                  onClick={openModal}
                  className="px-6 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors"
                >
                  Configurar SMTP
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-700">
              <h2 className="text-xl font-bold text-white">
                {credentials ? 'Editar Credenciales SMTP' : 'Configurar SMTP'}
              </h2>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Host SMTP
                  </label>
                  <input
                    type="text"
                    value={formData.smtp_host}
                    onChange={(e) => setFormData({ ...formData, smtp_host: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                    placeholder="smtp.gmail.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Puerto SMTP
                  </label>
                  <input
                    type="number"
                    value={formData.smtp_port}
                    onChange={(e) =>
                      setFormData({ ...formData, smtp_port: parseInt(e.target.value) })
                    }
                    className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                    placeholder="587"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Usuario SMTP
                </label>
                <input
                  type="text"
                  value={formData.smtp_user}
                  onChange={(e) => setFormData({ ...formData, smtp_user: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                  placeholder="usuario@ejemplo.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Contraseña SMTP
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.smtp_password}
                    onChange={(e) => setFormData({ ...formData, smtp_password: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Email Remitente
                </label>
                <input
                  type="email"
                  value={formData.from_email}
                  onChange={(e) => setFormData({ ...formData, from_email: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                  placeholder="noreply@ejemplo.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Nombre Remitente (opcional)
                </label>
                <input
                  type="text"
                  value={formData.from_name}
                  onChange={(e) => setFormData({ ...formData, from_name: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                  placeholder="Mi Empresa"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 p-6 border-t border-slate-700">
              <button
                onClick={() => setShowModal(false)}
                className="px-6 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={saveCredentials}
                disabled={
                  !formData.smtp_host ||
                  !formData.smtp_user ||
                  !formData.smtp_password ||
                  !formData.from_email
                }
                className="px-6 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};
