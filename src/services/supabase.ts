import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { appConfig, isBackendConfigured } from '@/services/appConfig';

let client: SupabaseClient | null = null;

/**
 * Lazily creates the Supabase client.
 * TODO(backend): configure VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY in .env.
 */
export function getSupabase(): SupabaseClient {
  if (!isBackendConfigured()) {
    throw new Error('Supabase is not configured yet.');
  }
  if (!client) {
    client = createClient(appConfig.supabaseUrl, appConfig.supabasePublishableKey);
  }
  return client;
}
