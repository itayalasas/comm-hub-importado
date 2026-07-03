import { useAuth } from '../contexts/AuthContext';

export const usePermissions = (menuKey: string) => {
  const { hasPermission, hasSubmenuAccess, user } = useAuth();

  const canCreate = hasPermission(menuKey, 'create');
  const canRead   = hasPermission(menuKey, 'read');
  const canUpdate = hasPermission(menuKey, 'update');
  const canDelete = hasPermission(menuKey, 'delete');

  const permissions: string[] = user?.permissions?.[menuKey] ?? [];

  return {
    canCreate,
    canRead,
    canUpdate,
    canDelete,
    hasAccess: canRead,
    role: user?.role,
    permissions,
    hasSubmenuAccess,
  };
};
