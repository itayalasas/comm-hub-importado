import { supabase } from './supabase';

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
    const { data, error } = await supabase
      .from('applications')
      .select('id, user_id, tenant_id')
      .eq('id', applicationId)
      .maybeSingle();

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
