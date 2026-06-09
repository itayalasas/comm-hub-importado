import { MarketingPage } from '../components/MarketingPage';

const FAQ = [
  {
    question: 'Cuando conviene SMTP en lugar de API?',
    answer: 'Conviene si ya tienes integraciones legacy o si quieres reutilizar clientes, librerias y flujos que dependen de SMTP.',
  },
  {
    question: 'Puedo usarlo junto con la API?',
    answer: 'Si. El objetivo es que tengas flexibilidad y no dependas de un solo modo de integracion.',
  },
  {
    question: 'Funciona con mi stack actual?',
    answer: 'Si tu sistema envia correo por host, puerto, usuario y contrasena, probablemente lo puedas conectar sin reescribir todo.',
  },
];

const structuredData = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'SendCraft',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  description: 'SMTP para integraciones que necesitan compatibilidad inmediata y control de envio.',
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
        keywords: ['SMTP', 'smtp email', 'servidor smtp', 'envio de correos smtp'],
        structuredData: [structuredData, faqSchema],
      }}
      eyebrow="SMTP"
      headline={
        <>
          SMTP para aplicaciones que necesitan compatibilidad inmediata y control de envio.
        </>
      }
      description="Si tu stack ya usa librerias SMTP, puedes seguir trabajando con el mismo flujo y sumar control, trazabilidad y una plataforma unificada."
      primaryAction={{ label: 'Ver documentacion', to: '/docs' }}
      secondaryAction={{ label: 'Ir a API Email', to: '/api-email' }}
      navLinks={[
        { label: 'Documentacion', to: '/docs' },
        { label: 'API Email', to: '/api-email' },
        { label: 'Precios', to: '/precios' },
      ]}
      stats={[
        { value: '587', label: 'Puerto tipico' },
        { value: 'TLS', label: 'Conexion segura' },
        { value: 'Stack', label: 'Compatible con legado' },
        { value: 'API', label: 'Alternativa moderna' },
      ]}
      highlights={[
        {
          tag: 'Legacy',
          title: 'Compatible con flujos existentes',
          description: 'No tienes que abandonar de golpe las integraciones que ya envian por SMTP.',
        },
        {
          tag: 'Security',
          title: 'Seguridad y buenas practicas',
          description: 'Usa TLS, credenciales y configuracion clara para mantener el control del envio.',
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
          description: 'La configuracion clasica funciona para sistemas que esperan credenciales SMTP.',
        },
        {
          title: 'Integracion rapida',
          description: 'Ideal para herramientas, scripts y aplicaciones que ya tienen soporte SMTP nativo.',
        },
        {
          title: 'Transicion gradual',
          description: 'Permite mover primero el envio y luego modernizar el resto del stack a tu ritmo.',
        },
        {
          title: 'Misma plataforma, menos fragmentacion',
          description: 'Unificas marketing, transaccional y documentos en un solo lugar.',
        },
        {
          title: 'Mejor observabilidad',
          description: 'Ganas logs y visibilidad incluso si tu aplicacion sigue hablando SMTP.',
        },
        {
          title: 'Listo para equipos mixtos',
          description: 'Sirve para desarrolladores nuevos y para sistemas que ya no quieres reescribir.',
        },
      ]}
      steps={[
        {
          title: 'Configura credenciales',
          description: 'Define host, puerto, usuario y contrasena como lo haria cualquier cliente SMTP.',
        },
        {
          title: 'Apunta tu app',
          description: 'Actualiza la configuracion en tu backend, worker o herramienta de envio.',
        },
        {
          title: 'Monitorea resultados',
          description: 'Revisa logs y comportamiento para validar que todo siga estable.',
        },
      ]}
      faq={FAQ}
      relatedLinks={[
        { label: 'API para email', to: '/api-email', description: 'Cuando quieras un flujo REST mas moderno.' },
        { label: 'Email transaccional', to: '/email-transaccional', description: 'Para confirmaciones, alertas y PDF.' },
        { label: 'Documentacion', to: '/docs', description: 'Guia tecnica de integracion y ejemplos.' },
      ]}
    />
  );
};

export default Smtp;
