import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { importTables } from './import-sqlite.mjs';
import { migrationResources, command, invalid } from './cloud-config.mjs';

const sha = value => createHash('sha256').update(value).digest('hex');
await command(async () => {
  const path = process.argv[2] && resolve(process.argv[2]);
  if (!path || !existsSync(path)) throw invalid('Berikan path backup SQLite yang dicetak oleh db:import:sqlite.');
  const source = new DatabaseSync(path, { readOnly: true });
  const { database, storage } = migrationResources();
  try {
    await database.request(async () => {
      const marker = await database.one("SELECT data FROM content WHERE key='_sqlite_import_v1'");
      if (!marker || JSON.parse(marker.data).sourceHash !== sha(readFileSync(path))) throw invalid('Backup tidak cocok dengan sumber impor database ini.');
      for (const table of importTables) {
        let count = 0;
        for (const old of source.prepare(`SELECT * FROM ${table}`).iterate()) {
          const key = table === 'content' ? 'key' : 'id';
          const current = await database.one(`SELECT * FROM ${table} WHERE ${key}=?`, old[key]);
          if (!current) throw invalid(`Record hilang pada tabel ${table}.`);
          for (const field of Object.keys(old)) {
            if (table === 'files' && ['bytes', 'storage_path'].includes(field)) continue;
            if (String(old[field]) !== String(current[field])) throw invalid(`Isi record berbeda pada tabel ${table}.`);
          }
          if (table === 'files' && sha(await storage.download(current.storage_path)) !== sha(Buffer.from(old.bytes))) throw invalid('Isi berkas berbeda dari backup.');
          count++;
        }
        const actual = (await database.one(`SELECT COUNT(*) AS n FROM ${table}`)).n;
        if (actual !== count + (table === 'content' ? 1 : 0)) throw invalid(`Jumlah record berbeda pada tabel ${table}.`);
        console.log(`${table}: ${count} record cocok`);
      }
    });
    console.log('Verifikasi isi record dan checksum berkas berhasil.');
  } finally { source.close(); await database.close(); }
});
