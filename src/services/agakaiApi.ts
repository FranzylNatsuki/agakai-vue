import { appConfig, isAiConfigured } from '@/services/appConfig';
import type { AppLanguage } from '@/composables/useSettings';
import { transcribeElevenLabs } from '@/services/elevenLabs';
import { readSseData } from '@/services/sse';
import { benefitService } from '@/services/benefitService';
import { localizeBenefit, type Benefit } from '@/models/benefit';
import { createCardDecisionStream, type ConversationTurn } from '@/services/chatCards';
import { profileService } from '@/services/profileService';
import { memoryUpdateStatus } from '@/services/memoryUpdateStatus';
import {
  MEMORY_NOTES_MAX_CHARS,
  normalizeMemoryHeadings,
  parseMemory,
} from '@/services/memory';
import { generateWithGemini, streamWithGemini } from '@/services/geminiClient';
import { mockAnswer } from '@/data/mock';

export type AgakEvent =
  | { type: 'transcript'; question: string }
  | { type: 'delta'; text: string }
  | { type: 'audio'; chunk: Uint8Array }
  | { type: 'done'; answer: string; cardKind: 'map' | 'benefits' | null }
  | { type: 'error'; message: string };

export interface ChatRequest {
  text?: string;
  audioBytes?: Uint8Array;
  audioFormat?: string;
  audioMimeType?: string;
  memoryLanguage?: AppLanguage;
  benefits?: Benefit[];
  userNotes?: string | null;
  history?: ConversationTurn[];
  allowCards?: boolean;
  user?: Record<string, unknown> | null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function normalizeAudioMime(format?: string, mimeType?: string): { mime: string; ext: string } {
  const rawMime = (mimeType ?? '').split(';')[0]?.trim().toLowerCase() || '';
  if (rawMime.includes('mp4') || rawMime.includes('m4a') || format === 'm4a') {
    return { mime: 'audio/mp4', ext: 'm4a' };
  }
  if (rawMime.includes('ogg') || format === 'ogg') {
    return { mime: 'audio/ogg', ext: 'ogg' };
  }
  if (rawMime.includes('wav') || format === 'wav') {
    return { mime: 'audio/wav', ext: 'wav' };
  }
  return { mime: 'audio/webm', ext: 'webm' };
}

/** Transcribes completed recordings with ElevenLabs only. */
export async function transcribeAudio(
  audioBytes: Uint8Array,
  format?: string,
  mimeType?: string,
): Promise<string> {
  const { mime, ext } = normalizeAudioMime(format, mimeType);
  return transcribeElevenLabs(audioBytes, mime, ext);
}

function buildSystemInstruction(
  user: Record<string, unknown> | null | undefined,
  benefitsList: string,
  userNotes: string | null,
  allowCards: boolean,
): string {
  return [
    'You are AgakAI, a compassionate, patient, and trustworthy voice assistant for Filipino senior citizens (Lola/Lolo) under OSCA (Office of the Senior Citizens Affairs).',
    'RESPONSE LANGUAGE: Reply in the same language as the senior’s latest message. If that message is clearly English, reply only in English—even if saved notes, profile details, benefit data, or earlier messages are in Tagalog or Cebuano. A language preference saved from earlier conversations must never override the clearly used language of the latest message. Follow a different language only when the senior explicitly requests it in their latest message. If they code-switch, mirror their mix naturally. Never infer response language from the app interface language, location, name, or support notes.',
    'Friend matching and introductions are not available. Do not invent, recommend, or claim to connect the senior with another person. If asked, say this feature is not available yet.',
    allowCards
      ? 'CARD DECISION: You decide whether an interactive card would genuinely help, using the meaning of this ordinary conversation and recent turns—not a fixed FAQ list. Choose benefits for relevant listed senior benefits, pensions, discounts, medical or medicine assistance, and free services. Choose map only when a health-care location would help. Choose none for unrelated chat or when the available data cannot support the card. The map is a generic city health-center location, not a verified nearest provider. Do not imply eligibility or current availability unless the supplied data confirms it.'
      : 'No interactive card is available in this view; answer normally without referring to cards.',
    'OUTPUT PROTOCOL: End every response with exactly one routing marker on its own final line: [[AGAK_CARD:benefits]], [[AGAK_CARD:map]], or [[AGAK_CARD:none]]. Do not mention the marker in the answer. The app removes it before showing or speaking the response.',
    'Formatting & tone guidelines:',
    '- Keep answers concise (2 to 3 short sentences or a brief bulleted list) so it is quick to speak aloud and easy for an elderly person to follow.',
    '- Highlight key terms in **bold** and end with a short, warm, encouraging note.',
    allowCards && benefitsList
      ? 'If you choose a benefits card, point to only relevant listed programs. Briefly tell the senior they can tap an item to learn more or tap See all to browse.'
      : '',
    allowCards
      ? 'If you choose a map card, tell the senior they can tap it to view the city health-center location; never call it the nearest or a verified provider.'
      : '',
    user ? `\nSenior Citizen Profile:\n${JSON.stringify(user, null, 2)}` : '',
    benefitsList ? `\nAvailable OSCA / LGU Benefits:\n${benefitsList}` : '',
    userNotes && userNotes.trim()
      ? `\nSupport Notes / Memory about this Senior:\n${userNotes}`
      : '\nSupport Notes / Memory about this Senior: (No prior memory yet — this is a new conversation.)',
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Updates the senior's rolling memory: a short plain-language summary plus notes.
 * Runs in the background after each exchange.
 */
async function updateRollingUserNotes(
  question: string,
  answer: string,
  memoryLanguage: AppLanguage = 'english',
): Promise<void> {
  const memoryLanguageName = {
    english: 'English',
    cebuano: 'Cebuano',
    tagalog: 'Tagalog',
  }[memoryLanguage];
  memoryUpdateStatus.begin();
  try {
    const memory = await profileService.loadMemory();
    const existing = (memory.notes ?? '').trim();
    const existingSummary = (memory.summary ?? '').trim();
    const res = await generateWithGemini({
      contents: [{
        role: 'user',
        parts: [{
          text: [
            'You maintain the memory AgakAI keeps about a Filipino senior citizen.',
            `Existing summary:\n${existingSummary || '(None yet)'}`,
            `Existing notes:\n${existing || '(None yet)'}`,
            `\nNew message from Senior: "${question}"`,
            `AgakAI response: "${answer}"`,
            '',
            'Return JSON with two keys: "summary" and "notes".',
            '',
            `Write the summary and all notes in ${memoryLanguageName}, matching the selected app language even if the conversation used another language. Keep every sentence, both section headings, and every bullet entirely in ${memoryLanguageName}; do not leave phrases in another language.`,
            'summary: one or two short sentences addressed to the senior as "you", explaining what Agak remembers about them and how they seem to be feeling lately.',
            'Be warm and plain. No clinical labels, no diagnoses, no advice. Rewrite it to fit within 240 characters; never cut a sentence off.',
            'If there is nothing meaningful yet, return an empty string.',
            '',
            'notes: concise Markdown with exactly two bold section headings.',
            `Translate both section headings, "Likes & Interests" and "Concerns & Recent Topics", into ${memoryLanguageName}.`,
            'Translate every bullet and all other note text into the selected memory language. Preserve the senior’s point of view. If a section has no details, leave it with its heading only; do not add placeholder bullets such as "None shared yet" or repeat a detail across sections.',
            'Rewrite notes to stay under 500 characters total, including headings. Use at most 3 short bullets per section (6 total), with the most useful or recent first; never cut a bullet off.',
            'Keep durable interests and preferences, plus only a few current or recurring concerns. Merge duplicates, replace outdated details, and remove one-off chatter.',
            'Do not save a transcript or add a new bullet for every conversation. Output JSON only.',
          ].join('\n'),
        }],
      }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: { summary: { type: 'STRING' }, notes: { type: 'STRING' } },
          required: ['summary', 'notes'],
        },
      },
    });
    if (!res.ok) return;
    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const raw = (data.candidates?.[0]?.content?.parts?.[0]?.text ?? '').trim();
    const parsed = parseMemory(raw);
    if (parsed) {
      const notes = parsed.notes || existing;
      const normalizedNotes = notes ? normalizeMemoryHeadings(notes, memoryLanguage) : '';
      if (normalizedNotes.length > MEMORY_NOTES_MAX_CHARS) return;
      await profileService.saveMemory(parsed.summary, normalizedNotes, memoryLanguage);
    }
  } catch {
    // Non-critical background task
  } finally {
    memoryUpdateStatus.end();
  }
}

/**
 * Gemini chat with ElevenLabs-only speech services.
 */
export const agakApi = {
  async *chatStream(req: ChatRequest): AsyncGenerator<AgakEvent> {
    if (!isAiConfigured()) {
      if (!appConfig.useMockData) {
        yield {
          type: 'error',
          message: 'Agak is not available right now. Please try again later.',
        };
        return;
      }

      if (req.audioBytes) {
        try {
          const question = await transcribeAudio(req.audioBytes, req.audioFormat, req.audioMimeType);
          if (!question) throw new Error("I didn't catch that clearly. Please try again or type your question.");
          yield { type: 'transcript', question };
        } catch (error) {
          yield { type: 'error', message: (error as Error).message };
          return;
        }
      }
      await sleep(700);
      let answer = '';
      for (const word of mockAnswer.split(/(\s+)/)) {
        answer += word;
        yield { type: 'delta', text: word };
        await sleep(25);
      }
      yield { type: 'done', answer, cardKind: null };
      return;
    }

    try {
      // 1. Speech-to-Text (ElevenLabs Scribe)
      let questionText = (req.text ?? '').trim();
      if (req.audioBytes && req.audioBytes.byteLength > 0) {
        questionText = await transcribeAudio(req.audioBytes, req.audioFormat, req.audioMimeType);
        if (!questionText) {
          yield {
            type: 'error',
            message: "I didn't catch that clearly. Please tap the mic and try speaking again.",
          };
          return;
        }
        yield { type: 'transcript', question: questionText };
      }

      if (!questionText) {
        yield { type: 'error', message: 'Please enter or speak a question first.' };
        return;
      }

      // 2. Gather context (benefits + support notes from Supabase)
      const userAddress = typeof req.user?.address === 'string' ? req.user.address : null;
      const [benefits, userNotes] = await Promise.all([
        req.benefits ?? benefitService.loadRelevantBenefits(userAddress),
        req.userNotes ?? profileService.loadUserNotes(),
      ]);

      const benefitsSummary = benefits
        .map((sourceBenefit) => {
          const b = localizeBenefit(sourceBenefit, 'en');
          return `- ${b.title} (${b.dateAndLocation}): ${b.description}`;
        })
        .join('\n');

      const systemInstruction = buildSystemInstruction(
        req.user,
        benefitsSummary,
        userNotes,
        req.allowCards === true,
      );

      // The authenticated Edge Function forwards Google's SSE response body directly;
      // do not buffer the stream here so answer text can appear as it is generated.
      const response = await streamWithGemini({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents: [
          ...(req.history ?? []).map(({ role, text }) => ({ role, parts: [{ text }] })),
          { role: 'user', parts: [{ text: questionText }] },
        ],
        generationConfig: { temperature: 0.5, maxOutputTokens: 1200 },
      });

      if (!response.ok || !response.body) {
        yield {
          type: 'error',
          message: 'Agak could not get a response right now. Please try again.',
        };
        return;
      }

      let fullAnswer = '';
      let finishReason: string | null = null;
      const cardDecisionStream = createCardDecisionStream();

      for await (const payload of readSseData(response.body)) {
        if (!payload || payload === '[DONE]') continue;

        let parsed: {
          error?: { message?: string };
          candidates?: Array<{
            content?: { parts?: Array<{ text?: string }> };
            finishReason?: string;
          }>;
        };
        try {
          parsed = JSON.parse(payload);
        } catch {
          throw new Error('Gemini returned an invalid streaming response.');
        }
        if (parsed.error?.message) throw new Error(parsed.error.message);

        const candidate = parsed.candidates?.[0];
        if (candidate?.finishReason) finishReason = candidate.finishReason;
        for (const part of candidate?.content?.parts ?? []) {
          if (!part.text) continue;
          const visibleText = cardDecisionStream.push(part.text);
          if (visibleText) {
            fullAnswer += visibleText;
            yield { type: 'delta', text: visibleText };
          }
        }
      }

      const cardDecision = cardDecisionStream.finish();
      if (cardDecision.text) {
        fullAnswer += cardDecision.text;
        yield { type: 'delta', text: cardDecision.text };
      }
      fullAnswer = fullAnswer.trim();

      if (finishReason === 'MAX_TOKENS') {
        yield {
          type: 'error',
          message: 'AgakAI reached its response limit, so the answer may be incomplete. Please ask for a shorter answer.',
        };
        return;
      }
      if (!finishReason) {
        yield {
          type: 'error',
          message: 'The answer stream ended before Gemini confirmed it was complete. Please try again.',
        };
        return;
      }

      if (!fullAnswer.trim()) {
        yield {
          type: 'error',
          message: 'AgakAI could not generate an answer right now. Please try again.',
        };
        return;
      }

      // 4. Update rolling user_notes in Supabase in the background
      void updateRollingUserNotes(questionText, fullAnswer, req.memoryLanguage);

      // 5. The player streams ElevenLabs audio for the completed answer.
      yield {
        type: 'done',
        answer: fullAnswer,
        cardKind: req.allowCards ? cardDecision.cardKind : null,
      };
    } catch (err) {
      yield {
        type: 'error',
        message: (err as Error).message || 'Something went wrong while contacting AgakAI.',
      };
    }
  },
};
