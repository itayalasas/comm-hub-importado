import { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/Toast';
import { Server, Eye, EyeOff, Plus, Key, Copy, CheckCircle2 } from 'lucide-react';

interface Application {
  id: string;
  name: string;
  api_key: string;
}

interface EmailCredentials {
  id?: string;
  provider_type: 'smtp' | 'resend';
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_password: string;
  resend_api_key: string;
  from_email: string;
  from_name: string;
  is_active: boolean;
}

export const Settings = () => {
  const { user } = useAuth();
  const toast = useToast();
  const [applications, setApplications] = useState<Application[]>([]);
  const [selectedApp, setSelectedApp] = useState<string | null>(null);
  const [defaultApp, setDefaultApp] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<EmailCredentials | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showNewAppModal, setShowNewAppModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copiedKey, setCopiedKey] = useState(false);
  const [newAppData, setNewAppData] = useState({
    name: '',
    domain: '',
  });
  const [formData, setFormData] = useState<EmailCredentials>({
    provider_type: 'smtp',
    smtp_host: '',
    smtp_port: 587,
    smtp_user: '',
    smtp_password: '',
    resend_api_key: '',
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
        .select('id, name, api_key')
        .eq('user_id', user.sub)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setApplications(data || []);

      const { data: prefs } = await supabase
        .from('user_preferences')
        .select('default_application_id')
        .eq('user_id', user.sub)
        .maybeSingle();

      if (prefs?.default_application_id) {
        setDefaultApp(prefs.default_application_id);
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
          provider_type: data.provider_type || 'smtp',
          smtp_host: data.smtp_host || '',
          smtp_port: data.smtp_port || 587,
          smtp_user: data.smtp_user || '',
          smtp_password: data.smtp_password || '',
          resend_api_key: data.resend_api_key || '',
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
      const updateData: any = {
        provider_type: formData.provider_type,
        from_email: formData.from_email,
        from_name: formData.from_name || null,
        updated_at: new Date().toISOString(),
      };

      if (formData.provider_type === 'smtp') {
        updateData.smtp_host = formData.smtp_host;
        updateData.smtp_port = formData.smtp_port;
        updateData.smtp_user = formData.smtp_user;
        updateData.smtp_password = formData.smtp_password;
        updateData.resend_api_key = null;
      } else {
        updateData.resend_api_key = formData.resend_api_key;
        updateData.smtp_host = null;
        updateData.smtp_port = null;
        updateData.smtp_user = null;
        updateData.smtp_password = null;
      }

      if (credentials?.id) {
        const { error } = await supabase
          .from('email_credentials')
          .update(updateData)
          .eq('id', credentials.id);

        if (error) throw error;
        toast.success('Credenciales actualizadas exitosamente');
      } else {
        const { error } = await supabase.from('email_credentials').insert({
          application_id: selectedApp,
          ...updateData,
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
        provider_type: credentials.provider_type || 'smtp',
        smtp_host: credentials.smtp_host || '',
        smtp_port: credentials.smtp_port || 587,
        smtp_user: credentials.smtp_user || '',
        smtp_password: credentials.smtp_password || '',
        resend_api_key: credentials.resend_api_key || '',
        from_email: credentials.from_email,
        from_name: credentials.from_name,
        is_active: credentials.is_active,
      });
    } else {
      setFormData({
        provider_type: 'smtp',
        smtp_host: '',
        smtp_port: 587,
        smtp_user: '',
        smtp_password: '',
        resend_api_key: '',
        from_email: '',
        from_name: '',
        is_active: true,
      });
    }
    setShowModal(true);
  };

  const setAsDefault = async (appId: string) => {
    try {
      if (!user?.sub) {
        console.error('No user ID available');
        return;
      }

      const { error } = await supabase
        .from('user_preferences')
        .upsert(
          {
            user_id: user.sub,
            default_application_id: appId,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'user_id',
          }
        );

      if (error) {
        console.error('Error in upsert:', error);
        throw error;
      }

      setDefaultApp(appId);
      setSelectedApp(appId);
      toast.success('Aplicación por defecto actualizada');

      console.log('Default app set successfully:', appId);
    } catch (error) {
      console.error('Error setting default app:', error);
      toast.error('Error al guardar la configuración');
    }
  };

  const copyApiKey = (apiKey: string) => {
    navigator.clipboard.writeText(apiKey);
    setCopiedKey(true);
    toast.success('API Key copiada al portapapeles');
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const generateSecureKey = () => {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  };

  const createApplication = async () => {
    if (!newAppData.name || !user?.sub) return;

    try {
      const appId = crypto.randomUUID();
      const apiKey = `sk_${generateSecureKey()}`;

      const { data, error } = await supabase
        .from('applications')
        .insert({
          user_id: user.sub,
          name: newAppData.name,
          app_id: appId,
          domain: newAppData.domain || null,
          api_key: apiKey,
        })
        .select()
        .single();

      if (error) throw error;

      await setAsDefault(data.id);

      toast.success('Aplicación creada y marcada como favorita');
      setShowNewAppModal(false);
      setNewAppData({ name: '', domain: '' });
      loadApplications();
    } catch (error) {
      console.error('Error creating application:', error);
      toast.error('Error al crear la aplicación');
    }
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
        <div>
          <h1 className="text-3xl font-bold text-white">Configuración</h1>
          <p className="text-slate-400 mt-2">
            Gestiona tus aplicaciones, API keys y configuración de email
          </p>
        </div>

        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-2">
              <Key className="w-5 h-5 text-cyan-400" />
              <h3 className="text-lg font-semibold text-white">Aplicaciones y API Keys</h3>
            </div>
            <button
              onClick={() => setShowNewAppModal(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors text-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Nueva Aplicación</span>
            </button>
          </div>

          {applications.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-slate-400 mb-4">No tienes aplicaciones creadas</p>
              <button
                onClick={() => setShowNewAppModal(true)}
                className="px-6 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors"
              >
                Crear Primera Aplicación
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {applications.map((app) => (
                  <div
                    key={app.id}
                    className={`bg-slate-900/50 border rounded-lg p-4 transition-all ${
                      defaultApp === app.id
                        ? 'border-cyan-500 bg-cyan-500/5'
                        : 'border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <h4 className="text-white font-semibold">{app.name}</h4>
                        {defaultApp === app.id && (
                          <span className="flex items-center space-x-1 px-2 py-1 bg-cyan-500/20 text-cyan-400 text-xs rounded-full">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Por defecto</span>
                          </span>
                        )}
                      </div>
                      {defaultApp !== app.id && (
                        <button
                          onClick={() => setAsDefault(app.id)}
                          className="text-xs px-3 py-1 bg-slate-700 text-slate-300 rounded hover:bg-slate-600 transition-colors"
                        >
                          Marcar como predeterminada
                        </button>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div>
                        <div className="text-xs text-slate-500 mb-1">API Key</div>
                        <div className="flex items-center space-x-2">
                          <code className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded text-sm text-cyan-400 font-mono overflow-x-auto">
                            {app.api_key}
                          </code>
                          <button
                            onClick={() => copyApiKey(app.api_key)}
                            className="p-2 bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors"
                            title="Copiar API Key"
                          >
                            {copiedKey ? (
                              <CheckCircle2 className="w-4 h-4 text-green-400" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500 mb-1">ID de Aplicación</div>
                        <code className="block px-3 py-2 bg-slate-800 border border-slate-700 rounded text-xs text-slate-400 font-mono overflow-x-auto">
                          {app.id}
                        </code>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        {applications.length > 0 && (
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-2">
                <Server className="w-5 h-5 text-cyan-400" />
                <h3 className="text-lg font-semibold text-white">
                  Configuración de Email {credentials && `(${credentials.provider_type === 'smtp' ? 'SMTP' : 'Resend'})`}
                </h3>
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
                    <span>Configurar Email</span>
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
                <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-3 mb-3">
                  <div className="text-xs text-cyan-400 mb-1">Proveedor Activo</div>
                  <div className="text-sm text-white font-semibold">
                    {credentials.provider_type === 'smtp' ? 'SMTP' : 'Resend'}
                  </div>
                </div>

                {credentials.provider_type === 'smtp' ? (
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
                ) : (
                  <div className="grid md:grid-cols-2 gap-3">
                    <div className="bg-slate-900/50 rounded-lg p-3">
                      <div className="text-xs text-slate-500 mb-1">API Key</div>
                      <div className="text-sm text-white font-mono">••••••••{credentials.resend_api_key?.slice(-8)}</div>
                    </div>
                    <div className="bg-slate-900/50 rounded-lg p-3">
                      <div className="text-xs text-slate-500 mb-1">Email Remitente</div>
                      <div className="text-sm text-white font-mono">{credentials.from_email}</div>
                    </div>
                  </div>
                )}
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
                  No hay credenciales de email configuradas para esta aplicación
                </p>
                <button
                  onClick={openModal}
                  className="px-6 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors"
                >
                  Configurar Email
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {showNewAppModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-md">
            <div className="p-6 border-b border-slate-700">
              <h2 className="text-xl font-bold text-white">Nueva Aplicación</h2>
              <p className="text-sm text-slate-400 mt-1">
                Se marcará automáticamente como favorita
              </p>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Nombre de la Aplicación *
                </label>
                <input
                  type="text"
                  value={newAppData.name}
                  onChange={(e) => setNewAppData({ ...newAppData, name: e.target.value })}
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
                  value={newAppData.domain}
                  onChange={(e) => setNewAppData({ ...newAppData, domain: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                  placeholder="example.com"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 p-6 border-t border-slate-700">
              <button
                onClick={() => {
                  setShowNewAppModal(false);
                  setNewAppData({ name: '', domain: '' });
                }}
                className="px-6 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={createApplication}
                disabled={!newAppData.name}
                className="px-6 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Crear
              </button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-700">
              <h2 className="text-xl font-bold text-white">
                {credentials ? 'Editar Configuración de Email' : 'Configurar Email'}
              </h2>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-3">
                  Proveedor de Email
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, provider_type: 'smtp' })}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      formData.provider_type === 'smtp'
                        ? 'border-cyan-500 bg-cyan-500/10'
                        : 'border-slate-700 bg-slate-900/50 hover:border-slate-600'
                    }`}
                  >
                    <div className="text-white font-semibold mb-1">SMTP</div>
                    <div className="text-xs text-slate-400">Servidor SMTP tradicional</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, provider_type: 'resend' })}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      formData.provider_type === 'resend'
                        ? 'border-cyan-500 bg-cyan-500/10'
                        : 'border-slate-700 bg-slate-900/50 hover:border-slate-600'
                    }`}
                  >
                    <div className="text-white font-semibold mb-1">Resend</div>
                    <div className="text-xs text-slate-400">API moderna de email</div>
                  </button>
                </div>
              </div>

              {formData.provider_type === 'smtp' ? (
                <>
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
              </>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Resend API Key
                    </label>
                    <input
                      type="text"
                      value={formData.resend_api_key}
                      onChange={(e) => setFormData({ ...formData, resend_api_key: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500 font-mono"
                      placeholder="re_xxxxxxxxxxxx"
                    />
                    <p className="text-xs text-slate-400 mt-1">
                      Obtén tu API key en <a href="https://resend.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">resend.com/api-keys</a>
                    </p>
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
                      placeholder="noreply@tudominio.com"
                    />
                    <p className="text-xs text-slate-400 mt-1">
                      Debe ser una dirección de tu dominio verificado en Resend
                    </p>
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
                </>
              )}
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
                  formData.provider_type === 'smtp'
                    ? (!formData.smtp_host || !formData.smtp_user || !formData.smtp_password || !formData.from_email)
                    : (!formData.resend_api_key || !formData.from_email)
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
