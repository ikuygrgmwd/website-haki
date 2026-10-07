import { backup } from 'node:sqlite';
import { mkdirSync, existsSync, readFileSync, writeFileSync, copyFileSync, renameSync } from 'node:fs';
import { resolve, join, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { openStore, hashPassword, token } from '../server/store.mjs';

const titles = [
  'PilahKita — Aplikasi Bank Sampah Warga', 'Kebun Atap — Panduan Urban Farming',
  'Belajar Bekasi — Media Belajar Interaktif', 'Siaga Air — Pemantauan Tinggi Air',
  'Rupa Kota — Buku Ilustrasi Lingkungan', 'Tenun Cerita — Motif Tekstil Digital',
  'Warung Pintar — Pencatatan Usaha Mikro', 'Jejak Hijau — Peta Kebun Komunitas',
  'Aksara Ceria — Permainan Literasi Anak', 'Jelajah Kampung — Panduan Wisata Lokal',
  'Panen Bersama — Modul Hidroponik', 'Ruang Baca — Perpustakaan Digital',
  'Dapur Hemat — Buku Resep Keluarga', 'Teman Lansia — Aplikasi Pendamping',
  'Kreasi Kertas — Modul Daur Ulang', 'Lentera Kelas — Animasi Pendidikan',
  'Kota Ramah — Buku Desain Ruang Publik', 'Pasar Dekat — Katalog Produk Warga',
  'Langkah Aman — Komik Keselamatan Jalan', 'Saku Usaha — Panduan UMKM',
  'Air untuk Semua — Video Edukasi', 'Berkebun Ceria — Permainan Edukasi',
  'Cerita Sungai — Buku Cerita Bergambar', 'Batik Rintik — Motif Kontemporer',
  'Panggung Warga — Rekaman Pertunjukan Teater', 'Suara Kota — Produksi Rekaman Podcast',
  'Cerita Pagi — Program Siaran Komunitas', 'Gerak Bersama — Rekaman Pertunjukan Tari',
  'Ruang Ekspresi — Dokumentasi Seni Pertunjukan', 'Dialog Kampung — Produksi Rekaman Diskusi',
  'Pentas Ceria — Rekaman Teater Anak', 'Kabar Lingkungan — Program Siaran Edukasi',
  'Cerita Senja — Produksi Rekaman Cerita', 'Panggung Pelajar — Rekaman Pertunjukan',
  'Sapa Warga — Program Siaran Komunitas', 'Kisah Nusantara — Rekaman Pembacaan Cerita',
];
const statuses = ['Draft', 'Diajukan', 'Diproses', 'Perlu Revisi', 'Selesai', 'Selesai'];
export const demoType = (title, related = false) => related ? 'Hak Terkait' : /video|animasi/i.test(title) ? 'Karya Audiovisual' : /motif/i.test(title) ? 'Karya Seni' : /buku|panduan|modul|komik/i.test(title) ? 'Karya Tulis' : 'Program Komputer';
const escape = s => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);

