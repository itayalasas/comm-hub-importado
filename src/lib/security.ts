import { db } from './db';

/**
 * Returns true when the user owns the application directly OR belongs to
 * the same tenant as the application. Tenant members share all applications.
 */
export async function verifyApplicationOwnership(
  applicationId: string,
  userId: string,
  tenantId?: string | null
): Promise<boolean> {
  try {
    const { data, error } = await db
      .from('applications')
      .select('id, user_id, tenant_id')
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
