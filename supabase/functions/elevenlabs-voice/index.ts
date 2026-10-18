import { withSupabase } from 'npm:@supabase/server@1.9.2';

const MAX_AUDIO_BYTES = 12 * 1024 * 1024;
const MAX_TTS_CHARACTERS = 2500;
const MAX_REQUESTS_PER_MINUTE = 20;
const requestWindows = new Map<string, { startedAt: number; count: number }>();

function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}

function rateLimited(userId: string): boolean {
  const now = Date.now();
  const current = requestWindows.get(userId);
  if (!current || now - current.startedAt >= 60_000) {
    requestWindows.set(userId, { startedAt: now, count: 1 });
    if (requestWindows.size > 2_000) {
      for (const [id, window] of requestWindows) {
        if (now - window.startedAt >= 60_000) requestWindows.delete(id);
      }
    }
    return false;
  }
  current.count += 1;
  return current.count > MAX_REQUESTS_PER_MINUTE;
}

function voiceConfig() {
  const apiKey = Deno.env.get('ELEVENLABS_API_KEY');
  const voiceId = Deno.env.get('ELEVENLABS_VOICE_ID');
  if (!apiKey || !voiceId) return null;
  return {
    apiKey,
    voiceId,
    sttModel: Deno.env.get('ELEVENLABS_STT_MODEL') || 'scribe_v2',
    ttsModel: Deno.env.get('ELEVENLABS_TTS_MODEL') || 'eleven_v3',
  };
}

const handler = withSupabase({ auth: 'user' }, async (request, context) => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  const userId = context.userClaims?.id;
  if (!userId) return json({ error: 'Sign in is required.' }, 401);
  if (rateLimited(userId)) return json({ error: 'Please wait before trying voice again.' }, 429);

  const endpoint = new URL(request.url).pathname.split('/').filter(Boolean).at(-1);
  const config = voiceConfig();
  if (!config) return json({ error: 'Voice service is not configured.' }, 503);

  if (endpoint === 'stt-token') {
    try {
      const upstream = await fetch('https://api.elevenlabs.io/v1/single-use-token/realtime_scribe', {
        method: 'POST',
        headers: { 'xi-api-key': config.apiKey },
        signal: AbortSignal.timeout(15_000),
      });
      if (!upstream.ok) {
        console.error('ElevenLabs realtime token request failed:', upstream.status);
        return json({ error: 'Live transcription is temporarily unavailable.' }, 502);
      }
      const result = await upstream.json();
      if (typeof result.token !== 'string' || !result.token) {
        return json({ error: 'Invalid token response from voice provider.' }, 502);
      }
      return json({ token: result.token });
    } catch (error) {
      console.error('ElevenLabs realtime token request failed:', error instanceof Error ? error.name : 'unknown');
      return json({ error: 'Live transcription is temporarily unavailable.' }, 502);
    }
  }

  if (endpoint === 'stt') {
    const contentLength = Number(request.headers.get('content-length') || 0);
    if (contentLength > MAX_AUDIO_BYTES + 256_000) {
      return json({ error: 'Audio recording is too large.' }, 413);
    }
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return json({ error: 'A valid audio recording is required.' }, 400);
    }
    const file = form.get('file');
    if (!(file instanceof File) || file.size === 0) {
      return json({ error: 'A valid audio recording is required.' }, 400);
    }
    if (file.size > MAX_AUDIO_BYTES) return json({ error: 'Audio recording is too large.' }, 413);

    const providerForm = new FormData();
    providerForm.append('file', file, file.name || 'recording');
    providerForm.append('model_id', config.sttModel);
    // Leave language_code unset so Scribe can detect and transcribe code-switching.
    providerForm.append('tag_audio_events', 'false');
    providerForm.append('diarize', 'false');
    try {
      const upstream = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
        method: 'POST',
        headers: { 'xi-api-key': config.apiKey },
        body: providerForm,
        signal: AbortSignal.timeout(60_000),
      });
      if (!upstream.ok) {
        console.error('ElevenLabs STT request failed:', upstream.status);
        return json({ error: 'Speech recognition is temporarily unavailable.' }, 502);
      }
      const result = await upstream.json();
      return json({ text: typeof result.text === 'string' ? result.text : '' });
    } catch (error) {
      console.error('ElevenLabs STT request failed:', error instanceof Error ? error.name : 'unknown');
      return json({ error: 'Speech recognition is temporarily unavailable.' }, 502);
    }
  }

  if (endpoint === 'tts') {
    let body: { text?: unknown; language?: unknown };
    try {
      body = await request.json();
    } catch {
      return json({ error: 'A valid speech request is required.' }, 400);
    }
    if (typeof body.text !== 'string' || !body.text.trim()) {
      return json({ error: 'Text to speak is required.' }, 400);
    }
    const text = body.text.trim();
    if (text.length > MAX_TTS_CHARACTERS) {
      return json({ error: `Speech text must be ${MAX_TTS_CHARACTERS} characters or fewer.` }, 413);
    }
    const language = body.language === 'ceb' || body.language === 'fil' || body.language === 'en'
      ? body.language
      : undefined;
    const providerUrl = new URL(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(config.voiceId)}/stream`,
    );
    providerUrl.searchParams.set('output_format', 'pcm_24000');
    try {
      const upstream = await fetch(providerUrl, {
        method: 'POST',
        headers: {
          'xi-api-key': config.apiKey,
          'Content-Type': 'application/json',
          Accept: 'audio/pcm',
        },
        body: JSON.stringify({
          text,
          model_id: config.ttsModel,
          ...(language ? { language_code: language } : {}),
        }),
        signal: AbortSignal.timeout(90_000),
      });
      if (!upstream.ok || !upstream.body) {
        console.error('ElevenLabs TTS request failed:', upstream.status);
        return json({ error: 'Speech playback is temporarily unavailable.' }, 502);
      }
      return new Response(upstream.body, {
        headers: {
          'Content-Type': 'audio/pcm',
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    } catch (error) {
      console.error('ElevenLabs TTS request failed:', error instanceof Error ? error.name : 'unknown');
      return json({ error: 'Speech playback is temporarily unavailable.' }, 502);
    }
  }

  return json({ error: 'Unknown voice operation.' }, 404);
});

export default { fetch: handler };
