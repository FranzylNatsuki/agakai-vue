export type SupplementalCardKind = 'map' | 'benefits';
export type ConversationTurn = { role: 'user' | 'model'; text: string };

const CARD_MARKER_PREFIX = '[[AGAK_CARD:';
const CARD_MARKER_PATTERN = /^\[\[AGAK_CARD:(benefits|map|none)\]\][\s.!?]*$/i;

/** Holds back a short suffix so Gemini's card marker never reaches visible text or TTS. */
export function createCardDecisionStream() {
  let pending = '';
  let markerStarted = false;

  return {
    push(chunk: string): string {
      if (markerStarted) {
        pending += chunk;
        return '';
      }
      pending += chunk;
      const markerIndex = pending.toLowerCase().indexOf(CARD_MARKER_PREFIX.toLowerCase());
      if (markerIndex >= 0) {
        markerStarted = true;
        const visible = pending.slice(0, markerIndex);
        pending = pending.slice(markerIndex);
        return visible;
      }

      const safeLength = pending.length - (CARD_MARKER_PREFIX.length - 1);
      if (safeLength <= 0) return '';
      const visible = pending.slice(0, safeLength);
      pending = pending.slice(safeLength);
      return visible;
    },

    finish(): { text: string; cardKind: SupplementalCardKind | null } {
      const marker = pending.match(CARD_MARKER_PATTERN);
      if (marker) {
        return {
          text: '',
          cardKind: marker[1].toLowerCase() === 'none' ? null : marker[1].toLowerCase() as SupplementalCardKind,
        };
      }
      return {
        text: pending.replace(/\[\[AGAK_CARD:[\s\S]*$/i, '').trimEnd(),
        cardKind: null,
      };
    },
  };
}
