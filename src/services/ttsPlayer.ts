import type { AppLanguage } from '@/composables/useSettings';
import { playElevenLabsPcm, playElevenLabsSpeech } from '@/services/elevenLabs';

let playbackGeneration = 0;
let controller: AbortController | null = null;
let speaking = false;
const listeners = new Set<(speaking: boolean) => void>();
const speechCache = new Map<string, Uint8Array>();
const MAX_CACHE_ITEMS = 40;
const MAX_CACHE_ITEM_BYTES = 4 * 1024 * 1024;
const MAX_CACHE_BYTES = 12 * 1024 * 1024;
let speechCacheBytes = 0;

function setSpeaking(value: boolean) {
  if (speaking === value) return;
  speaking = value;
  for (const listener of listeners) listener(value);
}

function cacheSpeech(key: string, bytes: Uint8Array) {
  if (!bytes.byteLength || bytes.byteLength > MAX_CACHE_ITEM_BYTES) return;
  const previous = speechCache.get(key);
  if (previous) {
    speechCacheBytes -= previous.byteLength;
    speechCache.delete(key);
  }
  const copy = bytes.slice();
  while (
    speechCache.size >= MAX_CACHE_ITEMS ||
    speechCacheBytes + copy.byteLength > MAX_CACHE_BYTES
  ) {
    const oldestKey = speechCache.keys().next().value as string | undefined;
    if (oldestKey === undefined) break;
    const oldest = speechCache.get(oldestKey);
    if (oldest) speechCacheBytes -= oldest.byteLength;
    speechCache.delete(oldestKey);
  }
  speechCache.set(key, copy);
  speechCacheBytes += copy.byteLength;
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

export const ttsPlayer = {
  onSpeakingChange(listener: (speaking: boolean) => void): () => void {
    listeners.add(listener);
    listener(speaking);
    return () => { listeners.delete(listener); };
  },

  /** Plays cached audio when available; otherwise generates it once through ElevenLabs. */
  async play(bytes: Uint8Array | null | undefined, text?: string, language?: AppLanguage): Promise<void> {
    // Stop synchronously so overlapping play calls cannot revive an older answer.
    void this.stop();
    const generation = playbackGeneration;
    const clean = stripMarkdownForSpeech(text || '');
    if (!clean) return;
    const key = `${language ?? 'auto'}:${clean}`;
    let audio = bytes?.byteLength ? bytes : speechCache.get(key);
    if (bytes?.byteLength) cacheSpeech(key, bytes);
    else if (audio) {
      speechCache.delete(key);
      speechCache.set(key, audio);
    }

    const pending = new AbortController();
    controller = pending;
    const signal = AbortSignal.any([pending.signal, AbortSignal.timeout(120_000)]);
    try {
      if (audio) {
        await playElevenLabsPcm(audio, signal, () => {
          if (generation === playbackGeneration) setSpeaking(true);
        });
      } else {
        audio = await playElevenLabsSpeech(clean, signal, () => {
          if (generation === playbackGeneration) setSpeaking(true);
        }, language, (pcm) => {
          if (generation === playbackGeneration && !pending.signal.aborted) cacheSpeech(key, pcm);
        });
      }
    } catch {
      if (generation === playbackGeneration && !pending.signal.aborted) {
        throw new Error('ElevenLabs speech is unavailable. You can read the answer on screen.');
      }
    } finally {
      if (controller === pending) controller = null;
      if (generation === playbackGeneration) setSpeaking(false);
    }
  },

  /** Clears this conversation's temporary audio when a new conversation starts. */
  clearCache(): void {
    speechCache.clear();
    speechCacheBytes = 0;
  },

  async stop(): Promise<void> {
    playbackGeneration++;
    controller?.abort();
    controller = null;
    setSpeaking(false);
  },
};
