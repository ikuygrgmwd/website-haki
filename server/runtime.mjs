import { createApplication } from './api.mjs';
import { postgresDatabase } from './database.mjs';
import { supabaseStorage } from './storage.mjs';

export function cloudConfig(env = process.env) {
  return {
    connectionString: env.DATABASE_URL || env.POSTGRES_URL,
    url: env.SUPABASE_URL,
    key: env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY,
    bucket: env.SUPABASE_STORAGE_BUCKET || 'sapatri-private',
  };
}

export async function createRuntime(env = process.env) {
  const config = cloudConfig(env);
  if (!config.connectionString) {
    if (env.VERCEL) throw new Error('DATABASE_URL belum diatur. SQLite tidak digunakan di Vercel.');
    return createApplication({ dbPath: env.SAPATRI_DB || 'private-data/sapatri.sqlite', bootstrapToken: env.SAPATRI_SETUP_TOKEN });
  }
  if (!env.SAPATRI_SETUP_TOKEN || env.SAPATRI_SETUP_TOKEN.length < 32) throw new Error('SAPATRI_SETUP_TOKEN harus berisi minimal 32 karakter acak.');
  const storage = supabaseStorage(config);
  const database = postgresDatabase(config.connectionString);
  try {
    return await createApplication({ database, storage, seed: false, bootstrapToken: env.SAPATRI_SETUP_TOKEN, secureCookies: env.NODE_ENV === 'production' || !!env.VERCEL });
  } catch (error) { await database.close(); throw error; }
}
