import type { AppLanguage } from '@/composables/useSettings';

export interface Memory {
  summary: string;
  notes: string;
}

export const MEMORY_SUMMARY_MAX_CHARS = 240;
export const MEMORY_NOTES_MAX_CHARS = 500;

const MEMORY_HEADINGS: Record<AppLanguage, { interests: string; concerns: string }> = {
  english: { interests: 'Likes & Interests', concerns: 'Concerns & Recent Topics' },
  cebuano: { interests: 'Mga Gusto ug Interes', concerns: 'Mga Kabalaka ug Bag-ong Hilisgutan' },
  tagalog: { interests: 'Mga Hilig at Interes', concerns: 'Mga Alalahanin at Kamakailang Paksa' },
};

/** Localize both section labels and remove duplicate bullets from old saved notes. */
export function normalizeMemoryHeadings(notes: string, language: AppLanguage): string {
  if (!notes.trim()) return '';
  let headingCount = 0;
  const seenBullets = new Set<string>();
  const lines: string[] = [];
  for (const line of notes.split(/\r?\n/)) {
    if (/^\s*(?:#{1,6}\s+.+|\*\*.+\*\*|__.+__)\s*$/.test(line)) {
      headingCount += 1;
      const label = headingCount === 1
        ? MEMORY_HEADINGS[language].interests
        : headingCount === 2 ? MEMORY_HEADINGS[language].concerns : null;
      lines.push(label ? `**${label}**` : line);
      continue;
    }
    const bullet = line.match(/^\s*[-*+]\s+(.+?)\s*$/)?.[1];
    if (bullet) {
      const key = bullet.toLowerCase();
      if (seenBullets.has(key)) continue;
      seenBullets.add(key);
    }
    lines.push(line);
  }
  if (headingCount === 0) return `**${MEMORY_HEADINGS[language].interests}**\n${lines.join('\n')}`;
  return lines.join('\n');
}

/**
 * Validates the model's memory output. Never lets malformed JSON overwrite
 * memory that the senior already has.
 */
export function parseMemory(raw: string): Memory | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!value || typeof value !== 'object') return null;
  const { summary, notes } = value as Record<string, unknown>;
  if (typeof summary !== 'string' || typeof notes !== 'string') return null;
  const cleanSummary = summary.replace(/\s+/g, ' ').trim();
  const cleanNotes = notes.trim();
  if (cleanSummary.length > MEMORY_SUMMARY_MAX_CHARS || cleanNotes.length > MEMORY_NOTES_MAX_CHARS) return null;
  if (!cleanSummary && !cleanNotes) return null;
  return { summary: cleanSummary, notes: cleanNotes };
}
