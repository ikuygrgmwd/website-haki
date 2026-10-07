import { existsSync, readFileSync } from 'node:fs';
import { cloudConfig } from '../server/runtime.mjs';
import { command, migrationResources, invalid } from './cloud-config.mjs';

await command(async () => {
  const config = cloudConfig();
  const checks = {
    DATABASE_URL: !!config.connectionString,
    SUPABASE_URL: !!config.url,
    SUPABASE_SECRET_KEY: !!config.key,
    SAPATRI_SETUP_TOKEN: (process.env.SAPATRI_SETUP_TOKEN || '').length >= 32,
  };
  console.log('Konfigurasi (nilai rahasia tidak ditampilkan):', checks);
  const linked = existsSync('.vercel/project.json');
  console.log('Project Vercel lokal:', linked ? JSON.parse(readFileSync('.vercel/project.json', 'utf8')).projectId : 'belum ditautkan');
  if (!Object.values(checks).every(Boolean)) throw invalid('Konfigurasi belum lengkap. Isi .env.local sesuai .env.example.');
  if (!process.argv.includes('--connect')) return;
  const { database, storage } = migrationResources();
  try {
    console.log('Koneksi PostgreSQL:', (await database.one('SELECT 1 AS n')).n === 1 ? 'OK' : 'gagal');
    const schema = await database.one("SELECT to_regclass('sapatri.users') AS name");
    console.log('Skema aplikasi:', schema.name ? 'tersedia' : 'belum dimigrasikan');
    console.log('Bucket tujuan:', storage.bucket);
  } finally { await database.close(); }
});
