export interface Memory {
  summary: string;
  notes: string;
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
  const cleanSummary = summary.replace(/\s+/g, ' ').trim().slice(0, 240);
  const cleanNotes = notes.trim().slice(0, 4000);
  if (!cleanSummary && !cleanNotes) return null;
  return { summary: cleanSummary, notes: cleanNotes };
}
