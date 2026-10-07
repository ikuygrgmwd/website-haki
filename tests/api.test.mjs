import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import sharp from 'sharp';
import { createApplication } from '../server/api.mjs';
import { openStore } from '../server/store.mjs';

const password = 'Sapatri-Test-2026!';
async function fixture(t, seed = false) {
  const dir = mkdtempSync(join(tmpdir(), 'sapatri-api-'));
  const app = await createApplication({ dbPath: join(dir, 'test.sqlite'), seed, bootstrapToken: 'test-setup-token', secureCookies: false });
  app.server.listen(0, '127.0.0.1'); await once(app.server, 'listening');
  const base = `http://127.0.0.1:${app.server.address().port}/api`;
  const client = () => ({ cookie: '', csrf: '', async req(path, method = 'GET', body, extra = {}) { const r = await fetch(base + path, { method, headers: { Cookie: this.cookie, 'X-CSRF-Token': this.csrf, ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...extra }, body: body === undefined ? undefined : JSON.stringify(body) }); if (r.headers.get('set-cookie')) this.cookie = r.headers.get('set-cookie').split(';')[0]; const data = r.headers.get('content-type')?.includes('application/json') ? await r.json() : Buffer.from(await r.arrayBuffer()); if (data.csrf) this.csrf = data.csrf; return { status: r.status, data, headers: r.headers }; }, async ok(path, method = 'GET', body) { const r = await this.req(path, method, body); assert.ok(r.status < 300, `${method} ${path}: ${r.status} ${JSON.stringify(r.data)}`); return r.data; } });
  const a = client(); await a.ok('/setup', 'POST', { token: 'test-setup-token', name: 'Admin Uji', email: 'admin@test.id', password }); await a.ok('/login', 'POST', { email: 'admin@test.id', password });
  const createUser = async (name, role = 'User') => { const email = `${name}@test.id`; const user = await a.ok('/users', 'POST', { name, email, role, password, active: true }); const c = client(); await c.ok('/login', 'POST', { email, password }); return { user, c }; };
  t.after(async () => { app.server.closeAllConnections(); await new Promise(resolve => app.server.close(resolve)); if (app.db.isOpen) app.db.close(); rmSync(dir, { recursive: true, force: true }); });
  return { app, a, client, createUser, dir };
}
const basic = { type: 'Program Komputer', description: 'Pengujian aplikasi', creators: [], holders: [], attachments: [] };
const image = async () => (await sharp({ create: { width: 20, height: 20, channels: 3, background: '#b57864' } }).png().toBuffer()).toString('base64');

test('ownership, persistent drafts, edit conflicts, CSRF and protected files', async t => {
  const { a, client, createUser, app } = await fixture(t);
  const { c: first, user: owner } = await createUser('pertama'); const { c: second } = await createUser('kedua');
  let work = await first.ok('/innovations', 'POST', {});
  const same = await first.ok('/innovations', 'POST', { id: work.id }); assert.equal(same.id, work.id); assert.equal((await first.ok('/innovations')).length, 1);
  work = await first.ok(`/innovations/${work.id}`, 'PUT', { title: 'Inovasi pertama', ownerId: null, data: basic, version: work.version }); assert.equal(work.owner_id, owner.id);
  assert.equal((await second.ok('/innovations')).length, 0);
  for (const method of ['GET', 'PUT', 'DELETE']) assert.equal((await second.req(`/innovations/${work.id}`, method, method === 'PUT' ? {} : undefined)).status, 404);
  assert.equal((await second.req('/innovations', 'POST', { id: work.id })).status, 404);
  assert.equal((await first.req('/users')).status, 403);
  assert.equal((await first.req(`/innovations/${work.id}/status`, 'PUT', { status: 'Selesai' })).status, 403);
  assert.equal((await first.req(`/innovations/${work.id}/submit`, 'POST', {})).status, 400);
  assert.equal((await first.req(`/innovations/${work.id}`, 'PUT', { title: 'Lampiran palsu', version: work.version, data: { ...basic, attachments: [{ id: null, category: 'identitas' }] } })).status, 400);
  assert.equal((await first.req(`/innovations/${work.id}`, 'PUT', { title: 'Pencipta tidak valid', version: work.version, data: { ...basic, creators: [null] } })).status, 400);
  assert.equal((await first.req(`/innovations/${work.id}`, 'PUT', { title: 'Konflik', data: basic, version: 1 })).status, 409);
  assert.equal((await first.req('/innovations', 'POST', {}, { 'X-CSRF-Token': 'wrong' })).status, 403);
  assert.equal((await first.req('/innovations', 'POST', {}, { Origin: 'https://example.com' })).status, 403);
  const f = await first.ok('/files', 'POST', { purpose: 'attachment', innovationId: work.id, name: 'contoh.png', base64: await image() });
  assert.equal((await second.req(`/files/${f.id}`)).status, 404); assert.equal((await client().req(`/files/${f.id}`)).status, 401);
  assert.equal((await a.req(`/files/${f.id}`)).status, 200);
  assert.equal((await first.req('/files', 'POST', { purpose: 'certificate', innovationId: work.id, name: 'cert.png', base64: await image() })).status, 403);
  assert.equal((await first.req('/files', 'POST', { purpose: 'attachment', innovationId: work.id, name: 'malicious.png', base64: Buffer.from('<svg onload="alert(1)"></svg>').toString('base64') })).status, 400);
  const list = await a.ok('/innovations'); assert.equal(list.length, 1); assert.equal(list[0].ownerName, 'pertama');
  const adminEdit = await a.ok(`/innovations/${work.id}`, 'PUT', { title: 'Diubah Admin', data: basic, ownerId: owner.id, version: work.version }); assert.equal(adminEdit.title, 'Diubah Admin');
  assert.equal(app.db.prepare('SELECT title FROM innovations WHERE id=?').get(work.id).title, 'Diubah Admin');
  await first.ok(`/innovations/${work.id}`, 'DELETE'); assert.equal((await first.req(`/files/${f.id}`)).status, 404);
});

