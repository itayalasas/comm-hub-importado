export interface PlanFeatureDefinition {
  code: string;
  label: string;
  description: string;
  value_type: 'number' | 'boolean' | 'string';
  category: string;
  unit?: string;
  usageLabel?: string;
  aliases?: string[];
}

const FEATURE_DEFINITIONS: Record<string, PlanFeatureDefinition> = {
  total_de_correos_mensuales: {
    code: 'total_de_correos_mensuales',
    label: 'Emails / mes',
    description: 'Limite mensual de envios de correo.',
    value_type: 'number',
    category: 'usage',
    unit: 'correos',
    usageLabel: 'enviados',
  },
  pdf_generations_monthly: {
    code: 'pdf_generations_monthly',
    label: 'PDFs / mes',
    description: 'Limite mensual de PDFs generados.',
    value_type: 'number',
    category: 'usage',
    unit: 'PDFs',
    usageLabel: 'generados',
  },
  max_applications: {
    code: 'max_applications',
    label: 'Aplicaciones',
    description: 'Cantidad maxima de aplicaciones por tenant.',
    value_type: 'number',
    category: 'usage',
    unit: 'aplicaciones',
    usageLabel: 'usadas',
  },
  max_users: {
    code: 'max_users',
    label: 'Usuarios',
    description: 'Cantidad maxima de usuarios activos por tenant.',
    value_type: 'number',
    category: 'usage',
    unit: 'usuarios',
    usageLabel: 'activos',
    aliases: ['team_seats'],
  },
  templates: {
    code: 'templates',
    label: 'Templates',
    description: 'Cantidad maxima de templates disponibles.',
    value_type: 'number',
    category: 'usage',
    unit: 'templates',
    usageLabel: 'creados',
  },
  api_access: {
    code: 'api_access',
    label: 'Acceso API',
    description: 'Acceso base a las APIs publicas del producto.',
    value_type: 'boolean',
    category: 'access',
  },
  api_explorer_access: {
    code: 'api_explorer_access',
    label: 'API Explorer',
    description: 'Acceso al explorador interactivo de endpoints.',
    value_type: 'boolean',
    category: 'access',
  },
  sdk_download: {
    code: 'sdk_download',
    label: 'SDK Downloads',
    description: 'Permite descargar los SDKs instalables por lenguaje.',
    value_type: 'boolean',
    category: 'marketplace',
  },
  marketplace_embed_access: {
    code: 'marketplace_embed_access',
    label: 'Marketplace Embed',
    description: 'Permite usar la version embebible del marketplace.',
    value_type: 'boolean',
    category: 'marketplace',
  },
  automation_programs: {
    code: 'automation_programs',
    label: 'Automation Programs',
    description: 'Habilita programas, ejecuciones y campañas automatizadas.',
    value_type: 'boolean',
    category: 'automation',
  },
  monitoring_dashboard: {
    code: 'monitoring_dashboard',
    label: 'Monitoring Dashboard',
    description: 'Habilita el panel de monitoreo y trazas operativas.',
    value_type: 'boolean',
    category: 'automation',
  },
  whatsapp_access: {
    code: 'whatsapp_access',
    label: 'WhatsApp',
    description: 'Habilita las pantallas y configuraciones de WhatsApp.',
    value_type: 'boolean',
    category: 'communication',
  },
  custom_branding: {
    code: 'custom_branding',
    label: 'Custom Branding',
    description: 'Permite personalizar marca, logo y apariencia de la plataforma.',
    value_type: 'boolean',
    category: 'branding',
  },
  custom_domain: {
    code: 'custom_domain',
    label: 'Dominio personalizado',
    description: 'Permite conectar un dominio propio.',
    value_type: 'boolean',
    category: 'branding',
  },
  audit_logs: {
    code: 'audit_logs',
    label: 'Audit Logs',
    description: 'Acceso a registros de auditoria y trazabilidad.',
    value_type: 'boolean',
    category: 'security',
  },
  two_factor_auth: {
    code: 'two_factor_auth',
    label: '2FA',
    description: 'Autenticacion de doble factor.',
    value_type: 'boolean',
    category: 'security',
  },
  sso_saml: {
    code: 'sso_saml',
    label: 'SSO / SAML',
    description: 'Inicio de sesion unico con SSO o SAML.',
    value_type: 'boolean',
    category: 'security',
  },
  priority_support: {
    code: 'priority_support',
    label: 'Soporte prioritario',
    description: 'Atencion prioritaria para cuentas avanzadas.',
    value_type: 'boolean',
    category: 'support',
  },
  advanced_reports: {
    code: 'advanced_reports',
    label: 'Reportes avanzados',
    description: 'Acceso a reportes y analiticas avanzadas.',
    value_type: 'boolean',
    category: 'analytics',
  },
  configuracion_smtp: {
    code: 'configuracion_smtp',
    label: 'Configuracion SMTP',
    description: 'Permite configurar SMTP propio.',
    value_type: 'boolean',
    category: 'email',
  },
  acceso_api_resend: {
    code: 'acceso_api_resend',
    label: 'API Resend',
    description: 'Permite usar Resend como proveedor.',
    value_type: 'boolean',
    category: 'email',
  },
  acceso_api_dedicado: {
    code: 'acceso_api_dedicado',
    label: 'APIs dedicadas',
    description: 'Aprovisiona un servidor dedicado de APIs por tenant.',
    value_type: 'boolean',
    category: 'infrastructure',
    aliases: ['api_dedicada', 'dedicated_api_access'],
  },
};

