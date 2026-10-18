import type { AppLanguage } from '@/composables/useSettings';
import { appConfig } from '@/services/appConfig';

/**
 * Low-latency pipelined TTS player:
 * - Splits text into sentence chunks so the first sentence starts speaking fast.
 * - Shares an in-flight / completed audio cache with `prefetchSentenceTts` so
 *   Sentence 1 can begin synthesizing while Gemini is still streaming text.
 * - Falls back to browser Web Speech API (`window.speechSynthesis`) if Gemini TTS
 *   is unavailable or rate-limited.
 */
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

let currentAudio: HTMLAudioElement | null = null;
let currentObjectUrl: string | null = null;
let playbackGeneration = 0;
let isCurrentlySpeaking = false;
const speakingListeners = new Set<(speaking: boolean) => void>();

/** In-memory cache mapping clean sentence text -> Promise<Uint8Array | null> (WAV bytes). */
const ttsSentenceCache = new Map<string, Promise<Uint8Array | null>>();

function setSpeakingState(val: boolean) {
  if (isCurrentlySpeaking === val) return;
  isCurrentlySpeaking = val;
  for (const cb of speakingListeners) {
    cb(val);
  }
}

export function stripMarkdownForSpeech(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[-*•]\s+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Splits a response into natural sentence chunks for fast pipelined TTS synthesis.
 */
export function splitIntoSpeechChunks(text: string): string[] {
  const clean = stripMarkdownForSpeech(text);
  if (!clean) return [];

  // Split after sentence-ending punctuation (. ! ? : ;) or newlines
  const rawParts = clean
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (rawParts.length <= 1) return [clean];

  // Keep first chunk short (~30-140 chars) for fastest time-to-first-audio,
  // and group very short trailing fragments together.
  const chunks: string[] = [];
  let buffer = '';
  for (const part of rawParts) {
    if (!buffer) {
      buffer = part;
    } else if (chunks.length === 0 && buffer.length >= 25) {
      // Flush first sentence as soon as it's a meaningful phrase
      chunks.push(buffer);
      buffer = part;
    } else if (buffer.length + part.length + 1 <= 180) {
      buffer = `${buffer} ${part}`;
    } else {
      chunks.push(buffer);
      buffer = part;
    }
  }
  if (buffer) chunks.push(buffer);
  return chunks;
}

function base64ToUint8(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

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
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
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

async function fetchGeminiTtsChunk(cleanSentence: string): Promise<Uint8Array | null> {
  if (!appConfig.geminiApiKey || !cleanSentence) return null;
  try {
    const url = `${GEMINI_BASE_URL}/${appConfig.geminiTtsModel}:generateContent?key=${encodeURIComponent(appConfig.geminiApiKey)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: cleanSentence }] }],
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
 * Prefetches TTS audio for a single sentence chunk and stores the Promise in cache.
 * Can be called while text is still streaming so the first sentence is ready immediately!
 */
export function prefetchSentenceTts(sentenceText: string): Promise<Uint8Array | null> {
  const clean = stripMarkdownForSpeech(sentenceText);
  if (!clean) return Promise.resolve(null);
  const existing = ttsSentenceCache.get(clean);
  if (existing) return existing;

  // Cap cache size to 40 sentences
  if (ttsSentenceCache.size > 40) {
    const oldestKey = ttsSentenceCache.keys().next().value;
    if (oldestKey) ttsSentenceCache.delete(oldestKey);
  }

  const promise = fetchGeminiTtsChunk(clean);
  ttsSentenceCache.set(clean, promise);
  return promise;
}

function pickBrowserVoice(lang?: AppLanguage): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;

  const preferredLangTags =
    lang === 'bisaya'
      ? ['ceb', 'fil-PH', 'tl-PH', 'tl', 'en-PH', 'en-US']
      : lang === 'tagalog'
        ? ['fil-PH', 'tl-PH', 'tl', 'en-PH', 'en-US']
        : ['en-PH', 'en-US', 'en-GB', 'en'];

  for (const tag of preferredLangTags) {
    const match = voices.find((v) => v.lang.toLowerCase().startsWith(tag.toLowerCase()));
    if (match) return match;
  }
  return voices[0] ?? null;
}

function detectAudioMimeType(bytes: Uint8Array): string {
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46
  ) {
    return 'audio/wav';
  }
  return 'audio/mpeg';
}

async function playSingleAudioBuffer(bytes: Uint8Array, gen: number): Promise<boolean> {
  if (gen !== playbackGeneration) return false;
  try {
    const mime = detectAudioMimeType(bytes);
    const blob = new Blob(
      [bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer],
      { type: mime },
    );
    if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl);
    currentObjectUrl = URL.createObjectURL(blob);
    currentAudio = new Audio(currentObjectUrl);
    setSpeakingState(true);

    await new Promise<void>((resolve, reject) => {
      if (!currentAudio || gen !== playbackGeneration) {
        resolve();
        return;
      }
      currentAudio.onended = () => resolve();
      currentAudio.onerror = () => reject(new Error('Audio playback failed'));
      currentAudio.play().catch(reject);
    });
    return true;
  } catch {
    return false;
  }
}

export const ttsPlayer = {
  /** Subscribe to speaking state changes (`true` while audio or speechSynthesis is active). */
  onSpeakingChange(cb: (speaking: boolean) => void): () => void {
    speakingListeners.add(cb);
    cb(isCurrentlySpeaking);
    return () => {
      speakingListeners.delete(cb);
    };
  },

  /**
   * Plays pre-synthesized audio bytes if provided, or pipelines sentence-by-sentence
   * Gemini TTS synthesis in parallel so Sentence 1 plays almost immediately!
   */
  async play(
    bytes: Uint8Array | null | undefined,
    fallbackText?: string,
    language?: AppLanguage,
  ): Promise<void> {
    await this.stop();
    const gen = ++playbackGeneration;

    // 1. If caller passed explicit audio bytes, play them directly
    if (bytes && bytes.byteLength > 0) {
      const ok = await playSingleAudioBuffer(bytes, gen);
      if (gen === playbackGeneration) setSpeakingState(false);
      if (ok) return;
    }

    if (!fallbackText) return;

    // 2. Pipelined sentence-by-sentence Gemini TTS (kicks off all chunks in parallel!)
    if (appConfig.geminiApiKey) {
      const chunks = splitIntoSpeechChunks(fallbackText);
      if (chunks.length > 0) {
        // Start synthesizing all sentence chunks in parallel immediately
        const chunkPromises = chunks.map((chunk) => prefetchSentenceTts(chunk));

        let playedAny = false;
        for (let i = 0; i < chunkPromises.length; i++) {
          if (gen !== playbackGeneration) return;
          const wavBytes = await chunkPromises[i];
          if (gen !== playbackGeneration) return;

          if (wavBytes && wavBytes.byteLength > 0) {
            const ok = await playSingleAudioBuffer(wavBytes, gen);
            if (ok) {
              playedAny = true;
              continue;
            }
          }
          // If the first chunk failed to synthesize, fall back to instant browser Web Speech
          if (!playedAny) break;
        }

        if (gen === playbackGeneration) setSpeakingState(false);
        if (playedAny) return;
      }
    }

    // 3. Instant fallback: Browser Web Speech API
    if (gen === playbackGeneration) {
      await this.speakText(fallbackText, language, gen);
    }
  },

  async speakText(text: string, language?: AppLanguage, gen = ++playbackGeneration): Promise<void> {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const clean = stripMarkdownForSpeech(text);
    if (!clean || gen !== playbackGeneration) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(clean);
    const voice = pickBrowserVoice(language);
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    } else {
      utterance.lang = language === 'english' ? 'en-PH' : 'fil-PH';
    }
    utterance.rate = 0.92;
    utterance.pitch = 1.0;

    setSpeakingState(true);
    await new Promise<void>((resolve) => {
      utterance.onend = () => {
        if (gen === playbackGeneration) setSpeakingState(false);
        resolve();
      };
      utterance.onerror = () => {
        if (gen === playbackGeneration) setSpeakingState(false);
        resolve();
      };
      window.speechSynthesis.speak(utterance);
    });
  },

  async stop(): Promise<void> {
    playbackGeneration++;
    if (currentAudio) {
      try {
        currentAudio.pause();
        currentAudio.src = '';
      } catch {
        // ignore
      }
      currentAudio = null;
    }
    if (currentObjectUrl) {
      URL.revokeObjectURL(currentObjectUrl);
      currentObjectUrl = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setSpeakingState(false);
  },
};
