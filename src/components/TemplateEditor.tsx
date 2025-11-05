import { useState, useEffect } from 'react';
import { X, Eye, Code, FileText, Image, QrCode, Plus, Trash2, Maximize2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useToast } from './Toast';
import { HTMLEditor } from './HTMLEditor';

interface TemplateEditorProps {
  formData: any;
  setFormData: (data: any) => void;
  onSave: () => void;
  onCancel: () => void;
  isEditing: boolean;
  applicationId: string;
}

interface PredefinedVariable {
  id?: string;
  name: string;
  description: string;
  example: string;
}

const defaultVariables: PredefinedVariable[] = [
  { name: 'client_name', example: 'Juan Pérez', description: 'Nombre del cliente' },
  { name: 'client_email', example: 'juan@ejemplo.com', description: 'Email del cliente' },
  { name: 'client_phone', example: '+52 555 1234', description: 'Teléfono del cliente' },
  { name: 'ticket_number', example: 'TK-5678', description: 'Número de ticket' },
  { name: 'invoice_total', example: '$1,500.00', description: 'Total de factura' },
  { name: 'company_name', example: 'Mi Empresa', description: 'Nombre de la empresa' },
  { name: 'company_url', example: 'https://cmpro.com', description: 'URL de la empresa' },
];

export const TemplateEditor = ({ formData, setFormData, onSave, onCancel, isEditing, applicationId }: TemplateEditorProps) => {
  const toast = useToast();
  const [showPreview, setShowPreview] = useState(false);
  const [showHTMLEditor, setShowHTMLEditor] = useState(false);
  const [customVariables, setCustomVariables] = useState<PredefinedVariable[]>([]);
  const [showAddVariable, setShowAddVariable] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [pdfTemplates, setPdfTemplates] = useState<any[]>([]);
  const [detectedVariables, setDetectedVariables] = useState<Set<string>>(new Set());
  const [newVariable, setNewVariable] = useState<PredefinedVariable>({
    name: '',
    description: '',
    example: '',
  });

  useEffect(() => {
    loadCustomVariables();
    loadPdfTemplates();
  }, [applicationId]);

  useEffect(() => {
    if (formData.html_content) {
      extractVariablesFromTemplate(formData.html_content);
    }
  }, [formData.html_content]);

  const extractVariablesFromTemplate = (html: string) => {
    const variables = new Set<string>();

    const simpleVarRegex = /\{\{([a-zA-Z0-9_.@]+)\}\}/g;
    let match;
    while ((match = simpleVarRegex.exec(html)) !== null) {
      const varName = match[1];
      if (!varName.startsWith('@') && varName !== 'this') {
        variables.add(varName);
      }
    }

    const eachRegex = /\{\{#each\s+([a-zA-Z0-9_.]+)\}\}/g;
    while ((match = eachRegex.exec(html)) !== null) {
      variables.add(match[1] + ' (array)');
    }

    const ifRegex = /\{\{#if\s+([a-zA-Z0-9_.]+)\}\}/g;
    while ((match = ifRegex.exec(html)) !== null) {
      variables.add(match[1]);
    }

    setDetectedVariables(variables);
  };

  const loadPdfTemplates = async () => {
    if (!applicationId) return;

    const { data, error } = await supabase
      .from('communication_templates')
      .select('id, name, description')
      .eq('application_id', applicationId)
      .eq('template_type', 'pdf')
      .eq('is_active', true)
      .order('name');

    if (!error && data) {
      setPdfTemplates(data);
    }
  };

  const loadCustomVariables = async () => {
    if (!applicationId) return;

    try {
      const { data, error } = await supabase
        .from('predefined_variables')
        .select('*')
        .eq('application_id', applicationId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setCustomVariables(data || []);
    } catch (error) {
      console.error('Error loading custom variables:', error);
    }
  };

  const saveCustomVariable = async () => {
    if (!newVariable.name || !newVariable.description) {
      toast.warning('Por favor completa el nombre y la descripción de la variable');
      return;
    }

    try {
      const { error } = await supabase.from('predefined_variables').insert({
        application_id: applicationId,
        name: newVariable.name,
        description: newVariable.description,
        example: newVariable.example,
      });

      if (error) throw error;

      await loadCustomVariables();
      setNewVariable({ name: '', description: '', example: '' });
      setShowAddVariable(false);
      toast.success('Variable guardada exitosamente');
    } catch (error: any) {
      console.error('Error saving custom variable:', error);
      if (error.code === '23505') {
        toast.error('Ya existe una variable con ese nombre');
      } else {
        toast.error('Error al guardar la variable. Por favor intenta de nuevo');
      }
    }
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;

    try {
      const { error } = await supabase
        .from('predefined_variables')
        .delete()
        .eq('id', deleteConfirm);

      if (error) throw error;
      await loadCustomVariables();
      toast.success('Variable eliminada exitosamente');
      setDeleteConfirm(null);
    } catch (error) {
      console.error('Error deleting custom variable:', error);
      toast.error('Error al eliminar la variable');
    }
  };

  const insertVariable = (varName: string) => {
    const variable = `{{${varName}}}`;
    setFormData({
      ...formData,
      html_content: formData.html_content + variable,
    });
  };

  const getPreviewHtml = () => {
    let html = formData.html_content;
    const allVariables = [...defaultVariables, ...customVariables];
    allVariables.forEach((variable) => {
      const regex = new RegExp(`\\{\\{${variable.name}\\}\\}`, 'g');
      html = html.replace(regex, variable.example);
    });
    return html;
  };

  const allVariables = [...defaultVariables, ...customVariables];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-7xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <h2 className="text-2xl font-bold text-white">
            {isEditing ? 'Editar Template' : 'Nuevo Template'}
          </h2>
          <button
            onClick={onCancel}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Nombre
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                    placeholder="Ej: welcome, invoice, notification"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Canal
                  </label>
                  <select
                    value={formData.channel}
                    onChange={(e) => setFormData({ ...formData, channel: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="email">Email</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Tipo de Template
                </label>
                <select
                  value={formData.template_type || 'email'}
                  onChange={(e) => setFormData({ ...formData, template_type: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="email">Email</option>
                  <option value="pdf">PDF</option>
                </select>
                <p className="text-xs text-slate-500 mt-1">
                  {formData.template_type === 'pdf'
                    ? 'Este template genera un PDF que puede adjuntarse a emails'
                    : 'Este template envía un email HTML'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Descripción (opcional)
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                  placeholder="Descripción del template"
                />
              </div>

              {formData.template_type === 'pdf' && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
                  <h3 className="text-amber-400 font-semibold mb-3 text-sm">Configuración de PDF</h3>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Patrón de Nombre de Archivo
                    </label>
                    <input
                      type="text"
                      value={formData.pdf_filename_pattern || 'document.pdf'}
                      onChange={(e) => setFormData({ ...formData, pdf_filename_pattern: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                      placeholder="factura_{{invoice_number}}.pdf"
                    />
                    <p className="text-xs text-slate-400 mt-1">
                      Usa variables para generar nombres dinámicos: factura_{`{{invoice_number}}`}.pdf
                    </p>
                  </div>
                </div>
              )}

              {formData.template_type === 'email' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Subject
                    </label>
                    <input
                      type="text"
                      value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                      placeholder="Use {{variable}} para variables dinámicas"
                    />
                  </div>

                  <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                    <h3 className="text-blue-400 font-semibold mb-3 text-sm">Template de PDF Asociado</h3>
                    <p className="text-xs text-slate-400 mb-3">
                      Si este email debe esperar un PDF generado por otro template, selecciónalo aquí.
                      El sistema creará una comunicación pendiente y enviará el email cuando el PDF esté listo.
                    </p>
                    <select
                      value={formData.pdf_template_id || ''}
                      onChange={(e) => setFormData({ ...formData, pdf_template_id: e.target.value || null })}
                      className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                    >
                      <option value="">Sin PDF (envío directo)</option>
                      {pdfTemplates.map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.name} {template.description && `- ${template.description}`}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-slate-500 mt-2">
                      {formData.pdf_template_id
                        ? '✓ Este email se enviará como comunicación pendiente hasta que el PDF esté listo'
                        : 'Este email se enviará inmediatamente sin adjuntos PDF'}
                    </p>
                  </div>
                </>
              )}

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-slate-300">
                    Contenido HTML
                  </label>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setShowHTMLEditor(true)}
                      className="flex items-center space-x-1 px-3 py-1.5 text-xs rounded transition-colors bg-purple-500 hover:bg-purple-600 text-white"
                      title="Abrir editor avanzado"
                    >
                      <Maximize2 className="w-3 h-3" />
                      <span>Editor Avanzado</span>
                    </button>
                    <button
                      onClick={() => setShowPreview(!showPreview)}
                      className={`flex items-center space-x-1 px-3 py-1 text-xs rounded transition-colors ${
                        showPreview
                          ? 'bg-cyan-500 text-white'
                          : 'bg-slate-900 text-slate-400 hover:text-white'
                      }`}
                    >
                      {showPreview ? <Eye className="w-3 h-3" /> : <Code className="w-3 h-3" />}
                      <span>{showPreview ? 'Vista Previa' : 'Código HTML'}</span>
                    </button>
                  </div>
                </div>
                {showPreview ? (
                  <div className="w-full min-h-[400px] p-4 bg-white border border-slate-700 rounded-lg overflow-auto">
                    <div dangerouslySetInnerHTML={{ __html: getPreviewHtml() }} />
                  </div>
                ) : (
                  <textarea
                    value={formData.html_content}
                    onChange={(e) => setFormData({ ...formData, html_content: e.target.value })}
                    className="w-full min-h-[400px] px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-sm focus:outline-none focus:border-cyan-500"
                    placeholder="Use dobles llaves para variables: {{nombre}}, {{email}}, etc."
                  />
                )}
                <p className="text-xs text-slate-500 mt-2">
                  Usa dobles llaves para variables dinámicas: {`{{nombre_variable}}`}.
                  <button
                    onClick={() => setShowHTMLEditor(true)}
                    className="ml-1 text-purple-400 hover:text-purple-300 underline"
                  >
                    Abre el editor avanzado
                  </button> para una mejor experiencia de edición.
                </p>
              </div>

              <div className="space-y-4 bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                <h3 className="text-sm font-semibold text-white flex items-center space-x-2">
                  <FileText className="w-4 h-4" />
                  <span>Elementos Especiales</span>
                </h3>

                <div className="space-y-3">
                  <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <Image className="w-4 h-4 text-blue-400" />
                        <span className="text-sm font-medium text-slate-300">Insertar Logo</span>
                      </div>
                      <button
                        onClick={() => {
                          const logoVar = formData.logo_variable || 'company_logo';
                          setFormData({
                            ...formData,
                            html_content: formData.html_content + `{{${logoVar}}}`,
                            has_logo: true,
                            logo_variable: logoVar,
                          });
                        }}
                        className="px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 transition-colors flex items-center space-x-1"
                      >
                        <span>+</span>
                        <span>Insertar</span>
                      </button>
                    </div>
                    <input
                      type="text"
                      value={formData.logo_variable}
                      onChange={(e) =>
                        setFormData({ ...formData, logo_variable: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white text-sm focus:outline-none focus:border-cyan-500"
                      placeholder="Nombre de variable (ej: company_logo)"
                    />
                    <p className="text-xs text-slate-500 mt-2">
                      La variable contendrá una URL o base64 del logo
                    </p>
                  </div>

                  <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <QrCode className="w-4 h-4 text-purple-400" />
                        <span className="text-sm font-medium text-slate-300">Insertar QR</span>
                      </div>
                      <button
                        onClick={() => {
                          const qrVar = formData.qr_variable || 'qr_data';
                          setFormData({
                            ...formData,
                            html_content: formData.html_content + `{{${qrVar}_qr}}`,
                            has_qr: true,
                            qr_variable: qrVar,
                          });
                        }}
                        className="px-3 py-1 bg-purple-500 text-white text-xs rounded hover:bg-purple-600 transition-colors flex items-center space-x-1"
                      >
                        <span>+</span>
                        <span>Insertar</span>
                      </button>
                    </div>
                    <input
                      type="text"
                      value={formData.qr_variable}
                      onChange={(e) =>
                        setFormData({ ...formData, qr_variable: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white text-sm focus:outline-none focus:border-cyan-500"
                      placeholder="Nombre de variable (ej: qr_data)"
                    />
                    <p className="text-xs text-slate-500 mt-2">
                      Se generará QR con los datos de la variable. Usa <code className="text-cyan-400">{`{{${formData.qr_variable || 'qr_data'}_qr}}`}</code> en el HTML
                    </p>
                  </div>

                  <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
                    <label className="flex items-start space-x-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.has_attachment}
                        onChange={(e) =>
                          setFormData({ ...formData, has_attachment: e.target.checked })
                        }
                        className="mt-1 w-4 h-4 text-cyan-500 bg-slate-700 border-slate-600 rounded focus:ring-cyan-500"
                      />
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <FileText className="w-4 h-4 text-emerald-400" />
                          <span className="text-sm font-medium text-slate-300">PDF Adjunto</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          Generar PDF del contenido y adjuntarlo al email
                        </p>
                        {formData.has_attachment && (
                          <input
                            type="text"
                            value={formData.attachment_variable}
                            onChange={(e) =>
                              setFormData({ ...formData, attachment_variable: e.target.value })
                            }
                            className="mt-2 w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white text-sm focus:outline-none focus:border-cyan-500"
                            placeholder="Variable con HTML para PDF (opcional)"
                          />
                        )}
                      </div>
                    </label>
                  </div>
                </div>
              </div>

              <div className="bg-amber-500/10 p-4 rounded-lg border border-amber-500/30">
                <h3 className="text-sm font-semibold text-amber-400 mb-3">Estructuras Complejas</h3>
                <p className="text-xs text-slate-400 mb-3">
                  Inserta loops y condicionales para datos complejos
                </p>
                <div className="space-y-2">
                  <button
                    onClick={() => {
                      const loopTemplate = `{{#each items}}
  <tr>
    <td>{{descripcion}}</td>
    <td>{{cantidad}}</td>
    <td>{{precio}}</td>
  </tr>
{{/each}}`;
                      setFormData({
                        ...formData,
                        html_content: formData.html_content + '\n' + loopTemplate,
                      });
                    }}
                    className="w-full text-left px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs transition-colors border border-slate-700"
                  >
                    <div className="font-medium text-amber-300 mb-1">🔄 Loop sobre Array</div>
                    <div className="text-slate-400">Itera sobre lista de items</div>
                    <code className="block mt-1 text-[10px] text-slate-500">
                      {`{{#each items}} ... {{/each}}`}
                    </code>
                  </button>

                  <button
                    onClick={() => {
                      const conditionalTemplate = `{{#if has_discount}}
  <p>Descuento: {{discount_amount}}</p>
{{/if}}`;
                      setFormData({
                        ...formData,
                        html_content: formData.html_content + '\n' + conditionalTemplate,
                      });
                    }}
                    className="w-full text-left px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs transition-colors border border-slate-700"
                  >
                    <div className="font-medium text-green-300 mb-1">❓ Condicional Simple</div>
                    <div className="text-slate-400">Muestra si condición es verdadera</div>
                    <code className="block mt-1 text-[10px] text-slate-500">
                      {`{{#if condition}} ... {{/if}}`}
                    </code>
                  </button>

                  <button
                    onClick={() => {
                      const conditionalElseTemplate = `{{#if is_paid}}
  <span class="paid">Pagado</span>
{{else}}
  <span class="pending">Pendiente</span>
{{/if}}`;
                      setFormData({
                        ...formData,
                        html_content: formData.html_content + '\n' + conditionalElseTemplate,
                      });
                    }}
                    className="w-full text-left px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs transition-colors border border-slate-700"
                  >
                    <div className="font-medium text-blue-300 mb-1">⚡ Condicional con Else</div>
                    <div className="text-slate-400">Muestra contenido alternativo</div>
                    <code className="block mt-1 text-[10px] text-slate-500">
                      {`{{#if}} ... {{else}} ... {{/if}}`}
                    </code>
                  </button>

                  <button
                    onClick={() => {
                      const nestedObjectTemplate = `<p>Emisor: {{issuer.razon_social}}</p>
<p>RUT: {{issuer.rut}}</p>`;
                      setFormData({
                        ...formData,
                        html_content: formData.html_content + '\n' + nestedObjectTemplate,
                      });
                    }}
                    className="w-full text-left px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs transition-colors border border-slate-700"
                  >
                    <div className="font-medium text-purple-300 mb-1">📦 Objeto Anidado</div>
                    <div className="text-slate-400">Accede a propiedades de objetos</div>
                    <code className="block mt-1 text-[10px] text-slate-500">
                      {`{{object.property}}`}
                    </code>
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {detectedVariables.size > 0 && (
                <div className="bg-cyan-500/10 p-4 rounded-lg border border-cyan-500/30">
                  <h3 className="text-sm font-semibold text-cyan-400 mb-3">Variables del Template</h3>
                  <p className="text-xs text-slate-400 mb-3">
                    Variables detectadas en tu template HTML
                  </p>
                  <div className="space-y-1 max-h-[200px] overflow-y-auto">
                    {Array.from(detectedVariables).sort().map((varName) => (
                      <div
                        key={varName}
                        className="px-3 py-2 bg-slate-800 rounded text-xs font-mono text-cyan-300 border border-slate-700"
                      >
                        {varName.includes('(array)') ? (
                          <div className="flex items-center gap-2">
                            <span className="text-amber-400">🔄</span>
                            <span>{varName.replace(' (array)', '')}</span>
                            <span className="text-xs text-slate-500">(loop)</span>
                          </div>
                        ) : varName.includes('.') ? (
                          <div className="flex items-center gap-2">
                            <span className="text-purple-400">📦</span>
                            <span>{varName}</span>
                            <span className="text-xs text-slate-500">(anidada)</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-green-400">✓</span>
                            <span>{varName}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700 sticky top-0">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-white">Variables Predefinidas</h3>
                  <button
                    onClick={() => setShowAddVariable(!showAddVariable)}
                    className="p-1 text-cyan-400 hover:text-cyan-300 transition-colors"
                    title="Agregar variable"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-slate-400 mb-3">
                  Haz clic para insertar en el contenido
                </p>

                {showAddVariable && (
                  <div className="mb-4 p-3 bg-slate-800 rounded-lg border border-cyan-500/30 space-y-2">
                    <input
                      type="text"
                      value={newVariable.name}
                      onChange={(e) => setNewVariable({ ...newVariable, name: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white text-xs focus:outline-none focus:border-cyan-500"
                      placeholder="Nombre (ej: order_id)"
                    />
                    <input
                      type="text"
                      value={newVariable.description}
                      onChange={(e) => setNewVariable({ ...newVariable, description: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white text-xs focus:outline-none focus:border-cyan-500"
                      placeholder="Descripción"
                    />
                    <input
                      type="text"
                      value={newVariable.example}
                      onChange={(e) => setNewVariable({ ...newVariable, example: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white text-xs focus:outline-none focus:border-cyan-500"
                      placeholder="Ejemplo"
                    />
                    <div className="flex space-x-2">
                      <button
                        onClick={saveCustomVariable}
                        className="flex-1 px-3 py-2 bg-cyan-500 text-white text-xs rounded hover:bg-cyan-600 transition-colors"
                      >
                        Guardar
                      </button>
                      <button
                        onClick={() => setShowAddVariable(false)}
                        className="flex-1 px-3 py-2 bg-slate-700 text-white text-xs rounded hover:bg-slate-600 transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {allVariables.map((variable) => (
                    <div
                      key={variable.id || variable.name}
                      className="group relative p-3 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors border border-slate-700 hover:border-cyan-500"
                    >
                      <button
                        onClick={() => insertVariable(variable.name)}
                        className="w-full text-left"
                      >
                        <div className="text-xs font-medium text-cyan-400 mb-1">
                          {`{{${variable.name}}}`}
                        </div>
                        <div className="text-xs text-slate-400">{variable.description}</div>
                        <div className="text-xs text-slate-500 mt-1">Ej: {variable.example}</div>
                      </button>
                      {variable.id && (
                        <button
                          onClick={() => setDeleteConfirm(variable.id!)}
                          className="absolute top-2 right-2 p-1 text-slate-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                          title="Eliminar variable"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end space-x-3 p-6 border-t border-slate-700 bg-slate-900/50">
          <button
            onClick={onCancel}
            className="px-6 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onSave}
            disabled={!formData.name || !formData.html_content}
            className="px-6 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Guardar
          </button>
        </div>
      </div>

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-white mb-2">Eliminar Variable</h3>
            <p className="text-slate-300 text-sm mb-6">
              ¿Estás seguro de que deseas eliminar esta variable? Esta acción no se puede deshacer.
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

      {showHTMLEditor && (
        <HTMLEditor
          value={formData.html_content}
          onChange={(newContent) => {
            setFormData({ ...formData, html_content: newContent });
          }}
          onClose={() => setShowHTMLEditor(false)}
          variables={allVariables}
        />
      )}
    </div>
  );
};
