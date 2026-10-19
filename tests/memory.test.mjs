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
    const { normalizeMemoryHeadings, parseMemory } = await vite.ssrLoadModule('/src/services/memory.ts');
    const {
      clearMemoryTranslations,
      loadMemoryTranslation,
      memorySourceHash,
      saveMemoryTranslation,
    } = await vite.ssrLoadModule('/src/services/memoryTranslation.ts');

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
    await t.test('rejects overlong summaries instead of cutting them off', () => {
      assert.equal(parseMemory(JSON.stringify({ summary: 'a'.repeat(241), notes: 'n' })), null);
      assert.equal(parseMemory('{"summary":"a\\n\\nb","notes":"n"}')?.summary, 'a b');
    });
    await t.test('rejects overlong detailed notes instead of truncating them', () => {
      const longNotes = `**Likes & Interests**\n${Array.from({ length: 100 }, (_, i) => `- Topic ${i} with extra detail`).join('\n')}`;
      assert.equal(parseMemory(JSON.stringify({ summary: 'You enjoy gardening.', notes: longNotes })), null);
    });
    await t.test('localizes both section headings and removes duplicate bullets', () => {
      assert.equal(
        normalizeMemoryHeadings(`**Likes & Interests**\n- Wala pay gibahin\n\n**Concerns & Recent Topics**\n- Wala pay gibahin`, 'cebuano'),
        `**Mga Gusto ug Interes**\n- Wala pay gibahin\n\n**Mga Kabalaka ug Bag-ong Hilisgutan**`,
      );
      assert.equal(
        normalizeMemoryHeadings('**Mga Hilig**\n- Paghahalaman\n\n**Mga Paksa**\n- Pension', 'tagalog'),
        '**Mga Hilig at Interes**\n- Paghahalaman\n\n**Mga Alalahanin at Kamakailang Paksa**\n- Pension',
      );
    });
    await t.test('caches translated memory by owner and exact source text', async () => {
      const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
      class MemoryStorage {
        values = new Map();
        get length() { return this.values.size; }
        key(index) { return [...this.values.keys()][index] ?? null; }
        getItem(key) { return this.values.get(key) ?? null; }
        setItem(key, value) { this.values.set(key, String(value)); }
        removeItem(key) { this.values.delete(key); }
      }
      Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: new MemoryStorage() });
      try {
        const source = { summary: 'You enjoy gardening.', notes: '**Likes**\\n- Gardening' };
        const hash = await memorySourceHash(source);
        assert.equal(hash, await memorySourceHash(source));
        assert.notEqual(hash, await memorySourceHash({ ...source, notes: 'Changed' }));
        const translation = { summary: 'Ganahan ka sa pagpananom.', notes: '**Mga gusto**\\n- Pagpananom' };
        await saveMemoryTranslation('senior-1', hash, 'cebuano', translation);
        assert.deepEqual(await loadMemoryTranslation('senior-1', hash, 'cebuano'), translation);
        assert.equal(await loadMemoryTranslation('senior-2', hash, 'cebuano'), null);
        clearMemoryTranslations('senior-1');
        assert.equal(await loadMemoryTranslation('senior-1', hash, 'cebuano'), null);
      } finally {
        if (originalDescriptor) Object.defineProperty(globalThis, 'localStorage', originalDescriptor);
        else delete globalThis.localStorage;
      }
    });
  } finally {
    await vite.close();
  }
});
