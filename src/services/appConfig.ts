/** Public build-time configuration. Provider secrets belong on the server. */
export const appConfig = {
  supabaseUrl: (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? '',
  supabasePublishableKey:
    (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ?? '',
  elevenLabsFunctionUrl:
    `${((import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? '').replace(/\/$/, '')}/functions/v1/elevenlabs-voice`,
  geminiFunctionUrl:
    `${((import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? '').replace(/\/$/, '')}/functions/v1/gemini-ai`,
  useMockData: import.meta.env.VITE_USE_MOCK_DATA === 'true',
};

export const isBackendConfigured = (): boolean =>
  !!appConfig.supabaseUrl && !!appConfig.supabasePublishableKey;

export const isAiConfigured = (): boolean => isBackendConfigured();
