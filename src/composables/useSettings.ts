import { computed, reactive } from 'vue';
import en from '@/locales/en.json';
import bis from '@/locales/bis.json';
import tl from '@/locales/tl.json';

/** Supported languages. Add a new one here + a locales/<code>.json file. */
export type AppLanguage = 'bisaya' | 'tagalog' | 'english';

export const APP_LANGUAGES: { id: AppLanguage; code: string; nativeLabel: string }[] = [
  { id: 'bisaya', code: 'bis', nativeLabel: 'Bisaya' },
  { id: 'tagalog', code: 'tl', nativeLabel: 'Tagalog' },
  { id: 'english', code: 'en', nativeLabel: 'English' },
];

const TRANSLATIONS: Record<AppLanguage, Record<string, string>> = {
  english: en,
  bisaya: bis,
  tagalog: tl,
};

/** Enlarged text multiplier (modest, so fixed layouts don't break). */
export const LARGE_TEXT_SCALE = 1.2;

const state = reactive({
  language: 'english' as AppLanguage,
  textScale: 1,
});

function applyTextScale() {
  document.documentElement.style.setProperty('--text-scale', String(state.textScale));
}

/** Single source of truth for language + text size. */
export function useSettings() {
  const largeText = computed(() => state.textScale > 1);

  function t(key: string, args?: Record<string, string | number>): string {
    let value = TRANSLATIONS[state.language][key] ?? key;
    if (args) {
      for (const [k, v] of Object.entries(args)) {
        value = value.split(`{${k}}`).join(String(v));
      }
    }
    return value;
  }

  function setLanguage(lang: AppLanguage) {
    state.language = lang;
    // TODO(backend): persist language preference.
  }

  function setLargeText(large: boolean) {
    state.textScale = large ? LARGE_TEXT_SCALE : 1;
    applyTextScale();
    // TODO(backend): persist text size preference.
  }

  return {
    state,
    language: computed(() => state.language),
    largeText,
    t,
    setLanguage,
    setLargeText,
  };
}
