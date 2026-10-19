import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = new URL('../', import.meta.url);
test('permission instructions and bundled speech stay aligned', async (t) => {
  const vite = await createServer({
    configFile: false, envDir: false, logLevel: 'silent',
    resolve: { alias: { '@': fileURLToPath(new URL('src', root)) } },
    server: { middlewareMode: true, hmr: false, watch: null },
  });
  try {
    const { permissionGuidance } = await vite.ssrLoadModule('/src/services/permissionGuidance.ts');
    const manifest = JSON.parse(await readFile(new URL('public/audio/onboarding/permission-clips.json', root), 'utf8'));
    for (const platform of ['android', 'ios', 'web']) {
      for (const permission of ['microphone', 'location']) {
        await t.test(`${platform} ${permission}`, async () => {
          const guidance = permissionGuidance(permission, platform);
          assert.equal(guidance.audioName.includes('-android-'), platform === 'android');
          for (const locale of ['en', 'ceb', 'tl']) {
            const strings = JSON.parse(await readFile(new URL(`src/locales/${locale}.json`, root), 'utf8'));
            const text = strings[guidance.textKey];
            assert.ok(text);
            assert.doesNotMatch(text, /\b(android|ios)\b/i);
            if (platform === 'android') assert.match(text, /While using the app/);
            else assert.doesNotMatch(text, /While using the app|Allow While Using App/);
            const clip = `${locale}/${guidance.audioName}.wav`;
            assert.equal(manifest[clip].key, guidance.textKey);
            assert.equal(manifest[clip].sha256, createHash('sha256').update(text).digest('hex'));
            const wav = await readFile(new URL(`public/audio/onboarding/${clip}`, root));
            assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
            assert.equal(wav.toString('ascii', 8, 12), 'WAVE');
            assert.equal(wav.readUInt32LE(24), 24000);
            assert.equal(wav.readUInt16LE(22), 1);
            assert.equal(wav.readUInt16LE(34), 16);
            assert.ok(wav.length > 44);
            assert.equal(wav.readUInt32LE(40), wav.length - 44);
          }
        });
      }
    }
  } finally { await vite.close(); }
});
