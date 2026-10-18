import { appConfig, isAiConfigured } from '@/services/appConfig';
import { benefitService } from '@/services/benefitService';
import { profileService } from '@/services/profileService';
import { useSettings, type AppLanguage } from '@/composables/useSettings';
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
const GROQ_TRANSCRIPTIONS_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';
const FALLBACK_GEMINI_MODELS = ['gemini-3-flash-preview', 'gemini-flash-latest'];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function candidateModels(): string[] {
  const models = [appConfig.geminiModel, ...FALLBACK_GEMINI_MODELS].filter(Boolean);
  return [...new Set(models)];
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function base64ToUint8(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Wraps raw 16-bit mono PCM bytes (returned by Gemini TTS at 24kHz) in a RIFF WAV header.
 */
function pcm16ToWav(pcmBytes: Uint8Array, sampleRate = 24000, numChannels = 1): Uint8Array {
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = pcmBytes.byteLength;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format = 1
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);

  const wavBytes = new Uint8Array(buffer);
  wavBytes.set(pcmBytes, 44);
  return wavBytes;
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

/**
 * Transcribes user audio via Groq Whisper (`whisper-large-v3`), and automatically
 * falls back to Gemini multimodal audio transcription if Groq is unavailable.
 */
export async function transcribeAudio(
  audioBytes: Uint8Array,
  language: AppLanguage,
  format?: string,
  mimeType?: string,
): Promise<string> {
  const { mime, ext } = normalizeAudioMime(format, mimeType);

  // 1. Primary: Groq Whisper API (`whisper-large-v3`)
  if (appConfig.groqApiKey) {
    try {
      const form = new FormData();
      const blob = new Blob(
        [audioBytes.buffer.slice(audioBytes.byteOffset, audioBytes.byteOffset + audioBytes.byteLength) as ArrayBuffer],
        { type: mime },
      );
      form.append('file', blob, `recording.${ext}`);
      form.append('model', appConfig.whisperModel);
      form.append(
        'prompt',
        language === 'bisaya'
          ? 'Bisaya / Cebuano, Tagalog, or English question from a Filipino senior citizen about OSCA benefits, Social Pension, Senior ID, medical check-ups, or discounts.'
          : language === 'tagalog'
            ? 'Tagalog o English na tanong mula sa isang senior citizen tungkol sa OSCA benefits, Social Pension, Senior ID, o discount.'
            : 'Question from a Filipino senior citizen about OSCA benefits, Social Pension, Senior Citizen ID, or discounts.',
      );
      if (language === 'tagalog') {
        form.append('language', 'tl');
      } else if (language === 'english') {
        form.append('language', 'en');
      }

      const res = await fetch(GROQ_TRANSCRIPTIONS_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${appConfig.groqApiKey}`,
        },
        body: form,
      });

      if (res.ok) {
        const data = (await res.json()) as { text?: string };
        const text = (data.text ?? '').trim();
        if (text) return text;
      }
    } catch {
      // Fall through to Gemini audio transcription fallback
    }
  }

  // 2. Fallback: Gemini multimodal audio transcription
  if (appConfig.geminiApiKey) {
    let lastError = 'Gemini STT failed';
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
                  inlineData: {
                    mimeType: mime,
                    data: uint8ToBase64(audioBytes),
                  },
                },
                {
                  text: 'Transcribe the spoken audio accurately in its original language (Bisaya/Cebuano, Tagalog, or English). Output ONLY the raw transcription text without quotes or commentary. If the audio is silent or unintelligible, output an empty string.',
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
          },
        }),
      });

      if (res.ok) {
        const data = (await res.json()) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        };
        return (data.candidates?.[0]?.content?.parts?.[0]?.text ?? '').trim();
      }
      lastError = `Gemini STT (${model}) status ${res.status}`;
    }
    throw new Error(lastError);
  }

  throw new Error('No STT API key configured (set VITE_GROQ_API_KEY or VITE_GEMINI_API_KEY in .env).');
}

function buildSystemInstruction(
  language: AppLanguage,
  user: Record<string, unknown> | null | undefined,
  benefitsList: string,
  userNotes: string | null,
): string {
  const langInstruction =
    language === 'bisaya'
      ? 'Respond primarily in natural, warm, easy-to-understand Bisaya (Cebuano), unless the senior explicitly asks in another language.'
      : language === 'tagalog'
        ? 'Respond primarily in natural, warm, easy-to-understand Tagalog (Filipino), unless the senior explicitly asks in another language.'
        : 'Respond primarily in clear, warm, easy-to-understand Philippine English, unless the senior explicitly asks in Bisaya or Tagalog.';

  return [
    'You are AgakAI, a compassionate, patient, and trustworthy voice assistant for Filipino senior citizens (Lola/Lolo) under OSCA (Office of the Senior Citizens Affairs).',
    langInstruction,
    'Formatting & tone guidelines:',
    '- Keep answers concise (2 to 4 short sentences or a brief bulleted list) so it is easy for an elderly person to read and listen to.',
    '- Use short numbered steps or bullet points when explaining procedures (like claiming Social Pension, applying for a Senior ID, or getting medical check-ups).',
    '- Highlight key terms in **bold** and end with a short, warm, encouraging note.',
    user ? `\nSenior Citizen Profile:\n${JSON.stringify(user, null, 2)}` : '',
    benefitsList ? `\nAvailable OSCA / LGU Benefits:\n${benefitsList}` : '',
    userNotes ? `\nSupport Notes about this Senior:\n${userNotes}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Generates TTS audio bytes via Gemini TTS (`gemini-2.5-flash-preview-tts`).
 * Returns null if unavailable so `ttsPlayer` can fall back to browser Web Speech API.
 */
export async function synthesizeGeminiTts(text: string): Promise<Uint8Array | null> {
  if (!appConfig.geminiApiKey || !text.trim()) return null;

  const cleanText = text
    .replace(/[*_#>`~]/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .trim();
  if (!cleanText) return null;

  try {
    const url = `${GEMINI_BASE_URL}/${appConfig.geminiTtsModel}:generateContent?key=${encodeURIComponent(appConfig.geminiApiKey)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: cleanText }],
          },
        ],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: 'Kore',
              },
            },
          },
        },
      }),
    });

    if (!res.ok) return null;

    const data = (await res.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{
            inlineData?: { mimeType?: string; data?: string };
          }>;
        };
      }>;
    };

    const inline = data.candidates?.[0]?.content?.parts?.[0]?.inlineData;
    if (!inline?.data) return null;

    const rawBytes = base64ToUint8(inline.data);
    const mime = (inline.mimeType ?? '').toLowerCase();
    if (mime.includes('pcm') || mime.includes('l16')) {
      return pcm16ToWav(rawBytes, 24000, 1);
    }
    return rawBytes;
  } catch {
    return null;
  }
}

/**
 * Updates rolling support notes (`user_notes`) in the background after an exchange.
 */
async function updateRollingUserNotes(question: string, answer: string): Promise<void> {
  if (!appConfig.geminiApiKey) return;
  try {
    const existing = (await profileService.loadUserNotes()) ?? '';
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
                  text: `Update the concise markdown support notes for this senior citizen based on their latest conversation.\n\nExisting notes:\n${existing || '(none)'}\n\nLatest Question: ${question}\nLatest Answer: ${answer}\n\nKeep the sections **Likes** and **Concerns** (or **Recent Topics**), in short bullet points. Output ONLY the markdown notes.`,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.2,
          },
        }),
      });
      if (!res.ok) continue;
      const data = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const updated = (data.candidates?.[0]?.content?.parts?.[0]?.text ?? '').trim();
      if (updated) {
        await profileService.saveUserNotes(updated);
      }
      break;
    }
  } catch {
    // Non-critical background task
  }
}

/**
 * Streaming chat client powered by Groq Whisper STT + Google Gemini API + Gemini/WebSpeech TTS.
 */
export const agakApi = {
  async *chatStream(req: ChatRequest): AsyncGenerator<AgakEvent> {
    const { language } = useSettings();
    const currentLang = language.value;

    // Fallback to mock stream only when Gemini API key is not configured yet
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
        await sleep(800);
        yield { type: 'transcript', question: 'Unsaon pag dawat sa Social Pension?' };
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
      // 1. Speech-to-Text (Whisper via Groq API, or Gemini multimodal audio fallback)
      let questionText = (req.text ?? '').trim();
      if (req.audioBytes && req.audioBytes.byteLength > 0) {
        questionText = await transcribeAudio(
          req.audioBytes,
          currentLang,
          req.audioFormat,
          req.audioMimeType,
        );
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

      // 2. Gather context (benefits + support notes)
      const userAddress = typeof req.user?.address === 'string' ? req.user.address : null;
      const [benefits, userNotes] = await Promise.all([
        benefitService.loadRelevantBenefits(userAddress),
        profileService.loadUserNotes(),
      ]);

      const benefitsSummary = benefits
        .map((b) => `- ${b.title} (${b.dateAndLocation}): ${b.description}`)
        .join('\n');

      const systemInstruction = buildSystemInstruction(
        currentLang,
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
              maxOutputTokens: 1024,
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

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let sseBuffer = '';
      let fullAnswer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        sseBuffer += decoder.decode(value, { stream: true });

        const lines = sseBuffer.split(/\r?\n/);
        sseBuffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const payload = trimmed.slice(5).trim();
          if (!payload || payload === '[DONE]') continue;

          try {
            const parsed = JSON.parse(payload) as {
              candidates?: Array<{
                content?: { parts?: Array<{ text?: string }> };
              }>;
            };
            const parts = parsed.candidates?.[0]?.content?.parts ?? [];
            for (const part of parts) {
              if (part.text) {
                fullAnswer += part.text;
                yield { type: 'delta', text: part.text };
              }
            }
          } catch {
            // Ignore malformed SSE chunk
          }
        }
      }

      if (!fullAnswer.trim()) {
        yield {
          type: 'error',
          message: 'AgakAI could not generate an answer right now. Please try again.',
        };
        return;
      }

      // 4. Synthesize TTS audio (Gemini TTS if available; otherwise ttsPlayer uses Web Speech API)
      const ttsAudio = await synthesizeGeminiTts(fullAnswer);
      if (ttsAudio && ttsAudio.byteLength > 0) {
        yield { type: 'audio', chunk: ttsAudio };
      }

      // 5. Update rolling user notes in the background
      void updateRollingUserNotes(questionText, fullAnswer);

      yield { type: 'done', answer: fullAnswer };
    } catch (err) {
      yield {
        type: 'error',
        message: (err as Error).message || 'Something went wrong while contacting AgakAI.',
      };
    }
  },
};
