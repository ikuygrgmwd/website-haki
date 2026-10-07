import { createClient } from '@supabase/supabase-js';

export function supabaseStorage({ url, key, bucket = 'sapatri-private' }) {
  if (!url || !key) throw new Error('SUPABASE_URL dan SUPABASE_SECRET_KEY diperlukan.');
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const files = client.storage.from(bucket);
  const unwrap = result => {
    if (result.error) throw Object.assign(new Error('Penyimpanan berkas tidak tersedia.'), { code: 'storage_error' });
    return result.data;
  };
  return {
    bucket,
    async ensureBucket() {
      const existing = await client.storage.getBucket(bucket);
      if (existing.error) {
        if (String(existing.error.statusCode) !== '404') unwrap(existing);
        unwrap(await client.storage.createBucket(bucket, { public: false, fileSizeLimit: 8 * 1024 * 1024, allowedMimeTypes: ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'] }));
      } else {
        if (existing.data.public) throw new Error('Bucket dokumen wajib private.');
        unwrap(await client.storage.updateBucket(bucket, { public: false, fileSizeLimit: 8 * 1024 * 1024, allowedMimeTypes: ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'] }));
      }
    },
    async signUpload(path) { return unwrap(await files.createSignedUploadUrl(path, { upsert: false })).signedUrl; },
    async download(path, maxBytes = 8 * 1024 * 1024) {
      const data = unwrap(await files.download(path));
      if (!data.size || data.size > maxBytes) throw Object.assign(new Error('Ukuran berkas tidak valid.'), { status: 400 });
      return Buffer.from(await data.arrayBuffer());
    },
    async put(path, bytes, mime) { unwrap(await files.upload(path, bytes, { contentType: mime, upsert: false, cacheControl: '0' })); },
    async remove(paths) { if (paths.length) unwrap(await files.remove(paths)); },
    async signDownload(path, name, mime) {
      return unwrap(await files.createSignedUrl(path, 60, mime === 'application/pdf' ? { download: name } : {})).signedUrl;
    },
  };
}
