import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

test('benefit display localization', async (t) => {
  const vite = await createServer({
    configFile: false, envDir: false, logLevel: 'silent',
    resolve: { alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) } },
    server: { middlewareMode: true, hmr: false, watch: null },
  });
  try {
    const { localizeBenefit } = await vite.ssrLoadModule('/src/models/benefit.ts');
    const benefit = {
      id: 'national',
      title: 'Social Pension',
      dateAndLocation: 'Jan 15, 2026 • National / All LGUs',
      iconKey: 'pension',
      category: 'cash',
      description: 'A national benefit.',
      lgu: 'National / All LGUs',
    };

    await t.test('replaces database shorthand with clear coverage text', () => {
      const result = localizeBenefit(benefit, 'en');
      assert.equal(result.dateAndLocation, 'Jan 15, 2026 • Available nationwide');
      assert.equal(result.lgu, 'Available nationwide');
    });

    await t.test('localizes nationwide coverage for Cebuano and Tagalog', () => {
      assert.equal(localizeBenefit(benefit, 'ceb').dateAndLocation, 'Jan 15, 2026 • Sakop sa tibuok nasod');
      assert.equal(localizeBenefit(benefit, 'tl').lgu, 'Sakop sa buong bansa');
    });
  } finally {
    await vite.close();
  }
});

test('structured Gemini card decisions stream clean answer text', async () => {
  const vite = await createServer({
    configFile: false, envDir: false, logLevel: 'silent',
    resolve: { alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) } },
    server: { middlewareMode: true, hmr: false, watch: null },
  });
  try {
    const { createChatResponseStream } = await vite.ssrLoadModule('/src/services/chatCards.ts');
    const stream = createChatResponseStream();
    const chunks = [
      '{"answer":"Use the ',
      'map.\\nTap \\"Show it\\".',
      '","cardKind":"map"}',
    ];
    const visible = chunks.map((chunk) => stream.push(chunk)).join('');
    const result = stream.finish();
    assert.equal(visible, 'Use the map.\nTap "Show it".');
    assert.equal(result.answer, visible);
    assert.equal(result.cardKind, 'map');
    assert.doesNotMatch(visible, /cardKind|AGAK_CARD/);

    const noCard = createChatResponseStream();
    const noCardJson = '{"answer":"That sounds pleasant.","cardKind":"none"}';
    noCard.push(noCardJson);
    assert.deepEqual(noCard.finish(), { answer: 'That sounds pleasant.', cardKind: 'none' });
  } finally {
    await vite.close();
  }
});
