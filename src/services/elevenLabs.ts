import { appConfig } from '@/services/appConfig';
import { getSupabase } from '@/services/supabase';
import type { AppLanguage } from '@/composables/useSettings';

export async function getVoiceAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session }, error } = await getSupabase().auth.getSession();
  if (error || !session) throw new Error('Sign in to use voice assistance.');
  return {
    apikey: appConfig.supabasePublishableKey,
    Authorization: `Bearer ${session.access_token}`,
  };
}

export const onboardingSpeechLanguage = (language: AppLanguage): string =>
  language === 'cebuano' ? 'ceb' : language === 'tagalog' ? 'fil' : 'en';

export async function transcribeElevenLabs(
  bytes: Uint8Array, mime: string, extension: string,
): Promise<string> {
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(bytes).buffer], { type: mime }), `recording.${extension}`);
  const headers = await getVoiceAuthHeaders();
  const response = await fetch(`${appConfig.elevenLabsFunctionUrl}/stt`, {
    method: 'POST', body: form, headers, signal: AbortSignal.timeout(65_000),
  });
  if (!response.ok) throw new Error(`ElevenLabs STT unavailable (${response.status})`);
  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new Error('The Agak voice service returned an unexpected response.');
  }
  const result = await response.json();
  if (typeof result.text !== 'string') throw new Error('Invalid ElevenLabs transcript');
  return result.text.trim();
}

/** Plays the Supabase-proxied ElevenLabs PCM stream (mono, 24 kHz). */
export async function playElevenLabsSpeech(
  text: string,
  signal: AbortSignal,
  onStart: () => void,
  language?: AppLanguage,
  onAudioReady?: (pcm: Uint8Array) => void,
): Promise<Uint8Array> {
  const context = new AudioContext({ sampleRate: 24000 });
  const sources = new Set<AudioBufferSourceNode>();
  const stop = () => {
    for (const source of sources) { try { source.stop(); } catch { /* already ended */ } }
    void context.close().catch(() => {});
  };
  signal.addEventListener('abort', stop, { once: true });
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  const audioChunks: Uint8Array[] = [];
  let audioLength = 0;
  const wait = (ms: number) => new Promise<void>((resolve, reject) => {
    if (signal.aborted) { reject(new DOMException('Aborted', 'AbortError')); return; }
    const abort = () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, ms);
    signal.addEventListener('abort', abort, { once: true });
  });
  try {
    signal.throwIfAborted();
    // A suspended context must not accumulate an unbounded playback queue.
    void context.resume().catch(() => {});
    for (let i = 0; context.state === 'suspended' && i < 20; i++) await wait(50);
    if (context.state !== 'running') throw new Error('Audio playback requires a user gesture');
    const headers = await getVoiceAuthHeaders();
    const response = await fetch(`${appConfig.elevenLabsFunctionUrl}/tts`, {
      method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        ...(language ? { language: onboardingSpeechLanguage(language) } : {}),
      }), signal,
    });
    if (!response.ok || !response.body || !response.headers.get('content-type')?.includes('audio/pcm')) {
      throw new Error('The Agak voice service returned an unexpected response.');
    }
    reader = response.body.getReader();
    let pendingByte: number | undefined;
    let nextTime = context.currentTime;
    let started = false;
    while (true) {
      signal.throwIfAborted();
      const { value, done } = await reader.read();
      if (done) break;
      audioChunks.push(value.slice());
      audioLength += value.length;
      const bytes = new Uint8Array(value.length + (pendingByte === undefined ? 0 : 1));
      if (pendingByte !== undefined) bytes[0] = pendingByte;
      bytes.set(value, pendingByte === undefined ? 0 : 1);
      const evenLength = bytes.length - bytes.length % 2;
      pendingByte = evenLength < bytes.length ? bytes[evenLength] : undefined;
      const view = new DataView(bytes.buffer);
      // Limit individual scheduled buffers to 100 ms and queued playback to 2 s.
      for (let offset = 0; offset < evenLength; offset += 4800) {
        while (nextTime > context.currentTime + 2) await wait(40);
        signal.throwIfAborted();
        const samples = Math.min(4800, evenLength - offset) / 2;
        const buffer = context.createBuffer(1, samples, 24000);
        const channel = buffer.getChannelData(0);
        for (let i = 0; i < samples; i++) channel[i] = view.getInt16(offset + i * 2, true) / 32768;
        const source = context.createBufferSource();
        source.buffer = buffer;
        source.connect(context.destination);
        sources.add(source);
        source.onended = () => { sources.delete(source); source.disconnect(); };
        nextTime = Math.max(nextTime, context.currentTime + 0.03);
        source.start(nextTime);
        nextTime += buffer.duration;
        if (!started) { started = true; onStart(); }
      }
    }
    if (pendingByte !== undefined || !started) throw new Error('Incomplete speech audio');
    const pcm = new Uint8Array(audioLength);
    let offset = 0;
    for (const chunk of audioChunks) {
      pcm.set(chunk, offset);
      offset += chunk.length;
    }
    onAudioReady?.(pcm);
    while (sources.size) await wait(40);
    return pcm;
  } finally {
    signal.removeEventListener('abort', stop);
    await reader?.cancel().catch(() => {});
    stop();
  }
}

/** Replays cached ElevenLabs PCM locally without making another request. */
export async function playElevenLabsPcm(
  pcm: Uint8Array, signal: AbortSignal, onStart: () => void,
): Promise<void> {
  if (pcm.byteLength === 0 || pcm.byteLength % 2 !== 0) throw new Error('Incomplete speech audio');
  const context = new AudioContext({ sampleRate: 24000 });
  const sources = new Set<AudioBufferSourceNode>();
  const stop = () => {
    for (const source of sources) { try { source.stop(); } catch { /* already ended */ } }
    void context.close().catch(() => {});
  };
  signal.addEventListener('abort', stop, { once: true });
  let abortListener: (() => void) | null = null;
  const wait = (ms: number) => new Promise<void>((resolve, reject) => {
    if (signal.aborted) { reject(new DOMException('Aborted', 'AbortError')); return; }
    const abort = () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, ms);
    signal.addEventListener('abort', abort, { once: true });
  });
  try {
    signal.throwIfAborted();
    void context.resume().catch(() => {});
    for (let i = 0; context.state === 'suspended' && i < 20; i++) await wait(50);
    if (context.state !== 'running') throw new Error('Audio playback requires a user gesture');

    const samples = pcm.byteLength / 2;
    const buffer = context.createBuffer(1, samples, 24000);
    const channel = buffer.getChannelData(0);
    const view = new DataView(pcm.buffer, pcm.byteOffset, pcm.byteLength);
    for (let i = 0; i < samples; i++) channel[i] = view.getInt16(i * 2, true) / 32768;

    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    sources.add(source);
    const completed = new Promise<void>((resolve) => {
      source.onended = () => { sources.delete(source); source.disconnect(); resolve(); };
    });
    const aborted = new Promise<void>((resolve) => {
      abortListener = () => resolve();
      signal.addEventListener('abort', abortListener, { once: true });
    });
    source.start();
    onStart();
    await Promise.race([completed, aborted]);
    signal.throwIfAborted();
  } finally {
    signal.removeEventListener('abort', stop);
    if (abortListener) signal.removeEventListener('abort', abortListener);
    stop();
  }
}
