import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

class MockWebSocket extends EventTarget {
  static OPEN = 1;
  readyState = 0;
  bufferedAmount = 0;
  sent = [];
  constructor(url) { super(); this.url = url; MockWebSocket.last = this; }
  send(value) { this.sent.push(JSON.parse(value)); }
  close() { this.readyState = 3; this.dispatchEvent(new Event('close')); }
  open() { this.readyState = 1; this.dispatchEvent(new Event('open')); }
  message(value) { this.dispatchEvent(Object.assign(new Event('message'), { data: JSON.stringify(value) })); }
}

test('live Scribe client streams PCM and commits transcript on Stop', async () => {
  const vite = await createServer({
    configFile: false, envDir: false, logLevel: 'silent',
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://agakai-test.supabase.co'),
      'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('sb_publishable_test'),
    },
    resolve: { alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) } },
    server: { middlewareMode: true, hmr: false, watch: null },
  });
  const oldFetch = globalThis.fetch;
  const oldSocket = globalThis.WebSocket;
  globalThis.WebSocket = MockWebSocket;
  try {
    const { getSupabase } = await vite.ssrLoadModule('/src/services/supabase.ts');
    globalThis.fetch = async (url) => {
      assert.match(String(url), /\/auth\/v1\/user$/);
      return Response.json({ id: 'test-user', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '' });
    };
    const accessToken = `eyJhbGciOiJub25lIn0.${Buffer.from(JSON.stringify({ sub: 'test-user', aud: 'authenticated', exp: 4102444800, role: 'authenticated' })).toString('base64url')}.c2ln`;
    await getSupabase().auth.setSession({
      access_token: accessToken,
      refresh_token: 'test-refresh-token',
      user: { id: 'test-user', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '' },
    });
    globalThis.fetch = async (url, options) => {
      assert.equal(url, 'https://agakai-test.supabase.co/functions/v1/elevenlabs-voice/stt-token');
      assert.equal(options.headers.Authorization.startsWith('Bearer '), true);
      assert.equal(options.headers.apikey, 'sb_publishable_test');
      return Response.json({ token: 'one-time-token' }, { headers: { 'Cache-Control': 'no-store' } });
    };
    const { LiveTranscription } = await vite.ssrLoadModule('/src/services/liveTranscription.ts');
    const connecting = LiveTranscription.connect();
    await new Promise((resolve) => setImmediate(resolve));
    const socket = MockWebSocket.last;
    const url = new URL(socket.url);
    assert.equal(url.protocol, 'wss:');
    assert.equal(url.searchParams.get('model_id'), 'scribe_v2_realtime');
    assert.equal(url.searchParams.get('token'), 'one-time-token');
    assert.equal(url.searchParams.get('audio_format'), 'pcm_16000');
    assert.equal(url.searchParams.get('language_code'), null);
    assert.deepEqual(url.searchParams.getAll('secondary_languages'), ['eng', 'ceb', 'fil']);
    assert.equal(url.searchParams.get('commit_strategy'), 'vad');
    assert.equal(url.searchParams.get('vad_silence_threshold_secs'), '1.5');
    assert.equal(url.searchParams.get('vad_threshold'), '0.4');
    socket.open();
    const session = await connecting;
    let display;
    session.onTranscript((partial, committed) => { display = { partial, committed }; });
    session.sendAudio('AAEC');
    assert.deepEqual(socket.sent[0], {
      message_type: 'input_audio_chunk', audio_base_64: 'AAEC', sample_rate: 16000, commit: false,
    });
    socket.message({ message_type: 'partial_transcript', text: 'Maayong buntag' });
    assert.deepEqual(display, { partial: 'Maayong buntag', committed: '' });
    const final = session.commit();
    assert.deepEqual(socket.sent[1], {
      message_type: 'input_audio_chunk', audio_base_64: '', sample_rate: 16000, commit: true,
    });
    socket.message({ message_type: 'committed_transcript', text: 'Maayong buntag' });
    assert.equal(await final, 'Maayong buntag');
    assert.deepEqual(display, { partial: '', committed: 'Maayong buntag' });
    assert.equal(session.getTranscript(), 'Maayong buntag');
    session.close();
    assert.equal(socket.readyState, 3);

    const failedConnect = LiveTranscription.connect();
    await new Promise((resolve) => setImmediate(resolve));
    const failedSocket = MockWebSocket.last;
    failedSocket.open();
    const failedSession = await failedConnect;
    failedSocket.message({ message_type: 'partial_transcript', text: 'Maayong buntag' });
    const pendingCommit = failedSession.commit();
    failedSocket.message({ message_type: 'quota_exceeded' });
    await assert.rejects(pendingCommit);
    assert.equal(failedSession.getTranscript(), 'Maayong buntag');
    failedSession.close();
  } finally {
    globalThis.fetch = oldFetch;
    globalThis.WebSocket = oldSocket;
    await vite.close();
  }
});
