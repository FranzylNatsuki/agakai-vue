import type { AppLanguage } from '@/composables/useSettings';

/**
 * TTS playback service supporting both synthesized audio bytes (Gemini TTS WAV/MP3)
 * and browser Web Speech API (`window.speechSynthesis`) fallback.
 */
let currentAudio: HTMLAudioElement | null = null;
let currentObjectUrl: string | null = null;
let isCurrentlySpeaking = false;
const speakingListeners = new Set<(speaking: boolean) => void>();

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
  // Check RIFF/WAVE header
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && // R
    bytes[1] === 0x49 && // I
    bytes[2] === 0x46 && // F
    bytes[3] === 0x46 // F
  ) {
    return 'audio/wav';
  }
  return 'audio/mpeg';
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
   * Play synthesized audio bytes if non-empty, otherwise fall back to
   * browser Web Speech API (`speechSynthesis`) when `fallbackText` is provided.
   */
  async play(
    bytes: Uint8Array | null | undefined,
    fallbackText?: string,
    language?: AppLanguage,
  ): Promise<void> {
    await this.stop();

    if (bytes && bytes.byteLength > 0) {
      try {
        const mime = detectAudioMimeType(bytes);
        const blob = new Blob(
          [bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer],
          { type: mime },
        );
        currentObjectUrl = URL.createObjectURL(blob);
        currentAudio = new Audio(currentObjectUrl);
        setSpeakingState(true);

        await new Promise<void>((resolve, reject) => {
          if (!currentAudio) {
            resolve();
            return;
          }
          currentAudio.onended = () => resolve();
          currentAudio.onerror = () => reject(new Error('Audio playback failed'));
          currentAudio.play().catch(reject);
        });
        setSpeakingState(false);
        return;
      } catch {
        await this.stop();
        // Fall through to Web Speech API fallback if available
      }
    }

    if (fallbackText) {
      await this.speakText(fallbackText, language);
    }
  },

  async speakText(text: string, language?: AppLanguage): Promise<void> {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const clean = stripMarkdownForSpeech(text);
    if (!clean) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(clean);
    const voice = pickBrowserVoice(language);
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    } else {
      utterance.lang = language === 'english' ? 'en-PH' : 'fil-PH';
    }
    // Slightly calmer pace for seniors
    utterance.rate = 0.9;
    utterance.pitch = 1.0;

    setSpeakingState(true);
    await new Promise<void>((resolve) => {
      utterance.onend = () => {
        setSpeakingState(false);
        resolve();
      };
      utterance.onerror = () => {
        setSpeakingState(false);
        resolve();
      };
      window.speechSynthesis.speak(utterance);
    });
  },

  async stop(): Promise<void> {
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
