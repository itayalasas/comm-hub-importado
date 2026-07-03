import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, Eye, Lock, Database, Globe, Trash2, Shield } from 'lucide-react';
import { Seo } from '../components/Seo';

const LAST_UPDATED = '5 de mayo de 2026';
const COMPANY = 'SendCraft';
const CONTACT_EMAIL = 'privacidad@sendcraft.app';

export const Privacy = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#020c1b] via-[#071428] to-[#020c1b] text-slate-300">
      <Seo
        title="Politica de privacidad"
        description="Politica de privacidad de SendCraft."
        path="/privacy"
        canonicalUrl="https://sendcraft.net/privacy"
        noIndex
      />

      {/* Header */}
      <header className="sticky top-0 z-10 bg-[#020c1b]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-slate-400 hover:text-cyan-400 transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver
          </button>
          <span className="text-xs text-slate-500">Última actualización: {LAST_UPDATED}</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-16">
        {/* Title */}
        <div className="mb-14 text-center">
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-3 py-1 rounded-full mb-5">
            <Shield className="w-3.5 h-3.5" />
            Privacidad & Datos
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white mb-4">Política de Privacidad</h1>
          <p className="text-slate-400 max-w-xl mx-auto">
            Tu privacidad es importante para nosotros. Esta política explica exactamente qué datos recopilamos, por qué y cómo los protegemos.
          </p>
        </div>

        {/* Quick summary */}
        <div className="mb-10 p-6 bg-cyan-500/8 border border-cyan-500/20 rounded-2xl">
          <h2 className="text-white font-bold mb-4 flex items-center gap-2">
            <Eye className="w-5 h-5 text-cyan-400" />
            Resumen rápido
          </h2>
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { icon: '🔒', title: 'No vendemos datos', desc: 'Nunca vendemos ni alquilamos tus datos a terceros.' },
              { icon: '🎯', title: 'Datos mínimos', desc: 'Solo recopilamos lo estrictamente necesario para el servicio.' },
              { icon: '🗑️', title: 'Control total', desc: 'Podés solicitar eliminación de tus datos en cualquier momento.' },
            ].map((item) => (
              <div key={item.title} className="bg-white/4 rounded-xl p-4 text-center">
                <div className="text-2xl mb-2">{item.icon}</div>
                <div className="text-white font-semibold text-sm mb-1">{item.title}</div>
                <div className="text-slate-400 text-xs">{item.desc}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-10">
          {/* 1 */}
          <Section icon={<Database className="w-5 h-5 text-cyan-400" />} title="1. Qué datos recopilamos">
            <div className="space-y-5">
              <DataGroup title="Datos de cuenta" color="cyan">
                {[
                  { field: 'Nombre y apellido', purpose: 'Identificarte como usuario de la plataforma.' },
                  { field: 'Correo electrónico', purpose: 'Acceso a la cuenta, notificaciones del servicio.' },
                  { field: 'Nombre de la empresa / tenant', purpose: 'Configuración del espacio de trabajo.' },
                  { field: 'Contraseña', purpose: 'Almacenada con hash bcrypt. Nunca en texto plano.' },
                ]}
              </DataGroup>

              <DataGroup title="Datos de uso del servicio" color="blue">
                {[
                  { field: 'Logs de emails enviados', purpose: 'Mostrar estadísticas, re-envíos y auditoría.' },
                  { field: 'Logs de PDFs generados', purpose: 'Historial y descarga de documentos generados.' },
                  { field: 'Métricas de apertura y click', purpose: 'Estadísticas de engagement de tus comunicaciones.' },
                  { field: 'API keys de aplicaciones', purpose: 'Autenticación de tus sistemas contra nuestra API.' },
                ]}
              </DataGroup>

              <DataGroup title="Datos técnicos" color="slate">
                {[
                  { field: 'Dirección IP', purpose: 'Seguridad, prevención de fraude y diagnóstico de problemas.' },
                  { field: 'User agent del navegador', purpose: 'Compatibilidad y diagnóstico técnico.' },
                  { field: 'Timestamps de acceso', purpose: 'Seguridad y auditoría de sesiones.' },
                ]}
              </DataGroup>
            </div>
          </Section>

          {/* 2 */}
          <Section icon={<Eye className="w-5 h-5 text-cyan-400" />} title="2. Cómo usamos tus datos">
            <ul className="space-y-2.5">
              {[
                ['Prestación del servicio', 'Procesamos tus datos para enviar emails, generar PDFs y mostrarte estadísticas.'],
                ['Comunicaciones del servicio', 'Te enviamos notificaciones sobre tu cuenta, alertas de seguridad y cambios importantes.'],
                ['Mejora del producto', 'Analizamos patrones de uso de forma agregada y anonimizada para mejorar la plataforma.'],
                ['Cumplimiento legal', 'Podemos usar tus datos para cumplir obligaciones legales o responder a solicitudes de autoridades competentes.'],
                ['Soporte técnico', 'Accedemos a logs específicos para diagnosticar y resolver problemas reportados.'],
              ].map(([title, desc]) => (
                <li key={title} className="flex items-start gap-3">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-cyan-400 flex-shrink-0" />
                  <div>
                    <span className="text-white font-medium">{title}: </span>
                    <span>{desc}</span>
                  </div>
                </li>
              ))}
            </ul>
          </Section>

          {/* 3 */}
          <Section icon={<Globe className="w-5 h-5 text-cyan-400" />} title="3. Compartición de datos con terceros">
            <p className="mb-4">
              <strong className="text-white">No vendemos tus datos.</strong> Solo compartimos información con terceros en los siguientes casos limitados:
            </p>
            <div className="space-y-4">
              {[
                {
                  name: 'Neon (base de datos)',
                  detail: 'Nuestros datos están almacenados en PostgreSQL sobre Neon. Aplica su política de privacidad.',
                  link: 'https://neon.tech/privacy-policy',
                },
                {
                  name: 'Resend (proveedor de email)',
                  detail: 'Cuando usás Resend como proveedor, tus emails pasan por su infraestructura.',
                  link: 'https://resend.com/legal/privacy-policy',
                },
                {
                  name: 'Tu proveedor SMTP configurado',
                  detail: 'Si configurás un servidor SMTP propio, los emails pasan por ese servidor bajo tu control total.',
                  link: null,
                },
              ].map((provider) => (
                <div key={provider.name} className="p-4 bg-white/3 border border-white/8 rounded-xl">
                  <div className="text-white font-medium text-sm mb-1">{provider.name}</div>
                  <div className="text-slate-400 text-sm">{provider.detail}</div>
                  {provider.link && (
                    <a
                      href={provider.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan-400 hover:text-cyan-300 text-xs mt-1.5 inline-block transition-colors"
                    >
                      Ver política de privacidad →
                    </a>
                  )}
                </div>
              ))}
            </div>
          </Section>

          {/* 4 */}
          <Section icon={<Lock className="w-5 h-5 text-cyan-400" />} title="4. Seguridad de los datos">
            <p className="mb-4">Implementamos medidas técnicas y organizativas para proteger tus datos:</p>
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                ['Cifrado en tránsito', 'Todas las comunicaciones usan TLS 1.2+.'],
                ['Cifrado en reposo', 'Los datos se almacenan cifrados en la base de datos.'],
                ['Contraseñas hasheadas', 'Nunca almacenamos contraseñas en texto plano.'],
                ['Row Level Security', 'Cada tenant solo puede acceder a sus propios datos.'],
                ['API keys con alcance limitado', 'Las claves tienen permisos mínimos necesarios.'],
                ['Auditoría de accesos', 'Registramos accesos para detección de anomalías.'],
              ].map(([title, desc]) => (
                <div key={title} className="flex items-start gap-2.5 p-3 bg-emerald-500/5 border border-emerald-500/15 rounded-lg">
                  <span className="mt-0.5 text-emerald-400 flex-shrink-0">✓</span>
                  <div>
                    <div className="text-white text-sm font-medium">{title}</div>
                    <div className="text-slate-400 text-xs mt-0.5">{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          {/* 5 */}
          <Section icon={<Trash2 className="w-5 h-5 text-cyan-400" />} title="5. Retención y eliminación de datos">
            <div className="space-y-3">
              <InfoRow label="Datos de cuenta" value="Se conservan mientras la cuenta esté activa. Al cancelar, se eliminan dentro de los 30 días." />
              <InfoRow label="Logs de emails" value="Se conservan por 12 meses desde la fecha de envío." />
              <InfoRow label="PDFs generados" value="Los archivos se eliminan 7 días después de generados. Los metadatos se conservan 12 meses." />
              <InfoRow label="Datos técnicos" value="Logs de acceso por 90 días, datos de seguridad por 12 meses." />
            </div>
            <div className="mt-5 p-4 bg-blue-500/8 border border-blue-500/20 rounded-xl">
              <p className="text-sm">
                <strong className="text-white">Derecho de eliminación:</strong> Podés solicitar la eliminación inmediata de todos tus datos escribiendo a{' '}
                <a href={`mailto:${CONTACT_EMAIL}`} className="text-cyan-400 hover:text-cyan-300 transition-colors">
                  {CONTACT_EMAIL}
                </a>. Procesamos estas solicitudes en un plazo máximo de 30 días.
              </p>
            </div>
          </Section>

          {/* 6 */}
          <Section icon={<Shield className="w-5 h-5 text-cyan-400" />} title="6. Tus derechos">
            <p className="mb-4">Tenés los siguientes derechos sobre tus datos personales:</p>
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                ['Acceso', 'Solicitar una copia de todos los datos que tenemos sobre vos.'],
                ['Rectificación', 'Corregir datos incorrectos o incompletos.'],
                ['Eliminación', 'Solicitar que eliminemos tus datos personales.'],
                ['Portabilidad', 'Recibir tus datos en formato estructurado y legible por máquina.'],
                ['Oposición', 'Oponerte al procesamiento de tus datos para ciertos fines.'],
                ['Limitación', 'Solicitar que limitemos el procesamiento de tus datos.'],
              ].map(([title, desc]) => (
                <div key={title} className="p-3 bg-white/3 border border-white/8 rounded-xl">
                  <div className="text-cyan-400 font-semibold text-sm mb-1">{title}</div>
                  <div className="text-slate-400 text-xs">{desc}</div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm">
              Para ejercer cualquiera de estos derechos, contactanos en{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-cyan-400 hover:text-cyan-300 transition-colors">
                {CONTACT_EMAIL}
              </a>.
            </p>
          </Section>

          {/* 7 */}
          <Section icon={<Database className="w-5 h-5 text-cyan-400" />} title="7. Cookies">
            <p>
              {COMPANY} utiliza cookies esenciales para el funcionamiento del servicio (gestión de sesión, CSRF protection). No utilizamos cookies de rastreo publicitario ni de terceros con fines de marketing.
            </p>
            <div className="mt-4 space-y-2">
              <CookieRow name="session" purpose="Autenticación y mantenimiento de sesión" type="Esencial" />
              <CookieRow name="csrf_token" purpose="Protección contra ataques CSRF" type="Esencial" />
            </div>
          </Section>

          {/* Contact */}
          <div className="p-6 bg-cyan-500/8 border border-cyan-500/20 rounded-2xl">
            <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
              <Mail className="w-4 h-4 text-cyan-400" />
              Contacto para temas de privacidad
            </h3>
            <p className="text-slate-400 text-sm">
              Para cualquier consulta o solicitud relacionada con tus datos personales, escribinos a{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-cyan-400 hover:text-cyan-300 transition-colors">
                {CONTACT_EMAIL}
              </a>.
              Respondemos en un plazo máximo de 10 días hábiles.
            </p>
          </div>
        </div>
      </main>

      <footer className="border-t border-white/5 py-8 text-center text-slate-600 text-xs">
        © {new Date().getFullYear()} {COMPANY}. Todos los derechos reservados.
      </footer>
    </div>
  );
};

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white/3 border border-white/8 rounded-2xl p-7">
      <h2 className="text-white font-bold text-xl mb-4 flex items-center gap-3">
        <span className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center flex-shrink-0">
          {icon}
        </span>
        {title}
      </h2>
      <div className="text-slate-400 leading-relaxed text-[15px]">{children}</div>
    </section>
  );
}

function DataGroup({ title, color, children }: { title: string; color: string; children: Array<{ field: string; purpose: string }> }) {
  const colors: Record<string, string> = {
    cyan: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
    blue: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    slate: 'text-slate-300 bg-slate-500/10 border-slate-500/20',
  };
  return (
    <div>
      <h3 className={`inline-flex text-xs font-semibold px-2.5 py-1 rounded-full border mb-3 ${colors[color] || colors.slate}`}>{title}</h3>
      <div className="divide-y divide-white/5 border border-white/8 rounded-xl overflow-hidden">
        {children.map((row) => (
          <div key={row.field} className="flex gap-4 px-4 py-3 text-sm">
            <span className="text-white font-medium w-44 flex-shrink-0">{row.field}</span>
            <span className="text-slate-400">{row.purpose}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 text-sm border-b border-white/5 pb-3 last:border-0 last:pb-0">
      <span className="text-slate-400 font-medium w-36 flex-shrink-0">{label}:</span>
      <span className="text-slate-300">{value}</span>
    </div>
  );
}

function CookieRow({ name, purpose, type }: { name: string; purpose: string; type: string }) {
  return (
    <div className="flex items-center gap-4 px-4 py-3 bg-white/3 border border-white/8 rounded-lg text-sm">
      <code className="text-cyan-300 font-mono w-28 flex-shrink-0">{name}</code>
      <span className="text-slate-400 flex-1">{purpose}</span>
      <span className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full flex-shrink-0">{type}</span>
    </div>
  );
}
