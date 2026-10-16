/**
 * Whole-answer TTS playback placeholder.
 * TODO(backend): play the accumulated mp3 bytes (e.g. via HTMLAudioElement + Blob).
 */
export const ttsPlayer = {
  async play(_bytes: Uint8Array): Promise<void> {},
  async stop(): Promise<void> {},
};
