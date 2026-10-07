import { supabaseStorage } from '../server/storage.mjs';
import { cloudConfig } from '../server/runtime.mjs';
import { command } from './cloud-config.mjs';
await command(async () => {
  const storage = supabaseStorage(cloudConfig());
  await storage.ensureBucket();
  console.log('Bucket private siap:', storage.bucket);
});
