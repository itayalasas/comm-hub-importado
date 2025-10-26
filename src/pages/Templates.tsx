import { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { TemplateEditor } from '../components/TemplateEditor';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { verifyApplicationOwnership } from '../lib/security';
import { useToast } from '../components/Toast';
import { Plus, Edit, Trash2, Eye, Code, FileText, Image, QrCode } from 'lucide-react';

interface Application {
  id: string;
  name: string;
}

interface Template {
  id: string;
  name: string;
  description: string | null;
  channel: string;
  subject: string | null;
  html_content: string;
  variables: any;
  is_active: boolean;
  application_id: string;
  has_attachment: boolean;
  attachment_variable: string | null;
  has_logo: boolean;
  logo_variable: string | null;
  has_qr: boolean;
  qr_variable: string | null;
  qr_position: string | null;
  template_type?: string;
  pdf_template_id?: string | null;
  pdf_filename_pattern?: string | null;
}

export const Templates = () => {
  const { user } = useAuth();
  const toast = useToast();
  const [applications, setApplications] = useState<Application[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedApp, setSelectedApp] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [previewData, setPreviewData] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    channel: 'email',
    subject: '',
    html_content: '',
    variables: [] as string[],
    has_attachment: false,
    attachment_variable: '',
    has_logo: false,
    logo_variable: '',
    has_qr: false,
    qr_variable: '',
    template_type: 'email',
    pdf_template_id: null as string | null,
    pdf_filename_pattern: '',
  });

  useEffect(() => {
    if (user) {
      loadApplications();
    }
  }, [user]);

  useEffect(() => {
    if (selectedApp) {
      loadTemplates(selectedApp);
    }
  }, [selectedApp]);

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
        .order('created_at', { ascending: false});

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

  const loadTemplates = async (appId: string) => {
    try {
      if (!user?.sub) return;

      const isOwner = await verifyApplicationOwnership(appId, user.sub);
      if (!isOwner) {
        console.error('Unauthorized access to application');
        return;
      }

      const { data, error } = await supabase
        .from('communication_templates')
        .select('*')
        .eq('application_id', appId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error('Error loading templates:', error);
    }
  };

  const extractVariables = (html: string): string[] => {
    const regex = /\{\{(\w+)\}\}/g;
    const matches = html.matchAll(regex);
    const vars = new Set<string>();
    for (const match of matches) {
      vars.add(match[1]);
    }
    return Array.from(vars);
  };

  const openEditor = (template?: Template) => {
    if (template) {
      setEditingTemplate(template);
      setFormData({
        name: template.name,
        description: template.description || '',
        channel: template.channel,
        subject: template.subject || '',
        html_content: template.html_content,
        variables: template.variables || [],
        has_attachment: template.has_attachment || false,
        attachment_variable: template.attachment_variable || '',
        has_logo: template.has_logo || false,
        logo_variable: template.logo_variable || '',
        has_qr: template.has_qr || false,
        qr_variable: template.qr_variable || '',
        template_type: (template as any).template_type || 'email',
        pdf_template_id: (template as any).pdf_template_id || null,
        pdf_filename_pattern: (template as any).pdf_filename_pattern || '',
      });
    } else {
      setEditingTemplate(null);
      setFormData({
        name: '',
        description: '',
        channel: 'email',
        subject: '',
        html_content: '',
        variables: [],
        has_attachment: false,
        attachment_variable: '',
        has_logo: false,
        logo_variable: '',
        has_qr: false,
        qr_variable: '',
        template_type: 'email',
        pdf_template_id: null,
        pdf_filename_pattern: '',
      });
    }
    setShowEditor(true);
  };

  const saveTemplate = async () => {
    if (!selectedApp || !formData.name || !formData.html_content) return;

    try {
      const variables = extractVariables(formData.html_content);

      if (editingTemplate) {
        const { error } = await supabase
          .from('communication_templates')
          .update({
            name: formData.name,
            description: formData.description || null,
            channel: formData.channel,
            subject: formData.subject || null,
            html_content: formData.html_content,
            variables: variables,
            has_attachment: formData.has_attachment,
            attachment_variable: formData.has_attachment ? formData.attachment_variable : null,
            has_logo: formData.has_logo,
            logo_variable: formData.has_logo ? formData.logo_variable : null,
            has_qr: formData.has_qr,
            qr_variable: formData.has_qr ? formData.qr_variable : null,
            template_type: formData.template_type,
            pdf_template_id: formData.pdf_template_id || null,
            pdf_filename_pattern: formData.template_type === 'pdf' ? formData.pdf_filename_pattern : null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingTemplate.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from('communication_templates').insert({
          application_id: selectedApp,
          name: formData.name,
          description: formData.description || null,
          channel: formData.channel,
          subject: formData.subject || null,
          html_content: formData.html_content,
          variables: variables,
          has_attachment: formData.has_attachment,
          attachment_variable: formData.has_attachment ? formData.attachment_variable : null,
          has_logo: formData.has_logo,
          logo_variable: formData.has_logo ? formData.logo_variable : null,
          has_qr: formData.has_qr,
          qr_variable: formData.has_qr ? formData.qr_variable : null,
          template_type: formData.template_type,
          pdf_template_id: formData.pdf_template_id || null,
          pdf_filename_pattern: formData.template_type === 'pdf' ? formData.pdf_filename_pattern : null,
        });

        if (error) throw error;
      }

      setShowEditor(false);
      loadTemplates(selectedApp);
    } catch (error) {
      console.error('Error saving template:', error);
    }
  };

  const confirmDeleteTemplate = async () => {
    if (!deleteConfirm) return;

    try {
      const { error } = await supabase
        .from('communication_templates')
        .delete()
        .eq('id', deleteConfirm);

      if (error) throw error;
      if (selectedApp) loadTemplates(selectedApp);
      toast.success('Template eliminado exitosamente');
      setDeleteConfirm(null);
    } catch (error) {
      console.error('Error deleting template:', error);
      toast.error('Error al eliminar el template');
    }
  };

  const openPreview = (template: Template) => {
    setEditingTemplate(template);
    const vars = template.variables || [];
    const initialData: any = {};
    vars.forEach((v: string) => {
      initialData[v] = '';
    });
    setPreviewData(initialData);
    setShowPreview(true);
  };

  const renderPreview = () => {
    if (!editingTemplate) return '';
    let html = editingTemplate.html_content;
    Object.keys(previewData).forEach((key) => {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      html = html.replace(regex, previewData[key] || `{{${key}}}`);
    });
    return html;
  };

  if (loading) {
    return (
      <Layout currentPage="templates">
        <div className="text-center py-12">
          <div className="text-slate-400">Cargando...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout currentPage="templates">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-white">Templates</h1>
          {selectedApp && (
            <button
              onClick={() => openEditor()}
              className="flex items-center space-x-2 px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors"
            >
              <Plus className="w-5 h-5" />
              <span>Nuevo Template</span>
            </button>
          )}
        </div>

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

            <div className="space-y-4">
              {templates.length === 0 ? (
                <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 p-8 text-center">
                  <Code className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-400 mb-4">No hay templates para esta aplicación</p>
                  <button
                    onClick={() => openEditor()}
                    className="px-6 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors"
                  >
                    Crear Primer Template
                  </button>
                </div>
              ) : (
                templates.map((template) => (
                  <div
                    key={template.id}
                    className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 p-6"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-white mb-2">{template.name}</h3>
                        {template.description && (
                          <p className="text-slate-400 mb-3">{template.description}</p>
                        )}
                        <div className="flex items-center space-x-4 text-sm">
                          <span className={`px-3 py-1 rounded-full ${
                            template.template_type === 'pdf'
                              ? 'bg-amber-500/10 text-amber-400'
                              : 'bg-cyan-500/10 text-cyan-400'
                          }`}>
                            {template.template_type === 'pdf' ? 'PDF' : 'Email'}
                          </span>
                          {template.has_attachment && (
                            <span className="flex items-center space-x-1 text-emerald-400" title="Genera PDF adjunto">
                              <FileText className="w-4 h-4" />
                              <span className="text-xs">PDF</span>
                            </span>
                          )}
                          {template.has_logo && (
                            <span className="flex items-center space-x-1 text-blue-400" title="Incluye logo">
                              <Image className="w-4 h-4" />
                              <span className="text-xs">Logo</span>
                            </span>
                          )}
                          {template.has_qr && (
                            <span className="flex items-center space-x-1 text-purple-400" title="Código QR">
                              <QrCode className="w-4 h-4" />
                              <span className="text-xs">QR</span>
                            </span>
                          )}
                          {template.variables && template.variables.length > 0 && (
                            <span className="text-slate-500">
                              Variables: {template.variables.join(', ')}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => openPreview(template)}
                          className="p-2 text-slate-400 hover:text-cyan-400 transition-colors"
                          title="Vista previa"
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => openEditor(template)}
                          className="p-2 text-slate-400 hover:text-cyan-400 transition-colors"
                          title="Editar"
                        >
                          <Edit className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(template.id)}
                          className="p-2 text-slate-400 hover:text-red-400 transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>

      {showEditor && selectedApp && (
        <TemplateEditor
          formData={formData}
          setFormData={setFormData}
          onSave={saveTemplate}
          onCancel={() => setShowEditor(false)}
          isEditing={!!editingTemplate}
          applicationId={selectedApp}
        />
      )}

      {showPreview && editingTemplate && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl border border-slate-700 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-700">
              <h2 className="text-xl font-bold text-white">Vista Previa: {editingTemplate.name}</h2>
            </div>
            <div className="p-6 space-y-4">
              {editingTemplate.variables && editingTemplate.variables.length > 0 && (
                <div className="bg-slate-900/50 rounded-lg p-4 space-y-3">
                  <h3 className="text-sm font-medium text-slate-300">Variables del Template</h3>
                  <div className="grid md:grid-cols-2 gap-3">
                    {editingTemplate.variables.map((variable: string) => (
                      <div key={variable}>
                        <label className="block text-xs text-slate-400 mb-1">{variable}</label>
                        <input
                          type="text"
                          value={previewData[variable] || ''}
                          onChange={(e) =>
                            setPreviewData({ ...previewData, [variable]: e.target.value })
                          }
                          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white text-sm focus:outline-none focus:border-cyan-500"
                          placeholder={`Valor para ${variable}`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-white rounded-lg p-6 min-h-[300px]">
                <div dangerouslySetInnerHTML={{ __html: renderPreview() }} />
              </div>

              <button
                onClick={() => setShowPreview(false)}
                className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-white mb-2">Eliminar Template</h3>
            <p className="text-slate-300 text-sm mb-6">
              ¿Estás seguro de que deseas eliminar este template? Esta acción no se puede deshacer.
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDeleteTemplate}
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
