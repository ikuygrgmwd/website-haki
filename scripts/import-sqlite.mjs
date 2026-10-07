import { DatabaseSync, backup } from 'node:sqlite';
import { mkdirSync, existsSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { migrationResources, command, invalid } from './cloud-config.mjs';

export const importTables = ['regions', 'users', 'innovations', 'files', 'aftercare', 'content', 'audit'];
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

export async function importSnapshot(source, database, storage, sourceHash) {
  const counts = {};
  return database.request(async () => {
    const marker = await database.one("SELECT data FROM content WHERE key='_sqlite_import_v1'");
    if (marker) throw invalid('Impor sudah pernah dijalankan. Jalankan verifikasi, jangan menimpa data online.');
    for (const table of [...importTables, 'sessions', 'resets', 'pending_uploads']) {
      if ((await database.one(`SELECT COUNT(*) AS n FROM ${table}`)).n) throw invalid('Database tujuan harus kosong sebelum impor. Gunakan project pengujian kosong.');
    }
    await storage.ensureBucket();
    for (const table of importTables) {
      const order = table === 'regions' ? " ORDER BY CASE level WHEN 'provinsi' THEN 0 WHEN 'kota' THEN 1 WHEN 'kecamatan' THEN 2 ELSE 3 END" : '';
      counts[table] = 0;
      for (const row of source.prepare(`SELECT * FROM ${table}${order}`).iterate()) {
        if (table === 'files') {
          if (row.storage_path) throw invalid('Sumber harus SQLite lokal dengan berkas BLOB lengkap.');
          const bytes = Buffer.from(row.bytes);
          row.storage_path = `migration/${sourceHash}/${row.id}`;
          // Deterministic paths allow a failed import to be retried without
          // overwriting an existing object or creating duplicate files.
          try { await storage.put(row.storage_path, bytes, row.mime); }
          catch (error) {
            try { if (sha(await storage.download(row.storage_path)) !== sha(bytes)) throw error; }
            catch { throw error; }
          }
          if (sha(await storage.download(row.storage_path)) !== sha(bytes)) throw invalid('Verifikasi berkas gagal; impor dibatalkan.');
          row.bytes = Buffer.alloc(0);
        }
        const keys = Object.keys(row);
        await database.run(`INSERT INTO ${table}(${keys.join(',')}) VALUES(${keys.map(() => '?').join(',')})`, ...keys.map(key => row[key]));
        counts[table]++;
      }
      if ((await database.one(`SELECT COUNT(*) AS n FROM ${table}`)).n !== counts[table]) throw invalid('Jumlah record hasil impor tidak sesuai.');
    }
    await database.run("SELECT setval(pg_get_serial_sequence('sapatri.audit','id'), COALESCE((SELECT MAX(id) FROM audit), 0) + 1, false)");
    await database.run('INSERT INTO content(key,data) VALUES(?,?)', '_sqlite_import_v1', JSON.stringify({ sourceHash, counts, completedAt: new Date().toISOString() }));
    return counts;
  }, true);
}

export async function backupSource(sourcePath) {
  if (!existsSync(sourcePath)) throw invalid('Database SQLite sumber tidak ditemukan.');
  const directory = resolve('private-data', 'backups', `cloud-${new Date().toISOString().replace(/[:.]/g, '-')}`);
  mkdirSync(directory, { recursive: true });
  const backupPath = join(directory, 'sapatri.sqlite');
  const live = new DatabaseSync(sourcePath, { readOnly: true });
  try { await backup(live, backupPath); } finally { live.close(); }
  return { backupPath, sourceHash: sha(readFileSync(backupPath)) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await command(async () => {
  const { database, storage } = migrationResources();
  let source;
  try {
    const retryPath = process.argv[2] && resolve(process.argv[2]);
    if (retryPath && !existsSync(retryPath)) throw invalid('Backup untuk percobaan ulang tidak ditemukan.');
    const { backupPath, sourceHash } = retryPath
      ? { backupPath: retryPath, sourceHash: sha(readFileSync(retryPath)) }
      : await backupSource(resolve(process.env.SAPATRI_DB || 'private-data/sapatri.sqlite'));
    console.log('Backup lokal:', backupPath);
    source = new DatabaseSync(backupPath, { readOnly: true });
    console.log('Record berhasil dipindahkan:', await importSnapshot(source, database, storage, sourceHash));
    console.log('Sesi dan token reset tidak dipindahkan. Pengguna perlu login ulang.');
  } finally { source?.close(); await database.close(); }
});
