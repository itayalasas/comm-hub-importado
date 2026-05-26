import { querySingle } from './queryApi';

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
    const { data, error } = await querySingle<{
      id: string;
      user_id: string | null;
      tenant_id: string | null;
    }>({
      table: 'applications',
      operation: 'select',
      select: 'id, user_id, tenant_id',
      filters: [
        { column: 'id', op: 'eq', value: applicationId },
      ],
      limit: 1,
    });

    if (error || !data) return false;

    // Direct owner
    if (data.user_id === userId) return true;

    // Same tenant — all tenant members have access
    if (tenantId && data.tenant_id && data.tenant_id === tenantId) return true;

    return false;
  } catch {
    return false;
  }
}
