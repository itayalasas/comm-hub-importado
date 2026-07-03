import { Link, useLocation } from 'react-router-dom';
import { Workflow, CalendarClock, Send, Activity } from 'lucide-react';

const SECTIONS = [
  {
    label: 'Programados',
    description: 'Crear y gestionar envios programados.',
    to: '/automatizaciones/programados',
    icon: CalendarClock,
  },
  {
    label: 'En lote',
    description: 'Disparar envios masivos y reutilizables.',
    to: '/automatizaciones/en-lote',
    icon: Send,
  },
  {
    label: 'Monitoreo',
    description: 'Ver trazas, jobs y estado operativo.',
    to: '/automatizaciones/monitoreo',
    icon: Activity,
  },
] as const;

export const AutomationPageHeader = ({
  title,
  description,
}: {
  title: string;
  description: string;
}) => {
  const location = useLocation();

  return (
    <div className="space-y-4">
      <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">
        <Workflow className="h-3.5 w-3.5" />
        Automatizaciones
      </div>

      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold text-white">{title}</h1>
        <p className="max-w-3xl text-sm text-slate-400">{description}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {SECTIONS.map((section) => {
          const active = location.pathname === section.to || location.pathname.startsWith(`${section.to}/`);
          const Icon = section.icon;

          return (
            <Link
              key={section.to}
              to={section.to}
              className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? 'border-cyan-400/30 bg-cyan-500/15 text-cyan-200'
                  : 'border-slate-700 bg-slate-800/40 text-slate-400 hover:bg-slate-800/70 hover:text-white'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{section.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
};
