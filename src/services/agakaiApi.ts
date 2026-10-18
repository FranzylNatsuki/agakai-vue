import { appConfig, isAiConfigured } from '@/services/appConfig';
import { transcribeElevenLabs } from '@/services/elevenLabs';
import { readSseData } from '@/services/sse';
import { benefitService } from '@/services/benefitService';
import { profileService } from '@/services/profileService';
import { parseMemory } from '@/services/memory';
import { mockAnswer } from '@/data/mock';

export type AgakEvent =
  | { type: 'transcript'; question: string }
  | { type: 'delta'; text: string }
  | { type: 'audio'; chunk: Uint8Array }
  | { type: 'done'; answer: string }
  | { type: 'error'; message: string };

export interface ChatRequest {
  text?: string;
  audioBytes?: Uint8Array;
  audioFormat?: string;
  audioMimeType?: string;
  user?: Record<string, unknown> | null;
}

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const FALLBACK_GEMINI_MODELS = ['gemini-3-flash-preview', 'gemini-flash-latest'];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function candidateModels(): string[] {
  const models = [appConfig.geminiModel, ...FALLBACK_GEMINI_MODELS].filter(Boolean);
  return [...new Set(models)];
}

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
): string {
  return [
    'You are AgakAI, a compassionate, patient, and trustworthy voice assistant for Filipino senior citizens (Lola/Lolo) under OSCA (Office of the Senior Citizens Affairs).',
    'Reply in the language the senior uses in their latest message. If they code-switch, mirror their mix naturally. Honor explicit language preferences they state in conversation or that are recorded in their support notes. Never use the app interface language as the response-language preference.',
    'Formatting & tone guidelines:',
    '- Keep answers concise (2 to 3 short sentences or a brief bulleted list) so it is quick to speak aloud and easy for an elderly person to follow.',
    '- Highlight key terms in **bold** and end with a short, warm, encouraging note.',
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
async function updateRollingUserNotes(question: string, answer: string): Promise<void> {
  if (!appConfig.geminiApiKey) return;
  try {
    const memory = await profileService.loadMemory();
    const existing = (memory.notes ?? '').trim();
    const existingSummary = (memory.summary ?? '').trim();
    for (const model of candidateModels()) {
      const url = `${GEMINI_BASE_URL}/${model}:generateContent?key=${encodeURIComponent(appConfig.geminiApiKey)}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: [
                    'You maintain the memory AgakAI keeps about a Filipino senior citizen.',
                    `Existing summary:\n${existingSummary || '(None yet)'}`,
                    `Existing notes:\n${existing || '(None yet)'}`,
                    `\nNew message from Senior: "${question}"`,
                    `AgakAI response: "${answer}"`,
                    '',
                    'Return JSON with two keys: "summary" and "notes".',
                    '',
                    'summary: one or two short sentences addressed to the senior as "you", in their language (Bisaya, Tagalog, or English as used), explaining what Agak remembers about them and how they seem to be feeling lately.',
                    'Be warm and plain. No clinical labels, no diagnoses, no advice. At most 240 characters.',
                    'If there is nothing meaningful yet, return an empty string.',
                    '',
                    'notes: concise markdown, exactly these headings:',
                    '**Likes & Interests**',
                    '- (bullets, or "None shared yet")',
                    '',
                    '**Concerns & Recent Topics**',
                    '- (bullets summarizing what they asked about or need help with)',
                    '',
                    'Merge with the existing memory; keep it short. Output JSON only.',
                  ].join('\n'),
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'OBJECT',
              properties: { summary: { type: 'STRING' }, notes: { type: 'STRING' } },
              required: ['summary', 'notes'],
            },
          },
        }),
      });
      if (!res.ok) continue;
      const data = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const raw = (data.candidates?.[0]?.content?.parts?.[0]?.text ?? '').trim();
      const parsed = parseMemory(raw);
      if (parsed) {
        await profileService.saveMemory(parsed.summary, parsed.notes || existing);
      }
      break;
    }
  } catch {
    // Non-critical background task
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
          message:
            'Gemini API key is not configured yet. Please set VITE_GEMINI_API_KEY in your .env file.',
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
      yield { type: 'done', answer };
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
        benefitService.loadRelevantBenefits(userAddress),
        profileService.loadUserNotes(),
      ]);

      const benefitsSummary = benefits
        .map((b) => `- ${b.title} (${b.dateAndLocation}): ${b.description}`)
        .join('\n');

      const systemInstruction = buildSystemInstruction(
        req.user,
        benefitsSummary,
        userNotes,
      );

      // 3. Stream answer from Gemini API (`streamGenerateContent?alt=sse`) with model fallback
      let response: Response | null = null;
      let lastStatus = 500;
      let lastErrBody = '';

      for (const model of candidateModels()) {
        const streamUrl = `${GEMINI_BASE_URL}/${model}:streamGenerateContent?alt=sse&key=${encodeURIComponent(appConfig.geminiApiKey)}`;
        const res = await fetch(streamUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: systemInstruction }],
            },
            contents: [
              {
                role: 'user',
                parts: [{ text: questionText }],
              },
            ],
            generationConfig: {
              temperature: 0.5,
              maxOutputTokens: 1200,
            },
          }),
        });

        if (res.ok && res.body) {
          response = res;
          break;
        }
        lastStatus = res.status;
        lastErrBody = await res.text().catch(() => '');
      }

      if (!response || !response.body) {
        let detail = `HTTP ${lastStatus}`;
        try {
          const parsed = JSON.parse(lastErrBody) as { error?: { message?: string } };
          if (parsed.error?.message) detail = parsed.error.message;
        } catch {
          if (lastErrBody) detail = lastErrBody;
        }
        yield {
          type: 'error',
          message: `Gemini API error (${lastStatus}): ${detail}`,
        };
        return;
      }

      let fullAnswer = '';
      let finishReason: string | null = null;

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
          fullAnswer += part.text;
          yield { type: 'delta', text: part.text };
        }
      }

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
      void updateRollingUserNotes(questionText, fullAnswer);

      // 5. The player streams ElevenLabs audio for the completed answer.
      yield { type: 'done', answer: fullAnswer };
    } catch (err) {
      yield {
        type: 'error',
        message: (err as Error).message || 'Something went wrong while contacting AgakAI.',
      };
    }
  },
};
