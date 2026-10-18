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
  language === 'bisaya' ? 'ceb' : language === 'tagalog' ? 'fil' : 'en';

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
  text: string, signal: AbortSignal, onStart: () => void, language?: AppLanguage,
): Promise<void> {
  const context = new AudioContext({ sampleRate: 24000 });
  const sources = new Set<AudioBufferSourceNode>();
  const stop = () => {
    for (const source of sources) { try { source.stop(); } catch { /* already ended */ } }
    void context.close().catch(() => {});
  };
  signal.addEventListener('abort', stop, { once: true });
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
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
    while (sources.size) await wait(40);
  } finally {
    signal.removeEventListener('abort', stop);
    await reader?.cancel().catch(() => {});
    stop();
  }
}
