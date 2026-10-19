import type { AppLanguage } from '@/composables/useSettings';
import { appConfig } from '@/services/appConfig';
import { getVoiceAuthHeaders, onboardingSpeechLanguage } from '@/services/elevenLabs';

const DATABASE_NAME = 'agakai-greeting-audio-v1';
const STORE_NAME = 'greetings';
const MAX_GREETING_BYTES = 512_000;

interface CachedGreeting {
  key: string;
  textHash: string;
  pcm: ArrayBuffer;
}

const memoryCache = new Map<string, CachedGreeting>();
let databasePromise: Promise<IDBDatabase | null> | null = null;

async function hash(value: string): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error('Secure audio cache is unavailable.');
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function openDatabase(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
  return databasePromise;
}

async function readCachedGreeting(key: string, textHash: string): Promise<Uint8Array | null> {
  const memory = memoryCache.get(key);
  if (memory?.textHash === textHash) return new Uint8Array(memory.pcm.slice(0));

  const database = await openDatabase();
  if (!database) return null;
  return new Promise((resolve) => {
    const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(key);
    request.onsuccess = () => {
      const record = request.result as CachedGreeting | undefined;
      if (!record || record.textHash !== textHash || !(record.pcm instanceof ArrayBuffer)) {
        resolve(null);
        return;
      }
      memoryCache.set(key, record);
      resolve(new Uint8Array(record.pcm.slice(0)));
    };
    request.onerror = () => resolve(null);
  });
}

async function cacheGreeting(key: string, textHash: string, pcm: Uint8Array): Promise<boolean> {
  const record: CachedGreeting = { key, textHash, pcm: pcm.slice().buffer };
  const database = await openDatabase();
  if (!database) return false;
  const stored = await new Promise<boolean>((resolve) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put(record);
    transaction.oncomplete = () => resolve(true);
    transaction.onerror = () => resolve(false);
    transaction.onabort = () => resolve(false);
  });
  if (stored) memoryCache.set(key, record);
  return stored;
}

async function generateGreeting(text: string, language: AppLanguage, signal: AbortSignal): Promise<Uint8Array> {
  const headers = await getVoiceAuthHeaders();
  const response = await fetch(`${appConfig.elevenLabsFunctionUrl}/tts`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, language: onboardingSpeechLanguage(language) }),
    signal,
  });
  if (!response.ok || !response.headers.get('content-type')?.includes('audio/pcm')) {
    throw new Error('The greeting voice is unavailable.');
  }
  const pcm = new Uint8Array(await response.arrayBuffer());
  if (pcm.length < 2 || pcm.length > MAX_GREETING_BYTES || pcm.length % 2 !== 0) {
    throw new Error('The greeting voice returned invalid audio.');
  }
  return pcm;
}

function pcmToWav(pcm: Uint8Array): Blob {
  const wav = new ArrayBuffer(44 + pcm.length);
  const header = new DataView(wav);
  const writeText = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index++) header.setUint8(offset + index, value.charCodeAt(index));
  };
  writeText(0, 'RIFF');
  header.setUint32(4, 36 + pcm.length, true);
  writeText(8, 'WAVE');
  writeText(12, 'fmt ');
  header.setUint32(16, 16, true);
  header.setUint16(20, 1, true);
  header.setUint16(22, 1, true);
  header.setUint32(24, 24_000, true);
  header.setUint32(28, 48_000, true);
  header.setUint16(32, 2, true);
  header.setUint16(34, 16, true);
  writeText(36, 'data');
  header.setUint32(40, pcm.length, true);
  new Uint8Array(wav, 44).set(pcm);
  return new Blob([wav], { type: 'audio/wav' });
}

function playWav(blob: Blob, signal: AbortSignal): Promise<void> {
  const url = URL.createObjectURL(blob);
  const player = new Audio(url);
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener('abort', abort);
      player.onended = null;
      player.onerror = null;
      player.pause();
      URL.revokeObjectURL(url);
      if (error) reject(error);
      else resolve();
    };
    const abort = () => finish(new DOMException('Greeting playback stopped.', 'AbortError'));
    player.onended = () => finish();
    player.onerror = () => finish(new Error('Greeting playback failed.'));
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) {
      abort();
      return;
    }
    void player.play().catch((error: unknown) => {
      finish(error instanceof Error ? error : new Error('Greeting playback failed.'));
    });
  });
}

/** Generate a personalized greeting on cache miss, persist it locally, then play it. */
export async function playCachedGreeting(
  userId: string,
  text: string,
  language: AppLanguage,
  signal: AbortSignal,
): Promise<void> {
  const [key, textHash] = await Promise.all([
    hash(`${userId}\u0000${language}`),
    hash(text),
  ]);
  signal.throwIfAborted();
  let pcm = await readCachedGreeting(key, textHash);
  if (!pcm) {
    if (!(await openDatabase())) throw new Error('Persistent greeting cache is unavailable.');
    pcm = await generateGreeting(text, language, signal);
    signal.throwIfAborted();
    if (!(await cacheGreeting(key, textHash, pcm))) {
      throw new Error('The greeting could not be cached.');
    }
  }
  signal.throwIfAborted();
  await playWav(pcmToWav(pcm), signal);
}
