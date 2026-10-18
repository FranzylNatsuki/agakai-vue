import { appConfig, isBackendConfigured } from '@/services/appConfig';
import { getSupabase } from '@/services/supabase';

/** Auth service querying `user` table by senior_id + password with mock fallback. */
export const authService = {
  async login(seniorId: string, password: string): Promise<{ id: number }> {
    const cleanId = seniorId.trim();
    const cleanPw = password.trim();

    if (isBackendConfigured()) {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('user')
        .select('id, password')
        .eq('senior_id', cleanId)
        .maybeSingle();

      if (error) {
        throw new Error(error.message);
      }
      if (!data) {
        throw new Error('Senior ID not found. Please check your ID and try again.');
      }
      if (data.password !== cleanPw) {
        throw new Error('Incorrect password. Please try again.');
      }
      return { id: Number(data.id) };
    }

    if (appConfig.useMockData) {
      return { id: 1 };
    }

    throw new Error(
      'Backend is not configured yet. Please set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env, or enable VITE_USE_MOCK_DATA=true.',
    );
  },

  async logout(): Promise<void> {
    // Session state is cleared by profileService.clear()
  },
};
