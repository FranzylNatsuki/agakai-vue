/**
 * Microphone capture using MediaRecorder + Web Audio API for live dB metering.
 */

import { hasNativePermission } from '@/services/permissionSettings';

const CANDIDATE_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus',
  'audio/wav',
];

function pickMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  for (const type of CANDIDATE_MIME_TYPES) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return '';
}

function extensionForMime(mime: string): string {
  if (mime.includes('mp4') || mime.includes('m4a')) return 'm4a';
  if (mime.includes('ogg')) return 'ogg';
  if (mime.includes('wav')) return 'wav';
  return 'webm';
}

let mediaStream: MediaStream | null = null;
let mediaRecorder: MediaRecorder | null = null;
let recordedChunks: BlobPart[] = [];
let activeMimeType = 'audio/webm';

let audioContext: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let processor: ScriptProcessorNode | null = null;
let rafId: number | null = null;
const pcmListeners = new Set<(base64: string) => void>();
const amplitudeListeners = new Set<(db: number) => void>();

function startMetering(stream: MediaStream) {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioContext = new AudioCtx();
    const source = audioContext.createMediaStreamSource(stream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);

    // Convert the existing microphone stream to mono PCM16 at 16 kHz for live Scribe.
    const captureContext = audioContext;
    processor = captureContext.createScriptProcessor(4096, 1, 1);
    processor.onaudioprocess = (event) => {
      if (!pcmListeners.size) return;
      const input = event.inputBuffer.getChannelData(0);
      const ratio = captureContext.sampleRate / 16000;
      const outputLength = Math.floor(input.length / ratio);
      const pcm = new Int16Array(outputLength);
      for (let i = 0; i < outputLength; i++) {
        const sample = Math.max(-1, Math.min(1, input[Math.floor(i * ratio)] ?? 0));
        pcm[i] = sample < 0 ? sample * 32768 : sample * 32767;
      }
      const bytes = new Uint8Array(pcm.buffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      }
      const chunk = btoa(binary);
      for (const listener of pcmListeners) listener(chunk);
    };
    source.connect(processor);
    const silentOutput = captureContext.createGain();
    silentOutput.gain.value = 0;
    processor.connect(silentOutput);
    silentOutput.connect(captureContext.destination);

    const data = new Float32Array(analyser.fftSize);
    const tick = () => {
      if (!analyser) return;
      analyser.getFloatTimeDomainData(data);
      let sumSquares = 0;
      for (let i = 0; i < data.length; i++) {
        const sample = data[i] ?? 0;
        sumSquares += sample * sample;
      }
      const rms = Math.sqrt(sumSquares / data.length);
      // Map RMS to ~ -60 dB (quiet) ... -5 dB (loud)
      const db = rms > 0.0001 ? Math.max(-60, Math.min(-5, 20 * Math.log10(rms))) : -60;
      for (const cb of amplitudeListeners) {
        cb(db);
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
  } catch {
    // Metering is non-critical; ignore if Web Audio API fails.
  }
}

function cleanupResources() {
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  analyser = null;
  if (processor) {
    processor.onaudioprocess = null;
    processor.disconnect();
    processor = null;
  }
  if (audioContext) {
    void audioContext.close().catch(() => {});
    audioContext = null;
  }
  if (mediaStream) {
    for (const track of mediaStream.getTracks()) {
      track.stop();
    }
    mediaStream = null;
  }
  mediaRecorder = null;
  recordedChunks = [];
}

export const voiceRecorder = {
  /** Check permission without triggering another OS prompt when the browser supports it. */
  async hasPermission(): Promise<boolean | null> {
    const nativePermission = await hasNativePermission('microphone');
    if (nativePermission !== null) return nativePermission;
    if (typeof navigator === 'undefined' || !navigator.permissions?.query) return null;
    try {
      const permission = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      return permission.state === 'granted';
    } catch {
      return null;
    }
  },

  /** Ask for microphone access without recording or retaining any audio. */
  async requestPermission(): Promise<boolean> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      return true;
    } catch {
      return false;
    }
  },

  /** Returns the file extension ('webm', 'm4a', 'ogg', 'wav') of the last recording. */
  getFormat(): string {
    return extensionForMime(activeMimeType);
  },

  /** Returns the MIME type of the last recording. */
  getMimeType(): string {
    return activeMimeType || 'audio/webm';
  },

  /** Returns false when the mic is unavailable or permission is denied. */
  async start(): Promise<boolean> {
    await this.cancel();
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia ||
      typeof MediaRecorder === 'undefined'
    ) {
      return false;
    }

    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      const mimeType = pickMimeType();
      activeMimeType = mimeType || 'audio/webm';
      recordedChunks = [];

      mediaRecorder = mimeType
        ? new MediaRecorder(mediaStream, { mimeType })
        : new MediaRecorder(mediaStream);

      if (mediaRecorder.mimeType) {
        activeMimeType = mediaRecorder.mimeType;
      }

      mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          recordedChunks.push(event.data);
        }
      };

      mediaRecorder.start(100);
      startMetering(mediaStream);
      return true;
    } catch {
      cleanupResources();
      return false;
    }
  },

  async stop(): Promise<Uint8Array | null> {
    const recorder = mediaRecorder;
    if (!recorder || recorder.state === 'inactive') {
      cleanupResources();
      return null;
    }

    return new Promise<Uint8Array | null>((resolve) => {
      recorder.onstop = async () => {
        try {
          const blob = new Blob(recordedChunks, { type: activeMimeType });
          cleanupResources();
          if (blob.size === 0) {
            resolve(null);
            return;
          }
          const buffer = await blob.arrayBuffer();
          resolve(new Uint8Array(buffer));
        } catch {
          cleanupResources();
          resolve(null);
        }
      };
      try {
        recorder.stop();
      } catch {
        cleanupResources();
        resolve(null);
      }
    });
  },

  async cancel(): Promise<void> {
    const recorder = mediaRecorder;
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = null;
      try {
        recorder.stop();
      } catch {
        // ignore
      }
    }
    cleanupResources();
  },

  /** Subscribe to mono PCM16/16kHz frames, base64 encoded for Scribe. */
  onPcmChunk(cb: (base64: string) => void): () => void {
    pcmListeners.add(cb);
    return () => { pcmListeners.delete(cb); };
  },

  /** Subscribe to mic level in dB (~ -60 quiet … -5 loud). Returns unsubscribe. */
  onAmplitude(cb: (db: number) => void): () => void {
    amplitudeListeners.add(cb);
    return () => {
      amplitudeListeners.delete(cb);
    };
  },
};