test('regional hierarchy, application submission, certificates and aftercare ownership', async t => {
  const { a, createUser } = await fixture(t);
  const { c: user, user: owner } = await createUser('peserta'); const { c: other } = await createUser('lain');
  const region = async (level, code, parentId) => a.ok('/regions', 'POST', { level, code, name: level, parentId, active: true });
  const p = await region('provinsi', '99'); const city = await region('kota', '99.01', p.id); const district = await region('kecamatan', '99.01.01', city.id); const village = await region('kelurahan', '99.01.01.1001', district.id);
  assert.equal((await a.req(`/regions/${district.id}`, 'DELETE')).status, 400);
  const person = { name: 'Peserta', address: 'Jalan Uji 1', districtId: district.id, villageId: village.id };
  let w = await user.ok('/innovations', 'POST', {}); const attachments = [];
  for (const category of ['identitas', 'pernyataan', 'contoh']) attachments.push({ ...await user.ok('/files', 'POST', { purpose: 'attachment', innovationId: w.id, name: `${category}.pdf`, base64: Buffer.from('%PDF-1.7\n%%EOF').toString('base64') }), category });
  w = await user.ok(`/innovations/${w.id}`, 'PUT', { title: 'Ciptaan lengkap', data: { ...basic, creators: [person], holders: [person], attachments }, version: w.version });
  w = await user.ok(`/innovations/${w.id}/submit`, 'POST', {}); assert.equal(w.status, 'Diajukan'); assert.ok(w.submitted_at);
  const again = await user.ok(`/innovations/${w.id}/submit`, 'POST', {}); assert.equal(again.submitted_at, w.submitted_at);
  assert.equal((await a.req(`/innovations/${w.id}/status`, 'PUT', { status: 'Selesai' })).status, 400);
  await a.ok(`/innovations/${w.id}/status`, 'PUT', { status: 'Diproses' }); w = await a.ok(`/innovations/${w.id}/status`, 'PUT', { status: 'Selesai' });
  const cert = await a.ok('/files', 'POST', { purpose: 'certificate', innovationId: w.id, name: 'sertifikat.pdf', base64: Buffer.from('%PDF-1.7\n%%EOF').toString('base64') });
  w = await a.ok(`/innovations/${w.id}`, 'PUT', { ownerId: owner.id, title: w.title, version: w.version, data: { ...w.data, certificateId: cert.id } });
  const care = await a.ok('/aftercare', 'POST', { innovationId: w.id, participantType: 'Perorangan', name: 'Peserta', program: 'Pelatihan', trainingStatus: 'Belum', photos: [] });
  assert.equal((await user.ok('/aftercare')).length, 1); assert.equal((await other.ok('/aftercare')).length, 0);
  assert.equal((await user.req(`/aftercare/${care.id}`, 'DELETE')).status, 403);
  assert.equal((await user.req(`/files/${cert.id}`)).status, 200); assert.equal((await other.req(`/files/${cert.id}`)).status, 404);
  assert.equal((await user.req(`/innovations/${w.id}`, 'DELETE')).status, 400);
  const changed = await user.ok(`/innovations/${w.id}`, 'PUT', { title: 'Revisi pemilik', version: w.version, data: { ...w.data, certificateId: null } });
  assert.equal(changed.status, 'Perlu Revisi'); assert.equal(changed.data.certificateId, cert.id);
  await a.ok(`/aftercare/${care.id}`, 'DELETE'); await user.ok(`/innovations/${w.id}`, 'DELETE');
  await a.ok(`/regions/${district.id}`, 'PUT', { ...district, parentId: city.id, active: false });
  assert.equal((await user.ok('/regions')).find(r => r.id === village.id).active, 0);
});

