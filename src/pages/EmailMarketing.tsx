import { MarketingPage } from '../components/MarketingPage';

const FAQ = [
  {
    question: '¿Qué hace distinta a SendCraft frente a una herramienta genérica?',
    answer: 'Combina email marketing, correos transaccionales, API, SMTP y PDF en una sola plataforma, con foco en control y entregabilidad.',
  },
  {
    question: 'Puedo segmentar por cliente, tenant o lista?',
    answer: 'Sí. La plataforma está pensada para trabajar con multi-tenant y flujos de comunicación separados por aplicación o cliente.',
  },
  {
    question: '¿Sirve para automatizaciones internas?',
    answer: 'Sí. Puedes disparar envíos desde tu app, webhooks o procesos internos sin depender de campañas manuales.',
  },
  {
    question: '¿Es útil para pymes y SaaS?',
    answer: 'Sí. De hecho el contenido y la arquitectura están pensados para empresas que necesitan crecer sin perder control técnico.',
  },
];

const structuredData = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'SendCraft',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  description:
    'Plataforma de email marketing para crear campañas, automatizaciones y segmentación con analítica de aperturas y clics.',
  url: 'https://sendcraft.net/email-marketing',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
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

export const EmailMarketing = () => {
  return (
    <MarketingPage
      seo={{
        title: 'Email Marketing para empresas',
        description:
          'Crea campañas de email marketing, automatizaciones y segmentación desde una plataforma pensada para SaaS y pymes.',
        path: '/email-marketing',
        canonicalUrl: 'https://sendcraft.net/email-marketing',
        keywords: [
          'email marketing',
          'plataforma de email marketing',
          'campañas email',
          'automatización de emails',
          'email marketing para pymes',
        ],
        structuredData: [structuredData, faqSchema],
      }}
      eyebrow="Email marketing"
      headline={
        <>
          Email marketing para equipos que quieren más aperturas, <span className="text-cyan-300">más clics</span> y más control.
        </>
      }
      description="Crea campañas, segmenta audiencias, automatiza envíos y mide resultados desde una plataforma pensada para SaaS, pymes y equipos de producto."
      primaryAction={{ label: 'Probar ahora', to: '/login' }}
      secondaryAction={{ label: 'Ver precios', to: '/precios' }}
      navLinks={[
        { label: 'Precios', to: '/precios' },
        { label: 'Documentación', to: '/docs' },
        { label: 'API Email', to: '/api-email' },
      ]}
      stats={[
        { value: '99.9%', label: 'Uptime objetivo' },
        { value: '360°', label: 'Canales de envío' },
        { value: '24/7', label: 'Automatizaciones' },
        { value: '1 sitio', label: 'Marca y control' },
      ]}
      highlights={[
        {
          tag: 'Claridad',
          title: 'Landing con propuesta clara',
          description: 'Habla de email marketing de forma directa, sin esconder la propuesta detrás de un slogan genérico.',
        },
        {
          tag: 'Growth',
          title: 'Listo para convertir',
          description: 'CTA claros, FAQ y enlaces internos para llevar al usuario al siguiente paso sin fricción.',
        },
        {
          tag: 'Ops',
          title: 'Pensado para equipos técnicos',
          description: 'La plataforma no solo vende marketing: también resuelve API, SMTP y trazabilidad.',
        },
      ]}
      features={[
        {
          title: 'Campañas y automatizaciones',
          description: 'Dispara secuencias, newsletters y correos de ciclo de vida desde una sola interfaz.',
        },
        {
          title: 'Segmentación por audiencia',
          description: 'Organiza listas y flujos por cliente, tenant o tipo de comunicación para evitar mezclar contextos.',
        },
        {
          title: 'Analítica útil',
          description: 'Mide aperturas, clics y entregas para entender qué mensaje funciona mejor.',
        },
        {
          title: 'Templates reutilizables',
          description: 'Arma mensajes consistentes con variables y bloques reutilizables para acelerar operaciones.',
        },
        {
          title: 'Entregabilidad y control',
          description: 'Suma buenas prácticas de envío, dominios y reputación para proteger la bandeja de entrada.',
        },
        {
          title: 'Integración con producto',
          description: 'Conecta el marketing con tu app, tus eventos y tus datos de negocio sin procesos manuales.',
        },
      ]}
      steps={[
        {
          title: 'Define la audiencia',
          description: 'Agrupa contactos por comportamiento, segmento o cuenta para que cada envío tenga contexto.',
        },
        {
          title: 'Lanza la campaña',
          description: 'Crea el contenido, elige el objetivo y publica sin depender de flujos manuales complejos.',
        },
        {
          title: 'Mide y mejora',
          description: 'Revisa aperturas, clics y conversiones para iterar la próxima versión del mensaje.',
        },
      ]}
      faq={FAQ}
      relatedLinks={[
        { label: 'Email transaccional', to: '/email-transaccional', description: 'Para confirmaciones, alertas y facturas automatizadas.' },
        { label: 'API para email', to: '/api-email', description: 'Integra envios desde tu backend con endpoints REST.' },
        { label: 'Alternativa a Mailchimp', to: '/alternativa-mailchimp', description: 'Comparativa enfocada en control, API y marca propia.' },
      ]}
    />
  );
};

export default EmailMarketing;
