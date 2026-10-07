import { openStore } from '../server/store.mjs';
import { postgresDatabase } from '../server/database.mjs';
import { migrationConfig, command, invalid } from './cloud-config.mjs';

await command(async () => {
  const database = postgresDatabase(migrationConfig().connectionString);
  const local = openStore(':memory:');
  try {
    await database.request(async () => {
      if ((await database.one('SELECT COUNT(*) AS n FROM regions')).n) throw invalid('Master wilayah sudah terisi; tidak ditimpa.');
      const rows = local.prepare("SELECT * FROM regions ORDER BY CASE level WHEN 'provinsi' THEN 0 WHEN 'kota' THEN 1 WHEN 'kecamatan' THEN 2 ELSE 3 END").all();
      for (const row of rows) await database.run('INSERT INTO regions(id,level,parent_id,code,name,active) VALUES(?,?,?,?,?,?)', row.id, row.level, row.parent_id, row.code, row.name, row.active);
      console.log(`${rows.length} wilayah disiapkan. Buat Admin melalui halaman login.`);
    }, true);
  } finally { local.close(); await database.close(); }
});
