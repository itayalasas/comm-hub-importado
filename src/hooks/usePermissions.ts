import { useAuth } from '../contexts/AuthContext';

const ROUTE_TO_PERMISSION_MAP: Record<string, string[]> = {
  'dashboard': ['dashboard', 'analytics', 'inicio'],
  'templates': ['templates', 'plantillas'],
  'statistics': ['statistics', 'estadisticas', 'stats'],
  'documentation': ['documentation', 'documentacion', 'docs'],
  'settings': ['settings', 'configuracion', 'config'],
};

export const usePermissions = (menu: string) => {
  const { hasPermission, user } = useAuth();

  const possibleKeys = ROUTE_TO_PERMISSION_MAP[menu] || [menu];

  let canCreate = false;
  let canRead = false;
  let canUpdate = false;
  let canDelete = false;
  let permissions: string[] = [];

  for (const key of possibleKeys) {
    if (hasPermission(key, 'create')) canCreate = true;
    if (hasPermission(key, 'read')) canRead = true;
    if (hasPermission(key, 'update')) canUpdate = true;
    if (hasPermission(key, 'delete')) canDelete = true;
    if (user?.permissions?.[key]) {
      permissions = user.permissions[key];
    }
  }

  return {
    canCreate,
    canRead,
    canUpdate,
    canDelete,
    hasAccess: canRead,
    role: user?.role,
    permissions,
  };
};
