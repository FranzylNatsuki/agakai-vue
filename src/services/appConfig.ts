/** Public build-time configuration. Provider secrets belong on the server. */
export const appConfig = {
  supabaseUrl: (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? '',
  supabasePublishableKey:
    (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ?? '',
  elevenLabsFunctionUrl:
    `${((import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? '').replace(/\/$/, '')}/functions/v1/elevenlabs-voice`,
  geminiApiKey: ((import.meta.env.VITE_GEMINI_API_KEY as string | undefined) ?? '').trim(),
  geminiModel:
    ((import.meta.env.VITE_GEMINI_MODEL as string | undefined) ?? '').trim() ||
    'gemini-3-flash-preview',
  useMockData: import.meta.env.VITE_USE_MOCK_DATA === 'true',
};

export const isBackendConfigured = (): boolean =>
  !!appConfig.supabaseUrl && !!appConfig.supabasePublishableKey;

export const isAiConfigured = (): boolean => !!appConfig.geminiApiKey;
