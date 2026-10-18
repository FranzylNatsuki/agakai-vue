import type { AppLanguage } from '@/composables/useSettings';
import { playElevenLabsSpeech } from '@/services/elevenLabs';

let playbackGeneration = 0;
let controller: AbortController | null = null;
let speaking = false;
const listeners = new Set<(speaking: boolean) => void>();

function setSpeaking(value: boolean) {
  if (speaking === value) return;
  speaking = value;
  for (const listener of listeners) listener(value);
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

  /** The legacy byte argument is retained for callers; only ElevenLabs generates speech. */
  async play(_bytes: Uint8Array | null | undefined, text?: string, language?: AppLanguage): Promise<void> {
    // Stop synchronously so overlapping play calls cannot revive an older answer.
    void this.stop();
    const generation = playbackGeneration;
    const clean = stripMarkdownForSpeech(text || '');
    if (!clean) return;
    const pending = new AbortController();
    controller = pending;
    try {
      await playElevenLabsSpeech(clean, language,
        AbortSignal.any([pending.signal, AbortSignal.timeout(120_000)]), () => {
          if (generation === playbackGeneration) setSpeaking(true);
        });
    } catch {
      if (generation === playbackGeneration && !pending.signal.aborted) {
        throw new Error('ElevenLabs speech is unavailable. You can read the answer on screen.');
      }
    } finally {
      if (controller === pending) controller = null;
      if (generation === playbackGeneration) setSpeaking(false);
    }
  },

  async stop(): Promise<void> {
    playbackGeneration++;
    controller?.abort();
    controller = null;
    setSpeaking(false);
  },
};
