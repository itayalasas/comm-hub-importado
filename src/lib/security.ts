import { db } from './db';

/**
 * Returns true when the user owns the application directly or belongs to the
 * same tenant as the application.
 */
export async function verifyApplicationOwnership(
  applicationId: string,
  userId: string,
  tenantId?: string | null
): Promise<boolean> {
  try {
    const { data, error } = await db
      .from('applications')
      .select('user_id, tenant_id')
      .eq('id', applicationId)
      .maybeSingle();

    if (error || !data) return false;

    const record = data as any;
    if (record.user_id === userId) return true;
    if (tenantId && record.tenant_id && record.tenant_id === tenantId) return true;

    return false;
  } catch {
    return false;
  }
}
