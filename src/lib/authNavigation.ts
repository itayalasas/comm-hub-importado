import { isSystemAdminEmail } from './systemAdmin';

export const ADMIN_DASHBOARD_PATH = '/admin-dashboard';

const AUTH_MENU_PRIORITY = ['dashboard', 'templates', 'automatizaciones', 'statistics', 'documentation', 'marketplace', 'settings'];

const LEGACY_MENU_REDIRECTS: Record<string, string> = {
  analytics: 'dashboard',
  inicio: 'dashboard',
  plantillas: 'templates',
  estadisticas: 'statistics',
  stats: 'statistics',
  documentacion: 'documentation',
  docs: 'documentation',
  configuracion: 'settings',
  config: 'settings',
};

type AuthUserLike = {
  email?: string | null;
  permissions?: Record<string, unknown> | null;
};

type MenuAccessResolver = (menu: string) => boolean;

export function getPostLoginRedirectPath(user?: AuthUserLike | null): string {
  if (isSystemAdminEmail(user?.email)) {
    return ADMIN_DASHBOARD_PATH;
  }

  const permissions = user?.permissions && typeof user.permissions === 'object'
    ? Object.keys(user.permissions)
    : [];

  if (permissions.length > 0) {
    const firstMenu = permissions[0];
    return `/${LEGACY_MENU_REDIRECTS[firstMenu] || firstMenu}`;
  }

  return '/dashboard';
}

export function getDefaultAuthenticatedPath(
  hasMenuAccess: MenuAccessResolver,
  isSystemAdmin: boolean,
): string {
  if (isSystemAdmin) {
    return ADMIN_DASHBOARD_PATH;
  }

  for (const menu of AUTH_MENU_PRIORITY) {
    if (hasMenuAccess(menu)) {
      return `/${menu}`;
    }
  }

  return '/dashboard';
}
