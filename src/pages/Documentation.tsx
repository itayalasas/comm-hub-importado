import { useState } from 'react';
import { Book, Code, Zap, Mail, Clock, CheckCircle, Copy, Check } from 'lucide-react';
import { Layout } from '../components/Layout';

export default function Documentation() {
  const [copiedEndpoint, setCopiedEndpoint] = useState<string | null>(null);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedEndpoint(id);
    setTimeout(() => setCopiedEndpoint(null), 2000);
  };

  const endpoints = [
    {
      id: 'send-email',
      title: 'Enviar Email Directo',
      icon: Mail,
      method: 'POST',
      endpoint: `${supabaseUrl}/functions/v1/send-email`,
      description: 'Envía un email inmediatamente usando un template.',
      headers: [
        { key: 'x-api-key', value: 'tu_api_key', required: true },
        { key: 'Content-Type', value: 'application/json', required: true },
      ],
      body: {
        template_name: 'welcome',
        recipient_email: 'cliente@example.com',
        data: {
          client_name: 'Juan Pérez',
          appointment_date: '2025-10-25',
          cta_url: 'https://dogcatify.com/confirmar',
        },
      },
      response: {
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
      useCases: [
        'Confirmaciones de citas',
        'Emails de bienvenida',
        'Notificaciones urgentes',
        'Recordatorios simples',
      ],
    },
    {
      id: 'pending-create',
      title: 'Crear Comunicación Pendiente',
      icon: Clock,
      method: 'POST',
      endpoint: `${supabaseUrl}/functions/v1/pending-communication/create`,
      description: 'Crea una comunicación que espera datos externos (ej: PDF de facturación).',
      headers: [
        { key: 'x-api-key', value: 'tu_api_key', required: true },
        { key: 'Content-Type', value: 'application/json', required: true },
      ],
      body: {
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
      response: {
        success: true,
        message: 'Pending communication created',
        data: {
          id: 'uuid-123',
          external_reference_id: 'INVOICE-12345',
          status: 'waiting_data',
          complete_url: `${supabaseUrl}/functions/v1/pending-communication/complete`,
        },
      },
      useCases: [
        'Facturas con PDF adjunto',
        'Reportes que requieren procesamiento',
        'Certificados personalizados',
        'Documentos legales',
      ],
    },
    {
      id: 'pending-complete',
      title: 'Completar Comunicación Pendiente',
      icon: CheckCircle,
      method: 'POST',
      endpoint: `${supabaseUrl}/functions/v1/pending-communication/complete`,
      description: 'Completa una comunicación pendiente con los datos faltantes y envía el email automáticamente.',
      headers: [
        { key: 'Content-Type', value: 'application/json', required: true },
      ],
      body: {
        external_reference_id: 'INVOICE-12345',
        data: {
          invoice_pdf: 'JVBERi0xLjQKJeLjz9MKMyAwIG9iago8PC...',
          invoice_number: 'FAC-2025-001',
          total_amount: '$150.00',
        },
      },
      response: {
        success: true,
        message: 'Communication completed and sent',
        log_id: 'uuid-456',
      },
      useCases: [
        'Sistema de facturación envía PDF generado',
        'CRM completa información del cliente',
        'Sistema de reportes agrega gráficos',
        'Procesador de pagos agrega recibo',
      ],
    },
    {
      id: 'pending-status',
      title: 'Consultar Estado de Comunicación',
      icon: Zap,
      method: 'GET',
      endpoint: `${supabaseUrl}/functions/v1/pending-communication/status?external_reference_id=INVOICE-12345`,
      description: 'Consulta el estado actual de una comunicación pendiente.',
      headers: [],
      response: {
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
      useCases: [
        'Monitorear progreso de envío',
        'Debugging de problemas',
        'Dashboard de estado',
        'Auditoría de comunicaciones',
      ],
    },
  ];

  const flowExample = {
    title: 'Flujo Completo: Email con Factura',
    steps: [
      {
        step: 1,
        title: 'Usuario completa cita en tu app',
        code: null,
        description: 'El cliente termina su cita veterinaria.',
      },
      {
        step: 2,
        title: 'Tu app crea comunicación pendiente',
        code: `POST ${supabaseUrl}/functions/v1/pending-communication/create
{
  "template_name": "invoice_email",
  "recipient_email": "cliente@example.com",
  "base_data": {
    "client_name": "Juan Pérez",
    "pet_name": "Max",
    "service": "Consulta veterinaria"
  },
  "pending_fields": ["invoice_pdf"],
  "external_reference_id": "VET-INVOICE-001",
  "external_system": "billing"
}`,
        description: 'Creas el registro inmediatamente, sin esperar el PDF.',
      },
      {
        step: 3,
        title: 'Sistema de facturación genera PDF',
        code: null,
        description: 'Tu sistema de facturación procesa y genera el PDF (puede tomar minutos).',
      },
      {
        step: 4,
        title: 'Sistema de facturación completa comunicación',
        code: `POST ${supabaseUrl}/functions/v1/pending-communication/complete
{
  "external_reference_id": "VET-INVOICE-001",
  "data": {
    "invoice_pdf": "JVBERi0xLjQKJeLjz9...",
    "invoice_number": "FAC-2025-001",
    "total": "$150.00"
  }
}`,
        description: 'El sistema envía el PDF y el email se envía automáticamente.',
      },
      {
        step: 5,
        title: 'Cliente recibe email con factura',
        code: null,
        description: 'El email llega con todos los datos + PDF adjunto.',
      },
      {
        step: 6,
        title: 'Webhook notifica a tu sistema',
        code: `POST https://tu-crm.com/webhooks/email-sent
{
  "event": "communication_sent",
  "external_reference_id": "VET-INVOICE-001",
  "log_id": "uuid-789",
  "sent_at": "2025-10-21T10:05:02Z"
}`,
        description: 'Tu sistema recibe confirmación de envío exitoso.',
      },
    ],
  };

  const templateVariables = [
    {
      type: 'Texto Simple',
      example: '{{client_name}}',
      description: 'Reemplazado por el valor en data.client_name',
      usage: '<h1>Hola {{client_name}}</h1>',
    },
    {
      type: 'Logo (Base64 o URL)',
      example: '{{company_logo}}',
      description: 'Convertido automáticamente a imagen',
      usage: 'Se configura en el template como has_logo=true',
    },
    {
      type: 'Código QR',
      example: '{{appointment_code_qr}}',
      description: 'Genera QR automáticamente del valor',
      usage: 'Se configura en el template como has_qr=true',
    },
    {
      type: 'PDF Adjunto',
      example: 'invoice_pdf en pending_fields',
      description: 'PDF en base64 que se adjunta al email',
      usage: 'Enviado via pending communication',
    },
  ];

  return (
    <Layout currentPage="documentation">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Documentación de API</h1>
          <p className="text-slate-300">
            Guía completa para integrar tu sistema con nuestro servicio de comunicaciones.
          </p>
        </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <Book className="w-6 h-6 text-blue-600 mt-1 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-blue-900 mb-2">Antes de comenzar</h3>
            <p className="text-blue-800 mb-3">
              Necesitas tu API Key. La encuentras en la sección de Settings.
            </p>
            <div className="bg-white border border-blue-200 rounded p-3 font-mono text-sm">
              x-api-key: ak_production_xxxxxxxxxxxxx
            </div>
          </div>
        </div>
      </div>

      <div className="bg-slate-800/50 rounded-lg border border-slate-700">
        <div className="border-b border-slate-700 p-4">
          <h2 className="text-xl font-semibold text-white">Endpoints Disponibles</h2>
        </div>

        <div className="divide-y divide-slate-700">
          {endpoints.map((endpoint) => {
            const Icon = endpoint.icon;
            return (
              <div key={endpoint.id} className="p-6">
                <div className="flex items-start gap-4 mb-4">
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <Icon className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-white mb-1">
                      {endpoint.title}
                    </h3>
                    <p className="text-slate-300 mb-3">{endpoint.description}</p>

                    <div className="flex items-center gap-2 mb-4">
                      <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded">
                        {endpoint.method}
                      </span>
                      <code className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded text-sm text-slate-200 overflow-x-auto">
                        {endpoint.endpoint}
                      </code>
                      <button
                        onClick={() => copyToClipboard(endpoint.endpoint, endpoint.id)}
                        className="p-2 text-slate-400 hover:text-slate-300 hover:bg-slate-700 rounded transition-colors"
                        title="Copiar endpoint"
                      >
                        {copiedEndpoint === endpoint.id ? (
                          <Check className="w-4 h-4 text-green-600" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </div>

                    {endpoint.headers.length > 0 && (
                      <div className="mb-4">
                        <h4 className="text-sm font-semibold text-slate-200 mb-2">Headers</h4>
                        <div className="space-y-1">
                          {endpoint.headers.map((header, idx) => (
                            <div
                              key={idx}
                              className="flex items-center gap-2 text-sm font-mono text-slate-300"
                            >
                              <span className="font-semibold">{header.key}:</span>
                              <span>{header.value}</span>
                              {header.required && (
                                <span className="text-xs text-red-600">(requerido)</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {endpoint.body && (
                      <div className="mb-4">
                        <h4 className="text-sm font-semibold text-slate-200 mb-2">Body</h4>
                        <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto text-sm">
                          {JSON.stringify(endpoint.body, null, 2)}
                        </pre>
                      </div>
                    )}

                    <div className="mb-4">
                      <h4 className="text-sm font-semibold text-slate-200 mb-2">Respuesta</h4>
                      <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto text-sm">
                        {JSON.stringify(endpoint.response, null, 2)}
                      </pre>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-slate-200 mb-2">Casos de uso</h4>
                      <ul className="grid grid-cols-2 gap-2">
                        {endpoint.useCases.map((useCase, idx) => (
                          <li
                            key={idx}
                            className="flex items-center gap-2 text-sm text-slate-300"
                          >
                            <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                            {useCase}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-slate-800/50 rounded-lg border border-slate-700">
        <div className="border-b border-slate-700 p-4">
          <h2 className="text-xl font-semibold text-white">
            {flowExample.title}
          </h2>
        </div>
        <div className="p-6">
          <div className="space-y-6">
            {flowExample.steps.map((step) => (
              <div key={step.step} className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-semibold">
                    {step.step}
                  </div>
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-white mb-1">{step.title}</h4>
                  <p className="text-slate-300 mb-2">{step.description}</p>
                  {step.code && (
                    <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto text-sm">
                      {step.code}
                    </pre>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-slate-800/50 rounded-lg border border-slate-700">
        <div className="border-b border-slate-700 p-4">
          <h2 className="text-xl font-semibold text-white">Variables de Template</h2>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            {templateVariables.map((variable, idx) => (
              <div
                key={idx}
                className="border border-slate-700 rounded-lg p-4"
              >
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-semibold text-white">{variable.type}</h4>
                  <code className="text-sm bg-slate-900 px-2 py-1 rounded text-cyan-400">
                    {variable.example}
                  </code>
                </div>
                <p className="text-slate-300 text-sm mb-2">{variable.description}</p>
                <div className="bg-slate-900 border border-slate-700 rounded p-3">
                  <p className="text-xs text-slate-400 mb-1">Uso:</p>
                  <code className="text-sm text-slate-200">{variable.usage}</code>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <Code className="w-6 h-6 text-amber-600 mt-1 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-amber-900 mb-2">Soporte y Ayuda</h3>
            <p className="text-amber-800">
              Si tienes dudas o necesitas ayuda con la integración, contacta con el equipo de
              soporte técnico.
            </p>
          </div>
        </div>
      </div>
      </div>
    </Layout>
  );
}
