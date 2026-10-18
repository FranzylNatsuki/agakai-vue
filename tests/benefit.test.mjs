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

test('supplemental chat cards match their guidance context', async () => {
  const vite = await createServer({
    configFile: false, envDir: false, logLevel: 'silent',
    resolve: { alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) } },
    server: { middlewareMode: true, hmr: false, watch: null },
  });
  try {
    const { supplementalCardKind } = await vite.ssrLoadModule('/src/services/chatCards.ts');
    assert.equal(supplementalCardKind('What benefits can I use?'), 'benefits');
    assert.equal(supplementalCardKind('Where is the health center?'), 'map');
    assert.equal(supplementalCardKind('Tell me a story'), null);
  } finally {
    await vite.close();
  }
});
