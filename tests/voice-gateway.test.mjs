import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { handleVoiceRequest, createLocalVoiceMiddleware } from '../server/voiceGateway.ts';

const secrets = { ELEVENLABS_API_KEY: 'test-only-key', ELEVENLABS_VOICE_ID: 'test-voice' };
const ttsRequest = (body = { text: 'Maayong buntag', language: 'ceb' }, signal) =>
  new Request('http://localhost/api/voice/tts', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal,
  });

test('TTS streams PCM, uses the server voice/model and passes cancellation', async () => {
  const controller = new AbortController();
  let upstreamSignal;
  let cancelled = false;
  const audio = new ReadableStream({
    start(stream) { stream.enqueue(new Uint8Array([0, 1])); },
    cancel() { cancelled = true; },
  });
  const response = await handleVoiceRequest(ttsRequest(undefined, controller.signal), secrets, async (url, options) => {
    assert.equal(url, 'https://api.elevenlabs.io/v1/text-to-speech/test-voice/stream?output_format=pcm_24000');
    assert.equal(options.headers['xi-api-key'], 'test-only-key');
    assert.deepEqual(JSON.parse(options.body), {
      text: 'Maayong buntag', model_id: 'eleven_v3', language_code: 'ceb',
    });
    upstreamSignal = options.signal;
    return new Response(audio);
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'audio/pcm');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const reader = response.body.getReader();
  assert.deepEqual((await reader.read()).value, new Uint8Array([0, 1]));
  controller.abort();
  assert.equal(upstreamSignal.aborted, true);
  await reader.cancel();
  assert.equal(cancelled, true);
});

for (const language of ['ceb', 'fil', 'en']) {
  test(`STT sends ${language} and only returns transcript text`, async () => {
    const form = new FormData();
    form.append('file', new Blob(['test audio'], { type: 'audio/webm' }), 'recording.webm');
    form.append('language', language);
    const response = await handleVoiceRequest(new Request('http://localhost/api/voice/stt', {
      method: 'POST', body: form,
    }), secrets, async (url, options) => {
      assert.equal(url, 'https://api.elevenlabs.io/v1/speech-to-text');
      assert.equal(options.body.get('model_id'), 'scribe_v2');
      assert.equal(options.body.get('language_code'), language);
      assert.equal(options.body.get('tag_audio_events'), 'false');
      assert.equal(options.body.get('diarize'), 'false');
      assert.equal(options.body.get('file').name, 'recording.webm');
      return Response.json({ text: '  transcript  ', private_metadata: 'not exposed' });
    });
    assert.deepEqual(await response.json(), { text: 'transcript' });
  });
}

test('single-use realtime token is minted server-side and never cached', async () => {
  const response = await handleVoiceRequest(new Request('http://localhost/api/voice/stt-token', { method: 'POST' }), secrets, async (url, options) => {
    assert.equal(url, 'https://api.elevenlabs.io/v1/single-use-token/realtime_scribe');
    assert.equal(options.method, 'POST');
    assert.equal(options.headers['xi-api-key'], 'test-only-key');
    return Response.json({ token: 'single-use-token' });
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), { token: 'single-use-token' });
});

test('missing secrets and invalid inputs fail without provider calls', async () => {
  const neverFetch = () => { assert.fail('unexpected provider call'); };
  assert.equal((await handleVoiceRequest(ttsRequest(), {}, neverFetch)).status, 503);
  assert.equal((await handleVoiceRequest(ttsRequest(), { ELEVENLABS_API_KEY: 'key' }, neverFetch)).status, 503);
  for (const body of [null, {}, { text: '', language: 'ceb' }, { text: 'x'.repeat(5001), language: 'ceb' },
    { text: 'hello', language: 'not-a-language' }]) {
    assert.equal((await handleVoiceRequest(ttsRequest(body), secrets, neverFetch)).status, 400);
  }
  assert.equal((await handleVoiceRequest(new Request('http://localhost/api/voice/tts'), secrets, neverFetch)).status, 405);
  assert.equal((await handleVoiceRequest(new Request('http://localhost/api/voice/nope', { method: 'POST' }), secrets, neverFetch)).status, 404);
});

test('provider errors and rate limits do not expose upstream bodies or trigger fallback', async () => {
  for (const status of [401, 429, 500]) {
    let calls = 0;
    const response = await handleVoiceRequest(ttsRequest(), secrets, async () => {
      calls++;
      return new Response('secret provider error', { status });
    });
    assert.equal(calls, 1);
    assert.equal(response.status, status === 429 ? 429 : 502);
    assert.equal((await response.text()).includes('secret'), false);
  }
});

test('local gateway rejects remote origins and accepts same-origin loopback only', async () => {
  const middleware = createLocalVoiceMiddleware({});
  const server = createServer((req, res) => {
    void middleware(req, res, () => { res.writeHead(404); res.end(); });
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const origin of ['', 'https://attacker.example', 'http://localhost:9999']) {
      const response = await fetch(`${base}/api/voice/tts`, { method: 'POST', headers: { Origin: origin } });
      assert.equal(response.status, 403);
      await response.text();
    }
    const response = await fetch(`${base}/api/voice/tts`, { method: 'POST', headers: { Origin: base } });
    assert.equal(response.status, 503);
    await response.text();
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});
