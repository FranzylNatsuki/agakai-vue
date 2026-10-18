import type { IncomingMessage, ServerResponse } from 'node:http';
import { once } from 'node:events';

export interface VoiceSecrets {
  ELEVENLABS_API_KEY?: string;
  ELEVENLABS_VOICE_ID?: string;
  ELEVENLABS_TTS_MODEL?: string;
  ELEVENLABS_STT_MODEL?: string;
}

const languages = new Set(['ceb', 'fil', 'en']);
const maxBytes = 12 * 1024 * 1024;

/** Provider adapter. Call only behind a trusted/authenticated HTTP boundary. */
export async function handleVoiceRequest(
  request: Request,
  secrets: VoiceSecrets,
  fetcher: typeof fetch = fetch,
): Promise<Response> {
  const fail = (status: number, error: string) => Response.json({ error }, { status });
  if (request.method !== 'POST') return fail(405, 'POST required');
  const route = new URL(request.url).pathname;
  if (!['/api/voice/stt', '/api/voice/tts', '/api/voice/stt-token'].includes(route)) return fail(404, 'Unknown voice route');
  const key = secrets.ELEVENLABS_API_KEY?.trim();
  if (!key) return fail(503, 'ElevenLabs is not configured');
  let url: string;
  let body: FormData | string;
  const headers: Record<string, string> = { 'xi-api-key': key };
  try {
    if (route.endsWith('/stt-token')) {
      const upstream = await fetcher('https://api.elevenlabs.io/v1/single-use-token/realtime_scribe', {
        method: 'POST', headers,
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(10_000)]),
      });
      if (!upstream.ok) return fail(upstream.status === 429 ? 429 : 502, 'ElevenLabs token request failed');
      const result = await upstream.json();
      if (typeof result.token !== 'string' || !result.token) return fail(502, 'Invalid ElevenLabs token response');
      return Response.json({ token: result.token }, { headers: { 'Cache-Control': 'no-store' } });
    }
    if (route.endsWith('/stt')) {
      const input = await request.formData();
      const file = input.get('file');
      const language = input.get('language');
      if (!(file instanceof File) || !file.size || file.size > maxBytes ||
          typeof language !== 'string' || !languages.has(language)) {
        return fail(400, 'Invalid recording or language');
      }
      const form = new FormData();
      form.append('file', file, file.name);
      form.append('model_id', secrets.ELEVENLABS_STT_MODEL?.trim() || 'scribe_v2');
      form.append('language_code', language);
      form.append('tag_audio_events', 'false');
      form.append('diarize', 'false');
      body = form;
      url = 'https://api.elevenlabs.io/v1/speech-to-text';
    } else {
      const voice = secrets.ELEVENLABS_VOICE_ID?.trim();
      if (!voice) return fail(503, 'ElevenLabs voice is not configured');
      const input = await request.json();
      if (typeof input?.text !== 'string' || !input.text.trim() || input.text.length > 5000 ||
          !languages.has(input.language)) return fail(400, 'Invalid text or language');
      body = JSON.stringify({
        text: input.text.trim(),
        model_id: secrets.ELEVENLABS_TTS_MODEL?.trim() || 'eleven_v3',
        language_code: input.language,
      });
      headers['Content-Type'] = 'application/json';
      url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}/stream?output_format=pcm_24000`;
    }
  } catch {
    return fail(400, 'Invalid request body');
  }
  try {
    const upstream = await fetcher(url, {
      method: 'POST', headers, body,
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(60_000)]),
    });
    if (!upstream.ok) {
      await upstream.body?.cancel();
      // Never forward upstream bodies (which can contain sensitive details).
      return fail(upstream.status === 429 ? 429 : 502, 'ElevenLabs request failed');
    }
    if (route.endsWith('/stt')) {
      const data = await upstream.json();
      if (typeof data.text !== 'string') return fail(502, 'Invalid transcription response');
      return Response.json({ text: data.text.trim() }, { headers: { 'Cache-Control': 'no-store' } });
    }
    if (!upstream.body) return fail(502, 'Missing speech audio');
    return new Response(upstream.body, {
      headers: { 'Content-Type': 'audio/pcm', 'Cache-Control': 'no-store' },
    });
  } catch {
    return fail(502, 'Voice service unavailable');
  }
}

/** Local development only. No public paid proxy and no browser API key. */
export function createLocalVoiceMiddleware(secrets: VoiceSecrets) {
  let active = 0;
  let requests = 0;
  let windowStart = Date.now();
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    if (!req.url?.startsWith('/api/voice/')) return next();
    const reject = (status: number) => { res.writeHead(status); res.end(); };
    const remote = req.socket.remoteAddress;
    const origin = req.headers.origin;
    let localOrigin = false;
    try {
      const parsed = new URL(origin || '');
      localOrigin = ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname) &&
        parsed.host === req.headers.host;
    } catch { /* Missing/invalid Origin is rejected. */ }
    if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remote || '') || !localOrigin) {
      return reject(403);
    }
    if (req.method !== 'POST') return reject(405);
    if (Date.now() - windowStart >= 60_000) { requests = 0; windowStart = Date.now(); }
    if (active >= 2 || requests >= 30) return reject(429);
    requests++;
    active++;
    const controller = new AbortController();
    const abort = () => controller.abort();
    res.on('close', abort);
    const timer = setTimeout(abort, 65_000);
    try {
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > maxBytes + 64 * 1024) { reject(413); return; }
        chunks.push(chunk);
      }
      const body = new Uint8Array(Buffer.concat(chunks));
      const response = await handleVoiceRequest(new Request(`http://localhost${req.url}`, {
        method: 'POST', body,
        headers: { 'Content-Type': req.headers['content-type'] || '' },
        signal: controller.signal,
      }), secrets);
      if (res.destroyed) return;
      res.writeHead(response.status, Object.fromEntries(response.headers));
      if (response.body) {
        const reader = response.body.getReader();
        try {
          while (!controller.signal.aborted) {
            const { value, done } = await reader.read();
            if (done) break;
            if (!res.write(value)) await once(res, 'drain', { signal: controller.signal });
          }
        } finally { await reader.cancel().catch(() => {}); }
      }
      res.end();
    } catch {
      if (!res.destroyed) {
        if (!res.headersSent) reject(502);
        else res.destroy();
      }
    } finally {
      clearTimeout(timer);
      res.off('close', abort);
      active--;
    }
  };
}
