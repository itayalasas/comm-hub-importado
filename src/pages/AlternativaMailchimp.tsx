import { MarketingPage } from '../components/MarketingPage';

const FAQ = [
  {
    question: '¿En qué se diferencia de Mailchimp?',
    answer: 'SendCraft combina email marketing con correos transaccionales, API y control técnico, en una sola plataforma enfocada en equipos de producto.',
  },
  {
    question: '¿Puedo mantener mi marca propia?',
    answer: 'Sí. El objetivo es que tengas más control operativo y menos dependencia de una herramienta cerrada.',
  },
  {
    question: '¿Sirve para una pyme o solo para SaaS?',
    answer: 'Sirve para ambos. Las pymes ganan simplicidad y los SaaS ganan control, automatización y trazabilidad.',
  },
];

const structuredData = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'SendCraft',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  description: 'Alternativa a Mailchimp para equipos que quieren control técnico, API y transaccional en una misma plataforma.',
  url: 'https://sendcraft.net/alternativa-mailchimp',
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

export const AlternativaMailchimp = () => {
  return (
    <MarketingPage
      seo={{
        title: 'Alternativa a Mailchimp',
        description:
          'SendCraft es una alternativa a Mailchimp para email marketing, automatizaciones y correos transaccionales con más control técnico.',
        path: '/alternativa-mailchimp',
        canonicalUrl: 'https://sendcraft.net/alternativa-mailchimp',
        keywords: ['alternativa a mailchimp', 'mailchimp alternative', 'email marketing alternativa'],
        structuredData: [structuredData, faqSchema],
      }}
      eyebrow="Comparativa"
      headline={
        <>
          Una alternativa a <span className="text-cyan-300">Mailchimp</span> para equipos que necesitan API, marca propia y transaccional.
        </>
      }
      description="Si quieres menos fricción operativa y más control técnico, SendCraft unifica campañas, automatizaciones y correo crítico en un solo lugar."
      primaryAction={{ label: 'Ver email marketing', to: '/email-marketing' }}
      secondaryAction={{ label: 'Ver precios', to: '/precios' }}
      navLinks={[
        { label: 'Email marketing', to: '/email-marketing' },
        { label: 'Precios', to: '/precios' },
        { label: 'Documentación', to: '/docs' },
      ]}
      stats={[
        { value: '1 stack', label: 'Marketing + transaccional' },
        { value: 'API', label: 'Integración directa' },
        { value: 'Marca', label: 'Más control' },
        { value: 'SaaS', label: 'Pensado para crecer' },
      ]}
      highlights={[
        {
          tag: 'Control',
          title: 'Más control sobre la experiencia',
          description: 'No dependes de flujos demasiado cerrados para tu estrategia de comunicaciones.',
        },
        {
          tag: 'Unified',
          title: 'Marketing y transaccional juntos',
          description: 'Evita duplicar herramientas cuando puedes operar ambos flujos en la misma plataforma.',
        },
        {
          tag: 'Tech',
          title: 'Más amigable para producto',
          description: 'La API y los datos hacen más fácil conectar la herramienta con tu app real.',
        },
      ]}
      features={[
        {
          title: 'Menos fragmentación',
          description: 'Centraliza campañas, templates, logs y documentos en una sola superficie de control.',
        },
        {
          title: 'Más orientada a producto',
          description: 'Se adapta mejor cuando tu equipo quiere automatizar el email desde el backend.',
        },
        {
          title: 'Mejor soporte para transaccional',
          description: 'No te obliga a separar marketing y notificaciones criticas en herramientas distintas.',
        },
        {
          title: 'Uso multi-tenant',
          description: 'Ideal si vendes servicios a clientes o manejas varias aplicaciones desde una misma cuenta.',
        },
        {
          title: 'APIs y templates',
          description: 'La plataforma no solo envía: también te ayuda a organizar cómo se generan los mensajes.',
        },
        {
          title: 'Alcance y crecimiento',
          description: 'La propia web puede atraer personas que comparan soluciones como esta.',
        },
      ]}
      steps={[
        {
          title: 'Evalúa tu stack actual',
          description: 'Revisa qué necesitas hoy y qué te está costando mantener con una herramienta genérica.',
        },
        {
          title: 'Prueba el flujo',
          description: 'Convierte una campaña o una integración crítica y mide la mejora en claridad y control.',
        },
        {
          title: 'Consolida canales',
          description: 'Usa el mismo stack para marketing, alertas y documentos para reducir herramientas sueltas.',
        },
      ]}
      faq={FAQ}
      relatedLinks={[
        { label: 'Email marketing', to: '/email-marketing', description: 'Pilares de captación y automatización.' },
        { label: 'Email transaccional', to: '/email-transaccional', description: 'Notificaciones, facturas y alertas.' },
        { label: 'Precios', to: '/precios', description: 'Planes para evaluar el cambio sin compromiso.' },
      ]}
    />
  );
};

export default AlternativaMailchimp;
