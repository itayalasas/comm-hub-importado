import { supabase } from './supabase';

export async function verifyApplicationOwnership(
  applicationId: string,
  userId: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('applications')
      .select('id')
      .eq('id', applicationId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error verifying application ownership:', error);
      return false;
    }

    return !!data;
  } catch (error) {
    console.error('Error in verifyApplicationOwnership:', error);
    return false;
  }
}
