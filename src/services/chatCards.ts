export type SupplementalCardKind = 'map' | 'benefits';
export type CardDecision = SupplementalCardKind | 'none';
export type ConversationTurn = { role: 'user' | 'model'; text: string };

/** Streams the answer field from Gemini's structured response without exposing routing metadata. */
export function createChatResponseStream() {
  let raw = '';
  let cursor = 0;
  let answerStart = -1;
  let answerComplete = false;
  let streamedAnswer = '';

  return {
    push(chunk: string): string {
      raw += chunk;

      if (answerStart < 0) {
        const field = /"answer"\s*:\s*"/.exec(raw);
        if (!field) return '';
        answerStart = field.index + field[0].length;
        cursor = answerStart;
      }

      let visible = '';
      while (cursor < raw.length && !answerComplete) {
        const char = raw[cursor];
        if (char === '"') {
          answerComplete = true;
          cursor += 1;
          break;
        }
        if (char !== '\\') {
          visible += char;
          cursor += 1;
          continue;
        }

        if (cursor + 1 >= raw.length) break;
        const escape = raw[cursor + 1];
        const escapedCharacters: Record<string, string> = {
          '"': '"',
          '\\': '\\',
          '/': '/',
          b: '\b',
          f: '\f',
          n: '\n',
          r: '\r',
          t: '\t',
        };
        if (escape === 'u') {
          if (cursor + 6 > raw.length) break;
          const hex = raw.slice(cursor + 2, cursor + 6);
          if (!/^[\da-f]{4}$/i.test(hex)) throw new Error('Invalid Gemini response encoding.');
          visible += String.fromCharCode(Number.parseInt(hex, 16));
          cursor += 6;
          continue;
        }
        if (!(escape in escapedCharacters)) throw new Error('Invalid Gemini response encoding.');
        visible += escapedCharacters[escape];
        cursor += 2;
      }

      streamedAnswer += visible;
      return visible;
    },

    finish(): { answer: string; cardKind: CardDecision } {
      const parsed: unknown = JSON.parse(raw.trim());
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Gemini returned an invalid chat response.');
      }
      const response = parsed as Record<string, unknown>;
      if (typeof response.answer !== 'string' || !answerComplete) {
        throw new Error('Gemini returned an incomplete chat response.');
      }
      if (response.cardKind !== 'none' && response.cardKind !== 'map' && response.cardKind !== 'benefits') {
        throw new Error('Gemini returned an invalid card decision.');
      }
      if (!response.answer.startsWith(streamedAnswer)) {
        throw new Error('Gemini returned an inconsistent streamed answer.');
      }
      return { answer: response.answer, cardKind: response.cardKind };
    },
  };
}
