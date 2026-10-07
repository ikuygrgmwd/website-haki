import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

if (existsSync('.env.local')) {
  console.log('.env.local sudah tersedia; isinya tidak diubah.');
} else {
  const template = readFileSync('.env.example', 'utf8').replace('SAPATRI_SETUP_TOKEN=', `SAPATRI_SETUP_TOKEN=${randomBytes(32).toString('hex')}`);
  writeFileSync('.env.local', template, { flag: 'wx' });
  console.log('.env.local dibuat dengan token setup acak. Isi konfigurasi Supabase di berkas tersebut.');
}
