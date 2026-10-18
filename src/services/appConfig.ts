/**
 * Runtime configuration. Mirrors lib/services/app_config.dart.
 * Values are read from Vite env vars (.env).
 */
export const appConfig = {
  supabaseUrl: (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? '',
  supabasePublishableKey:
    (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ?? '',
  geminiApiKey: ((import.meta.env.VITE_GEMINI_API_KEY as string | undefined) ?? '').trim(),
  geminiModel:
    ((import.meta.env.VITE_GEMINI_MODEL as string | undefined) ?? '').trim() ||
    'gemini-3-flash-preview',
  geminiTtsModel:
    ((import.meta.env.VITE_GEMINI_TTS_MODEL as string | undefined) ?? '').trim() ||
    'gemini-2.5-flash-preview-tts',
  groqApiKey: ((import.meta.env.VITE_GROQ_API_KEY as string | undefined) ?? '').trim(),
  whisperModel:
    ((import.meta.env.VITE_WHISPER_MODEL as string | undefined) ?? '').trim() ||
    'whisper-large-v3',
  useMockData: import.meta.env.VITE_USE_MOCK_DATA === 'true',
};

export const isBackendConfigured = (): boolean =>
  !!appConfig.supabaseUrl && !!appConfig.supabasePublishableKey;

export const isAiConfigured = (): boolean => !!appConfig.geminiApiKey;
