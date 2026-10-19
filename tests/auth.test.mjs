import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

test('senior identity helpers', async (t) => {
  const vite = await createServer({
    configFile: false, envDir: false, logLevel: 'silent',
    resolve: { alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) } },
    server: { middlewareMode: true, hmr: false, watch: null },
  });
  try {
    const { seniorEmail, normalizeSeniorId, isPinValid } = await vite.ssrLoadModule('/src/services/authService.ts');

    await t.test('Senior ID maps to a stable internal address', () => {
      assert.equal(normalizeSeniorId('  SC-2024-0001 '), 'sc-2024-0001');
      assert.equal(normalizeSeniorId('  sc-2024-0001 '), 'sc-2024-0001');
      assert.equal(seniorEmail('  SC-2024-0001 '), 'sc-2024-0001@seniors.agakai.local');
      assert.equal(seniorEmail('  sc-2024-0001 '), 'sc-2024-0001@seniors.agakai.local');
      assert.equal(seniorEmail('sc 2024 0001'), 'sc20240001@seniors.agakai.local');
    });

    await t.test('PIN is exactly six digits', () => {
      assert.equal(isPinValid('123456'), true);
      assert.equal(isPinValid('12345'), false);
      assert.equal(isPinValid('1234567'), false);
      assert.equal(isPinValid('12a456'), false);
      assert.equal(isPinValid(' 123456'), false);
    });
  } finally {
    await vite.close();
  }
});
