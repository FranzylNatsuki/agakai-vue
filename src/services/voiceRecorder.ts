/**
 * Microphone capture placeholder.
 * TODO(backend/native): implement with MediaRecorder or a Capacitor
 * audio-recording plugin; return m4a/webm bytes on stop().
 */
export const voiceRecorder = {
  /** Returns false when the mic is unavailable. */
  async start(): Promise<boolean> {
    return true;
  },

  async stop(): Promise<Uint8Array | null> {
    // Non-empty bytes so the preview flow continues.
    return new Uint8Array([0]);
  },

  async cancel(): Promise<void> {},

  /** Subscribe to mic level in dB (~ -60 quiet … -5 loud). Returns unsubscribe. */
  onAmplitude(_cb: (db: number) => void): () => void {
    return () => {};
  },
};
