import { useEffect, useState } from 'react';
import { querySelect } from '../lib/queryApi';

export interface OnboardingStep {
  id: 'application' | 'template' | 'send';
  title: string;
  description: string;
  route: string;
  done: boolean;
}

interface UseOnboardingProgressResult {
  steps: OnboardingStep[];
  allDone: boolean;
  loading: boolean;
}

async function existsForApplications(table: string, applicationIds: string[]): Promise<boolean> {
  if (applicationIds.length === 0) return false;

  const { data, error } = await querySelect<{ id: string }>({
    table,
    operation: 'select',
    select: 'id',
    filters: [{ column: 'application_id', op: 'in', value: applicationIds }],
    limit: 1,
  });

  if (error) return false;
  return (data?.length || 0) > 0;
}

export function useOnboardingProgress(applicationIds: string[]): UseOnboardingProgressResult {
  const [hasTemplate, setHasTemplate] = useState(false);
  const [hasSent, setHasSent] = useState(false);
  const [loading, setLoading] = useState(true);

  const hasApplication = applicationIds.length > 0;
  const applicationsKey = applicationIds.slice().sort().join(',');

  useEffect(() => {
    let cancelled = false;

    if (!hasApplication) {
      setHasTemplate(false);
      setHasSent(false);
      setLoading(false);
      return;
    }

    setLoading(true);

    Promise.all([
      existsForApplications('communication_templates', applicationIds),
      existsForApplications('email_logs', applicationIds),
    ]).then(([templateExists, sentExists]) => {
      if (cancelled) return;
      setHasTemplate(templateExists);
      setHasSent(sentExists);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationsKey, hasApplication]);

  const steps: OnboardingStep[] = [
    {
      id: 'application',
      title: 'Crear tu primera aplicación',
      description: 'Da de alta tu aplicación en Configuración para obtener tu API key.',
      route: '/settings/apps',
      done: hasApplication,
    },
    {
      id: 'template',
      title: 'Crear un template de email',
      description: 'Diseñá el contenido que vas a enviar a tus destinatarios.',
      route: '/templates',
      done: hasTemplate,
    },
    {
      id: 'send',
      title: 'Probar tu primer envío',
      description: 'Usá el API Explorer para probar /send-email sin escribir código.',
      route: '/api-explorer',
      done: hasSent,
    },
  ];

  return {
    steps,
    allDone: steps.every((step) => step.done),
    loading,
  };
}
