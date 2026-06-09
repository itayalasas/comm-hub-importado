import { MarketingPage } from '../components/MarketingPage';
import { PricingPlansSection } from '../components/PricingPlansSection';

const FAQ = [
  {
    question: 'Los planes incluyen email marketing y transaccional?',
    answer: 'Si. La idea es que puedas crecer con una sola plataforma y no con varios proveedores sueltos.',
  },
  {
    question: 'Puedo empezar y luego escalar?',
    answer: 'Si. Los planes estan pensados para entrar rapido y subir de nivel cuando tu volumen crece.',
  },
  {
    question: 'Hay soporte para equipos?',
    answer: 'Si. Los planes estan pensados para uso en equipo y para entornos multi-tenant.',
  },
];

const structuredData = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'SendCraft',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  description: 'Planes y precios de SendCraft para email marketing y comunicaciones transaccionales.',
  url: 'https://sendcraft.net/precios',
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

export const Precios = () => {
  return (
    <MarketingPage
      seo={{
        title: 'Planes y precios',
        description:
          'Consulta los planes y precios de SendCraft para email marketing, correos transaccionales, API y SMTP.',
        path: '/precios',
        canonicalUrl: 'https://sendcraft.net/precios',
        keywords: ['precios sendcraft', 'planes de email marketing', 'pricing email marketing'],
        structuredData: [structuredData, faqSchema],
      }}
      eyebrow="Precios"
      headline={
        <>
          Planes y precios pensados para crecer sin sorpresas.
        </>
      }
      description="Una pagina de precios clara ayuda tanto a convertir como a responder la duda comercial clave."
      primaryAction={{ label: 'Probar ahora', to: '/login' }}
      secondaryAction={{ label: 'Ver email marketing', to: '/email-marketing' }}
      navLinks={[
        { label: 'Email marketing', to: '/email-marketing' },
        { label: 'API Email', to: '/api-email' },
        { label: 'Documentacion', to: '/docs' },
      ]}
      stats={[
        { value: 'Claros', label: 'Sin letra chica' },
        { value: 'Escalables', label: 'Suben con tu uso' },
        { value: 'Equipo', label: 'Listos para multi-tenant' },
        { value: 'SaaS', label: 'Pensados para crecer' },
      ]}
      highlights={[
        {
          tag: 'Decision',
          title: 'Pagina para comparar y decidir',
          description: 'La pagina responde rapido una duda comercial real: cuanto cuesta y que incluye.',
        },
        {
          tag: 'Growth',
          title: 'Ruta clara al siguiente paso',
          description: 'Desde el pricing llevas al usuario a probar, leer docs o profundizar en la propuesta de valor.',
        },
      ]}
      features={[
        {
          title: 'Planes faciles de comparar',
          description: 'Evita tablas confusas: la claridad ayuda a decidir mas rapido.',
        },
        {
          title: 'Escalado progresivo',
          description: 'Cambia de plan a medida que aumentan tus envios, contactos o necesidades de equipo.',
        },
        {
          title: 'Compatible con SaaS y pymes',
          description: 'El pricing acompana tanto etapas tempranas como equipos con mas volumen.',
        },
      ]}
      faq={FAQ}
      relatedLinks={[
        { label: 'Email marketing', to: '/email-marketing', description: 'La pagina principal de producto.' },
        { label: 'Email transaccional', to: '/email-transaccional', description: 'Flujos criticos y automaciones.' },
        { label: 'Documentacion', to: '/docs', description: 'Referencia tecnica para evaluar la integracion.' },
      ]}
    >
      <div className="rounded-3xl border border-white/8 bg-white/[0.03] p-4 sm:p-6 lg:p-8">
        <PricingPlansSection />
      </div>
    </MarketingPage>
  );
};

export default Precios;
