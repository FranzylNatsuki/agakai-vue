import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const assetsDir = fileURLToPath(new URL('../dist/assets/', import.meta.url));
const maxChunkBytes = 500_000;
const entries = await readdir(assetsDir);
const chunks = await Promise.all(
  entries
    .filter((entry) => entry.endsWith('.js'))
    .map(async (name) => ({ name, size: (await stat(join(assetsDir, name))).size })),
);

const largest = chunks.reduce((current, chunk) => chunk.size > current.size ? chunk : current, {
  name: '(none)',
  size: 0,
});
console.log(
  `Checked ${chunks.length} JavaScript chunks; largest is ${largest.name} (${(largest.size / 1000).toFixed(2)} kB). Limit: 500 kB.`,
);

const oversized = chunks.filter((chunk) => chunk.size > maxChunkBytes);
if (oversized.length) {
  for (const chunk of oversized) {
    console.error(`Over limit: ${chunk.name} (${(chunk.size / 1000).toFixed(2)} kB)`);
  }
  process.exitCode = 1;
}
