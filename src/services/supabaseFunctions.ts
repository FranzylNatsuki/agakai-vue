import { appConfig, isBackendConfigured } from '@/services/appConfig';
import { getSupabase } from '@/services/supabase';

export async function getAuthenticatedFunctionHeaders(): Promise<Record<string, string>> {
  if (!isBackendConfigured()) throw new Error('Agak is not available right now.');
  const { data: { session }, error } = await getSupabase().auth.getSession();
  if (error || !session) throw new Error('Sign in to use Agak.');
  return {
    apikey: appConfig.supabasePublishableKey,
    Authorization: `Bearer ${session.access_token}`,
  };
}