export const PLAN_FEATURE_DEFINITIONS = FEATURE_DEFINITIONS;

export const PLAN_FEATURE_ORDER = [
  'total_de_correos_mensuales',
  'pdf_generations_monthly',
  'max_applications',
  'max_users',
  'templates',
  'api_access',
  'api_explorer_access',
  'sdk_download',
  'marketplace_embed_access',
  'automation_programs',
  'monitoring_dashboard',
  'whatsapp_access',
  'custom_branding',
  'custom_domain',
  'audit_logs',
  'two_factor_auth',
  'sso_saml',
  'advanced_reports',
  'priority_support',
  'configuracion_smtp',
  'acceso_api_resend',
  'acceso_api_dedicado',
] as const;

export const PLAN_FEATURE_USAGE_LABELS: Record<string, string> = {
  max_applications: 'usadas',
  max_users: 'activos',
  templates: 'creados',
  total_de_correos_mensuales: 'enviados',
  pdf_generations_monthly: 'generados',
};

const FEATURE_ALIAS_MAP: Record<string, string> = Object.values(FEATURE_DEFINITIONS).reduce<Record<string, string>>((acc, feature) => {
  feature.aliases?.forEach((alias) => {
    acc[alias] = feature.code;
  });
  return acc;
}, {});

function prettyLabel(code: string): string {
  return code
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function normalizePlanFeatureCode(code: string): string {
  const normalized = String(code || '').trim();
  return FEATURE_ALIAS_MAP[normalized] || normalized;
}

export function findPlanFeatureByCode<T extends { code: string }>(features: T[] | undefined | null, code: string): T | undefined {
  if (!features || !code) return undefined;

  const normalized = normalizePlanFeatureCode(code);
  const candidateCodes = new Set([normalized, code]);

  const canonical = FEATURE_DEFINITIONS[normalized];
  if (canonical?.aliases) {
    for (const alias of canonical.aliases) {
      candidateCodes.add(alias);
    }
  }

  return features.find((feature) => candidateCodes.has(feature.code));
}

export function getPlanFeatureLabel(code: string): string {
  const definition = FEATURE_DEFINITIONS[normalizePlanFeatureCode(code)];
  return definition?.label || prettyLabel(code);
}

export function getPlanFeatureDescription(code: string): string {
  const definition = FEATURE_DEFINITIONS[normalizePlanFeatureCode(code)];
  return definition?.description || '';
}

export function getPlanFeatureCategory(code: string): string {
  const definition = FEATURE_DEFINITIONS[normalizePlanFeatureCode(code)];
  return definition?.category || 'general';
}

export function getPlanFeatureUsageLabel(code: string): string {
  const normalized = normalizePlanFeatureCode(code);
  return PLAN_FEATURE_USAGE_LABELS[normalized] || 'usados';
}

export function getPlanFeatureOrderIndex(code: string): number {
  const normalized = normalizePlanFeatureCode(code);
  const index = PLAN_FEATURE_ORDER.indexOf(normalized as (typeof PLAN_FEATURE_ORDER)[number]);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}
