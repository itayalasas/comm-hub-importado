export const SYSTEM_ADMIN_EMAIL = 'administrador@sendcraft.net';

export const normalizeEmail = (email?: string | null): string =>
  String(email ?? '').trim().toLowerCase();

export const isSystemAdminEmail = (email?: string | null): boolean =>
  normalizeEmail(email) === SYSTEM_ADMIN_EMAIL;

export const isSystemAdminUser = (user?: { email?: string | null } | null): boolean =>
  isSystemAdminEmail(user?.email);
