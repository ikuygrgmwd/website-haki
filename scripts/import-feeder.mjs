import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { resolve, dirname, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { importSource, publicProjection } from './feeder-lib.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const input = args.find(a => !a.startsWith('--'));
const value = flag => { const i = args.indexOf(flag); return i === -1 ? undefined : args[i + 1]; };
if (!input) { console.error('Usage: npm run import:feeder -- <path.tsv> [--source bekasi-hak-cipta]'); process.exit(1); }
const sourceId = value('--source') ?? 'bekasi-hak-cipta';
const privateDir = resolve(root, 'private-data');
const databasePath = resolve(privateDir, 'feeder-db.json');
const publicPath = resolve(root, 'public/data/innovations.json');
for (const target of [privateDir, publicPath]) {
  const subpath = relative(root, target); if (subpath.startsWith('..') || isAbsolute(subpath)) throw new Error('Output di luar direktori proyek.');
}
await mkdir(privateDir, { recursive: true });
await mkdir(dirname(publicPath), { recursive: true });
let previous = null;
try { previous = JSON.parse(await readFile(databasePath, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const original = await readFile(resolve(input), 'utf8');
const database = importSource(original, sourceId, previous);
const projection = publicProjection(database, sourceId);
async function writeAtomic(path, data) { await writeFile(`${path}.tmp`, data, { mode: 0o600 }); await rename(`${path}.tmp`, path); }
await writeAtomic(resolve(privateDir, `${sourceId}.tsv`), original);
await writeAtomic(databasePath, JSON.stringify(database, null, 2) + '\n');
await writeAtomic(publicPath, JSON.stringify(projection, null, 2) + '\n');
const uniqueCreators = new Set(projection.innovations.flatMap(i => i.identifiedCreatorIds)).size;
console.log(`Feeder berhasil diperbarui: ${projection.innovations.length} inovasi, ${uniqueCreators} pencipta teridentifikasi. Data pribadi hanya disimpan di private-data/.`);
