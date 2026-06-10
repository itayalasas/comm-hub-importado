import { MarketingPage } from '../components/MarketingPage';

const FAQ = [
  {
    question: '¿Qué es un correo transaccional?',
    answer: 'Es un email disparado por una acción concreta del usuario o del sistema: confirmación, alerta, recibo, aviso o recuperación de cuenta.',
  },
  {
    question: 'Puedo usarlo para facturas y PDFs?',
    answer: 'Sí. El flujo de SendCraft incluye generación de PDF y adjuntos para comunicaciones operativas.',
  },
  {
    question: '¿Sirve para integraciones de alta prioridad?',
    answer: 'Sí. Está pensado para eventos críticos donde importan velocidad, trazabilidad y control de entrega.',
  },
];

const structuredData = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'SendCraft',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  description:
    'Correo transaccional con API, logs, adjuntos PDF y entregabilidad para confirmaciones, alertas y facturas.',
  url: 'https://sendcraft.net/email-transaccional',
};

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ.map((item) => ({
    '@type': 'Question',
    name: item.question,
    acceptedAnswer: {
      '@type': 'Answer',
      text: item.answer,
    },
  })),
};

export const EmailTransaccional = () => {
  return (
    <MarketingPage
      seo={{
        title: 'Email transaccional con API y entregabilidad',
        description:
          'Envío de correos transaccionales para confirmaciones, alertas, facturas y notificaciones críticas con control y trazabilidad.',
        path: '/email-transaccional',
        canonicalUrl: 'https://sendcraft.net/email-transaccional',
        keywords: ['email transaccional', 'correos transaccionales', 'envío transaccional', 'API email'],
        structuredData: [structuredData, faqSchema],
      }}
      eyebrow="Transaccional"
      headline={
        <>
          Email transaccional con <span className="text-cyan-300">API</span> y entregabilidad para facturas, alertas y confirmaciones.
        </>
      }
      description="Diseñado para eventos críticos: confirmaciones de compra, recuperación de contraseña, avisos operativos y envíos con PDF."
      primaryAction={{ label: 'Abrir la API', to: '/docs' }}
      secondaryAction={{ label: 'Ver SMTP', to: '/smtp' }}
      navLinks={[
        { label: 'Documentación', to: '/docs' },
        { label: 'API Email', to: '/api-email' },
        { label: 'Precios', to: '/precios' },
      ]}
      stats={[
        { value: '<2s', label: 'Tiempo objetivo' },
        { value: 'PDF', label: 'Adjuntos y documentos' },
        { value: 'Logs', label: 'Trazabilidad' },
        { value: 'API', label: 'Integración directa' },
      ]}
      highlights={[
        {
          tag: 'Critical',
          title: 'Hecho para momentos importantes',
          description: 'Confirmaciones, alertas y facturas no pueden depender de una herramienta pensada solo para newsletters.',
        },
        {
          tag: 'Trace',
          title: 'Seguimiento de punta a punta',
          description: 'Te ayuda a saber qué se envió, cuándo y con qué resultado para depurar incidentes rápido.',
        },
        {
          tag: 'Automation',
          title: 'Integrado con eventos del sistema',
          description: 'Activa correos cuando cambian estados, se aprueba un pago o se genera un documento.',
        },
      ]}
      features={[
        {
          title: 'Confirmaciones automáticas',
          description: 'Envío de recibos, reservas, altas de usuario y movimientos críticos sin trabajo manual.',
        },
        {
          title: 'Alertas operativas',
          description: 'Notifica errores, eventos de negocio y estados de proceso con rapidez y consistencia.',
        },
        {
          title: 'Adjuntos PDF',
          description: 'Genera y adjunta documentos para que la comunicación salga completa desde el mismo flujo.',
        },
        {
          title: 'Trazabilidad y logs',
          description: 'Monitorea los envíos para diagnosticar problemas y mejorar la observabilidad del sistema.',
        },
        {
          title: 'Integración simple',
          description: 'Consume un endpoint REST o conecta por SMTP según la arquitectura que ya tengas.',
        },
        {
          title: 'Control de entregabilidad',
          description: 'Reduce errores de envío con un flujo pensado para correo crítico y no solo marketing masivo.',
        },
      ]}
      steps={[
        {
          title: 'Dispara el evento',
          description: 'Tu backend o workflow genera un evento cuando cambia un estado importante.',
        },
        {
          title: 'Construye el mensaje',
          description: 'La plataforma resuelve el template, los datos y los adjuntos necesarios.',
        },
        {
          title: 'Entrega y registra',
          description: 'El correo sale con trazabilidad para revisar entregas, aperturas y errores.',
        },
      ]}
      faq={FAQ}
      relatedLinks={[
        { label: 'API para email', to: '/api-email', description: 'Endpoints para integrarte directamente desde tu backend.' },
        { label: 'SMTP', to: '/smtp', description: 'Si ya tienes integraciones que usan host, puerto y credenciales.' },
        { label: 'Documentación', to: '/docs', description: 'Guía completa de endpoints, ejemplos y payloads.' },
      ]}
    />
  );
};

export default EmailTransaccional;
