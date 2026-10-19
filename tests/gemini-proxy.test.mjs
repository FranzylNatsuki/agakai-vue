import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

test('Gemini proxy preserves SSE streaming and selects the low-cost Flash-Lite models', async () => {
  const vite = await createServer({
    configFile: false,
    envDir: false,
    logLevel: 'silent',
    resolve: { alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) } },
    server: { middlewareMode: true, hmr: false, watch: null },
  });
  try {
    const { DEFAULT_GEMINI_MODELS, geminiEndpointUrl, forwardGeminiResponse } =
      await vite.ssrLoadModule('/supabase/functions/_shared/geminiProxy.ts');
    assert.deepEqual(DEFAULT_GEMINI_MODELS, ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite']);
    assert.equal(
      geminiEndpointUrl(DEFAULT_GEMINI_MODELS[0], true).searchParams.get('alt'),
      'sse',
    );

    let finishUpstream;
    let upstreamFinished = false;
    const waiting = new Promise((resolve) => { finishUpstream = resolve; });
    const upstreamBody = new ReadableStream({
      async start(controller) {
        controller.enqueue(new TextEncoder().encode('data: first\n\n'));
        await waiting;
        controller.enqueue(new TextEncoder().encode('data: second\n\n'));
        upstreamFinished = true;
        controller.close();
      },
    });
    const response = forwardGeminiResponse(
      new Response(upstreamBody, { headers: { 'Content-Type': 'text/event-stream' } }),
      true,
    );

    assert.equal(response.headers.get('content-type'), 'text/event-stream');
    assert.match(response.headers.get('cache-control'), /no-transform/);
    const reader = response.body.getReader();
    const first = await reader.read();
    assert.equal(new TextDecoder().decode(first.value), 'data: first\n\n');
    assert.equal(upstreamFinished, false, 'the proxy must not wait for the full upstream body');

    finishUpstream();
    const second = await reader.read();
    assert.equal(new TextDecoder().decode(second.value), 'data: second\n\n');
    assert.equal((await reader.read()).done, true);
  } finally {
    await vite.close();
  }
});
