import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, FileText, Shield, AlertCircle, RefreshCw, Scale } from 'lucide-react';
import { Seo } from '../components/Seo';

const LAST_UPDATED = '5 de mayo de 2026';
const COMPANY = 'SendCraft';
const CONTACT_EMAIL = 'legal@sendcraft.app';

export const Terms = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#020c1b] via-[#071428] to-[#020c1b] text-slate-300">
      <Seo
        title="Terminos de servicio"
        description="Terminos de servicio de SendCraft."
        path="/terms"
        canonicalUrl="https://sendcraft.net/terms"
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
            <Scale className="w-3.5 h-3.5" />
            Términos Legales
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white mb-4">Términos de Servicio</h1>
          <p className="text-slate-400 max-w-xl mx-auto">
            Al usar {COMPANY} aceptás estos términos. Te recomendamos leerlos completos — están escritos en lenguaje claro, sin letra chica.
          </p>
        </div>

        <div className="space-y-10">
          {/* 1 */}
          <Section icon={<FileText className="w-5 h-5 text-cyan-400" />} title="1. Qué es SendCraft">
            <p>
              {COMPANY} es una plataforma de comunicaciones transaccionales que permite a empresas y desarrolladores enviar correos electrónicos y generar documentos PDF de manera programática a través de una API REST y una interfaz web de gestión.
            </p>
            <p className="mt-3">
              El servicio incluye: envío de emails mediante proveedores SMTP o Resend, generación de PDFs desde templates HTML, gestión de aplicaciones multi-tenant, estadísticas de engagement y panel de administración.
            </p>
          </Section>

          {/* 2 */}
          <Section icon={<Shield className="w-5 h-5 text-cyan-400" />} title="2. Aceptación de los términos">
            <p>
              Al registrarte, acceder o usar {COMPANY} confirmás que:
            </p>
            <ul className="mt-3 space-y-2 list-none">
              {[
                'Tenés al menos 18 años de edad o la mayoría de edad legal en tu jurisdicción.',
                'Tenés autoridad para aceptar estos términos en nombre de tu empresa u organización si estás registrando una cuenta empresarial.',
                'Usarás el servicio de acuerdo con todas las leyes y regulaciones aplicables.',
                'La información que proporcionás es veraz, precisa y actualizada.',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <span className="mt-1 w-1.5 h-1.5 rounded-full bg-cyan-400 flex-shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </Section>

          {/* 3 */}
          <Section icon={<Mail className="w-5 h-5 text-cyan-400" />} title="3. Uso aceptable del servicio">
            <p>Podés usar {COMPANY} para enviar comunicaciones transaccionales legítimas. Esto incluye:</p>
            <ul className="mt-3 space-y-1.5">
              {[
                'Facturas, recibos y confirmaciones de compra.',
                'Notificaciones de eventos en tu sistema (registros, alertas, actualizaciones).',
                'Documentos generados automáticamente (cotizaciones, reportes).',
                'Comunicaciones operativas a usuarios que te dieron su consentimiento.',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <span className="mt-1 w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <div className="mt-5 p-4 bg-red-500/8 border border-red-500/20 rounded-xl">
              <p className="font-semibold text-red-400 mb-2 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" /> Usos prohibidos
              </p>
              <ul className="space-y-1.5">
                {[
                  'Spam o correos masivos no solicitados.',
                  'Phishing, fraude o suplantación de identidad.',
                  'Contenido ilegal, difamatorio, o que viole derechos de terceros.',
                  'Distribución de malware o código malicioso.',
                  'Eludir límites del plan de manera artificial.',
                  'Reventa del servicio sin acuerdo previo por escrito.',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-slate-400">
                    <span className="mt-1 w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Section>

          {/* 4 */}
          <Section icon={<RefreshCw className="w-5 h-5 text-cyan-400" />} title="4. Planes, pagos y cancelación">
            <p>
              {COMPANY} opera bajo un modelo de suscripción mensual. Los planes disponibles son Starter, Business y Pro, con distintos límites de uso.
            </p>
            <div className="mt-4 space-y-3">
              <InfoRow label="Facturación" value="Mensual, al inicio de cada período de facturación." />
              <InfoRow label="Moneda" value="Los precios están expresados en Pesos Uruguayos (UYU)." />
              <InfoRow label="Cancelación" value="Podés cancelar en cualquier momento. El acceso continúa hasta el final del período ya pagado." />
              <InfoRow label="Reembolsos" value="No se realizan reembolsos proporcionales por cancelaciones anticipadas. Excepcionalmente se evalúan casos de falla técnica imputable a SendCraft." />
              <InfoRow label="Cambio de plan" value="Los cambios se aplican al inicio del siguiente período de facturación." />
            </div>
          </Section>

          {/* 5 */}
          <Section icon={<Shield className="w-5 h-5 text-cyan-400" />} title="5. Propiedad intelectual">
            <p>
              <strong className="text-white">Tu contenido es tuyo.</strong> Los templates, datos y documentos que creás en {COMPANY} son de tu propiedad. Nos otorgás una licencia limitada para procesarlos con el único propósito de prestar el servicio.
            </p>
            <p className="mt-3">
              <strong className="text-white">Nuestro software.</strong> El código fuente, interfaces, marca y tecnología de {COMPANY} son propiedad de sus desarrolladores y están protegidos por leyes de propiedad intelectual. No podés copiar, modificar ni redistribuir ninguna parte del servicio sin autorización expresa.
            </p>
          </Section>

          {/* 6 */}
          <Section icon={<AlertCircle className="w-5 h-5 text-cyan-400" />} title="6. Disponibilidad y limitación de responsabilidad">
            <p>
              Nos esforzamos por mantener una disponibilidad del servicio superior al 99%. Sin embargo, no garantizamos disponibilidad ininterrumpida. Pueden ocurrir interrupciones por mantenimiento, actualizaciones o causas fuera de nuestro control.
            </p>
            <div className="mt-4 p-4 bg-amber-500/8 border border-amber-500/20 rounded-xl text-slate-400">
              <p>
                {COMPANY} no será responsable por daños indirectos, lucro cesante, pérdida de datos o interrupción del negocio derivados del uso o imposibilidad de uso del servicio. La responsabilidad total de {COMPANY} estará limitada al monto pagado en los 3 meses anteriores al evento.
              </p>
            </div>
          </Section>

          {/* 7 */}
          <Section icon={<Scale className="w-5 h-5 text-cyan-400" />} title="7. Terminación">
            <p>
              Podemos suspender o terminar tu cuenta si:
            </p>
            <ul className="mt-3 space-y-1.5">
              {[
                'Violás estos términos de servicio.',
                'Usás el servicio para actividades ilegales o fraudulentas.',
                'Hay impago reiterado de la suscripción.',
                'Tu actividad pone en riesgo la seguridad o estabilidad del servicio para otros usuarios.',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <span className="mt-1 w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3">
              En caso de terminación por tu parte, podés exportar tus datos durante los 30 días posteriores a la cancelación.
            </p>
          </Section>

          {/* 8 */}
          <Section icon={<RefreshCw className="w-5 h-5 text-cyan-400" />} title="8. Modificaciones a los términos">
            <p>
              Podemos actualizar estos términos ocasionalmente. Si los cambios son significativos, te notificaremos por email con al menos 15 días de anticipación. El uso continuado del servicio después de la notificación implica la aceptación de los términos actualizados.
            </p>
          </Section>

          {/* 9 */}
          <Section icon={<Scale className="w-5 h-5 text-cyan-400" />} title="9. Ley aplicable">
            <p>
              Estos términos se rigen por las leyes de la República Oriental del Uruguay. Cualquier disputa será sometida a la jurisdicción de los tribunales competentes de Montevideo, Uruguay.
            </p>
          </Section>

          {/* Contact */}
          <div className="p-6 bg-cyan-500/8 border border-cyan-500/20 rounded-2xl">
            <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
              <Mail className="w-4 h-4 text-cyan-400" />
              ¿Preguntas sobre estos términos?
            </h3>
            <p className="text-slate-400 text-sm">
              Escribinos a{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-cyan-400 hover:text-cyan-300 transition-colors">
                {CONTACT_EMAIL}
              </a>{' '}
              y te respondemos a la brevedad.
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

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 text-sm">
      <span className="text-slate-400 font-medium w-28 flex-shrink-0">{label}:</span>
      <span className="text-slate-300">{value}</span>
    </div>
  );
}
