import { useAuth } from '../contexts/AuthContext';

export const usePermissions = (menu: string) => {
  const { hasPermission, user } = useAuth();

  return {
    canCreate: hasPermission(menu, 'create'),
    canRead: hasPermission(menu, 'read'),
    canUpdate: hasPermission(menu, 'update'),
    canDelete: hasPermission(menu, 'delete'),
    hasAccess: hasPermission(menu, 'read'),
    role: user?.role,
    permissions: user?.permissions?.[menu] || [],
  };
};
