import { cloudConfig } from '../server/runtime.mjs';
import { postgresDatabase } from '../server/database.mjs';
import { supabaseStorage } from '../server/storage.mjs';

export function migrationConfig() {
  const config = cloudConfig();
  config.connectionString = process.env.DATABASE_MIGRATION_URL || config.connectionString;
  if (!config.connectionString) throw new Error('Isi DATABASE_MIGRATION_URL atau DATABASE_URL di .env.local terlebih dahulu.');
  return config;
}
export function migrationResources() {
  const config = migrationConfig();
  const storage = supabaseStorage(config);
  return { database: postgresDatabase(config.connectionString), storage };
}
export async function command(fn) {
  try { await fn(); }
  catch (error) {
    // Driver errors can contain connection strings, SQL and private values.
    console.error('Operasi tidak selesai.', { code: error.code || 'configuration_or_validation', reason: error.safeMessage || 'Periksa konfigurasi, akses, dan prasyarat pada docs/deployment.md.' });
    process.exitCode = 1;
  }
}
export function invalid(message) { return Object.assign(new Error(message), { safeMessage: message }); }
