import { useState } from 'react';
import { Book, Code, Copy, Check, ChevronDown, ChevronRight, Info, AlertCircle } from 'lucide-react';
import { Layout } from '../components/Layout';

interface EndpointSection {
  id: string;
  title: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  description: string;
  authentication: string;
  headers?: { name: string; type: string; required: boolean; description: string }[];
  parameters?: { name: string; type: string; required: boolean; description: string }[];
  requestBody?: {
    contentType: string;
    schema: any;
    example: any;
  };
  responses: {
    code: string;
    description: string;
    example: any;
  }[];
}

export default function Documentation() {
  const [activeSection, setActiveSection] = useState('introduction');
  const [expandedEndpoints, setExpandedEndpoints] = useState<string[]>(['send-email']);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const toggleEndpoint = (id: string) => {
    setExpandedEndpoints(prev =>
      prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]
    );
  };

  const sections = [
    { id: 'introduction', title: 'Introducción', icon: Book },
    { id: 'authentication', title: 'Autenticación', icon: Code },
    { id: 'email-config', title: 'Configuración de Email', icon: Code },
    { id: 'endpoints', title: 'Endpoints', icon: Code },
    { id: 'templates', title: 'Variables de Template', icon: Code },
    { id: 'examples', title: 'Ejemplos de Integración', icon: Code },
  ];

  const endpoints: EndpointSection[] = [
    {
      id: 'generate-pdf',
      title: 'Generar PDF',
      method: 'POST',
      path: '/functions/v1/generate-pdf',
      description: 'Genera un PDF desde un template HTML usando jsPDF. El PDF se guarda en la base de datos y puede adjuntarse a comunicaciones pendientes si se proporciona un order_id.',
      authentication: 'API Key (x-api-key header)',
      headers: [
        { name: 'x-api-key', type: 'string', required: true, description: 'Tu API key de la aplicación' },
        { name: 'Content-Type', type: 'string', required: true, description: 'application/json' },
      ],
      requestBody: {
        contentType: 'application/json',
        schema: {
          pdf_template_name: 'string (required*)',
          template_id: 'string (required*)',
          data: 'object (required)',
          order_id: 'string (optional)',
          pending_communication_id: 'string (optional)',
        },
        example: {
          order_id: 'ORDER-1234567',
          pdf_template_name: 'invoice_template',
          data: {
            response_payload: {
              success: true,
              approved: true,
              reference: 'CFE-123456789',
              numero_cfe: '101000001',
              serie_cfe: 'A',
              tipo_cfe: '101',
              cae: '12345678901234',
              vencimiento_cae: '2025-10-29',
              qr_code: 'https://servicios.dgi.gub.uy/cfe?id=abc123...',
              dgi_estado: 'aprobado',
            },
            issuer: {
              numero_cfe: 'INV-1729567890-a2396dce',
              serie: 'A',
              rut: '211234560018',
              razon_social: 'Empresa Demo S.A.',
              fecha_emision: '2025-10-22',
              moneda: 'UYU',
              subtotal: 819.67,
              iva: 180.33,
              total: 1000.00,
            },
            items: [
              {
                descripcion: 'Producto o Servicio',
                cantidad: 2,
                precio_unitario: 409.84,
                iva_porcentaje: 22,
                subtotal: 819.68,
                iva: 180.33,
                total: 1000.01,
              },
            ],
            datos_adicionales: {
              observaciones: 'Venta al público',
              forma_pago: 'Efectivo',
            },
          },
        },
      },
      responses: [
        {
          code: '200',
          description: 'PDF generado exitosamente',
          example: {
            success: true,
            message: 'PDF generated successfully',
            data: {
              pdf_id: 'e52fbc58-1a59-4f14-8b24-2e4a3c8c7b91',
              pdf_base64: 'JVBERi0xLjQKJeLjz9MKMyAwIG9iago8PC9UeXBlIC9QYWdlcy9LaWRzWzQgMCBSXS9Db3VudCAxL01lZGlhQm94WzAgMCA1OTUuMjggODQxLjg5XT4+CmVuZG9iago0IDAgb2JqCjw8L1R5cGUgL1BhZ2UvUGFyZW50IDMgMCBSL0NvbnRlbnRzIDUgMCBSL1Jlc291cmNlczw8L0ZvbnQ8PC9GMSA3IDAgUi9GMiA5IDAgUj4+Pj4+PgplbmRvYmoKNSAwIG9iago8PC9MZW5ndGggNjcxPj4Kc3RyZWFtCkJUCi9GMSA0MCBUZgooSW52b2ljZSBJTlYtMTcyOTU2Nzg5MC1hMjM5NmRjZSkgVGoKL0YyIDE0IFRmCihFbXByZXNhIERlbW8gUy5BLikgVGoKKFJVVDogMjExMjM0NTYwMDE4KSBUagooRmVjaGEgZGUgZW1pc2nDs246IDIwMjUtMTAtMjIpIFRqCihNb25lZGE6IFVZVSkgVGoKKFN1YnRvdGFsOiA4MTkuNjcpIFRqCihJVkE6IDE4MC4zMykgVGoKKFRvdGFsOiAxMDAwLjAwKSBUagpFVAplbmRzdHJlYW0KZW5kb2JqCjYgMCBvYmoKPDwvVHlwZS9DYXRhbG9nL1BhZ2VzIDMgMCBSPj4KZW5kb2JqCjcgMCBvYmoKPDwvVHlwZS9Gb250L1N1YnR5cGUvVHlwZTEvQmFzZUZvbnQvSGVsdmV0aWNhL0VuY29kaW5nL1dpbkFuc2lFbmNvZGluZz4+CmVuZG9iago5IDAgb2JqCjw8L1R5cGUvRm9udC9TdWJ0eXBlL1R5cGUxL0Jhc2VGb250L0hlbHZldGljYS1Cb2xkL0VuY29kaW5nL1dpbkFuc2lFbmNvZGluZz4+CmVuZG9iagp4cmVmCjAgMTAKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDA5IDAwMDAwIG4gCjAwMDAwMDAwOTggMDAwMDAgbiAKMDAwMDAwMDEzNiAwMDAwMCBuIAowMDAwMDAwMjExIDAwMDAwIG4gCjAwMDAwMDAzMzEgMDAwMDAgbiAKMDAwMDAwMTA1MSAwMDAwMCBuIAowMDAwMDAxMTAwIDAwMDAwIG4gCjAwMDAwMDExOTkgMDAwMDAgbiAKMDAwMDAwMTMwNCAwMDAwMCBuIAp0cmFpbGVyCjw8L1NpemUgMTAvUm9vdCA2IDAgUi9JbmZvIDEgMCBSPj4Kc3RhcnR4cmVmCjE0MDkKJSVFT0YK...',
              filename: 'invoice_INV-1729567890-a2396dce.pdf',
              size_bytes: 8245,
            },
          },
        },
        {
          code: '404',
          description: 'Template de PDF no encontrado',
          example: {
            success: false,
            error: 'PDF template not found or inactive',
            details: 'Template not found',
          },
        },
        {
          code: '400',
          description: 'Parámetros faltantes o inválidos',
          example: {
            success: false,
            error: 'Either template_id or pdf_template_name is required',
          },
        },
        {
          code: '401',
          description: 'API key inválida',
          example: {
            success: false,
            error: 'Invalid API key',
          },
        },
      ],
    },
    {
      id: 'send-email',
      title: 'Enviar Email',
      method: 'POST',
      path: '/functions/v1/send-email',
      description: 'Envía un email inmediatamente usando un template configurado.',
      authentication: 'API Key (x-api-key header)',
      headers: [
        { name: 'x-api-key', type: 'string', required: true, description: 'Tu API key de la aplicación' },
        { name: 'Content-Type', type: 'string', required: true, description: 'application/json' },
      ],
      requestBody: {
        contentType: 'application/json',
        schema: {
          template_name: 'string (required)',
          recipient_email: 'string (required)',
          data: 'object (required)',
        },
        example: {
          template_name: 'welcome',
          recipient_email: 'cliente@example.com',
          data: {
            client_name: 'Juan Pérez',
            appointment_date: '2025-10-25',
            cta_url: 'https://dogcatify.com/confirmar',
          },
        },
      },
      responses: [
        {
          code: '200',
          description: 'Email enviado exitosamente',
          example: {
            success: true,
            message: 'Email sent successfully',
            log_id: 'uuid-123',
            features: {
              has_attachment: false,
              has_logo: true,
              has_qr: false,
            },
            processing_time_ms: 1234,
          },
        },
        {
          code: '401',
          description: 'API key inválida',
          example: {
            success: false,
            error: 'Invalid API key',
          },
        },
        {
          code: '404',
          description: 'Template no encontrado',
          example: {
            success: false,
            error: 'Template not found or inactive',
          },
        },
      ],
    },
    {
      id: 'pending-create',
      title: 'Crear Comunicación Pendiente',
      method: 'POST',
      path: '/functions/v1/pending-communication/create',
      description: 'Crea una comunicación que espera datos externos antes de ser enviada.',
      authentication: 'API Key (x-api-key header)',
      headers: [
        { name: 'x-api-key', type: 'string', required: true, description: 'Tu API key de la aplicación' },
        { name: 'Content-Type', type: 'string', required: true, description: 'application/json' },
      ],
      requestBody: {
        contentType: 'application/json',
        schema: {
          template_name: 'string (required)',
          recipient_email: 'string (required)',
          base_data: 'object (optional)',
          pending_fields: 'array (optional)',
          external_reference_id: 'string (required)',
          external_system: 'string (required)',
          webhook_url: 'string (optional)',
          expires_at: 'string ISO 8601 (optional)',
        },
        example: {
          template_name: 'invoice_confirmation',
          recipient_email: 'cliente@example.com',
          base_data: {
            client_name: 'Juan Pérez',
            appointment_date: '2025-10-25',
            service: 'Consulta veterinaria',
          },
          pending_fields: ['invoice_pdf', 'invoice_number'],
          external_reference_id: 'INVOICE-12345',
          external_system: 'billing_system',
          webhook_url: 'https://tu-crm.com/webhooks/email-sent',
          expires_at: '2025-10-25T23:59:59Z',
        },
      },
      responses: [
        {
          code: '201',
          description: 'Comunicación pendiente creada',
          example: {
            success: true,
            message: 'Pending communication created',
            data: {
              id: 'uuid-123',
              external_reference_id: 'INVOICE-12345',
              status: 'waiting_data',
              complete_url: `${supabaseUrl}/functions/v1/pending-communication/complete`,
            },
          },
        },
      ],
    },
    {
      id: 'pending-complete',
      title: 'Completar Comunicación Pendiente',
      method: 'POST',
      path: '/functions/v1/pending-communication/complete',
      description: 'Completa una comunicación pendiente con los datos faltantes y envía el email automáticamente.',
      authentication: 'No requiere (usa external_reference_id)',
      requestBody: {
        contentType: 'application/json',
        schema: {
          external_reference_id: 'string (required)',
          data: 'object (required)',
        },
        example: {
          external_reference_id: 'INVOICE-12345',
          data: {
            invoice_pdf: 'JVBERi0xLjQKJeLjz9MKMyAwIG9iago8PC...',
            invoice_number: 'FAC-2025-001',
            total_amount: '$150.00',
          },
        },
      },
      responses: [
        {
          code: '200',
          description: 'Comunicación completada y enviada',
          example: {
            success: true,
            message: 'Communication completed and sent',
            log_id: 'uuid-456',
          },
        },
        {
          code: '404',
          description: 'Comunicación no encontrada',
          example: {
            success: false,
            error: 'Pending communication not found or already processed',
          },
        },
      ],
    },
    {
      id: 'pending-status',
      title: 'Consultar Estado',
      method: 'GET',
      path: '/functions/v1/pending-communication/status',
      description: 'Consulta el estado de una comunicación pendiente.',
      authentication: 'No requiere',
      parameters: [
        { name: 'external_reference_id', type: 'string', required: true, description: 'ID de referencia externo' },
      ],
      responses: [
        {
          code: '200',
          description: 'Estado de la comunicación',
          example: {
            success: true,
            data: {
              id: 'uuid-123',
              status: 'sent',
              created_at: '2025-10-21T10:00:00Z',
              completed_at: '2025-10-21T10:05:00Z',
              sent_at: '2025-10-21T10:05:02Z',
              pending_fields: ['invoice_pdf', 'invoice_number'],
            },
          },
        },
      ],
    },
  ];

  const renderMethodBadge = (method: string) => {
    const colors = {
      GET: 'bg-blue-500',
      POST: 'bg-green-500',
      PUT: 'bg-amber-500',
      DELETE: 'bg-red-500',
    };
    return (
      <span className={`${colors[method as keyof typeof colors]} text-white px-2 py-1 rounded text-xs font-bold`}>
        {method}
      </span>
    );
  };

  const renderIntroduction = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-4">Documentación de API</h2>
        <p className="text-slate-300 mb-4">
          Bienvenido a la documentación de la API de CommHub. Esta guía te ayudará a integrar nuestro
          servicio de comunicaciones en tu sistema.
        </p>
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-3">Base URL</h3>
        <div className="bg-slate-900 border border-slate-700 rounded p-3 font-mono text-sm text-cyan-400 flex items-center justify-between">
          <span>{supabaseUrl}</span>
          <button
            onClick={() => copyToClipboard(supabaseUrl, 'base-url')}
            className="p-1 text-slate-400 hover:text-white transition-colors"
          >
            {copiedCode === 'base-url' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="text-blue-400 font-semibold mb-2">Características principales</h3>
            <ul className="text-slate-300 space-y-2 text-sm">
              <li>• Envío de emails con templates personalizados</li>
              <li>• Soporte para comunicaciones pendientes con datos externos</li>
              <li>• Adjuntar PDFs en base64</li>
              <li>• Logos y códigos QR automáticos</li>
              <li>• Webhooks para notificaciones</li>
              <li>• Tracking de emails enviados</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );

  const renderEmailConfig = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-4">Configuración de Email</h2>
        <p className="text-slate-300 mb-4">
          El sistema soporta dos proveedores de email: SMTP (genérico) y Resend. Puedes configurar tu proveedor preferido desde la sección de <strong>Configuración</strong>.
        </p>
      </div>

      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="text-blue-400 font-semibold mb-2">Proveedores Soportados</h3>
            <ul className="text-slate-300 space-y-2 text-sm">
              <li>• <strong>SMTP:</strong> Compatible con cualquier servidor SMTP (Gmail, Office 365, SendGrid, etc.)</li>
              <li>• <strong>Resend:</strong> API moderna con webhooks para tracking avanzado</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Opción 1: Configuración SMTP</h3>
        <p className="text-slate-300 mb-4 text-sm">
          El protocolo SMTP funciona con prácticamente cualquier proveedor de email. Aquí están algunos de los más populares:
        </p>

        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
            <h4 className="text-cyan-400 font-semibold mb-3 flex items-center gap-2">
              Gmail / Google Workspace
            </h4>
            <div className="space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-slate-400 mb-1">Host:</p>
                  <code className="bg-slate-800 px-3 py-1.5 rounded text-cyan-300 block">smtp.gmail.com</code>
                </div>
                <div>
                  <p className="text-slate-400 mb-1">Puerto:</p>
                  <code className="bg-slate-800 px-3 py-1.5 rounded text-cyan-300 block">587</code>
                </div>
              </div>
              <div>
                <p className="text-slate-400 mb-1">Usuario:</p>
                <code className="bg-slate-800 px-3 py-1.5 rounded text-cyan-300 block">tu-email@gmail.com</code>
              </div>
              <div>
                <p className="text-slate-400 mb-1">Contraseña:</p>
                <code className="bg-slate-800 px-3 py-1.5 rounded text-cyan-300 block">Contraseña de aplicación (no tu contraseña normal)</code>
              </div>
              <div className="mt-3 bg-amber-500/10 border border-amber-500/30 rounded p-3">
                <p className="text-amber-400 text-xs font-semibold mb-1">⚠️ Configuración Requerida:</p>
                <ol className="text-slate-300 text-xs space-y-1 ml-4">
                  <li>1. Activa la verificación en 2 pasos en tu cuenta de Google</li>
                  <li>2. Ve a: <a href="https://myaccount.google.com/apppasswords" target="_blank" className="text-cyan-400 underline">myaccount.google.com/apppasswords</a></li>
                  <li>3. Genera una "Contraseña de aplicación" para "Correo"</li>
                  <li>4. Usa esa contraseña de 16 caracteres en la configuración SMTP</li>
                </ol>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
            <h4 className="text-cyan-400 font-semibold mb-3 flex items-center gap-2">
              Microsoft 365 / Outlook
            </h4>
            <div className="space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-slate-400 mb-1">Host:</p>
                  <code className="bg-slate-800 px-3 py-1.5 rounded text-cyan-300 block">smtp.office365.com</code>
                </div>
                <div>
                  <p className="text-slate-400 mb-1">Puerto:</p>
                  <code className="bg-slate-800 px-3 py-1.5 rounded text-cyan-300 block">587</code>
                </div>
              </div>
              <div>
                <p className="text-slate-400 mb-1">Usuario:</p>
                <code className="bg-slate-800 px-3 py-1.5 rounded text-cyan-300 block">tu-email@outlook.com</code>
              </div>
              <div>
                <p className="text-slate-400 mb-1">Contraseña:</p>
                <code className="bg-slate-800 px-3 py-1.5 rounded text-cyan-300 block">Tu contraseña de Microsoft 365</code>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
            <h4 className="text-cyan-400 font-semibold mb-3 flex items-center gap-2">
              SendGrid
            </h4>
            <div className="space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-slate-400 mb-1">Host:</p>
                  <code className="bg-slate-800 px-3 py-1.5 rounded text-cyan-300 block">smtp.sendgrid.net</code>
                </div>
                <div>
                  <p className="text-slate-400 mb-1">Puerto:</p>
                  <code className="bg-slate-800 px-3 py-1.5 rounded text-cyan-300 block">587</code>
                </div>
              </div>
              <div>
                <p className="text-slate-400 mb-1">Usuario:</p>
                <code className="bg-slate-800 px-3 py-1.5 rounded text-cyan-300 block">apikey</code>
              </div>
              <div>
                <p className="text-slate-400 mb-1">Contraseña:</p>
                <code className="bg-slate-800 px-3 py-1.5 rounded text-cyan-300 block">Tu API Key de SendGrid</code>
              </div>
              <div className="mt-3 bg-blue-500/10 border border-blue-500/30 rounded p-3">
                <p className="text-blue-400 text-xs">
                  💡 Obtén tu API Key en: <a href="https://app.sendgrid.com/settings/api_keys" target="_blank" className="text-cyan-400 underline">Settings → API Keys</a>
                </p>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
            <h4 className="text-cyan-400 font-semibold mb-3 flex items-center gap-2">
              Amazon SES
            </h4>
            <div className="space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-slate-400 mb-1">Host:</p>
                  <code className="bg-slate-800 px-3 py-1.5 rounded text-cyan-300 block">email-smtp.us-east-1.amazonaws.com</code>
                </div>
                <div>
                  <p className="text-slate-400 mb-1">Puerto:</p>
                  <code className="bg-slate-800 px-3 py-1.5 rounded text-cyan-300 block">587</code>
                </div>
              </div>
              <div>
                <p className="text-slate-400 mb-1">Usuario:</p>
                <code className="bg-slate-800 px-3 py-1.5 rounded text-cyan-300 block">Tu SMTP Username de AWS</code>
              </div>
              <div>
                <p className="text-slate-400 mb-1">Contraseña:</p>
                <code className="bg-slate-800 px-3 py-1.5 rounded text-cyan-300 block">Tu SMTP Password de AWS</code>
              </div>
              <div className="mt-3 bg-blue-500/10 border border-blue-500/30 rounded p-3">
                <p className="text-blue-400 text-xs">
                  💡 El host varía según tu región AWS (us-east-1, eu-west-1, etc.)
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Opción 2: Configuración Resend</h3>
        <p className="text-slate-300 mb-4 text-sm">
          Resend es una API moderna de email con excelente deliverability y tracking avanzado.
        </p>

        <div className="space-y-4">
          <div className="bg-green-500/10 border border-green-500/30 rounded p-4">
            <h4 className="text-green-400 font-semibold mb-2">✨ Ventajas de Resend</h4>
            <ul className="text-slate-300 text-sm space-y-1">
              <li>• Webhooks automáticos para tracking de emails (entregado, abierto, clicado)</li>
              <li>• Mejor deliverability que SMTP tradicional</li>
              <li>• API simple y moderna</li>
              <li>• Dashboard con estadísticas en tiempo real</li>
              <li>• Plan gratuito: 3,000 emails/mes, 100 emails/día</li>
            </ul>
          </div>

          <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
            <h4 className="text-cyan-400 font-semibold mb-3">Paso 1: Crear cuenta en Resend</h4>
            <ol className="text-slate-300 text-sm space-y-2 ml-4">
              <li>1. Ve a <a href="https://resend.com/signup" target="_blank" className="text-cyan-400 underline">resend.com/signup</a></li>
              <li>2. Crea una cuenta gratuita</li>
              <li>3. Verifica tu email</li>
            </ol>
          </div>

          <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
            <h4 className="text-cyan-400 font-semibold mb-3">Paso 2: Obtener API Key</h4>
            <ol className="text-slate-300 text-sm space-y-2 ml-4">
              <li>1. En el dashboard de Resend, ve a "API Keys"</li>
              <li>2. Haz clic en "Create API Key"</li>
              <li>3. Dale un nombre (ej: "Production")</li>
              <li>4. Selecciona permisos: "Sending access"</li>
              <li>5. Copia la API Key (empieza con <code className="text-cyan-400">re_</code>)</li>
            </ol>
            <div className="mt-3 bg-amber-500/10 border border-amber-500/30 rounded p-3">
              <p className="text-amber-400 text-xs">
                ⚠️ Guarda la API Key de forma segura. Solo se muestra una vez.
              </p>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
            <h4 className="text-cyan-400 font-semibold mb-3">Paso 3: Configurar dominio (Opcional pero recomendado)</h4>
            <ol className="text-slate-300 text-sm space-y-2 ml-4">
              <li>1. En Resend, ve a "Domains"</li>
              <li>2. Haz clic en "Add Domain"</li>
              <li>3. Ingresa tu dominio (ej: <code className="text-cyan-400">tuempresa.com</code>)</li>
              <li>4. Agrega los registros DNS proporcionados:
                <ul className="ml-4 mt-2 space-y-1">
                  <li>• SPF (TXT)</li>
                  <li>• DKIM (TXT)</li>
                  <li>• DMARC (TXT) - opcional</li>
                </ul>
              </li>
              <li>5. Espera a que se verifique el dominio (puede tomar hasta 24 horas)</li>
            </ol>
            <div className="mt-3 bg-blue-500/10 border border-blue-500/30 rounded p-3">
              <p className="text-blue-400 text-xs">
                💡 Sin dominio verificado, puedes usar <code className="text-cyan-400">onboarding@resend.dev</code> pero los emails pueden ir a spam.
              </p>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
            <h4 className="text-cyan-400 font-semibold mb-3">Paso 4: Configurar Webhooks (Opcional)</h4>
            <p className="text-slate-300 text-sm mb-3">
              Los webhooks te permiten recibir notificaciones en tiempo real sobre el estado de tus emails.
            </p>
            <ol className="text-slate-300 text-sm space-y-2 ml-4">
              <li>1. En Resend, ve a "Webhooks"</li>
              <li>2. Haz clic en "Add Endpoint"</li>
              <li>3. Ingresa la URL del webhook:
                <div className="mt-2 bg-slate-800 p-2 rounded">
                  <code className="text-cyan-400 text-xs break-all">{supabaseUrl}/functions/v1/resend-webhook</code>
                </div>
              </li>
              <li>4. Selecciona los eventos:
                <ul className="ml-4 mt-2 space-y-1">
                  <li>• <code className="text-green-400">email.delivered</code> - Email entregado</li>
                  <li>• <code className="text-blue-400">email.opened</code> - Email abierto</li>
                  <li>• <code className="text-purple-400">email.clicked</code> - Link clicado</li>
                  <li>• <code className="text-red-400">email.bounced</code> - Email rebotado</li>
                  <li>• <code className="text-amber-400">email.complained</code> - Marcado como spam</li>
                </ul>
              </li>
              <li>5. Guarda el endpoint</li>
            </ol>
            <div className="mt-3 bg-green-500/10 border border-green-500/30 rounded p-3">
              <p className="text-green-400 text-xs">
                ✓ Los webhooks actualizarán automáticamente el estado de tus emails en tiempo real
              </p>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
            <h4 className="text-cyan-400 font-semibold mb-3">Paso 5: Configurar en el Sistema</h4>
            <ol className="text-slate-300 text-sm space-y-2 ml-4">
              <li>1. Ve a <strong>Configuración</strong> en el sistema</li>
              <li>2. Selecciona <strong>"Resend"</strong> como proveedor de email</li>
              <li>3. Pega tu API Key de Resend</li>
              <li>4. Configura el remitente:
                <ul className="ml-4 mt-2 space-y-1">
                  <li>• <strong>From Email:</strong> <code className="text-cyan-400">noreply@tudominio.com</code></li>
                  <li>• <strong>From Name:</strong> <code className="text-cyan-400">Tu Empresa</code></li>
                </ul>
              </li>
              <li>5. Guarda la configuración</li>
              <li>6. Prueba enviando un email de prueba</li>
            </ol>
          </div>
        </div>
      </div>

      <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="text-amber-400 font-semibold mb-2">Recomendaciones de Seguridad</h3>
            <ul className="text-slate-300 text-sm space-y-1">
              <li>• Nunca compartas tus API Keys o contraseñas SMTP</li>
              <li>• Usa contraseñas de aplicación específicas (no tu contraseña principal)</li>
              <li>• Configura SPF, DKIM y DMARC para mejor deliverability</li>
              <li>• Monitorea tus límites de envío diarios</li>
              <li>• Verifica tu dominio para evitar que los emails vayan a spam</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="text-blue-400 font-semibold mb-2">¿Cuál elegir?</h3>
            <div className="text-slate-300 text-sm space-y-2">
              <p><strong>Usa SMTP si:</strong></p>
              <ul className="ml-4 space-y-1">
                <li>• Ya tienes un proveedor de email existente</li>
                <li>• Necesitas usar un servidor de correo corporativo</li>
                <li>• Prefieres mayor control sobre la infraestructura</li>
              </ul>
              <p className="mt-3"><strong>Usa Resend si:</strong></p>
              <ul className="ml-4 space-y-1">
                <li>• Necesitas webhooks y tracking avanzado</li>
                <li>• Quieres mejor deliverability out-of-the-box</li>
                <li>• Prefieres una API moderna y simple</li>
                <li>• Quieres estadísticas en tiempo real</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderAuthentication = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-4">Autenticación</h2>
        <p className="text-slate-300 mb-4">
          La API utiliza API Keys para autenticar las solicitudes. Debes incluir tu API key en el header
          de cada solicitud.
        </p>
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-3">Obtener tu API Key</h3>
        <p className="text-slate-300 mb-4">
          Puedes encontrar tu API key en la sección de <strong>Configuración</strong> de tu aplicación.
        </p>
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-3">Uso</h3>
        <p className="text-slate-300 mb-4">Incluye tu API key en el header de la solicitud:</p>
        <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto text-sm">
{`x-api-key: ak_production_xxxxxxxxxxxxx
Content-Type: application/json`}
        </pre>
      </div>

      <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="text-amber-400 font-semibold mb-2">Seguridad</h3>
            <p className="text-slate-300 text-sm">
              Nunca expongas tu API key en código del lado del cliente. Todas las llamadas a la API deben
              hacerse desde tu backend o servidor.
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderEndpoints = () => (
    <div className="space-y-4">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white mb-2">Endpoints</h2>
        <p className="text-slate-300">
          Lista completa de endpoints disponibles en la API.
        </p>
      </div>

      {endpoints.map((endpoint) => (
        <div key={endpoint.id} className="bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden">
          <div className="p-4 flex items-center justify-between">
            <button
              onClick={() => toggleEndpoint(endpoint.id)}
              className="flex-1 flex items-center gap-3 hover:bg-slate-700/30 transition-colors -m-4 p-4 rounded-l"
            >
              <div className="flex items-center gap-3">
                {expandedEndpoints.includes(endpoint.id) ? (
                  <ChevronDown className="w-5 h-5 text-slate-400" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-slate-400" />
                )}
                {renderMethodBadge(endpoint.method)}
                <span className="text-white font-semibold">{endpoint.title}</span>
              </div>
            </button>
            <div className="flex items-center gap-2">
              <code className="text-sm text-slate-400 font-mono">{endpoint.path}</code>
              <button
                onClick={() => copyToClipboard(`${supabaseUrl}${endpoint.path}`, `${endpoint.id}-url`)}
                className="p-2 hover:bg-slate-700 rounded transition-colors"
                title="Copiar URL completa"
              >
                {copiedCode === `${endpoint.id}-url` ? (
                  <Check className="w-4 h-4 text-green-400" />
                ) : (
                  <Copy className="w-4 h-4 text-slate-400" />
                )}
              </button>
            </div>
          </div>

          {expandedEndpoints.includes(endpoint.id) && (
            <div className="border-t border-slate-700 p-6 space-y-6">
              <div>
                <p className="text-slate-300">{endpoint.description}</p>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <span className="text-slate-400">Autenticación:</span>
                <code className="bg-slate-900 px-2 py-1 rounded text-cyan-400">{endpoint.authentication}</code>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold text-white uppercase tracking-wider">Request</h4>

                  {endpoint.headers && (
                    <div>
                      <h5 className="text-sm font-medium text-slate-300 mb-2">Headers</h5>
                      <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-slate-800">
                            <tr>
                              <th className="text-left p-2 text-slate-300 font-medium">Nombre</th>
                              <th className="text-left p-2 text-slate-300 font-medium">Tipo</th>
                              <th className="text-left p-2 text-slate-300 font-medium">Requerido</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-700">
                            {endpoint.headers.map((header, idx) => (
                              <tr key={idx}>
                                <td className="p-2 text-cyan-400 font-mono">{header.name}</td>
                                <td className="p-2 text-slate-400">{header.type}</td>
                                <td className="p-2">
                                  {header.required ? (
                                    <span className="text-red-400 text-xs">✓ Requerido</span>
                                  ) : (
                                    <span className="text-slate-500 text-xs">Opcional</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {endpoint.parameters && (
                    <div>
                      <h5 className="text-sm font-medium text-slate-300 mb-2">Parámetros</h5>
                      <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-slate-800">
                            <tr>
                              <th className="text-left p-2 text-slate-300 font-medium">Nombre</th>
                              <th className="text-left p-2 text-slate-300 font-medium">Tipo</th>
                              <th className="text-left p-2 text-slate-300 font-medium">Requerido</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-700">
                            {endpoint.parameters.map((param, idx) => (
                              <tr key={idx}>
                                <td className="p-2 text-cyan-400 font-mono">{param.name}</td>
                                <td className="p-2 text-slate-400">{param.type}</td>
                                <td className="p-2">
                                  {param.required ? (
                                    <span className="text-red-400 text-xs">✓ Requerido</span>
                                  ) : (
                                    <span className="text-slate-500 text-xs">Opcional</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {endpoint.requestBody && (
                    <div>
                      <h5 className="text-sm font-medium text-slate-300 mb-2">Body</h5>
                      <div className="space-y-2">
                        <div className="bg-slate-900 border border-slate-700 rounded-lg p-3">
                          <p className="text-xs text-slate-400 mb-2">Schema:</p>
                          {Object.entries(endpoint.requestBody.schema).map(([key, value]) => (
                            <div key={key} className="text-sm font-mono text-slate-300 mb-1">
                              <span className="text-cyan-400">{key}</span>:{' '}
                              <span className="text-amber-400">{String(value)}</span>
                            </div>
                          ))}
                          {endpoint.id === 'generate-pdf' && (
                            <div className="mt-3 pt-3 border-t border-slate-700">
                              <p className="text-xs text-amber-400 mb-1">* Solo necesitas UNO de estos:</p>
                              <p className="text-xs text-slate-400">• <code className="text-cyan-400">pdf_template_name</code>: Nombre del template (ej: "invoice_template")</p>
                              <p className="text-xs text-slate-400">• <code className="text-cyan-400">template_id</code>: UUID del template</p>
                            </div>
                          )}
                        </div>
                        <div className="relative">
                          <pre className="bg-slate-900 border border-slate-700 text-slate-100 p-4 rounded-lg overflow-x-auto text-sm">
                            {endpoint.requestBody?.example && JSON.stringify(endpoint.requestBody.example, null, 2)}
                          </pre>
                          <button
                            onClick={() =>
                              endpoint.requestBody?.example && copyToClipboard(
                                JSON.stringify(endpoint.requestBody.example, null, 2),
                                `${endpoint.id}-request`
                              )
                            }
                            className="absolute top-2 right-2 p-2 bg-slate-800 hover:bg-slate-700 rounded transition-colors"
                          >
                            {copiedCode === `${endpoint.id}-request` ? (
                              <Check className="w-4 h-4 text-green-400" />
                            ) : (
                              <Copy className="w-4 h-4 text-slate-400" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <h4 className="text-sm font-semibold text-white uppercase tracking-wider">Responses</h4>
                  {endpoint.responses.map((response, idx) => (
                    <div key={idx}>
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className={`px-2 py-1 rounded text-xs font-bold ${
                            response.code.startsWith('2')
                              ? 'bg-green-500 text-white'
                              : response.code.startsWith('4')
                              ? 'bg-amber-500 text-white'
                              : 'bg-red-500 text-white'
                          }`}
                        >
                          {response.code}
                        </span>
                        <span className="text-sm text-slate-300">{response.description}</span>
                      </div>
                      <div className="relative">
                        <pre className="bg-slate-900 border border-slate-700 text-slate-100 p-4 rounded-lg overflow-x-auto text-sm">
                          {JSON.stringify(response.example, null, 2)}
                        </pre>
                        <button
                          onClick={() =>
                            copyToClipboard(
                              JSON.stringify(response.example, null, 2),
                              `${endpoint.id}-response-${idx}`
                            )
                          }
                          className="absolute top-2 right-2 p-2 bg-slate-800 hover:bg-slate-700 rounded transition-colors"
                        >
                          {copiedCode === `${endpoint.id}-response-${idx}` ? (
                            <Check className="w-4 h-4 text-green-400" />
                          ) : (
                            <Copy className="w-4 h-4 text-slate-400" />
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );

  const renderTemplates = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Templates y Variables</h2>
        <p className="text-slate-300 mb-4">
          El sistema soporta dos tipos de templates que trabajan juntos para crear comunicaciones complejas.
        </p>
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 mb-6">
        <h3 className="text-lg font-semibold text-white mb-4">Tipos de Templates</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-900 border border-slate-700 rounded p-4">
            <h4 className="text-cyan-400 font-semibold mb-2">Template de Email</h4>
            <p className="text-slate-300 text-sm mb-3">
              Define el contenido HTML del email que se envía al destinatario.
            </p>
            <ul className="text-slate-300 text-xs space-y-1">
              <li>• Puede enviarse inmediatamente</li>
              <li>• Puede esperar un PDF adjunto</li>
              <li>• Soporta logos, QR codes y variables</li>
            </ul>
          </div>
          <div className="bg-slate-900 border border-slate-700 rounded p-4">
            <h4 className="text-amber-400 font-semibold mb-2">Template de PDF</h4>
            <p className="text-slate-300 text-sm mb-3">
              Define el contenido HTML que se convierte en PDF para adjuntar a emails.
            </p>
            <ul className="text-slate-300 text-xs space-y-1">
              <li>• Genera PDFs dinámicos (facturas, recibos)</li>
              <li>• Se asocia con templates de email</li>
              <li>• Nombre de archivo personalizable</li>
            </ul>
          </div>
        </div>
        <div className="mt-4 bg-blue-500/10 border border-blue-500/30 rounded p-4">
          <p className="text-blue-400 text-sm">
            <strong>Ejemplo:</strong> Un template de PDF "Factura" genera el PDF, y un template de email
            "Confirmación con Factura" espera ese PDF antes de enviarse. Así separas la lógica del PDF del email.
          </p>
        </div>
      </div>

      <h3 className="text-lg font-semibold text-white mb-4">Sistema de Templates Avanzado</h3>
      <p className="text-slate-300 text-sm mb-4">
        El sistema soporta un motor de templates completo con variables, loops y condicionales.
      </p>

      <div className="grid gap-4 mb-8">
        {[
          {
            type: 'Variables Simples',
            syntax: '{{variable_name}}',
            description: 'Reemplaza el placeholder con el valor proporcionado',
            example: '<h1>Hola {{client_name}}</h1>\n<p>Total: {{total}}</p>',
          },
          {
            type: 'Variables Anidadas',
            syntax: '{{object.property}}',
            description: 'Accede a propiedades anidadas en objetos',
            example: '<p>RUT: {{issuer.rut}}</p>\n<p>Razón Social: {{issuer.razon_social}}</p>',
          },
          {
            type: 'Loops (Arrays)',
            syntax: '{{#each array}} ... {{/each}}',
            description: 'Itera sobre arrays de objetos o valores simples',
            example: `{{#each items}}
  <tr>
    <td>{{descripcion}}</td>
    <td>{{cantidad}}</td>
    <td>{{precio_unitario}}</td>
    <td>{{total}}</td>
  </tr>
{{/each}}`,
          },
          {
            type: 'Variables Especiales en Loops',
            syntax: '{{@index}} {{@number}}',
            description: 'Variables automáticas dentro de loops',
            example: `{{#each items}}
  <div>Item #{{@number}}: {{this}}</div>
  <!-- @index empieza en 0, @number empieza en 1 -->
{{/each}}`,
          },
          {
            type: 'Condicionales',
            syntax: '{{#if condition}} ... {{/if}}',
            description: 'Muestra contenido solo si la condición es verdadera',
            example: `{{#if has_discount}}
  <p>Descuento aplicado: {{discount_amount}}</p>
{{/if}}`,
          },
          {
            type: 'Condicionales con Else',
            syntax: '{{#if condition}} ... {{else}} ... {{/if}}',
            description: 'Muestra contenido alternativo si la condición es falsa',
            example: `{{#if has_discount}}
  <p class="text-green">Con descuento</p>
{{else}}
  <p class="text-gray">Sin descuento</p>
{{/if}}`,
          },
          {
            type: 'Logo (Base64 o URL)',
            syntax: '{{company_logo}}',
            description: 'Convierte automáticamente a imagen embebida',
            example: 'Configurar has_logo=true en el template',
          },
          {
            type: 'Código QR',
            syntax: '{{appointment_code_qr}}',
            description: 'Genera un código QR automáticamente del valor',
            example: 'Configurar has_qr=true en el template',
          },
        ].map((variable, idx) => (
          <div key={idx} className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
            <div className="flex items-start justify-between mb-2">
              <h3 className="font-semibold text-white">{variable.type}</h3>
              <code className="text-sm bg-slate-900 px-2 py-1 rounded text-cyan-400">{variable.syntax}</code>
            </div>
            <p className="text-slate-300 text-sm mb-3">{variable.description}</p>
            <div className="bg-slate-900 border border-slate-700 rounded p-3">
              <p className="text-xs text-slate-400 mb-1">Ejemplo:</p>
              <pre className="text-sm text-slate-200 whitespace-pre-wrap">{variable.example}</pre>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/30 rounded-lg p-6">
        <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Info className="w-5 h-5 text-cyan-400" />
          Ejemplo Completo: Factura con Items
        </h4>
        <p className="text-slate-300 text-sm mb-4">
          Así se vería un template completo de factura usando variables anidadas y loops:
        </p>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-slate-400 mb-2">Template HTML:</p>
            <pre className="bg-slate-900 border border-slate-700 text-slate-100 p-4 rounded-lg overflow-x-auto text-xs">
{`<h1>Factura {{numero_cfe}}</h1>
<p>Emisor: {{razon_social_emisor}}</p>
<p>RUT: {{rut_emisor}}</p>
<p>Fecha: {{fecha_emision}}</p>

<table>
  <thead>
    <tr>
      <th>Descripción</th>
      <th>Cant.</th>
      <th>P. Unit.</th>
      <th>Total</th>
    </tr>
  </thead>
  <tbody>
    {{#each items}}
    <tr>
      <td>{{descripcion}}</td>
      <td>{{cantidad}}</td>
      <td>\${{precio_unitario}}</td>
      <td>\${{total}}</td>
    </tr>
    {{/each}}
  </tbody>
</table>

<p>Subtotal: \${{subtotal}}</p>
<p>IVA: \${{iva}}</p>
<p>Total: \${{total}}</p>

{{#if datos_adicionales.observaciones}}
<p>Obs: {{datos_adicionales.observaciones}}</p>
{{/if}}`}
            </pre>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-2">Datos JSON:</p>
            <pre className="bg-slate-900 border border-slate-700 text-slate-100 p-4 rounded-lg overflow-x-auto text-xs">
{`{
  "numero_cfe": "INV-001",
  "razon_social_emisor": "Mi Empresa",
  "rut_emisor": "211234560018",
  "fecha_emision": "2025-10-22",
  "items": [
    {
      "descripcion": "Servicio A",
      "cantidad": 2,
      "precio_unitario": 100,
      "total": 200
    },
    {
      "descripcion": "Servicio B",
      "cantidad": 1,
      "precio_unitario": 150,
      "total": 150
    }
  ],
  "subtotal": 350,
  "iva": 77,
  "total": 427,
  "datos_adicionales": {
    "observaciones": "Pago al contado"
  }
}`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );

  const renderExamples = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Ejemplos de Integración</h2>
        <p className="text-slate-300 mb-4">
          Ejemplos prácticos de cómo integrar la API en diferentes escenarios.
        </p>
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 mb-6">
        <h3 className="text-lg font-semibold text-white mb-2">Configuración Previa</h3>
        <p className="text-slate-300 text-sm mb-4">
          Antes de usar el flujo con PDFs, necesitas crear dos templates en la plataforma:
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-900 border border-slate-700 rounded p-4">
            <h4 className="text-cyan-400 font-semibold mb-2">1. Template de PDF</h4>
            <ul className="text-slate-300 text-sm space-y-1">
              <li>• <strong>Tipo:</strong> PDF</li>
              <li>• <strong>Nombre:</strong> invoice_pdf</li>
              <li>• <strong>Contenido:</strong> HTML de la factura</li>
              <li>• <strong>Nombre archivo:</strong> factura_{`{{invoice_number}}`}.pdf</li>
            </ul>
          </div>
          <div className="bg-slate-900 border border-slate-700 rounded p-4">
            <h4 className="text-green-400 font-semibold mb-2">2. Template de Email</h4>
            <ul className="text-slate-300 text-sm space-y-1">
              <li>• <strong>Tipo:</strong> Email</li>
              <li>• <strong>Nombre:</strong> invoice_email</li>
              <li>• <strong>PDF Asociado:</strong> invoice_pdf</li>
              <li>• <strong>Contenido:</strong> Email de confirmación</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 mb-6">
        <h3 className="text-lg font-semibold text-white mb-4">Opción 1: Envío Automático con PDF (Recomendado)</h3>
        <p className="text-slate-300 text-sm mb-4">
          Cuando asocias un template de PDF con un template de email, el sistema automáticamente genera y adjunta el PDF. Solo necesitas una llamada:
        </p>
        <div className="bg-green-500/10 border border-green-500/30 rounded p-4 mb-4">
          <p className="text-green-400 text-sm">
            ✓ El sistema detecta el template de PDF asociado<br/>
            ✓ Genera el PDF con los datos proporcionados<br/>
            ✓ Lo adjunta automáticamente al email<br/>
            ✓ Envía el email completo en una sola operación
          </p>
        </div>
        <div className="border-l-4 border-green-500 pl-4">
          <h4 className="font-semibold text-white mb-2">Enviar email con PDF automático</h4>
          <p className="text-slate-300 text-sm mb-3">Una sola llamada hace todo el trabajo</p>
          <div className="relative">
            <pre className="bg-slate-900 border border-slate-700 text-slate-100 p-4 rounded-lg overflow-x-auto text-sm">
{`curl -X POST ${supabaseUrl}/functions/v1/send-email \\
  -H "x-api-key: tu_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "template_name": "invoice_email",
    "recipient_email": "cliente@example.com",
    "data": {
      "client_name": "Juan Pérez",
      "invoice_number": "FAC-2025-001",
      "invoice_date": "2025-10-21",
      "items": "Consulta veterinaria",
      "total": "$150.00"
    }
  }'`}
            </pre>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            El sistema generará automáticamente el PDF "factura_FAC-2025-001.pdf" y lo adjuntará al email.
          </p>
        </div>
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Opción 2: Flujo con Comunicaciones Pendientes</h3>
        <p className="text-slate-300 text-sm mb-4">
          Para casos donde necesitas esperar datos de múltiples sistemas antes de enviar:
        </p>
        <div className="space-y-4">
          {[
            {
              step: 1,
              title: 'Crear comunicación pendiente',
              description: 'Tu app crea el registro inmediatamente después de la cita',
              code: `curl -X POST ${supabaseUrl}/functions/v1/pending-communication/create \\
  -H "x-api-key: tu_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "template_name": "invoice_email",
    "recipient_email": "cliente@example.com",
    "base_data": {
      "client_name": "Juan Pérez",
      "service": "Consulta"
    },
    "pending_fields": ["invoice_pdf"],
    "external_reference_id": "INV-001",
    "external_system": "billing"
  }'`,
            },
            {
              step: 2,
              title: 'Generar el PDF',
              description: 'Tu sistema de facturación genera el PDF usando el template',
              code: `curl -X POST ${supabaseUrl}/functions/v1/generate-pdf \\
  -H "x-api-key: tu_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "pdf_template_name": "invoice_pdf",
    "data": {
      "client_name": "Juan Pérez",
      "invoice_number": "FAC-2025-001",
      "invoice_date": "2025-10-21",
      "items": "Consulta veterinaria",
      "total": "$150.00"
    },
    "external_reference_id": "INV-001"
  }'`,
            },
            {
              step: 3,
              title: 'Completar la comunicación',
              description: 'Envía el PDF generado para completar y enviar el email',
              code: `curl -X POST ${supabaseUrl}/functions/v1/pending-communication/complete \\
  -H "Content-Type: application/json" \\
  -d '{
    "external_reference_id": "INV-001",
    "data": {
      "invoice_pdf": "JVBERi0xLjQK...",
      "invoice_number": "FAC-2025-001"
    }
  }'`,
            },
          ].map((step) => (
            <div key={step.step} className="border-l-4 border-blue-500 pl-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                  {step.step}
                </div>
                <h4 className="font-semibold text-white">{step.title}</h4>
              </div>
              <p className="text-slate-300 text-sm mb-3">{step.description}</p>
              <div className="relative">
                <pre className="bg-slate-900 border border-slate-700 text-slate-100 p-4 rounded-lg overflow-x-auto text-sm">
                  {step.code}
                </pre>
                <button
                  onClick={() => copyToClipboard(step.code, `example-${step.step}`)}
                  className="absolute top-2 right-2 p-2 bg-slate-800 hover:bg-slate-700 rounded transition-colors"
                >
                  {copiedCode === `example-${step.step}` ? (
                    <Check className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4 text-slate-400" />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (activeSection) {
      case 'introduction':
        return renderIntroduction();
      case 'authentication':
        return renderAuthentication();
      case 'email-config':
        return renderEmailConfig();
      case 'endpoints':
        return renderEndpoints();
      case 'templates':
        return renderTemplates();
      case 'examples':
        return renderExamples();
      default:
        return renderIntroduction();
    }
  };

  return (
    <Layout currentPage="documentation">
      <div className="flex gap-6 -mt-8 -mx-8 h-[calc(100vh-8rem)]">
        <aside className="w-64 bg-slate-800/30 border-r border-slate-700 overflow-y-auto">
          <div className="p-4">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Documentación
            </h2>
            <nav className="space-y-1">
              {sections.map((section) => {
                const Icon = section.icon;
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                      activeSection === section.id
                        ? 'bg-cyan-500/10 text-cyan-400'
                        : 'text-slate-400 hover:bg-slate-700/50 hover:text-white'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {section.title}
                  </button>
                );
              })}
            </nav>
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto p-8">
          {renderContent()}
        </main>
      </div>
    </Layout>
  );
}
