import { MarketingPage } from '../components/MarketingPage';

const FAQ = [
  {
    question: '¿Para qué equipo tiene sentido cambiar de SendGrid?',
    answer: 'Para equipos que quieren unificar marketing y transaccional, o que necesitan más control de marca y operación.',
  },
  {
    question: '¿Puedo usar templates y API a la vez?',
    answer: 'Sí. La plataforma se adapta tanto a equipos técnicos como a equipos de marketing.',
  },
  {
    question: '¿Es buena para SaaS?',
    answer: 'Sí. El foco en API, multi-tenant y trazabilidad la hace especialmente útil para productos y plataformas.',
  },
];

const structuredData = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'SendCraft',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  description: 'Alternativa a SendGrid para email marketing, SMTP y correos transaccionales con una experiencia unificada.',
  url: 'https://sendcraft.net/alternativa-sendgrid',
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

export const AlternativaSendgrid = () => {
  return (
    <MarketingPage
      seo={{
        title: 'Alternativa a SendGrid',
        description:
          'SendCraft es una alternativa a SendGrid para marketing, SMTP y email transaccional con una plataforma más simple de operar.',
        path: '/alternativa-sendgrid',
        canonicalUrl: 'https://sendcraft.net/alternativa-sendgrid',
        keywords: ['alternativa a sendgrid', 'sendgrid alternative', 'email transactional platform'],
        structuredData: [structuredData, faqSchema],
      }}
      eyebrow="Comparativa"
      headline={
        <>
          Alternativa a <span className="text-cyan-300">SendGrid</span> para marketing, SMTP y correo transaccional.
        </>
      }
      description="Si quieres una experiencia más unificada para marketing y correo crítico, SendCraft simplifica la operación sin perder control técnico."
      primaryAction={{ label: 'Ver API email', to: '/api-email' }}
      secondaryAction={{ label: 'Ver SMTP', to: '/smtp' }}
      navLinks={[
        { label: 'API Email', to: '/api-email' },
        { label: 'SMTP', to: '/smtp' },
        { label: 'Precios', to: '/precios' },
      ]}
      stats={[
        { value: 'API', label: 'Primero' },
        { value: 'SMTP', label: 'Disponible' },
        { value: 'PDF', label: 'Incluido' },
        { value: 'Ops', label: 'Menos fricción' },
      ]}
      highlights={[
        {
          tag: 'Simple',
          title: 'Menos piezas para operar',
          description: 'Unifica proveedores, credenciales y tipos de comunicación dentro de una sola plataforma.',
        },
        {
          tag: 'Product',
          title: 'Orientada a producto y negocio',
          description: 'No solo es infraestructura de email: también es una capa operativa para tu equipo.',
        },
        {
          tag: 'Crecimiento',
          title: 'Lista para crecer',
          description: 'Las comparativas y landings ayudan a atraer personas que están evaluando opciones reales.',
        },
      ]}
      features={[
        {
          title: 'Unifica marketing y transaccional',
          description: 'Evita separar campañas, templates y eventos críticos en herramientas distintas.',
        },
        {
          title: 'Menos configuración dispersa',
          description: 'Reduce el trabajo de mantener varios proveedores y paneles en paralelo.',
        },
        {
          title: 'API y SMTP',
          description: 'Ofrece flexibilidad para equipos nuevos y para integraciones existentes.',
        },
        {
          title: 'Templates y documentos',
          description: 'No solo envías texto: también puedes construir correos ricos y PDF adjuntos.',
        },
        {
          title: 'Trazabilidad útil',
          description: 'Convierte el envío en un flujo observable y más fácil de depurar.',
        },
        {
          title: 'Marca y control',
          description: 'Te da más autonomía sobre la forma en la que operas tu canal de email.',
        },
      ]}
      steps={[
        {
          title: 'Mira dónde estás perdiendo tiempo',
          description: 'Identifica si el problema actual es costo, complejidad, soporte o falta de unificación.',
        },
        {
          title: 'Migra un caso concreto',
          description: 'Empieza por una plantilla o un flujo de envío y valida el cambio con datos reales.',
        },
        {
          title: 'Consolida la operación',
          description: 'Si el piloto funciona, mueve el resto de tus comunicaciones al mismo stack.',
        },
      ]}
      faq={FAQ}
      relatedLinks={[
        { label: 'API para email', to: '/api-email', description: 'Rest API para conectar tu backend.' },
        { label: 'Email marketing', to: '/email-marketing', description: 'Campañas y automatizaciones.' },
        { label: 'Precios', to: '/precios', description: 'Planes y alternativas para evaluar el cambio.' },
      ]}
    />
  );
};

export default AlternativaSendgrid;
