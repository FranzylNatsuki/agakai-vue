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

test('AI card decision markers stay out of streamed text and speech', async () => {
  const vite = await createServer({
    configFile: false, envDir: false, logLevel: 'silent',
    resolve: { alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) } },
    server: { middlewareMode: true, hmr: false, watch: null },
  });
  try {
    const { createCardDecisionStream } = await vite.ssrLoadModule('/src/services/chatCards.ts');
    const stream = createCardDecisionStream();
    const visible = [
      'A listed program may help. ',
      '[[AGAK_',
      'CARD:benefits]]',
    ].map((chunk) => stream.push(chunk)).join('');
    const result = stream.finish();
    assert.equal(visible + result.text, 'A listed program may help. ');
    assert.equal(result.cardKind, 'benefits');
    assert.doesNotMatch(visible + result.text, /AGAK_CARD/);

    const noCard = createCardDecisionStream();
    noCard.push('That sounds pleasant. [[AGAK_CARD:none]]');
    assert.deepEqual(noCard.finish(), { text: '', cardKind: null });
  } finally {
    await vite.close();
  }
});
