import { MarketingPage } from '../components/MarketingPage';

const FAQ = [
  {
    question: 'La API sirve para aplicaciones web y backend?',
    answer: 'Si. Puedes llamarla desde tu backend, workers, jobs o cualquier servicio que haga requests HTTP.',
  },
  {
    question: 'Necesito usar SMTP obligatoriamente?',
    answer: 'No. La plataforma ofrece un enfoque API first, aunque tambien soporta SMTP cuando lo necesitas.',
  },
  {
    question: 'Puedo enviar correos con templates?',
    answer: 'Si. Puedes usar plantillas y variables para mantener consistencia sin generar HTML a mano cada vez.',
  },
];

const structuredData = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'SendCraft',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  description: 'API para enviar correos, disparar templates y registrar el estado de las comunicaciones.',
  url: 'https://sendcraft.net/api-email',
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

export const ApiEmail = () => {
  return (
    <MarketingPage
      seo={{
        title: 'API para enviar correos desde tu app',
        description:
          'Integra una API de email para enviar correos transaccionales, templates y automatizaciones desde tu backend o frontend.',
        path: '/api-email',
        canonicalUrl: 'https://sendcraft.net/api-email',
        keywords: ['API email', 'api para enviar correos', 'email api', 'envio de correos por API'],
        structuredData: [structuredData, faqSchema],
      }}
      eyebrow="API email"
      headline={
        <>
          API para enviar correos desde tu app sin complicar tu backend.
        </>
      }
      description="Integra envios con endpoints REST, usa variables en templates y controla el resultado de cada comunicacion desde una sola plataforma."
      primaryAction={{ label: 'Leer la documentacion', to: '/docs' }}
      secondaryAction={{ label: 'Ver SMTP', to: '/smtp' }}
      navLinks={[
        { label: 'Documentacion', to: '/docs' },
        { label: 'Transaccional', to: '/email-transaccional' },
        { label: 'Precios', to: '/precios' },
      ]}
      stats={[
        { value: 'REST', label: 'Integracion directa' },
        { value: 'JSON', label: 'Payloads simples' },
        { value: 'Keys', label: 'Autenticacion' },
        { value: 'Logs', label: 'Observabilidad' },
      ]}
      highlights={[
        {
          tag: 'DX',
          title: 'Pensada para desarrolladores',
          description: 'Mensajes claros, estructura simple y flujos que no obligan a reescribir la app completa.',
        },
        {
          tag: 'Control',
          title: 'Claves y permisos',
          description: 'Cada aplicacion puede operar con su propia API key y su propio contexto.',
        },
        {
          tag: 'Scale',
          title: 'Crecimiento sin friccion',
          description: 'Empiezas con pocos envios y luego escalas sin cambiar de herramienta.',
        },
      ]}
      features={[
        {
          title: 'Endpoints claros',
          description: 'Usa rutas simples para enviar correos, validar estados y operar con templates.',
        },
        {
          title: 'Variables dinamicas',
          description: 'Inserta datos de cliente, pedidos o eventos sin generar HTML nuevo para cada caso.',
        },
        {
          title: 'Respuesta trazable',
          description: 'Registra cada accion para saber que paso con el mensaje y su estado.',
        },
        {
          title: 'Control de errores',
          description: 'Te permite diagnosticar y reintentar cuando el flujo no termina como esperabas.',
        },
        {
          title: 'Compatible con tu stack',
          description: 'Funciona igual de bien si usas Node, PHP, Python, Go o cualquier backend HTTP.',
        },
        {
          title: 'Un solo proveedor',
          description: 'Marketing, transaccional y PDF viven en la misma plataforma para reducir complejidad.',
        },
      ]}
      steps={[
        {
          title: 'Crea tu API key',
          description: 'Asigna permisos a cada aplicacion para mantener separadas las credenciales.',
        },
        {
          title: 'Define el payload',
          description: 'Envias los datos del destinatario, template y variables que el mensaje necesita.',
        },
        {
          title: 'Recibe la respuesta',
          description: 'Tu sistema registra el resultado y sigue el flujo con la informacion devuelta.',
        },
      ]}
      faq={FAQ}
      relatedLinks={[
        { label: 'Email transaccional', to: '/email-transaccional', description: 'Ideal para confirmaciones, alertas y documentos.' },
        { label: 'SMTP', to: '/smtp', description: 'Si tu integracion ya habla SMTP y quieres mantener compatibilidad.' },
        { label: 'Documentacion', to: '/docs', description: 'Ejemplos de request, response y conectores.' },
      ]}
    />
  );
};

export default ApiEmail;
