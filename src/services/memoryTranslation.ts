import type { AppLanguage } from '@/composables/useSettings';
import { generateWithGemini } from '@/services/geminiClient';
import { normalizeMemoryHeadings, parseMemory, type Memory } from '@/services/memory';
const LANGUAGE_NAMES: Record<AppLanguage, string> = {
  english: 'English',
  cebuano: 'Cebuano',
  tagalog: 'Tagalog',
};

export async function memorySourceHash(memory: Memory): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify([memory.summary, memory.notes]));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function cacheKey(ownerId: string, sourceHash: string, language: AppLanguage): Promise<string> {
  return `agakai_memory_translation_${encodeURIComponent(ownerId)}_${language}_${sourceHash}_v4`;
}

export async function loadMemoryTranslation(
  ownerId: string,
  sourceHash: string,
  language: AppLanguage,
): Promise<Memory | null> {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(await cacheKey(ownerId, sourceHash, language));
    if (!raw) return null;
    const value = JSON.parse(raw) as { summary?: unknown; notes?: unknown };
    if (typeof value.summary !== 'string' || typeof value.notes !== 'string') return null;
    return { summary: value.summary, notes: value.notes };
  } catch {
    return null;
  }
}

export async function saveMemoryTranslation(
  ownerId: string,
  sourceHash: string,
  language: AppLanguage,
  translation: Memory,
): Promise<void> {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(
      await cacheKey(ownerId, sourceHash, language),
      JSON.stringify(translation),
    );
  } catch {
    // Translation still works for this session if local storage is unavailable.
  }
}

export function clearMemoryTranslations(ownerId: string): void {
  if (typeof localStorage === 'undefined') return;
  const prefix = `agakai_memory_translation_${encodeURIComponent(ownerId)}_`;
  for (let index = localStorage.length - 1; index >= 0; index -= 1) {
    const key = localStorage.key(index);
    if (key?.startsWith(prefix)) localStorage.removeItem(key);
  }
}

export async function translateMemory(
  memory: Memory,
  language: AppLanguage,
  signal?: AbortSignal,
): Promise<Memory> {
  const response = await generateWithGemini({
    contents: [{
      role: 'user',
      parts: [{
        text: [
          `Translate this saved personal memory into ${LANGUAGE_NAMES[language]}.`,
          'Translate every sentence, heading, and bullet into the requested language. If the source mixes languages, translate every phrase too. Do not leave source-language phrases untranslated; preserve names, numbers, dates, and essential meaning. Do not add, infer, or advise.',
          'Use natural, plain language suitable for a senior. Preserve the point of view: address the senior as “you” in the summary; do not change the senior to “I” or “me”.',
          'Keep the summary within 240 characters and the notes within 500 characters. If the source is longer, condense repetitive or less important details naturally; never cut a sentence or bullet off.',
          'Translate both section headings and all bullet contents into the requested language. Keep sections with no saved details empty; do not add placeholder bullets or duplicate a detail.',
          'Return JSON only with exactly two string fields: "summary" and "notes".',
          `Memory JSON: ${JSON.stringify(memory)}`,
        ].join('\n'),
      }],
    }],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: { summary: { type: 'STRING' }, notes: { type: 'STRING' } },
        required: ['summary', 'notes'],
      },
    },
  }, signal);

  if (!response.ok) throw new Error('Memory translation is temporarily unavailable.');
  const data = await response.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const raw = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('').trim() ?? '';
  const translated = parseMemory(raw);
  const sourceBullets = memory.notes.match(/^\s*[-*+]\s+/gm)?.length ?? 0;
  const translatedBullets = translated?.notes.match(/^\s*[-*+]\s+/gm)?.length ?? 0;
  if (
    translated &&
    (!memory.notes.trim() || (translated.notes.trim() && sourceBullets === translatedBullets))
  ) {
    return {
      ...translated,
      notes: translated.notes.trim() ? normalizeMemoryHeadings(translated.notes, language) : '',
    };
  }
  throw new Error('Memory translation is incomplete or could not be read.');
}
