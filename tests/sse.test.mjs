import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

test('Gemini SSE parser keeps fragmented and unterminated final events', async () => {
  const vite = await createServer({
    configFile: false,
    envDir: false,
    logLevel: 'silent',
    resolve: { alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) } },
    server: { middlewareMode: true, hmr: false, watch: null },
  });
  try {
    const { readSseData } = await vite.ssrLoadModule('/src/services/sse.ts');
    const bytes = new TextEncoder().encode(
      'data: {"text":"Maayong 😊"}\r\n\r\ndata: {"text":"final words"}',
    );
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(bytes.slice(0, 17));
        controller.enqueue(bytes.slice(17, 32));
        controller.enqueue(bytes.slice(32, 39));
        controller.enqueue(bytes.slice(39));
        controller.close();
      },
    });
    const payloads = [];
    for await (const payload of readSseData(stream)) payloads.push(payload);
    assert.deepEqual(payloads, ['{"text":"Maayong 😊"}', '{"text":"final words"}']);
  } finally {
    await vite.close();
  }
});
