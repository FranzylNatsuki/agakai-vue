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

/** 3-tier font sizes from AgakAI (20px, 24px, 28px). */
export const TEXT_SIZES = [20, 24, 28] as const;
export type TextSizeIndex = 0 | 1 | 2;

/** Enlarged text multiplier (legacy helper). */
export const LARGE_TEXT_SCALE = 1.2;

const state = reactive({
  language: 'bisaya' as AppLanguage,
  textScale: 1,
  textSizeIndex: 0 as TextSizeIndex,
});

function applyFontSize() {
  if (typeof document !== 'undefined') {
    const px = TEXT_SIZES[state.textSizeIndex] ?? 20;
    document.documentElement.style.setProperty('--fs', `${px}px`);
    document.documentElement.style.setProperty('--text-scale', String(state.textScale));
  }
}

applyFontSize();

/** Single source of truth for language + text size. */
export function useSettings() {
  const largeText = computed(() => state.textSizeIndex > 0);
  const textSizeIndex = computed(() => state.textSizeIndex);

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

  function setTextSizeIndex(index: TextSizeIndex) {
    state.textSizeIndex = index;
    state.textScale = index === 0 ? 1 : index === 1 ? 1.2 : 1.4;
    applyFontSize();
  }

  function setLargeText(large: boolean) {
    setTextSizeIndex(large ? 1 : 0);
  }

  return {
    state,
    language: computed(() => state.language),
    largeText,
    textSizeIndex,
    t,
    setLanguage,
    setLargeText,
    setTextSizeIndex,
  };
}
