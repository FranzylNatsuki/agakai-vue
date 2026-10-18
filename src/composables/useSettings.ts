import { computed, reactive } from 'vue';
import en from '@/locales/en.json';
import bis from '@/locales/bis.json';
import tl from '@/locales/tl.json';

/** Supported languages. Add a new one here + a locales/<code>.json file. */
export type AppLanguage = 'bisaya' | 'tagalog' | 'english';

export const APP_LANGUAGES: { id: AppLanguage; code: string; nativeLabel: string }[] = [
  { id: 'english', code: 'en', nativeLabel: 'English' },
  { id: 'bisaya', code: 'bis', nativeLabel: 'Bisaya' },
  { id: 'tagalog', code: 'tl', nativeLabel: 'Tagalog' },
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

const LANGUAGE_KEY = 'agakai_ui_language';
const storedLanguage = typeof localStorage === 'undefined'
  ? null
  : localStorage.getItem(LANGUAGE_KEY);
const initialLanguage: AppLanguage = APP_LANGUAGES.some((item) => item.id === storedLanguage)
  ? storedLanguage as AppLanguage
  : 'english';
const TEXT_SIZE_KEY = 'agakai_text_size_index';
const storedTextSize = typeof localStorage === 'undefined'
  ? null
  : Number(localStorage.getItem(TEXT_SIZE_KEY));
const initialTextSizeIndex: TextSizeIndex = storedTextSize === 1 || storedTextSize === 2
  ? storedTextSize
  : 0;

const state = reactive({
  language: initialLanguage,
  textScale: initialTextSizeIndex === 0 ? 1 : initialTextSizeIndex === 1 ? 1.2 : 1.4,
  textSizeIndex: initialTextSizeIndex,
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
    let value = TRANSLATIONS[state.language][key] ?? TRANSLATIONS.english[key] ?? key;
    if (args) {
      for (const [k, v] of Object.entries(args)) {
        value = value.split(`{${k}}`).join(String(v));
      }
    }
    return value;
  }

  function setLanguage(lang: AppLanguage) {
    state.language = lang;
    if (typeof localStorage !== 'undefined') localStorage.setItem(LANGUAGE_KEY, lang);
  }

  function setTextSizeIndex(index: TextSizeIndex) {
    state.textSizeIndex = index;
    state.textScale = index === 0 ? 1 : index === 1 ? 1.2 : 1.4;
    if (typeof localStorage !== 'undefined') localStorage.setItem(TEXT_SIZE_KEY, String(index));
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
