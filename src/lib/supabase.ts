import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { configManager } from './config';

let supabaseInstance: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!supabaseInstance) {
    if (!configManager.isLoaded()) {
      throw new Error('Configuration not loaded. Ensure app is initialized.');
    }

    const supabaseUrl = configManager.supabaseUrl;
    const supabaseAnonKey = configManager.supabaseAnonKey;

    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
  }

  return supabaseInstance;
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const instance = getSupabase();
    const value = (instance as any)[prop];
    return typeof value === 'function' ? value.bind(instance) : value;
  }
});
