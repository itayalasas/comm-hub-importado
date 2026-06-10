import { MarketingPage } from '../components/MarketingPage';

const FAQ = [
  {
    question: '¿Cuándo conviene SMTP en lugar de API?',
    answer: 'Conviene si ya tienes integraciones legacy o si quieres reutilizar clientes, librerías y flujos que dependen de SMTP.',
  },
  {
    question: 'Puedo usarlo junto con la API?',
    answer: 'Sí. El objetivo es que tengas flexibilidad y no dependas de un solo modo de integración.',
  },
  {
    question: 'Funciona con mi stack actual?',
    answer: 'Si tu sistema envía correo por host, puerto, usuario y contraseña, probablemente lo puedas conectar sin reescribir todo.',
  },
];

const structuredData = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'SendCraft',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  description: 'SMTP para integraciones que necesitan compatibilidad inmediata y control de envío.',
  url: 'https://sendcraft.net/smtp',
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

export const Smtp = () => {
  return (
    <MarketingPage
      seo={{
        title: 'SMTP para aplicaciones y sistemas',
        description:
          'Conecta tu app con SMTP para enviar correos de forma compatible, segura y sin cambiar tu arquitectura actual.',
        path: '/smtp',
        canonicalUrl: 'https://sendcraft.net/smtp',
        keywords: ['SMTP', 'smtp email', 'servidor smtp', 'envío de correos smtp'],
        structuredData: [structuredData, faqSchema],
      }}
      eyebrow="SMTP"
      headline={
        <>
          SMTP para aplicaciones que necesitan compatibilidad inmediata y control de envío.
        </>
      }
      description="Si tu stack ya usa librerías SMTP, puedes seguir trabajando con el mismo flujo y sumar control, trazabilidad y una plataforma unificada."
      primaryAction={{ label: 'Ver documentación', to: '/docs' }}
      secondaryAction={{ label: 'Ir a API Email', to: '/api-email' }}
      navLinks={[
        { label: 'Documentación', to: '/docs' },
        { label: 'API Email', to: '/api-email' },
        { label: 'Precios', to: '/precios' },
      ]}
      stats={[
        { value: '587', label: 'Puerto típico' },
        { value: 'TLS', label: 'Conexión segura' },
        { value: 'Stack', label: 'Compatible con legado' },
        { value: 'API', label: 'Alternativa moderna' },
      ]}
      highlights={[
        {
          tag: 'Legacy',
          title: 'Compatible con flujos existentes',
          description: 'No tienes que abandonar de golpe las integraciones que ya envían por SMTP.',
        },
        {
          tag: 'Security',
          title: 'Seguridad y buenas prácticas',
          description: 'Usa TLS, credenciales y configuración clara para mantener el control del envío.',
        },
        {
          tag: 'Bridge',
          title: 'Puente hacia la API',
          description: 'Puedes empezar con SMTP y luego migrar a un modelo API first si lo necesitas.',
        },
      ]}
      features={[
        {
          title: 'Host y puerto conocidos',
          description: 'La configuración clásica funciona para sistemas que esperan credenciales SMTP.',
        },
        {
          title: 'Integración rápida',
          description: 'Ideal para herramientas, scripts y aplicaciones que ya tienen soporte SMTP nativo.',
        },
        {
          title: 'Transición gradual',
          description: 'Permite mover primero el envío y luego modernizar el resto del stack a tu ritmo.',
        },
        {
          title: 'Misma plataforma, menos fragmentación',
          description: 'Unificas marketing, transaccional y documentos en un solo lugar.',
        },
        {
          title: 'Mejor observabilidad',
          description: 'Ganas logs y visibilidad incluso si tu aplicación sigue hablando SMTP.',
        },
        {
          title: 'Listo para equipos mixtos',
          description: 'Sirve para desarrolladores nuevos y para sistemas que ya no quieres reescribir.',
        },
      ]}
      steps={[
        {
          title: 'Configura credenciales',
          description: 'Define host, puerto, usuario y contraseña como lo haría cualquier cliente SMTP.',
        },
        {
          title: 'Apunta tu app',
          description: 'Actualiza la configuración en tu backend, worker o herramienta de envío.',
        },
        {
          title: 'Monitorea resultados',
          description: 'Revisa logs y comportamiento para validar que todo siga estable.',
        },
      ]}
      faq={FAQ}
      relatedLinks={[
        { label: 'API para email', to: '/api-email', description: 'Cuando quieras un flujo REST más moderno.' },
        { label: 'Email transaccional', to: '/email-transaccional', description: 'Para confirmaciones, alertas y PDF.' },
        { label: 'Documentación', to: '/docs', description: 'Guía técnica de integración y ejemplos.' },
      ]}
    />
  );
};

export default Smtp;
