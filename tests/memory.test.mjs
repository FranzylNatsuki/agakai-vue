import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

test('memory parsing', async (t) => {
  const vite = await createServer({
    configFile: false, envDir: false, logLevel: 'silent',
    resolve: { alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) } },
    server: { middlewareMode: true, hmr: false, watch: null },
  });
  try {
    const { parseMemory } = await vite.ssrLoadModule('/src/services/memory.ts');

    await t.test('keeps summary and notes', () => {
      assert.deepEqual(
        parseMemory('{"summary":"You asked about your pension.","notes":"**Likes & Interests**\\n- Gardening"}'),
        { summary: 'You asked about your pension.', notes: '**Likes & Interests**\n- Gardening' },
      );
    });
    await t.test('rejects malformed output instead of erasing memory', () => {
      assert.equal(parseMemory(''), null);
      assert.equal(parseMemory('not json'), null);
      assert.equal(parseMemory('{"summary":"only a summary"}'), null);
      assert.equal(parseMemory('{"summary":1,"notes":"x"}'), null);
      assert.equal(parseMemory('{"summary":"","notes":""}'), null);
    });
    await t.test('bounds the summary shown to the senior', () => {
      const parsed = parseMemory(JSON.stringify({ summary: 'a\n\nb'.repeat(200), notes: 'n' }));
      assert.equal(parsed?.summary.length, 240);
      assert.equal(parseMemory('{"summary":"a\\n\\nb","notes":"n"}')?.summary, 'a b');
    });
  } finally {
    await vite.close();
  }
});