// Original vector artwork, rasterized for the existing upload/file pipeline.
async function illustration(label, accent = '#d78872', variant = 0) {
  const bars = [110, 180, 140, 250, 210].map((h, i) => `<rect x="${490 + i * 64}" y="${430 - h}" width="40" height="${h}" rx="10" fill="${i % 2 ? '#769aa5' : accent}"/>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="600" viewBox="0 0 960 600"><rect width="960" height="600" fill="#182d3e"/><circle cx="870" cy="90" r="250" fill="#243f50"/><circle cx="40" cy="650" r="300" fill="#213c4a"/><path d="M80 405Q200 190 340 295T830 150" fill="none" stroke="#4d7080" stroke-width="3" stroke-dasharray="8 12"/><rect x="100" y="125" width="280" height="340" rx="28" fill="#f7f1e8" transform="rotate(-6 240 300)"/><rect x="145" y="180" width="160" height="17" rx="8" fill="${accent}"/><rect x="145" y="220" width="190" height="10" rx="5" fill="#d7dbd7"/><rect x="145" y="247" width="145" height="10" rx="5" fill="#d7dbd7"/><circle cx="237" cy="338" r="57" fill="${accent}"/><path d="m212 338 18 18 36-40" fill="none" stroke="white" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>${bars}<circle cx="${720 + variant * 20}" cy="115" r="32" fill="#f1c991"/><text x="72" y="65" fill="#f7f1e8" font-family="sans-serif" font-size="19" letter-spacing="4">SAPATRI / RUANG KREASI</text><text x="72" y="540" fill="#f7f1e8" font-family="sans-serif" font-size="27">${escape(label)}</text><text x="888" y="575" text-anchor="end" fill="#b7c9cc" font-family="sans-serif" font-size="15">ILUSTRASI DEMO</text></svg>`;
  return sharp(Buffer.from(svg)).webp({ quality: 85 }).toBuffer();
}

function samplePdf(label, code) {
  const lines = ['SAPATRI - DOKUMEN DEMONSTRASI', label, `Referensi: ${code}`, '', 'DATA DUMMY / BUKAN DOKUMEN RESMI', 'Berkas ini hanya untuk mencoba unggah dan unduh aplikasi.', 'Tidak memuat identitas atau bukti pendaftaran sebenarnya.'];
  const stream = `BT /F1 16 Tf 60 770 Td ${lines.map((line, i) => `${i ? '0 -35 Td ' : ''}(${line.replace(/[()\\]/g, '\\$&')}) Tj`).join('\n')} ET`;
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`];
  let pdf = '%PDF-1.4\n'; const offsets = [0];
  objects.forEach((object, i) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${i + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(n => `${String(n).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf);
}

export async function seedDemo({ dbPath = 'private-data/sapatri.sqlite', outputPath = 'public/data/innovations.json', backupRoot = 'private-data/backups', archiveOriginals = true, replace = false } = {}) {
  const db = openStore(dbPath);
  try {
    if (db.prepare("SELECT key FROM content WHERE key='_demo_seed_v1'").get() && !replace) throw new Error('Data demo sudah tersedia. Gunakan --replace-demo hanya untuk mengatur ulang contoh demo.');
    const admin = db.prepare("SELECT * FROM users WHERE role='Admin' AND active=1 ORDER BY created_at LIMIT 1").get();
    if (!admin) throw new Error('Buat Admin pertama sebelum mengisi data demo.');
    const backupDir = join(resolve(backupRoot), new Date().toISOString().replace(/[:.]/g, '-'));
    if (archiveOriginals && !backupDir.startsWith(resolve('private-data') + sep)) throw new Error('Cadangan feeder harus berada di private-data.');
    mkdirSync(backupDir, { recursive: true });
    await backup(db, join(backupDir, 'sapatri.sqlite'));
    if (existsSync(outputPath)) copyFileSync(outputPath, join(backupDir, 'innovations.json'));
    const originals = ['private-data/feeder-db.json', 'private-data/bekasi-hak-cipta.tsv'];
    if (archiveOriginals) for (const file of originals) if (existsSync(file)) copyFileSync(file, join(backupDir, file.split('/').at(-1)));

    const password = `Demo-${token().slice(0, 16)}!`;
    const accounts = [];
    for (const [i, name] of ['Nadia Pramesti', 'Raka Wicaksana', 'Dewi Larasati'].entries()) {
      const id = `demo-user-${i + 1}`, email = `demo.${['nadia', 'raka', 'dewi'][i]}@example.test`;
      if (!db.prepare('SELECT id FROM users WHERE id=?').get(id)) accounts.push({ id, name: `${name} (Demo)`, email, hash: await hashPassword(password) });
    }
    const districts = db.prepare("SELECT * FROM regions WHERE level='kecamatan' AND active=1 ORDER BY name").all();
    if (districts.length !== 12) throw new Error('Demo memerlukan 12 kecamatan aktif Kota Bekasi.');
    const villages = districts.map(d => db.prepare("SELECT * FROM regions WHERE parent_id=? AND active=1 ORDER BY name LIMIT 1").get(d.id));
    if (villages.some(v => !v)) throw new Error('Setiap kecamatan demo harus mempunyai kelurahan aktif.');
    const art = await Promise.all(['Ide hari ini, manfaat esok hari', 'Bersama mengembangkan karya', 'Dari karya menuju peluang'].map((t, i) => illustration(t, ['#d78872', '#75a799', '#c6a263'][i], i)));
    const at = new Date().toISOString();
    const projection = { schemaVersion: 1, sourceId: 'sapatri-demo', sourceLabel: 'Data demonstrasi Sapatri — seluruh karya dan pencipta bersifat fiktif', notes: { geography: 'Sebaran contoh karya berdasarkan domisili pencipta fiktif di 12 kecamatan Kota Bekasi.', teamSize: 'Ukuran tim dihitung dari jumlah pencipta fiktif pada setiap contoh karya.', identity: 'Seluruh karya, identitas pencipta, status, dan dokumen dalam dataset ini merupakan data dummy untuk demonstrasi; bukan data pendaftaran resmi.' }, innovations: [], reviewSummary: [] };
    db.exec('BEGIN IMMEDIATE');
    try {
      // Replace imported/demo works only; preserve manually-created works and all existing accounts.
      db.exec("DELETE FROM aftercare WHERE innovation_id IN (SELECT id FROM innovations WHERE source_id IS NOT NULL OR id LIKE 'demo-work-%'); DELETE FROM innovations WHERE source_id IS NOT NULL OR id LIKE 'demo-work-%';");
      for (const a of accounts) db.prepare('INSERT INTO users(id,name,email,password_hash,role,created_at,district_id,village_id) VALUES(?,?,?,?,?,?,?,?)').run(a.id, a.name, a.email, a.hash, 'User', at, districts[accounts.indexOf(a)].id, villages[accounts.indexOf(a)].id);
      const owners = db.prepare("SELECT id FROM users WHERE role='User' AND active=1 ORDER BY created_at,id").all().map(u => u.id);
      owners.push(admin.id);
      const file = (id, owner, work, purpose, name, bytes, mime = 'application/pdf') => {
        db.prepare('INSERT INTO files(id,owner_id,innovation_id,purpose,name,mime,bytes,created_at) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET bytes=excluded.bytes,name=excluded.name').run(id, owner, work, purpose, name, mime, bytes, at);
        return id;
      };
      for (const a of accounts) {
        const photo = file(`${a.id}-avatar`, a.id, null, 'avatar', 'avatar-demo.webp', art[accounts.indexOf(a)], 'image/webp');
        db.prepare('UPDATE users SET photo_id=? WHERE id=?').run(photo, a.id);
      }
      for (const [i, title] of titles.entries()) {
        const id = `demo-work-${String(i + 1).padStart(2, '0')}`, owner = owners[i % owners.length];
        const code = `DEMO-${i < 24 ? 'HC' : 'HT'}-2026-${String(i + 1).padStart(3, '0')}`;
        const status = statuses[i % statuses.length], district = districts[i % 12];
        const count = i % 5 + 1;
        const creators = Array.from({ length: count }, (_, j) => {
          const di = j === 0 ? i % 12 : (i + j * 3) % 12;
          return { name: `Pencipta Demo ${i + 1}.${j + 1}`, address: `Jalan Contoh Nomor ${i + 1} (alamat fiktif)`, districtId: districts[di].id, villageId: villages[di].id };
        });
        const created = new Date(Date.UTC(2026, 6 + Math.floor(i / 12), i % 12 + 1, 2)).toISOString();
        const submitted = status === 'Draft' ? null : new Date(Date.parse(created) + 86400000).toISOString();
        const data = { type: demoType(title, i >= 24), description: `Contoh ${title.toLowerCase()} untuk mendukung kreativitas warga ${district.name}. Data dummy ini menyediakan alur percobaan pengajuan, pengelolaan lampiran, serta pemantauan status. Seluruh nama dan dokumen bersifat fiktif.`, announcedAt: created.slice(0, 10), creators, holders: [creators[0]], attachments: [], districts: [...new Set(creators.map(p => districts.find(d => d.id === p.districtId).name))] };
        db.prepare('INSERT INTO innovations(id,owner_id,code,title,kind,status,created_at,submitted_at,updated_at,source_id,data) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(id, owner, code, title, i < 24 ? 'Hak Cipta' : 'Hak Terkait', status, created, submitted, at, `sapatri-demo:${i + 1}`, '{}');
        for (const category of ['identitas', 'pernyataan', 'contoh']) {
          const name = `${category}-${code}.pdf`;
          data.attachments.push({ id: file(`${id}-${category}`, owner, id, 'attachment', name, samplePdf(`Lampiran contoh: ${category}`, code)), name, category });
        }
        if (status === 'Selesai') {
          data.registrationNumber = `DEMO-PENCATATAN-${String(i + 1).padStart(4, '0')}`;
          data.certificateId = file(`${id}-certificate`, owner, id, 'certificate', `sertifikat-${code}.pdf`, samplePdf('Contoh Sertifikat - Tidak Berlaku Resmi', code));
        }
        db.prepare('UPDATE innovations SET data=? WHERE id=?').run(JSON.stringify(data), id);
        const creatorIds = creators.map((_, j) => `demo-creator-${i + 1}-${j + 1}`);
        projection.innovations.push({ id, sourceNumber: String(i + 1), title, creatorIds, identifiedCreatorIds: creatorIds, creatorCount: count, unresolvedCreatorCount: 0, supervisorCount: 0, holderCount: 1, holderRecordCount: 1, districts: data.districts, geographyBasis: 'creator-residence', mappingStatus: 'mapped', reviewFlags: [] });
        if (status === 'Selesai') {
          const ci = Math.floor(i / 6) * 2 + (i % 6 - 4), participantType = ['Perorangan', 'Kelompok', 'Organisasi Posyantek'][ci % 3];
          const photo = file(`${id}-care-art`, owner, id, 'pasca', `ilustrasi-kegiatan-${code}.webp`, art[ci % 3], 'image/webp');
          const care = { participantType, name: participantType === 'Perorangan' ? creators[0].name : `${participantType === 'Kelompok' ? 'Tim Kreasi' : 'Posyantek Demo'} ${district.name}`, groupType: ci % 2 ? 'Tim mahasiswa' : 'Kelompok umum', university: ci % 2 ? 'Kampus Kreatif Demo (Fiktif)' : '', members: creators.map((p, j) => `${p.name} — ${j ? 'Pengembang' : 'Koordinator'}`).join('\n'), districtId: district.id, program: ci % 2 ? 'Inkubasi Bisnis' : 'Pelatihan', trainingStatus: ci % 4 === 0 ? 'Belum' : 'Sudah', startDate: ci % 4 === 0 ? '2026-10-20' : '2026-10-01', endDate: ci % 4 === 0 ? '2026-10-22' : '2026-10-03', product: ci % 4 === 0 ? 'Rencana pengembangan prototipe' : `Prototipe dan materi presentasi ${code}`, description: 'Kegiatan demonstrasi: pendampingan pengembangan produk, penyusunan model usaha, dan presentasi karya. Gambar adalah ilustrasi, bukan dokumentasi kegiatan nyata.', photos: [photo] };
          db.prepare('INSERT INTO aftercare(id,innovation_id,data,updated_at) VALUES(?,?,?,?)').run(`demo-care-${i + 1}`, id, JSON.stringify(care), at);
        }
      }
      const set = (key, data) => db.prepare('INSERT INTO content(key,data) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET data=excluded.data').run(key, JSON.stringify(data));
      const slides = ['Wujudkan ide, catatkan karya', 'Kreativitas tumbuh bersama', 'Kembangkan manfaat karya Anda'].map((title, i) => ({ id: `demo-slide-${i + 1}`, title, description: ['Mulai dari draft, lengkapi data pencipta, lalu pantau proses pengajuan dalam satu tempat.', 'Jelajahi contoh inovasi dari 12 kecamatan dan temukan semangat berkarya di sekitar Anda.', 'Ikuti contoh perjalanan pembinaan, pelatihan, dan inkubasi setelah pengajuan selesai.'][i], imageId: file(`demo-landing-${i + 1}`, admin.id, null, 'landing', `ilustrasi-sapatri-${i + 1}.webp`, art[i], 'image/webp'), buttonText: ['Mulai Pengajuan', 'Jelajahi Inovasi', 'Masuk ke Akun'][i], url: ['#/baru', '#/dashboard', '#/login'][i], visible: true }));
      set('carousel', slides);
      set('about', { title: 'Satu ruang untuk ide dan karya warga', html: '<p>Sapatri membantu warga mengelola informasi karya, menyiapkan pengajuan, dan mengikuti perkembangannya melalui satu portal.</p><h3>Perjalanan karya Anda</h3><ol><li>Simpan ide sebagai draft dan lengkapi data pencipta.</li><li>Unggah lampiran, kemudian ajukan untuk ditinjau Admin.</li><li>Pantau status dan lengkapi perbaikan ketika diperlukan.</li><li>Lihat dokumen serta pembinaan setelah proses selesai.</li></ol><p><strong>Versi demonstrasi:</strong> karya, pencipta, status, dan dokumen contoh pada aplikasi ini adalah data dummy. Tidak mewakili pendaftaran resmi.</p>', imageId: slides[1].imageId, visible: true, updatedAt: at, updatedBy: 'Pengisian Data Demo' });
      set('_demo_seed_v1', { at, count: titles.length, backupDir });
      db.prepare('INSERT INTO audit(actor_id,action,record_id,created_at) VALUES(?,?,?,?)').run(null, 'seed_demo', 'sapatri-demo', at);
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    writeFileSync(outputPath, JSON.stringify(projection, null, 2) + '\n');
    if (archiveOriginals) for (const original of originals) if (existsSync(original)) renameSync(original, join(backupDir, `archived-${original.split('/').at(-1)}`));
    const access = { createdAt: at, accounts: accounts.map(a => ({ email: a.email, password })), note: 'Akun dummy lokal. Akun dan password pengguna yang sudah ada tidak diubah.' };
    if (accounts.length) writeFileSync(join(resolve(dbPath, '..'), 'demo-access.json'), JSON.stringify(access, null, 2));
    return { innovations: titles.length, aftercare: 12, slides: 3, newDemoAccounts: accounts.length, backupDir };
  } finally { db.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  console.log(JSON.stringify(await seedDemo({ dbPath: process.env.SAPATRI_DB || 'private-data/sapatri.sqlite', replace: process.argv.includes('--replace-demo') }), null, 2));
}
