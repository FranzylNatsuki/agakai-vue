import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

class FakeAudioContext {
  static instances = [];
  state = 'running';
  destination = {};
  started = Date.now();
  played = [];
  constructor() { FakeAudioContext.instances.push(this); }
  get currentTime() { return (Date.now() - this.started) / 1000; }
  async resume() {}
  async close() { this.state = 'closed'; }
  createBuffer(_channels, length, sampleRate) {
    const data = new Float32Array(length);
    return { duration: length / sampleRate, getChannelData: () => data };
  }
  createBufferSource() {
    const context = this;
    let timer;
    return {
      buffer: null, onended: null, connect() {}, disconnect() {},
      start(time) {
        context.played.push([...this.buffer.getChannelData(0)]);
        timer = setTimeout(() => this.onended?.(), Math.max(1, (time - context.currentTime + this.buffer.duration) * 1000));
      },
      stop() { clearTimeout(timer); this.onended?.(); },
    };
  }
}

test('ElevenLabs-only client', async (t) => {
  const vite = await createServer({
    configFile: false, envDir: false, logLevel: 'silent',
    resolve: { alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) } },
    server: { middlewareMode: true, hmr: false, watch: null },
  });
  const originalFetch = globalThis.fetch;
  const originalAudioContext = globalThis.AudioContext;
  globalThis.AudioContext = FakeAudioContext;
  try {
    const voice = await vite.ssrLoadModule('/src/services/elevenLabs.ts');
    const { ttsPlayer } = await vite.ssrLoadModule('/src/services/ttsPlayer.ts');
    await t.test('STT posts audio and the exact language; silence stays empty', async () => {
      for (const [language, code] of [['bisaya', 'ceb'], ['tagalog', 'fil'], ['english', 'en']]) {
        globalThis.fetch = async (url, options) => {
          assert.equal(url, '/api/voice/stt');
          assert.equal(options.body.get('language'), code);
          assert.equal(options.body.get('file').type, 'audio/mp4');
          assert.equal(options.body.get('file').name, 'recording.m4a');
          return Response.json({ text: '' });
        };
        assert.equal(await voice.transcribeElevenLabs(new Uint8Array([1]), 'audio/mp4', 'm4a', language), '');
      }
    });
    await t.test('STT failure never invokes another provider', async () => {
      let calls = 0;
      globalThis.fetch = async () => { calls++; return new Response('', { status: 503 }); };
      await assert.rejects(voice.transcribeElevenLabs(new Uint8Array([1]), 'audio/webm', 'webm', 'bisaya'));
      assert.equal(calls, 1);
    });
    await t.test('TTS starts before the stream ends and handles split PCM samples', async () => {
      let streamController;
      let started;
      const firstPlayback = new Promise((resolve) => { started = resolve; });
      globalThis.fetch = async (url, options) => {
        assert.equal(url, '/api/voice/tts');
        assert.deepEqual(JSON.parse(options.body), { text: 'Hello', language: 'ceb' });
        return new Response(new ReadableStream({ start(controller) {
          streamController = controller;
          controller.enqueue(new Uint8Array([0, 128, 255]));
        } }), { headers: { 'Content-Type': 'audio/pcm' } });
      };
      const playback = voice.playElevenLabsSpeech('Hello', 'bisaya', new AbortController().signal, started);
      await firstPlayback;
      const context = FakeAudioContext.instances.at(-1);
      assert.deepEqual(context.played, [[-1]]);
      streamController.enqueue(new Uint8Array([127]));
      streamController.close();
      await playback;
      assert.deepEqual(context.played, [[-1], [32767 / 32768]]);
      assert.equal(context.state, 'closed');
    });
    await t.test('TTS failure propagates instead of switching to Gemini/browser speech', async () => {
      let calls = 0;
      globalThis.fetch = async () => { calls++; return new Response('', { status: 503 }); };
      await assert.rejects(ttsPlayer.play(null, 'Hello', 'english'), /ElevenLabs/);
      assert.equal(calls, 1);
      assert.equal(FakeAudioContext.instances.at(-1).state, 'closed');
    });
    await t.test('Stop aborts the request, settles playback and resets speaking state', async () => {
      let signal;
      let started;
      const firstPlayback = new Promise((resolve) => { started = resolve; });
      const states = [];
      const unsubscribe = ttsPlayer.onSpeakingChange((value) => {
        states.push(value);
        if (value) started();
      });
      globalThis.fetch = async (_url, options) => {
        signal = options.signal;
        return new Response(new ReadableStream({ start(controller) {
          controller.enqueue(new Uint8Array([0, 0]));
          signal.addEventListener('abort', () => controller.error(new DOMException('Aborted', 'AbortError')), { once: true });
        } }), { headers: { 'Content-Type': 'audio/pcm' } });
      };
      const playback = ttsPlayer.play(null, 'Hello', 'english');
      await firstPlayback;
      await ttsPlayer.stop();
      await playback;
      unsubscribe();
      assert.equal(signal.aborted, true);
      assert.deepEqual(states, [false, true, false]);
      assert.equal(FakeAudioContext.instances.at(-1).state, 'closed');
    });
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.AudioContext = originalAudioContext;
    await vite.close();
  }
});
