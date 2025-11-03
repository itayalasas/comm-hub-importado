import { useAuth } from '../contexts/AuthContext';

const ROUTE_TO_PERMISSION_MAP: Record<string, string> = {
  'dashboard': 'dashboard',
  'templates': 'templates',
  'statistics': 'estadisticas',
  'documentation': 'documentacion',
  'settings': 'configuracion',
};

export const usePermissions = (menu: string) => {
  const { hasPermission, user } = useAuth();

  const permissionKey = ROUTE_TO_PERMISSION_MAP[menu] || menu;

  return {
    canCreate: hasPermission(permissionKey, 'create'),
    canRead: hasPermission(permissionKey, 'read'),
    canUpdate: hasPermission(permissionKey, 'update'),
    canDelete: hasPermission(permissionKey, 'delete'),
    hasAccess: hasPermission(permissionKey, 'read'),
    role: user?.role,
    permissions: user?.permissions?.[permissionKey] || [],
  };
};
