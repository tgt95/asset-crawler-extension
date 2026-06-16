import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(new URL('../package.json', import.meta.url)));
const dist = resolve(root, 'dist');

await mkdir(dist, { recursive: true });
await copyFile(resolve(root, 'manifest.json'), resolve(dist, 'manifest.json'));
