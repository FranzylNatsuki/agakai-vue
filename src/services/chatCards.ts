export type SupplementalCardKind = 'map' | 'benefits';

/** Keep the cards shown by the chat UI aligned with the instructions sent to Gemini. */
export function supplementalCardKind(question: string): SupplementalCardKind | null {
  const lower = question.toLowerCase();
  if (/tambal|hospital|doktor|check-?up|medical|treatment|health/.test(lower)) return 'map';
  if (/benep|benef/.test(lower)) return 'benefits';
  return null;
}
