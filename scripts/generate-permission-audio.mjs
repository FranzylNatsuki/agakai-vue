// Dry run by default. --generate spends ElevenLabs credits through the authenticated gateway.
// Supply AGAKAI_AUDIO_SENIOR_ID and AGAKAI_AUDIO_PIN for an authorized test account.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { loadEnv } from 'vite';
import { createClient } from '@supabase/supabase-js';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'public/audio/onboarding');
const manifestPath = path.join(output, 'permission-clips.json');
const hash = (text) => createHash('sha256').update(text).digest('hex');
const plan = [];
for (const [locale, language] of [['en', 'en'], ['ceb', 'ceb'], ['tl', 'fil']]) {
  const strings = JSON.parse(await fs.readFile(path.join(root, `src/locales/${locale}.json`), 'utf8'));
  for (const platform of ['web', 'android']) {
    for (const permission of ['microphone', 'location']) {
      const key = `onboarding_${permission === 'microphone' ? 'mic' : 'location'}_prompt${platform === 'android' ? '_android' : ''}`;
      const file = `${locale}/${permission}${platform === 'android' ? '-android' : ''}-v2.wav`;
      const text = strings[key];
      if (!text || /\b(android|ios)\b/i.test(text)) throw new Error(`Invalid dialogue: ${locale}/${key}`);
      plan.push({ file, key, text, language, sha256: hash(text) });
    }
  }
}
let manifest = {};
try { manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
const pending = [];
for (const clip of plan) {
  const exists = await fs.access(path.join(output, clip.file)).then(() => true, () => false);
  if (!exists || manifest[clip.file]?.sha256 !== clip.sha256) pending.push(clip);
}
console.log(`${pending.length} clips pending; ${pending.reduce((sum, clip) => sum + clip.text.length, 0)} characters. Generation uses paid credits.`);
if (!process.argv.includes('--generate') || !pending.length) process.exit(0);

const env = { ...loadEnv('production', root, 'VITE_'), ...process.env };
const id = env.AGAKAI_AUDIO_SENIOR_ID;
const pin = env.AGAKAI_AUDIO_PIN;
if (!id || !pin) throw new Error('Supply the authorized test account via AGAKAI_AUDIO_SENIOR_ID and AGAKAI_AUDIO_PIN.');
const url = env.VITE_SUPABASE_URL?.replace(/\/$/, '');
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) throw new Error('Missing public Supabase configuration.');
const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
const { data, error } = await client.auth.signInWithPassword({
  email: `${id.trim().toLowerCase().replace(/\s+/g, '')}@seniors.agakai.local`, password: pin,
});
if (error || !data.session) throw new Error('Test account sign-in failed; no audio generated.');

try {
  for (const clip of pending) {
    const response = await fetch(`${url}/functions/v1/elevenlabs-voice/tts`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${data.session.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: clip.text, language: clip.language }),
      signal: AbortSignal.timeout(120000),
    });
    if (!response.ok || !response.headers.get('content-type')?.includes('audio/pcm')) {
      throw new Error(`Speech request failed (${response.status}); stopped without automatic retries.`);
    }
    const pcm = Buffer.from(await response.arrayBuffer());
    if (!pcm.length || pcm.length % 2) throw new Error('Incomplete PCM audio; stopped without automatic retries.');
    // The gateway returns mono, signed 16-bit little-endian PCM at 24 kHz.
    const header = Buffer.alloc(44);
    header.write('RIFF', 0); header.writeUInt32LE(36 + pcm.length, 4); header.write('WAVEfmt ', 8);
    header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
    header.writeUInt32LE(24000, 24); header.writeUInt32LE(48000, 28);
    header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34);
    header.write('data', 36); header.writeUInt32LE(pcm.length, 40);
    const file = path.join(output, clip.file);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(`${file}.tmp`, Buffer.concat([header, pcm]));
    await fs.rename(`${file}.tmp`, file);
    manifest[clip.file] = { key: clip.key, sha256: clip.sha256 };
    await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(`Generated ${clip.file} (${(pcm.length / 48000).toFixed(1)}s)`);
    await new Promise((resolve) => setTimeout(resolve, 3100));
  }
} finally {
  // Revoke only this script's session, not other signed-in devices.
  await client.auth.signOut({ scope: 'local' });
}
