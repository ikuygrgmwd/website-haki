import { createServer } from 'node:http';
import { once } from 'node:events';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createApplication } from '../server/api.mjs';
import { supabaseStorage } from '../server/storage.mjs';

// Local HTTP double for Supabase Storage: exercises the real SDK and the actual
// browser upload path, including cross-origin PUT and final signed downloads.
const objects = new Map(), permitted = new Set();
let directBytes = 0;
const storageServer = createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type, x-upsert');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  const url = new URL(req.url, 'http://localhost');
  const path = url.pathname.replace('/storage/v1', '');
  const json = (value, code = 200) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(value)); };
  const chunks = []; for await (const chunk of req) chunks.push(chunk);
  const bytes = Buffer.concat(chunks);
  const backend = req.headers.apikey === 'storage-test-key';
  if (path.startsWith('/object/upload/sign/')) {
    const key = path.slice('/object/upload/sign/'.length);
    if (req.method === 'POST' && backend) { permitted.add(key); return json({ url: `${path}?token=local-test` }); }
    if (req.method === 'PUT' && permitted.has(key) && url.searchParams.get('token') === 'local-test' && !objects.has(key)) {
      directBytes += bytes.length; objects.set(key, bytes); return json({ Key: key });
    }
  } else if (path.startsWith('/object/sign/')) {
    const key = path.slice('/object/sign/'.length);
    if (req.method === 'POST' && backend) return json({ signedURL: `${path}?token=download-test` });
    if (req.method === 'GET' && url.searchParams.get('token') === 'download-test' && objects.has(key)) { res.writeHead(200, { 'Content-Type': 'application/pdf' }); res.end(objects.get(key)); return; }
  } else if (path.startsWith('/object/') && backend) {
    const key = path.slice('/object/'.length);
    if (req.method === 'POST' && !objects.has(key)) { objects.set(key, bytes); return json({ Key: key }); }
    if (req.method === 'GET' && objects.has(key)) { res.end(objects.get(key)); return; }
  }
  json({ message: 'Not found', statusCode: '404' }, 404);
});
storageServer.listen(0, '127.0.0.1'); await once(storageServer, 'listening');
const storage = supabaseStorage({ url: `http://127.0.0.1:${storageServer.address().port}`, key: 'storage-test-key' });
const app = await createApplication({ dbPath: ':memory:', seed: false, storage, bootstrapToken: 'browser-storage-setup', secureCookies: false });
app.server.listen(0, '127.0.0.1'); await once(app.server, 'listening');
const base = `http://127.0.0.1:${app.server.address().port}`;
let browser;
try {
  browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });
  const page = await browser.newPage();
  page.setDefaultTimeout(15000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}/#/login`);
  await page.getByLabel('Kode penyiapan').fill('browser-storage-setup');
  await page.getByLabel('Nama lengkap', { exact: true }).fill('Storage Test');
  await page.getByLabel('Email', { exact: true }).fill('storage@example.test');
  await page.getByLabel('Password', { exact: true }).fill('Storage-Test-2026!');
  await page.getByRole('button', { name: 'Buat Admin', exact: true }).click();
  await page.getByRole('heading', { name: 'Masuk ke Akun Anda', exact: true }).waitFor();
  await page.getByLabel('Email', { exact: true }).fill('storage@example.test');
  await page.getByLabel('Password', { exact: true }).fill('Storage-Test-2026!');
  await page.getByRole('button', { name: 'Masuk', exact: true }).click();
  await page.getByRole('heading', { name: 'Daftar Ciptaan', exact: true }).waitFor();
  console.log('PASS: Storage browser login');
  const work = await page.evaluate(async () => {
    const s = await fetch('/api/session').then(r => r.json());
    return fetch('/api/innovations', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': s.csrf }, body: '{}' }).then(r => r.json());
  });
  assert.ok(work.id);
  // Use the same route as the existing UI's edit links, without guessing it.
  await page.goto(`${base}/#/ciptaan`);
  await page.reload();
  const link = page.locator('tbody tr').first().getByRole('link', { name: 'Lanjutkan Draft', exact: true });
  await link.click();
  await page.getByRole('heading', { name: 'Edit Ciptaan', exact: true }).waitFor();
  await page.locator('[data-stage="3"]').click();
  const bytes = Buffer.alloc(8 * 1024 * 1024, 32); bytes.write('%PDF-1.4\n');
  await page.locator('#attachment-file').setInputFiles({ name: 'delapan-megabyte.pdf', mimeType: 'application/pdf', buffer: bytes });
  await page.locator('#portal-toast').filter({ hasText: 'Berkas tersimpan.' }).waitFor();
  assert.equal(directBytes, bytes.length);
  const row = app.db.prepare('SELECT * FROM files').get();
  assert.equal(row.mime, 'application/pdf'); assert.equal(row.bytes.length, 0);
  assert.ok(row.storage_path.startsWith('files/'));
  const response = await page.request.get(`${base}/api/files/${row.id}`);
  assert.equal(response.status(), 200); assert.deepEqual(await response.body(), bytes);
  assert.equal((await fetch(`${base}/api/files/${row.id}`, { redirect: 'manual' })).status, 401);
  assert.deepEqual(errors, []);
  console.log('PASS: browser → upload permission → cross-origin 8 MB PUT → real Storage SDK → file validation → private download');
} finally {
  await browser?.close();
  app.server.closeAllConnections(); storageServer.closeAllConnections();
  await Promise.all([new Promise(resolve => app.server.close(resolve)), new Promise(resolve => storageServer.close(resolve))]);
  await app.database.close();
}
