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
    resolve: { alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) } },
    server: { middlewareMode: true, hmr: false, watch: null },
  });
  const oldFetch = globalThis.fetch;
  const oldSocket = globalThis.WebSocket;
  globalThis.WebSocket = MockWebSocket;
  try {
    globalThis.fetch = async (url) => {
      assert.equal(url, '/api/voice/stt-token');
      return Response.json({ token: 'one-time-token' }, { headers: { 'Cache-Control': 'no-store' } });
    };
    const { LiveTranscription } = await vite.ssrLoadModule('/src/services/liveTranscription.ts');
    const connecting = LiveTranscription.connect('bisaya');
    await new Promise((resolve) => setImmediate(resolve));
    const socket = MockWebSocket.last;
    const url = new URL(socket.url);
    assert.equal(url.protocol, 'wss:');
    assert.equal(url.searchParams.get('model_id'), 'scribe_v2_realtime');
    assert.equal(url.searchParams.get('token'), 'one-time-token');
    assert.equal(url.searchParams.get('audio_format'), 'pcm_16000');
    assert.equal(url.searchParams.get('language_code'), 'ceb');
    assert.equal(url.searchParams.get('commit_strategy'), 'manual');
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
    session.close();
    assert.equal(socket.readyState, 3);
  } finally {
    globalThis.fetch = oldFetch;
    globalThis.WebSocket = oldSocket;
    await vite.close();
  }
});
