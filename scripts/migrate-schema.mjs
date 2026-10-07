import { readFileSync } from 'node:fs';
import { postgresDatabase } from '../server/database.mjs';
import { migrationConfig, command } from './cloud-config.mjs';

await command(async () => {
  const db = postgresDatabase(migrationConfig().connectionString);
  try {
    await db.request(() => db.run(readFileSync(new URL('../migrations/001-postgres.sql', import.meta.url), 'utf8')), true);
    console.log('Skema PostgreSQL siap. Tidak ada data SQLite yang dipindahkan oleh perintah ini.');
  } finally { await db.close(); }
});