test('profile, secure password reset, last Admin guard and published content', async t => {
  const { a, createUser, client, app } = await fixture(t);
  const { c: user, user: account } = await createUser('profil');
  const me = (await a.ok('/session')).user;
  assert.equal((await a.req(`/users/${me.id}`, 'PUT', { ...me, role: 'User', active: true })).status, 400);
  assert.equal((await a.req('/users', 'POST', { name: 'Invalid', email: 'invalid@test.id', role: 'Operator', password })).status, 400);
  const photo = await user.ok('/files', 'POST', { purpose: 'avatar', name: 'profil.png', base64: await image() });
  const updated = await user.ok('/profile', 'PUT', { name: 'Nama baru', email: 'changed@test.id', phone: '081234567890', photoId: photo.id }); assert.equal(updated.email, account.email); assert.equal(updated.photoId, photo.id);
  assert.equal((await user.req('/password', 'PUT', { oldPassword: 'salah', password: 'Password-baru-2026!', confirm: 'Password-baru-2026!' })).status, 400);
  const otherSession = client(); await otherSession.ok('/login', 'POST', { email: account.email, password });
  await user.ok('/password', 'PUT', { oldPassword: password, password: 'Password-baru-2026!', confirm: 'Password-baru-2026!' }); assert.equal((await otherSession.req('/innovations')).status, 401);
  const reset = await a.ok(`/users/${account.id}/reset`, 'POST', {}); assert.equal((await user.req('/innovations')).status, 401);
  await client().ok('/reset-password', 'POST', { token: reset.token, password: 'Password-reset-2026!', confirm: 'Password-reset-2026!' });
  assert.equal((await client().req('/reset-password', 'POST', { token: reset.token, password, confirm: password })).status, 400);
  const newSession = client(); await newSession.ok('/login', 'POST', { email: account.email, password: 'Password-reset-2026!' });
  assert.equal((await newSession.ok('/session')).user.name, 'Nama baru');
  assert.ok(!JSON.stringify(await a.ok('/users')).includes('password_hash')); assert.ok(!app.db.prepare('SELECT password_hash FROM users WHERE id=?').get(account.id).password_hash.includes('Password-reset'));
  const imageId = (await a.ok('/files', 'POST', { purpose: 'landing', name: 'slide.png', base64: await image() })).id;
  assert.equal((await client().req(`/files/${imageId}`)).status, 401);
  const slide = { id: 'slide1', title: 'Informasi', description: 'Isi', imageId, buttonText: 'Buka', url: '#/dashboard', visible: true };
  await a.ok('/content/carousel', 'PUT', { slides: [slide] }); assert.equal((await client().req(`/files/${imageId}`)).status, 200);
  assert.equal((await a.req('/content/carousel', 'PUT', { slides: [{ ...slide, url: 'javascript:alert(1)' }] })).status, 400);
  await a.ok('/content/about', 'PUT', { title: 'Tentang', html: '<p>Isi <strong>aman</strong><script>alert(1)</script><a href="javascript:alert(1)" onclick="alert(1)">tautan</a></p>', visible: true });
  const publicContent = await client().ok('/landing'); assert.ok(!/script|onclick|javascript/.test(publicContent.about.html)); assert.ok(publicContent.about.html.includes('<strong>aman</strong>'));
  await a.ok('/content/carousel', 'PUT', { slides: [{ ...slide, visible: false }] }); assert.equal((await client().ok('/landing')).slides.length, 0); assert.equal((await client().req(`/files/${imageId}`)).status, 401);
  await a.ok(`/users/${account.id}`, 'PUT', { ...account, active: false }); assert.equal((await newSession.req('/innovations')).status, 401);
});

test('feeder import preserves unknown facts and geographical identifiers', async t => {
  const { a } = await fixture(t, true); const rows = await a.ok('/innovations'); assert.equal(rows.length, JSON.parse(readFileSync('public/data/innovations.json')).innovations.length);
  assert.ok(rows.every(r => !r.owner_id && !r.status && !r.created_at && !r.submitted_at));
  const regions = await a.ok('/regions'); assert.equal(regions.filter(r => r.level === 'kecamatan').length, 12); assert.equal(regions.filter(r => r.level === 'kelurahan').length, 56);
  assert.equal(regions.find(r => r.code === '32.75.01').name, 'Bekasi Timur');
});

test('database reopen preserves edits, sessions and feeder deletions', async t => {
  const { a, app, dir } = await fixture(t, true);
  const rows = await a.ok('/innovations'); const removed = rows[0]; const edited = rows[1];
  await a.ok(`/innovations/${removed.id}`, 'DELETE');
  await a.ok(`/innovations/${edited.id}`, 'PUT', { title: 'Judul tersimpan setelah restart', version: edited.version, data: basic, ownerId: null });
  const cookie = a.cookie;
  app.server.closeAllConnections(); await new Promise(resolve => app.server.close(resolve)); app.db.close();
  const reopened = openStore(join(dir, 'test.sqlite'), true);
  try {
    assert.equal(reopened.prepare('SELECT COUNT(*) AS n FROM innovations').get().n, rows.length - 1);
    assert.equal(reopened.prepare('SELECT id FROM innovations WHERE source_id=?').get(removed.source_id), undefined);
    assert.equal(reopened.prepare('SELECT title FROM innovations WHERE id=?').get(edited.id).title, 'Judul tersimpan setelah restart');
    assert.equal(reopened.prepare('SELECT COUNT(*) AS n FROM sessions').get().n, 1);
    assert.ok(cookie.startsWith('sapatri='));
  } finally { reopened.close(); }
});
