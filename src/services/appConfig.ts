/**
 * Runtime configuration. Mirrors lib/services/app_config.dart.
 * Values are read from Vite env vars (.env).
 */
export const appConfig = {
  supabaseUrl: (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? '',
  supabasePublishableKey:
    (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ?? '',
  useMockData: import.meta.env.VITE_USE_MOCK_DATA === 'true',
};

export const isBackendConfigured = (): boolean =>
  !!appConfig.supabaseUrl && !!appConfig.supabasePublishableKey;
