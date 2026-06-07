import { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { PageLoader } from '../components/PageLoader';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/Toast';
import { useSubscriptionLimits } from '../hooks/useSubscriptionLimits';
import { UpgradeModal } from '../components/UpgradeModal';
import { Server, Eye, EyeOff, Plus, Key, Copy, CheckCircle2, Link, Lock, Trash2, RefreshCw, ExternalLink, MessageSquare, X, Loader2, AlertTriangle } from 'lucide-react';
import { configManager, getRuntimeConfig, buildFunctionsUrl } from '../lib/config';
import { db } from '../lib/db';
import { queryCount, queryMutate, querySelect } from '../lib/queryApi';
import { createOwnedApplication, loadOwnedApplicationsWithKeys } from '../lib/applicationQueries';

interface Application {
  id: string;
  name: string;
  api_key: string;
}

interface ApplicationDeleteSummary {
  templates_count: number;
  jobs_count: number;
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

interface EmbedCredential {
  id: string;
  username: string;
  label: string;
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
}

const isLocalHost = () => typeof window !== 'undefined' && ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);

interface WhatsAppConfig {
  id: string;
  application_id: string;
  phone_number_id: string;
  waba_id: string;
  access_token: string;
  display_name: string;
  is_active: boolean;
}

export const Settings = ({ tab = 'apps' }: { tab?: 'apps' | 'email' | 'embed' | 'whatsapp' }) => {
  const { user } = useAuth();
  const toast = useToast();
  const { checkApplicationLimit, refreshCounts, hasFeature } = useSubscriptionLimits();
  const [applications, setApplications] = useState<Application[]>([]);
  const [selectedApp, setSelectedApp] = useState<string | null>(null);
  const [defaultApp, setDefaultApp] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<EmailCredentials | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showNewAppModal, setShowNewAppModal] = useState(false);
  const [showDeleteAppModal, setShowDeleteAppModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [newAppData, setNewAppData] = useState({
    name: '',
    domain: '',
  });
  const [deleteAppTarget, setDeleteAppTarget] = useState<Application | null>(null);
  const [deleteAppSummary, setDeleteAppSummary] = useState<ApplicationDeleteSummary | null>(null);
  const [deleteAppConfirmName, setDeleteAppConfirmName] = useState('');
  const [deleteAppError, setDeleteAppError] = useState('');
  const [deleteAppPreviewLoading, setDeleteAppPreviewLoading] = useState(false);
  const [deleteAppLoading, setDeleteAppLoading] = useState(false);

  const isAdmin = user?.role === 'administrador' || user?.role === 'admin';

  // Embed credentials state
  const [embedCreds, setEmbedCreds] = useState<EmbedCredential[]>([]);
  const [embedLoading, setEmbedLoading] = useState(false);
  const [showEmbedModal, setShowEmbedModal] = useState(false);
  const [newEmbed, setNewEmbed] = useState({ username: '', password: '', label: '' });
  const [newEmbedError, setNewEmbedError] = useState('');
  const [newEmbedSaving, setNewEmbedSaving] = useState(false);
  const [showEmbedPass, setShowEmbedPass] = useState(false);
  const [generatedPass, setGeneratedPass] = useState('');

  // ── WhatsApp config state ────────────────────────────────────────────
  const [waConfig, setWaConfig] = useState<WhatsAppConfig | null>(null);
  const [, setWaConfigLoading] = useState(false);
  const [waConfigSaving, setWaConfigSaving] = useState(false);
  const [showWaModal, setShowWaModal] = useState(false);
  const [waForm, setWaForm] = useState({
    phone_number_id: '',
    waba_id: '',
    access_token: '',
    display_name: '',
  });
  const [showWaToken, setShowWaToken] = useState(false);

  // ── Per-app copied key tracking ──────────────────────────────────────
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);

  // Plan feature gates for email providers
  const canUseSmtp = hasFeature('configuracion_smtp');
  const canUseResend = hasFeature('acceso_api_resend');
  const [copiedReturnUrl, setCopiedReturnUrl] = useState(false);
  // Build the final frontend return URL dynamically so it works on any domain/environment
  const subscriptionReturnUrl = `${window.location.origin}/subscription/result`;
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
    if (user && tab === 'embed') {
      loadEmbedCreds();
    }
  }, [user, tab]);

  useEffect(() => {
    if (selectedApp && tab === 'whatsapp') {
      loadWaConfig(selectedApp);
    }
  }, [selectedApp, tab]);

  const provisionDefaultEmail = async (appId: string) => {
    try {
      await configManager.loadConfig();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const apiKey = getRuntimeConfig().apiKey || '';
      await fetch(buildFunctionsUrl('provision-default-email'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
          ...(apiKey ? { 'x-api-key': apiKey } : {}),
        },
        body: JSON.stringify({ application_id: appId }),
      });
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (!selectedApp) return;
    if (!canUseSmtp && !canUseResend) {
      // Auto-provision platform default email silently, then load to confirm active
      provisionDefaultEmail(selectedApp).then(() => loadCredentials(selectedApp));
    } else {
      loadCredentials(selectedApp);
    }
  }, [selectedApp, canUseSmtp, canUseResend]);

  const copyReturnUrl = () => {
    navigator.clipboard.writeText(subscriptionReturnUrl);
    setCopiedReturnUrl(true);
    toast.success('URL copiada al portapapeles');
    setTimeout(() => setCopiedReturnUrl(false), 2000);
  };

  const applicationManagementFetch = async (payload: Record<string, unknown>) => {
    await configManager.loadConfig();
    const apiKey = getRuntimeConfig().apiKey || '';
    if (isLocalHost()) {
      console.groupCollapsed('[settings] delete-application request');
      console.log('url:', buildFunctionsUrl('delete-application'));
      console.log('body:', payload);
      console.log('headers:', {
        'x-api-key': apiKey || '(none)',
      });
      console.groupEnd();
    }

    return fetch(buildFunctionsUrl('delete-application'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'x-api-key': apiKey } : {}),
      },
      body: JSON.stringify(payload),
    });
  };

  const loadApplications = async () => {
    try {
      if (!user?.sub) return;

      const apps = await loadOwnedApplicationsWithKeys(user.sub, user.tenant_id);
      setApplications(apps);

      const { data: prefs, error } = await querySelect<{ default_application_id: string | null }>({
        table: 'user_preferences',
        operation: 'select',
        select: 'default_application_id',
        filters: [{ column: 'user_id', op: 'eq', value: user.sub }],
        limit: 1,
      });

      if (error) throw error;

      const defaultApplicationId = prefs?.[0]?.default_application_id || null;
      if (defaultApplicationId) {
        setDefaultApp(defaultApplicationId);
        setSelectedApp(defaultApplicationId);
      } else if (apps.length > 0) {
        setSelectedApp(apps[0].id);
      }
    } catch {
      // ignore
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

      if (error) throw error;

      setCredentials(data as any);
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
    } catch {
      // ignore
    }
  };

  // ── WhatsApp config helpers ──────────────────────────────────────────

  const loadWaConfig = async (appId: string) => {
    setWaConfigLoading(true);
    try {
      const { data } = await db
        .from('whatsapp_configs')
        .select('*')
        .eq('application_id', appId)
        .maybeSingle();
      setWaConfig((data as WhatsAppConfig) || null);
    } finally {
      setWaConfigLoading(false);
    }
  };

  const saveWaConfig = async () => {
    const targetId = selectedApp;
    if (!targetId) return;
    if (!waForm.phone_number_id || !waForm.waba_id || !waForm.access_token) {
      toast.error('Phone Number ID, WABA ID y Access Token son requeridos.');
      return;
    }
    setWaConfigSaving(true);
    try {
      if (waConfig) {
        await db
          .from('whatsapp_configs')
          .update({ ...waForm, updated_at: new Date().toISOString() })
          .eq('id', waConfig.id);
      } else {
        await db.from('whatsapp_configs').insert({
          ...waForm,
          application_id: targetId,
          is_active: true,
        });
      }
      toast.success('Configuración de WhatsApp guardada');
      setShowWaModal(false);
      if (selectedApp && (tab === 'whatsapp')) loadWaConfig(selectedApp);
    } catch {
      toast.error('Error al guardar la configuración.');
    } finally {
      setWaConfigSaving(false);
    }
  };


  // Embed credential helpers

  const sha256 = async (text: string): Promise<string> => {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$';
    const arr = new Uint8Array(16);
    crypto.getRandomValues(arr);
    const pass = Array.from(arr).map(b => chars[b % chars.length]).join('');
    setNewEmbed(e => ({ ...e, password: pass }));
    setGeneratedPass(pass);
  };

  const parseJsonResponse = async <T,>(res: Response): Promise<T | null> => {
    const text = await res.text().catch(() => '');
    if (!text) return null;

    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error(text.slice(0, 200) || `HTTP ${res.status}`);
    }
  };

  const embedFetch = async (path: string, options: RequestInit = {}) => {
    await configManager.loadConfig();
    const { apiKey: runtimeApiKey, apiKeyUserEmbed } = getRuntimeConfig();
    const embedApiKey = runtimeApiKey || apiKeyUserEmbed || '';
    const userId = user?.sub?.trim() || '';
    if (!embedApiKey) {
      throw new Error('Missing API key for embed credentials');
    }
    if (!userId) {
      throw new Error('Missing user id for embed credentials');
    }

    return fetch(buildFunctionsUrl(`embed-credentials${path}`), {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': embedApiKey,
        'x-user-id': userId,
        ...options.headers,
      },
    });
  };

  const loadEmbedCreds = async () => {
    setEmbedLoading(true);
    try {
      const res = await embedFetch('');
      const data = await parseJsonResponse<EmbedCredential[] | { data?: EmbedCredential[] }>(res);
      if (!res.ok) {
        throw new Error(
          typeof data === 'object' && data && 'error' in data && data.error
            ? String((data as any).error)
            : `HTTP ${res.status}`,
        );
      }
      setEmbedCreds(Array.isArray(data) ? data : []);
    } catch {
      setEmbedCreds([]);
    } finally {
      setEmbedLoading(false);
    }
  };

  const saveEmbedCred = async () => {
    if (!newEmbed.username.trim() || !newEmbed.password) {
      setNewEmbedError('Usuario y contraseña son requeridos.');
      return;
    }
    setNewEmbedSaving(true);
    setNewEmbedError('');
    try {
      const hash = await sha256(newEmbed.password);
      const res = await embedFetch('', {
        method: 'POST',
        body: JSON.stringify({
          username: newEmbed.username.trim(),
          password_hash: hash,
          label: newEmbed.label.trim() || newEmbed.username.trim(),
        }),
      });
      const data = await parseJsonResponse<{ error?: string }>(res);
      if (!res.ok) {
        if (data?.error === 'username_taken') setNewEmbedError('Ese nombre de usuario ya existe.');
        else setNewEmbedError('Error al guardar. Intentá de nuevo.');
        return;
      }
      setShowEmbedModal(false);
      setNewEmbed({ username: '', password: '', label: '' });
      setGeneratedPass('');
      toast.success('Credencial creada');
      loadEmbedCreds();
    } catch {
      setNewEmbedError('Error al guardar. Intentá de nuevo.');
    } finally {
      setNewEmbedSaving(false);
    }
  };

  const deleteEmbedCred = async (id: string) => {
    await embedFetch(`/${id}`, { method: 'DELETE' });
    setEmbedCreds(prev => prev.filter(c => c.id !== id));
    toast.success('Credencial eliminada');
  };

  const toggleEmbedCred = async (id: string, current: boolean) => {
    await embedFetch(`/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active: !current }),
    });
    setEmbedCreds(prev => prev.map(c => c.id === id ? { ...c, is_active: !current } : c));
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
    } catch {
      toast.error('Error al guardar las credenciales');
    }
  };

  const openModal = () => {
    // Resolve default provider: respect saved value only if that provider is still allowed by plan
    const resolveProvider = (saved?: 'smtp' | 'resend'): 'smtp' | 'resend' => {
      if (saved === 'resend' && canUseResend) return 'resend';
      if (saved === 'smtp'   && canUseSmtp)   return 'smtp';
      // Fallback: pick first allowed, or smtp as last resort
      if (canUseSmtp)   return 'smtp';
      if (canUseResend) return 'resend';
      return 'smtp';
    };

    if (credentials) {
      setFormData({
        id: credentials.id,
        provider_type: resolveProvider(credentials.provider_type),
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
        provider_type: resolveProvider(),
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
      if (!user?.sub) return;

      const { error } = await queryMutate({
        table: 'user_preferences',
        operation: 'upsert',
        data: {
          user_id: user.sub,
          default_application_id: appId,
          updated_at: new Date().toISOString(),
        },
        onConflict: 'user_id',
      });

      if (error) throw error;

      setDefaultApp(appId);
      setSelectedApp(appId);
      toast.success('Aplicación predeterminada actualizada');
    } catch {
      toast.error('Error al guardar la configuración');
    }
  };

  const copyApiKey = (apiKey: string, appId?: string) => {
    navigator.clipboard.writeText(apiKey);
    if (appId) setCopiedKeyId(appId);
    toast.success('API Key copiada al portapapeles');
    setTimeout(() => setCopiedKeyId((current) => (current === appId ? null : current)), 2000);
  };

  const handleNewApplicationClick = () => {
    const limitCheck = checkApplicationLimit();

    if (limitCheck.limitReached) {
      setShowUpgradeModal(true);
    } else {
      setShowNewAppModal(true);
    }
  };

  const createApplication = async () => {
    if (!newAppData.name || !user?.sub) return;

    const normalizedNewName = normalizeApplicationName(newAppData.name);
    const duplicateApp = applications.some((app) => normalizeApplicationName(app.name) === normalizedNewName);
    if (duplicateApp) {
      toast.error('Ya existe una aplicacion con ese nombre');
      return;
    }

    const limitCheck = checkApplicationLimit();
    if (limitCheck.limitReached) {
      setShowUpgradeModal(true);
      return;
    }

    try {
      const createdApp = await createOwnedApplication({
        ownerId: user.sub,
        tenantId: user.tenant_id,
        name: newAppData.name,
        domain: newAppData.domain,
        environment: 'development',
      });

      await setAsDefault(createdApp.id);
      await refreshCounts();

      toast.success('Aplicación creada y marcada como favorita');
      setShowNewAppModal(false);
      setNewAppData({ name: '', domain: '' });
      await loadApplications();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al crear la aplicación');
    }
  };

  const normalizeApplicationName = (value: string) => value.trim().toLowerCase();

  const openDeleteApplicationModal = async (app: Application) => {
    setDeleteAppTarget(app);
    setDeleteAppSummary(null);
    setDeleteAppConfirmName('');
    setDeleteAppError('');
    setDeleteAppPreviewLoading(true);
    setShowDeleteAppModal(true);

    try {
      if (isLocalHost()) {
        console.groupCollapsed('[settings] delete-application preview requests');
        console.log('application_id:', app.id);
        console.table([
          {
            table: 'communication_templates',
            operation: 'select',
            select: 'id',
            filter: `application_id eq ${app.id}`,
          },
          {
            table: 'campaign_jobs',
            operation: 'select',
            select: 'id',
            filter: `application_id eq ${app.id}`,
          },
        ]);
        console.groupEnd();
      }
      const [templatesResult, jobsResult] = await Promise.all([
        queryCount({
          table: 'communication_templates',
          operation: 'select',
          select: 'id',
          filters: [{ column: 'application_id', op: 'eq', value: app.id }],
        }),
        queryCount({
          table: 'campaign_jobs',
          operation: 'select',
          select: 'id',
          filters: [{ column: 'application_id', op: 'eq', value: app.id }],
        }),
      ]);

      if (templatesResult.error) throw templatesResult.error;
      if (jobsResult.error) throw jobsResult.error;

      setDeleteAppSummary({
        templates_count: templatesResult.count,
        jobs_count: jobsResult.count,
      });
    } catch (error) {
      setDeleteAppError(error instanceof Error ? error.message : 'No se pudo cargar la información de la aplicación');
    } finally {
      setDeleteAppPreviewLoading(false);
    }
  };

  const closeDeleteApplicationModal = () => {
    if (deleteAppLoading) return;
    setShowDeleteAppModal(false);
    setDeleteAppTarget(null);
    setDeleteAppSummary(null);
    setDeleteAppConfirmName('');
    setDeleteAppError('');
    setDeleteAppPreviewLoading(false);
  };

  const confirmDeleteApplication = async () => {
    if (!deleteAppTarget || deleteAppLoading || deleteAppPreviewLoading) return;

    if (normalizeApplicationName(deleteAppConfirmName) !== normalizeApplicationName(deleteAppTarget.name)) {
      setDeleteAppError('Escribe el nombre exacto de la aplicación para confirmar.');
      return;
    }

    setDeleteAppLoading(true);
    setDeleteAppError('');

    try {
      const response = await applicationManagementFetch(
        {
          application_id: deleteAppTarget.id,
          confirm_name: deleteAppConfirmName.trim(),
        },
      );

      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result?.success) {
        throw new Error(result?.error?.message || result?.error || 'No se pudo eliminar la aplicación');
      }

      const deletedTemplates = result.data?.dependency_summary?.templates_count ?? 0;
      const deletedJobs = result.data?.dependency_summary?.jobs_count ?? 0;

      setShowDeleteAppModal(false);
      setDeleteAppTarget(null);
      setDeleteAppSummary(null);
      setDeleteAppConfirmName('');
      setDeleteAppError('');
      setSelectedApp(null);
      setCredentials(null);

      await refreshCounts();
      await loadApplications();

      if (deletedTemplates > 0 || deletedJobs > 0) {
        toast.success('Aplicación eliminada y dependencias limpiadas');
      } else {
        toast.success('Aplicación eliminada');
      }
    } catch (error) {
      setDeleteAppError(error instanceof Error ? error.message : 'No se pudo eliminar la aplicación');
    } finally {
      setDeleteAppLoading(false);
    }
  };

  const currentPageSlug = tab === 'email' ? 'settings-email' : tab === 'embed' ? 'settings-embed' : 'settings-apps';
  const pageTitle = tab === 'email' ? 'Correo Electrónico' : tab === 'embed' ? 'Acceso al Embed' : 'Aplicaciones';
  const pageDesc = tab === 'email'
    ? 'Configura el proveedor de email para cada aplicación'
    : tab === 'embed'
    ? 'Genera credenciales para proteger el acceso al Marketplace embebido'
    : 'Gestiona tus aplicaciones y API keys';

  if (loading) {
    return (
      <Layout currentPage={currentPageSlug}>
        <PageLoader />
      </Layout>
    );
  }

  return (
    <Layout currentPage={currentPageSlug}>
      <div className="space-y-4 sm:space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">{pageTitle}</h1>
          <p className="text-sm sm:text-base text-slate-400 mt-2">{pageDesc}</p>
        </div>

        {tab === 'apps' && (
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 sm:mb-6">
            <div className="flex items-center space-x-2">
              <Key className="w-5 h-5 text-cyan-400" />
              <h3 className="text-base sm:text-lg font-semibold text-white">Aplicaciones y API Keys</h3>
            </div>
            <button
              onClick={handleNewApplicationClick}
              className="flex items-center justify-center space-x-2 px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors text-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Nueva Aplicación</span>
            </button>
          </div>

          {applications.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-slate-400 mb-4">No tienes aplicaciones creadas</p>
              <button
                onClick={handleNewApplicationClick}
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
                            onClick={() => copyApiKey(app.api_key, app.id)}
                            className="p-2 bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors"
                            title="Copiar API Key"
                          >
                            {copiedKeyId === app.id ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
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
                    <div className="flex justify-end mt-4">
                      <button
                        onClick={() => openDeleteApplicationModal(app)}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-red-500/20 bg-red-500/10 text-red-300 hover:bg-red-500/15 hover:text-red-200 transition-colors text-xs font-semibold"
                        title="Eliminar aplicación"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Eliminar
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
        )}

        {tab === 'email' && applications.length > 0 && (
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-2">
                <Server className="w-5 h-5 text-cyan-400" />
                <h3 className="text-lg font-semibold text-white">
                  Configuración de Email
                  {!canUseSmtp && !canUseResend
                    ? ' (Plataforma)'
                    : credentials
                    ? ` (${credentials.provider_type === 'smtp' ? 'SMTP' : 'Resend'})`
                    : ''}
                </h3>
              </div>
              {/* Only show edit button when the plan allows custom provider config */}
              {(canUseSmtp || canUseResend) && (
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
              )}
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

            {/* Plan uses platform email - show locked status only */}
            {!canUseSmtp && !canUseResend ? (
              <div className="flex items-start gap-4 bg-slate-900/50 border border-slate-700/60 rounded-xl p-5">
                <div className="w-10 h-10 flex-shrink-0 rounded-full bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white mb-1">Correo configurado por la plataforma</p>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Los envíos de email para esta aplicación están gestionados por la plataforma.
                    Para configurar tu propio proveedor de email, actualiza tu plan.
                  </p>
                  {isAdmin && (
                    <button
                      onClick={() => setShowUpgradeModal(true)}
                      className="mt-3 text-xs text-cyan-400 hover:text-cyan-300 underline decoration-cyan-400/40 transition-colors"
                    >
                      Ver planes disponibles
                    </button>
                  )}
                </div>
              </div>
            ) : credentials ? (
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
                      <div className="text-xs text-slate-500 mb-1">Clave API</div>
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

        {/* Embed credentials tab */}
        {tab === 'embed' && (
          <div className="space-y-4">
            {/* Info banner */}
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 p-4 sm:p-6">
              <div className="flex items-center gap-2 mb-3">
                <Lock className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base sm:text-lg font-semibold text-white">Credenciales del Marketplace embebido</h3>
              </div>
              <p className="text-sm text-slate-400 mb-4 leading-relaxed">
                Generá un usuario y contraseña para cada sistema que necesite acceder al Marketplace.
                Al abrir el embed, se pedirán estas credenciales antes de mostrar los conectores.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                <div className="flex-1 bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2">
                  <p className="text-[10px] text-slate-500 mb-0.5">URL del embed</p>
                  <code className="text-xs text-cyan-400 break-all">{window.location.origin}/embed/marketplace</code>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/embed/marketplace`); toast.success('URL copiada'); }}
                    className="flex items-center gap-1.5 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-medium transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5" /> Copiar URL
                  </button>
                  <a
                    href={`${window.location.origin}/embed/marketplace`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-medium transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Abrir
                  </a>
                </div>
              </div>
            </div>

            {/* Credentials list */}
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-sm font-semibold text-white">Usuarios de acceso</h3>
                </div>
                <div className="flex gap-2">
                  <button onClick={loadEmbedCreds} className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors">
                    <RefreshCw className={`w-4 h-4 ${embedLoading ? 'animate-spin' : ''}`} />
                  </button>
                  <button
                    onClick={() => { setShowEmbedModal(true); setNewEmbed({ username: '', password: '', label: '' }); setGeneratedPass(''); setNewEmbedError(''); }}
                    className="flex items-center gap-2 px-3 py-1.5 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg text-xs font-semibold transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Nueva credencial
                  </button>
                </div>
              </div>

              {embedLoading ? (
                <div className="text-center py-6 text-slate-500 text-sm">Cargando...</div>
              ) : embedCreds.length === 0 ? (
                <div className="text-center py-8">
                  <Lock className="w-8 h-8 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400 text-sm mb-1">Sin credenciales aún</p>
                  <p className="text-slate-600 text-xs">Creá una para proteger el acceso al embed</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {embedCreds.map(cred => (
                    <div key={cred.id} className="flex items-center gap-3 bg-slate-900/50 rounded-xl border border-slate-700/50 px-4 py-3">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${cred.is_active ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-white truncate">{cred.username}</span>
                          {cred.label && cred.label !== cred.username && (
                            <span className="text-xs text-slate-500 truncate">({cred.label})</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          {cred.last_used_at ? (
                            <span className="text-[10px] text-slate-600">Último uso: {new Date(cred.last_used_at).toLocaleDateString('es')}</span>
                          ) : (
                            <span className="text-[10px] text-slate-700">Sin uso registrado</span>
                          )}
                          <span className="text-[10px] text-slate-700">Creado: {new Date(cred.created_at).toLocaleDateString('es')}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => toggleEmbedCred(cred.id, cred.is_active)}
                          className={`px-2 py-1 rounded-lg text-[10px] font-semibold transition-colors ${cred.is_active ? 'bg-emerald-500/10 text-emerald-400 hover:bg-red-500/10 hover:text-red-400' : 'bg-slate-700 text-slate-500 hover:bg-emerald-500/10 hover:text-emerald-400'}`}
                        >
                          {cred.is_active ? 'Activo' : 'Inactivo'}
                        </button>
                        <button onClick={() => deleteEmbedCred(cred.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-600 hover:text-red-400 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Subscription return URL - visible to admins on email tab */}
        {tab === 'email' && isAdmin && (
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-2">
              <Link className="w-5 h-5 text-cyan-400" />
              <h3 className="text-base sm:text-lg font-semibold text-white">URL final de suscripción</h3>
            </div>
            <p className="text-sm text-slate-400 mb-4 leading-relaxed">
              Usá esta URL como <span className="text-slate-300 font-mono text-xs">return_url</span> del checkout gestionado.
              AuthSystem se encarga del <span className="text-slate-300 font-mono text-xs">back_url</span> técnico de Mercado Pago.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-cyan-400 font-mono overflow-x-auto whitespace-nowrap">
                {subscriptionReturnUrl}
              </code>
              <button
                onClick={copyReturnUrl}
                className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-semibold transition-colors"
                title="Copiar URL"
              >
                {copiedReturnUrl ? (
                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
                {copiedReturnUrl ? 'Copiado' : 'Copiar'}
              </button>
            </div>
          </div>
        )}
      </div>

      {showDeleteAppModal && deleteAppTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl border border-slate-700 w-full max-w-lg overflow-hidden shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-slate-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Eliminar aplicación</h2>
                  <p className="text-xs text-slate-400 mt-0.5">Esta acción no se puede deshacer</p>
                </div>
              </div>
              <button
                onClick={closeDeleteApplicationModal}
                disabled={deleteAppLoading}
                className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto">
              <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-4">
                <div className="text-xs uppercase tracking-wider text-slate-500">Aplicación</div>
                <div className="mt-1 text-lg font-semibold text-white">{deleteAppTarget.name}</div>
                <div className="mt-2 text-xs text-slate-500 break-all">
                  ID: <span className="text-cyan-400">{deleteAppTarget.id}</span>
                </div>
              </div>

              {deleteAppPreviewLoading ? (
                <div className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-900/50 p-4">
                  <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
                  <div>
                    <p className="text-sm font-semibold text-white">Cargando dependencias...</p>
                    <p className="text-xs text-slate-400">Revisando templates y jobs asociados</p>
                  </div>
                </div>
              ) : deleteAppSummary ? (
                <div className={`rounded-xl border p-4 ${deleteAppSummary.templates_count > 0 || deleteAppSummary.jobs_count > 0 ? 'border-amber-500/25 bg-amber-500/10' : 'border-slate-700 bg-slate-900/50'}`}>
                  <div className="flex items-start gap-3">
                    <AlertTriangle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${deleteAppSummary.templates_count > 0 || deleteAppSummary.jobs_count > 0 ? 'text-amber-400' : 'text-emerald-400'}`} />
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {deleteAppSummary.templates_count > 0 || deleteAppSummary.jobs_count > 0
                          ? 'Se eliminarán también los datos asociados'
                          : 'No se detectaron templates ni jobs asociados'}
                      </p>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                        {deleteAppSummary.templates_count} templates y {deleteAppSummary.jobs_count} jobs serán eliminados junto con la aplicación.
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Escribe el nombre de la aplicación para confirmar
                </label>
                <input
                  type="text"
                  value={deleteAppConfirmName}
                  onChange={(e) => {
                    setDeleteAppConfirmName(e.target.value);
                    setDeleteAppError('');
                  }}
                  placeholder={deleteAppTarget.name}
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-red-500 transition-colors"
                />
              </div>

              {deleteAppError && (
                <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3">
                  <p className="text-sm text-red-300">{deleteAppError}</p>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 p-5 border-t border-slate-700">
              <button
                onClick={closeDeleteApplicationModal}
                disabled={deleteAppLoading}
                className="px-5 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => { void confirmDeleteApplication(); }}
                disabled={
                  deleteAppLoading ||
                  deleteAppPreviewLoading ||
                  !deleteAppTarget ||
                  normalizeApplicationName(deleteAppConfirmName) !== normalizeApplicationName(deleteAppTarget.name)
                }
                className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-bold transition-colors disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed"
              >
                {deleteAppLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                {deleteAppLoading ? 'Eliminando...' : 'Eliminar aplicación'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showEmbedModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl border border-slate-700 w-full max-w-md overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-slate-700">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-cyan-400" />
                <h2 className="text-base font-bold text-white">Nueva credencial de embed</h2>
              </div>
              <button onClick={() => setShowEmbedModal(false)} className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Etiqueta (para identificarla)</label>
                <input
                  type="text"
                  value={newEmbed.label}
                  onChange={e => setNewEmbed(d => ({ ...d, label: e.target.value }))}
                  placeholder="Ej: CRM Principal, Sistema de Ventas"
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Nombre de usuario</label>
                <input
                  type="text"
                  value={newEmbed.username}
                  onChange={e => { setNewEmbed(d => ({ ...d, username: e.target.value })); setNewEmbedError(''); }}
                  placeholder="crm_principal"
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors"
                />
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Contraseña</label>
                  <button onClick={generatePassword} className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1">
                    <RefreshCw className="w-3 h-3" /> Generar automática
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showEmbedPass ? 'text' : 'password'}
                    value={newEmbed.password}
                    onChange={e => { setNewEmbed(d => ({ ...d, password: e.target.value })); setGeneratedPass(''); }}
                    placeholder="••••••••"
                    className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm placeholder-slate-600 pr-10 focus:outline-none focus:border-cyan-500 transition-colors font-mono"
                  />
                  <button type="button" onClick={() => setShowEmbedPass(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                    {showEmbedPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {generatedPass && (
                  <div className="flex items-center justify-between bg-slate-900/60 border border-cyan-500/20 rounded-lg px-3 py-2">
                    <code className="text-xs text-cyan-400 font-mono">{generatedPass}</code>
                    <button
                      onClick={() => { navigator.clipboard.writeText(generatedPass); toast.success('Contraseña copiada'); }}
                      className="text-slate-500 hover:text-slate-300 transition-colors ml-2"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                <p className="text-[11px] text-slate-600">Guardá la contraseña ahora — no se puede recuperar después.</p>
              </div>

              {newEmbedError && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  <p className="text-xs text-red-400">{newEmbedError}</p>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button onClick={() => setShowEmbedModal(false)} className="flex-1 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium transition-colors">
                  Cancelar
                </button>
                <button
                  onClick={saveEmbedCred}
                  disabled={newEmbedSaving}
                  className="flex-1 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-600 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-bold transition-colors"
                >
                  {newEmbedSaving ? 'Guardando...' : 'Crear credencial'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
                  {/* SMTP option */}
                  <div className="relative">
                    <button
                      type="button"
                      disabled={!canUseSmtp}
                      onClick={() => canUseSmtp && setFormData({ ...formData, provider_type: 'smtp' })}
                      className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                        !canUseSmtp
                          ? 'border-slate-700/50 bg-slate-900/30 opacity-50 cursor-not-allowed'
                          : formData.provider_type === 'smtp'
                          ? 'border-cyan-500 bg-cyan-500/10'
                          : 'border-slate-700 bg-slate-900/50 hover:border-slate-600'
                      }`}
                    >
                      <div className={`font-semibold mb-1 ${!canUseSmtp ? 'text-slate-500' : 'text-white'}`}>SMTP</div>
                      <div className="text-xs text-slate-400">Servidor SMTP tradicional</div>
                    </button>
                    {!canUseSmtp && (
                      <div className="absolute top-2 right-2">
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/30 text-amber-400">
                          Plan superior
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Resend option */}
                  <div className="relative">
                    <button
                      type="button"
                      disabled={!canUseResend}
                      onClick={() => canUseResend && setFormData({ ...formData, provider_type: 'resend' })}
                      className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                        !canUseResend
                          ? 'border-slate-700/50 bg-slate-900/30 opacity-50 cursor-not-allowed'
                          : formData.provider_type === 'resend'
                          ? 'border-cyan-500 bg-cyan-500/10'
                          : 'border-slate-700 bg-slate-900/50 hover:border-slate-600'
                      }`}
                    >
                      <div className={`font-semibold mb-1 ${!canUseResend ? 'text-slate-500' : 'text-white'}`}>Resend</div>
                      <div className="text-xs text-slate-400">API moderna de email</div>
                    </button>
                    {!canUseResend && (
                      <div className="absolute top-2 right-2">
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/30 text-amber-400">
                          Plan superior
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Inline upgrade hint when a provider is blocked */}
                {(!canUseSmtp || !canUseResend) && (
                  <p className="mt-2 text-xs text-slate-500">
                    Algunas opciones requieren un plan superior.{' '}
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => { setShowModal(false); setShowUpgradeModal(true); }}
                        className="text-cyan-400 hover:text-cyan-300 underline decoration-cyan-400/40 transition-colors"
                      >
                        Actualizar plan
                      </button>
                    )}
                  </p>
                )}
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
                      Clave API de Resend
                    </label>
                    <input
                      type="text"
                      value={formData.resend_api_key}
                      onChange={(e) => setFormData({ ...formData, resend_api_key: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500 font-mono"
                      placeholder="re_xxxxxxxxxxxx"
                    />
                    <p className="text-xs text-slate-400 mt-1">
                      Obtén tu clave API en <a href="https://resend.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">resend.com/api-keys</a>
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

      {/* ── WhatsApp config modal ── */}
      {showWaModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl border border-slate-700 w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-slate-700">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-emerald-400" />
                <h2 className="text-base font-bold text-white">
                  {waConfig ? 'Editar' : 'Configurar'} WhatsApp Business
                </h2>
              </div>
              <button onClick={() => setShowWaModal(false)} className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors">
                <span className="text-lg leading-none">×</span>
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Display Name</label>
                <input
                  type="text"
                  value={waForm.display_name}
                  onChange={e => setWaForm(f => ({ ...f, display_name: e.target.value }))}
                  placeholder="Mi negocio"
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Phone Number ID <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  value={waForm.phone_number_id}
                  onChange={e => setWaForm(f => ({ ...f, phone_number_id: e.target.value }))}
                  placeholder="123456789012345"
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-colors font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">WABA ID <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  value={waForm.waba_id}
                  onChange={e => setWaForm(f => ({ ...f, waba_id: e.target.value }))}
                  placeholder="123456789012345"
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-colors font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Access Token <span className="text-red-400">*</span></label>
                <div className="relative">
                  <input
                    type={showWaToken ? 'text' : 'password'}
                    value={waForm.access_token}
                    onChange={e => setWaForm(f => ({ ...f, access_token: e.target.value }))}
                    placeholder="EAA…"
                    className="w-full px-4 py-2.5 pr-10 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-colors font-mono"
                  />
                  <button type="button" onClick={() => setShowWaToken(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                    {showWaToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-600">Token permanente de usuario de sistema. No expira.</p>
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setShowWaModal(false)} className="flex-1 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium transition-colors">
                  Cancelar
                </button>
                <button
                  onClick={saveWaConfig}
                  disabled={waConfigSaving}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm font-bold transition-colors"
                >
                  {waConfigSaving ? 'Guardando…' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        currentLimit={checkApplicationLimit().maxLimit}
        featureName="aplicaciones"
        featureCode="max_applications"
      />
    </Layout>
  );
};


