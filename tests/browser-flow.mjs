import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtempSync, mkdirSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { createApplication } from '../server/api.mjs';

const temp = mkdtempSync(join(tmpdir(), 'sapatri-browser-'));
mkdirSync('.browser-check', { recursive: true });
const app = await createApplication({ dbPath: join(temp, 'test.sqlite'), bootstrapToken: 'browser-test-token', secureCookies: false });
app.server.listen(0, '127.0.0.1'); await once(app.server, 'listening');
const base = `http://127.0.0.1:${app.server.address().port}`;
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });
const errors = [];
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
page.on('dialog', d => d.accept());
const password = 'Browser-Test-2026!';
const go = async hash => { await page.goto(base + '/#/' + hash); };
const heading = (name, p = page) => p.getByRole('heading', { name, exact: true }).first().waitFor();
const toast = (text, p = page) => p.locator('#portal-toast').filter({ hasText: text }).waitFor();
const api = async (p, path, method = 'GET', body) => p.evaluate(async ({ path, method, body }) => { const session = await fetch('/api/session').then(r => r.json()); const r = await fetch('/api' + path, { method, headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': session.csrf }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, data: await r.json() }; }, { path, method, body });
try {
  await go('login'); await heading('Siapkan Admin Pertama');
  await page.getByLabel('Kode penyiapan').fill('browser-test-token'); await page.getByLabel('Nama lengkap', { exact: true }).fill('Admin Pengujian'); await page.getByLabel('Email', { exact: true }).fill('admin@browser.test'); await page.getByLabel('Password', { exact: true }).fill(password); await page.getByRole('button', { name: 'Buat Admin', exact: true }).click();
  await heading('Masuk ke Akun Anda'); await page.getByLabel('Email', { exact: true }).fill('admin@browser.test'); await page.getByLabel('Password', { exact: true }).fill(password); await page.getByRole('button', { name: 'Masuk', exact: true }).click();
  await heading('Daftar Ciptaan'); await page.locator('tbody tr').first().waitFor();
  assert.equal(await page.locator('.sidebar').getByText('Daftar Ciptaan Draft', { exact: true }).count(), 0);
  assert.equal(await page.locator('.sidebar').getByText('Hak Cipta Lagu dan/atau Musik', { exact: true }).count(), 0);
  await page.screenshot({ path: '.browser-check/admin-ciptaan.png', fullPage: true });
  await page.locator('tbody tr').first().getByRole('link', { name: 'Edit', exact: true }).click(); await heading('Edit Ciptaan');
  assert.equal(await page.getByLabel('Pemilik akun').inputValue(), '', 'Feeder tanpa pemilik tidak boleh otomatis menjadi milik Admin');
  console.log('PASS: setup, login Admin, tabel feeder, navigasi');
  await go('pengguna'); await heading('Manajemen Pengguna'); await page.getByRole('button', { name: '+ Tambah Pengguna' }).click();
  const d = page.locator('dialog'); await d.getByLabel('Nama lengkap').fill('User Percobaan'); await d.getByLabel('Email', { exact: true }).fill('user@browser.test'); await d.getByLabel('Password awal').fill(password); await d.getByRole('button', { name: 'Simpan', exact: true }).click(); await toast('Pengguna disimpan');
  const userContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } }); const user = await userContext.newPage(); user.on('pageerror', e => errors.push(e.message)); user.on('dialog', d => d.accept());
  await user.goto(base + '/#/login'); await heading('Masuk ke Akun Anda', user); await user.getByLabel('Email', { exact: true }).fill('user@browser.test'); await user.getByLabel('Password', { exact: true }).fill(password); await user.getByRole('button', { name: 'Masuk', exact: true }).click(); await heading('Daftar Ciptaan', user); await user.getByText('Belum ada data yang sesuai', { exact: true }).waitFor();
  assert.equal(await user.locator('.sidebar').getByText('Manajemen Pengguna').count(), 0);
  await user.locator('#main-content').getByRole('link', { name: '+ Permohonan Baru', exact: true }).click(); await heading('Permohonan Baru', user);
  await user.getByLabel('Judul ciptaan').fill('Aplikasi Inovasi Pengujian'); await user.getByLabel('Jenis ciptaan', { exact: true }).selectOption('Program Komputer'); await user.getByLabel('Uraian singkat').fill('Aplikasi untuk menguji alur pengajuan.'); await user.getByRole('button', { name: 'Simpan Draft', exact: true }).click(); await toast('Perubahan berhasil disimpan', user);
  const editUrl = user.url(); await user.reload(); await heading('Edit Ciptaan', user); assert.equal(await user.getByLabel('Judul ciptaan').inputValue(), 'Aplikasi Inovasi Pengujian');
  await user.getByRole('button', { name: 'Selanjutnya →' }).click();
  for (const key of ['creators', 'holders']) {
    await user.locator(`#${key}-0-name`).fill('User Percobaan'); await user.locator(`#${key}-0-address`).fill('Jalan Inovasi 1'); await user.locator(`#${key}-0-provinsi`).selectOption('32'); await user.locator(`#${key}-0-kota`).selectOption('32.75'); await user.locator(`#${key}-0-kecamatan`).selectOption('32.75.01'); await user.locator(`#${key}-0-kelurahan`).selectOption({ index: 1 });
  }
  await user.getByRole('button', { name: 'Selanjutnya →' }).click();
  const png = await sharp({ create: { width: 300, height: 200, channels: 3, background: '#c2806e' } }).png().toBuffer();
  for (const category of ['identitas', 'pernyataan', 'contoh']) {
    await user.locator('#attachment-category').selectOption(category);
    const response = user.waitForResponse(r => r.url().includes('/api/innovations/') && r.request().method() === 'PUT');
    await user.locator('#attachment-file').setInputFiles({ name: category + '.png', mimeType: 'image/png', buffer: png }); await response;
    await user.locator('.attachment-row').filter({ hasText: category + '.webp' }).waitFor();
  }
  await user.getByRole('button', { name: 'Ajukan Ciptaan', exact: true }).click(); await heading('Aplikasi Inovasi Pengujian', user); await user.locator('.detail-meta').getByText('Diajukan', { exact: true }).waitFor();
  await user.goto(base + '/#/ciptaan'); await heading('Daftar Ciptaan', user); await user.locator('tbody tr').filter({ hasText: 'Aplikasi Inovasi Pengujian' }).waitFor(); assert.equal(await user.locator('tbody tr').count(), 1);
  const workId = editUrl.split('/edit/')[1];
  await go(`ciptaan/${workId}`); await heading('Aplikasi Inovasi Pengujian'); await page.getByLabel('Status berikutnya').selectOption('Diproses'); await page.getByRole('button', { name: 'Perbarui Status' }).click(); await page.locator('.detail-meta').getByText('Diproses', { exact: true }).waitFor();
  await page.getByLabel('Status berikutnya').selectOption('Selesai'); await page.getByRole('button', { name: 'Perbarui Status' }).click(); await page.locator('.detail-meta').getByText('Selesai', { exact: true }).waitFor();
  console.log('PASS: CRUD draft, muat ulang, wilayah bertingkat, unggah, submit, status Admin');
  await user.goto(base + '/#/profil'); await heading('Profil Saya', user); await user.getByLabel('Nama lengkap', { exact: true }).fill('Nama User Diperbarui'); await user.getByLabel('Nomor HP').fill('081234567890'); await user.locator('#photo').setInputFiles({ name: 'foto.png', mimeType: 'image/png', buffer: png }); await user.getByRole('button', { name: 'Simpan Perubahan', exact: true }).click(); await toast('Profil diperbarui', user); await user.reload(); await user.getByLabel('Nama lengkap', { exact: true }).waitFor(); assert.equal(await user.getByLabel('Nama lengkap', { exact: true }).inputValue(), 'Nama User Diperbarui'); assert.equal(await user.locator('.profile-photo img').count(), 1);
  await user.screenshot({ path: '.browser-check/user-profil.png', fullPage: true });
  await user.getByLabel('Password lama', { exact: true }).fill(password); await user.getByLabel('Password baru', { exact: true }).fill('Browser-New-2026!'); await user.getByLabel('Konfirmasi password baru').fill('Browser-New-2026!'); await user.getByRole('button', { name: 'Perbarui Password', exact: true }).click(); await toast('Password diperbarui', user);
  console.log('PASS: foto, profil tersimpan, ubah password');
  await go('pasca'); await heading('Pasca Hak Cipta'); await page.getByRole('button', { name: '+ Tambah Peserta' }).click();
  await d.getByLabel('Nama peserta / kelompok / Posyantek').fill('Peserta Inkubasi'); await d.getByLabel('Ciptaan terkait (status Selesai)').selectOption(workId); await d.getByRole('button', { name: 'Simpan', exact: true }).click(); await toast('Pembinaan disimpan'); await page.locator('tbody tr').filter({ hasText: 'Peserta Inkubasi' }).waitFor();
  await user.goto(base + '/#/pasca'); await heading('Pasca Hak Cipta', user); await user.locator('tbody tr').filter({ hasText: 'Peserta Inkubasi' }).waitFor(); assert.equal(await user.getByRole('button', { name: '+ Tambah Peserta' }).count(), 0);
  await go('landing/carousel'); await heading('Carousel'); await page.getByRole('button', { name: '+ Tambah Slide' }).click(); await d.getByLabel('Judul slide').fill('Inovasi untuk Bekasi'); await d.getByLabel('Teks singkat').fill('Informasi terbaru.'); await d.locator('#slide-image').setInputFiles({ name: 'slide.png', mimeType: 'image/png', buffer: png }); await d.getByRole('button', { name: 'Simpan Slide' }).click(); await toast('Carousel disimpan');
  await go('landing/tentang'); await heading('Tentang HAKI'); await page.getByLabel('Judul halaman').fill('Tentang Sapatri'); await page.locator('#about-editor').fill('Tempat pengembangan inovasi Kota Bekasi.'); await page.getByRole('button', { name: 'Simpan', exact: true }).click(); await toast('Tentang HAKI disimpan');
  const publicContext = await browser.newContext(); const publicPage = await publicContext.newPage(); await publicPage.goto(base + '/#/beranda'); await publicPage.getByRole('heading', { name: 'Inovasi untuk Bekasi' }).waitFor(); await publicPage.getByRole('heading', { name: 'Tentang Sapatri' }).waitFor();
  assert.equal((await api(publicPage, `/innovations/${workId}`)).status, 401);
  console.log('PASS: pembinaan, carousel dan Tentang HAKI tampil publik');
  await go('master/kecamatan'); await heading('Kecamatan'); await page.screenshot({ path: '.browser-check/master.png', fullPage: true });
  await go('dashboard'); await page.locator('.bekasi-map canvas').waitFor(); await page.locator('.bekasi-map-loading').waitFor({ state: 'hidden', timeout: 25000 }); assert.equal(await page.getByRole('heading', { name: 'Kelengkapan pemetaan' }).count(), 0);
  const dashboardData = JSON.parse(readFileSync('public/data/innovations.json')).innovations;
  const districtTotal = dashboardData.filter(i => i.districts.includes('Bekasi Timur')).length;
  const regionalValues = () => page.evaluate(() => ({
    map: Array.from(document.querySelectorAll('.bekasi-map-label')).map(el => [el.getAttribute('data-district-name'), el.querySelector('b').textContent]),
    chart: Array.from(document.querySelectorAll('.district-bar')).map(el => [el.getAttribute('data-district'), el.querySelector('strong').textContent, el.querySelector('.bar-fill').getAttribute('style')]),
    options: Array.from(document.querySelectorAll('[aria-label="Pilih kecamatan pada peta"] option')).map(el => el.textContent),
  }));
  const regionalBefore = await regionalValues();
  assert.equal(regionalBefore.map.length, 12);
  await page.locator('#bekasi-map').scrollIntoViewIfNeeded();
  const districtLabel = await page.locator('[data-district-name="Bekasi Timur"]').boundingBox();
  assert.ok(districtLabel);
  await page.mouse.click(districtLabel.x + districtLabel.width / 2, districtLabel.y + districtLabel.height / 2);
  await page.locator('[data-district-name="Bekasi Timur"].is-selected').waitFor();
  assert.equal(await page.locator('#list-count').innerText(), `${districtTotal} inovasi`);
  assert.deepEqual(await regionalValues(), regionalBefore, 'Clicking a polygon must preserve other districts, colors and map choices');
  await page.locator('#district-chart [data-district="Bekasi Barat"]').click();
  assert.equal(await page.locator('#district-filter').inputValue(), 'Bekasi Barat');
  assert.deepEqual(await regionalValues(), regionalBefore, 'Clicking a chart bar must preserve regional totals');
  await page.getByLabel('Pilih kecamatan pada peta', { exact: true }).selectOption('Jatiasih');
  assert.deepEqual(await regionalValues(), regionalBefore);
  await page.getByLabel('Domisili pencipta', { exact: true }).selectOption('Bekasi Timur'); await page.locator('#list-count').filter({ hasText: `${districtTotal} inovasi` }).waitFor(); await page.screenshot({ path: '.browser-check/dashboard-loaded.png' });
  assert.deepEqual(await regionalValues(), regionalBefore);
  await page.getByLabel('Cari inovasi', { exact: true }).fill('PilahKita');
  const searchValues = await regionalValues();
  for (const [name, count] of searchValues.map) assert.equal(Number(count), dashboardData.filter(i => i.title.includes('PilahKita') && i.districts.includes(name)).length, 'Search still filters geography independently of district selection');
  await page.getByRole('button', { name: 'Hapus filter', exact: true }).click();
  assert.deepEqual(await regionalValues(), regionalBefore);
  assert.equal(await page.locator('#list-count').innerText(), `${dashboardData.length} inovasi`);
  await user.setViewportSize({ width: 390, height: 844 }); await user.goto(base + '/#/ciptaan'); await heading('Daftar Ciptaan', user); assert.ok(await user.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)); await user.screenshot({ path: '.browser-check/mobile-list.png', fullPage: true }); await user.getByRole('button', { name: 'Buka navigasi' }).click(); await user.locator('.sidebar.mobile-open').waitFor(); await user.locator('.sidebar.mobile-open').getByRole('link', { name: 'Profil', exact: false }).click(); await heading('Profil Saya', user); assert.ok(await user.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  assert.deepEqual(errors, []); console.log('PASS: peta/filter, responsif 390px, tanpa error JavaScript');
} catch (error) {
  await page.screenshot({ path: '.browser-check/failure.png', fullPage: true }).catch(() => {});
  console.error('Browser state:', await page.locator('body').innerText().catch(() => ''), 'JavaScript errors:', errors);
  throw error;
} finally {
  await browser.close(); app.server.closeAllConnections(); await new Promise(resolve => app.server.close(resolve)); app.db.close(); rmSync(temp, { recursive: true, force: true });
}
