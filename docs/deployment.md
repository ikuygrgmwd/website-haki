# Supabase dan Vercel

Kode mendukung SQLite untuk lokal serta PostgreSQL dan Supabase Storage untuk
Vercel. Integrasi akun tidak mengubah database aplikasi secara otomatis.
Target website yang diberikan: https://website-haki.vercel.app/.

## Konfigurasi lokal dan project

1. Jalankan `npm ci` dan `npm run setup:local`. Perintah kedua membuat
   `.env.local` beserta token setup acak tanpa menampilkan rahasianya. Berkas
   yang sudah ada tidak ditimpa.
2. Isi `.env.local` berdasarkan `.env.example`. Jangan kirim nilai rahasia ke
   chat, commit, screenshot, atau log.
3. Tautkan checkout ke **team/project Vercel yang benar** menggunakan `vercel link`.
   Periksa `.vercel/project.json`. Jika CLI belum ada, gunakan `npx vercel link`.
   Integrasi dalam aplikasi Codex dan login Vercel CLI merupakan koneksi terpisah.
4. Di Vercel, pastikan project tersambung ke repository
   `ikuygrgmwd/website-haki` dengan preset Vite. `vercel.json` mengatur build
   `npm run build`, output `dist`, dan routing API ke satu Node.js Function.
   Gunakan Node.js 22.18+ (pilih versi 22.x atau 24.x yang tersedia) dan region
   Function dekat region database. Tidak perlu mengganti frontend ke Next.js.
5. Periksa konfigurasi dengan `npm run cloud:check`. Perintah ini hanya
   menampilkan nama konfigurasi dan status hadir/tidak, tanpa nilainya.

| Konfigurasi server | Isi |
| --- | --- |
| `DATABASE_URL` | URI PostgreSQL dari Supabase Connect, transaction pooler untuk Vercel; driver memakai query tanpa prepared statement bernama |
| `DATABASE_MIGRATION_URL` | Opsional: direct/session URI untuk skrip migrasi lokal; kosong memakai `DATABASE_URL` |
| `SUPABASE_URL` | URL project Supabase |
| `SUPABASE_SECRET_KEY` | Secret key backend; `SUPABASE_SERVICE_ROLE_KEY` lama juga didukung |
| `SUPABASE_STORAGE_BUCKET` | Nama bucket private, default `sapatri-private` |
| `SAPATRI_SETUP_TOKEN` | Token acak minimal 32 karakter untuk pembuatan Admin pertama |
| `SAPATRI_DB` | Path SQLite lokal yang menjadi sumber impor |

`POSTGRES_URL` dari integrasi juga diterima sebagai alternatif `DATABASE_URL`.
Gunakan URI yang menegakkan SSL, sesuai informasi koneksi Supabase. Jangan
menonaktifkan verifikasi sertifikat. Bila driver memerlukan CA, gunakan
sertifikat resmi project sesuai dokumentasi Supabase dan Node.js.
Jangan menambahkan prefix `VITE_` atau `NEXT_PUBLIC_` pada rahasia server.
Nama env integrasi dapat berbeda; cocokkan nama, jangan menganggap otomatis cocok.

Set variabel runtime yang sama di Settings → Environment Variables project
Vercel. Pisahkan database/bucket Development/Preview dari Production. Nilai
Production Secret mungkin tidak ikut `vercel env pull`; isi konfigurasi lokal
pengujian melalui pengaturan yang aman. Jangan menyalin production ke preview.

## Migrasi (setelah linkage dan konfigurasi diverifikasi)

Tidak ada migrasi atau seeding yang dijalankan oleh build/deployment. Ini
mencegah setiap preview mengubah database secara tidak sengaja.

```powershell
npm run cloud:check -- --connect
npm run db:migrate
npm run storage:setup
```

Untuk memindahkan data SQLite saat ini:

```powershell
npm run db:import:sqlite
npm run db:verify -- "private-data/backups/cloud-<waktu>/sapatri.sqlite"
```

Gunakan path backup yang dicetak importer. Importer membuat backup menggunakan
API SQLite sehingga data WAL tercakup. Sumber lokal tidak diubah. Database
tujuan harus kosong; script menolak menimpa data atau menjalankan impor kedua.
ID, akun, hash password, karya, wilayah, konten, pembinaan, dan audit dipertahankan.
Sesi login dan token reset tidak dipindahkan. File BLOB dikirim ke bucket private,
checksum unduhan dicocokkan, lalu metadata di-commit dalam satu transaksi.

Jika transaksi gagal, record PostgreSQL di-rollback. Object Storage yang sudah
diunggah dapat tertinggal di prefix `migration/<checksum backup>/`; gunakan
backup yang sama saat melanjutkan: `npm run db:import:sqlite -- "path/backup/sapatri.sqlite"`. Jangan menghapus
prefix yang masih dirujuk tabel `files`. Backup mengandung data privat.

Untuk database baru tanpa akun/pengajuan demo, gunakan **sebagai alternatif impor**:

```powershell
npm run db:seed:regions
```

Lalu buka `#/login` untuk membuat Admin menggunakan `SAPATRI_SETUP_TOKEN`.
Tidak perlu memakai Supabase Auth: login aplikasi tetap menggunakan scrypt,
cookie HttpOnly, CSRF, dan pemeriksaan role/kepemilikan di backend.

Schema `sapatri` berada di luar schema publik Data API. RLS diaktifkan dan
hak akses publik dicabut. Koneksi SQL backend harus memakai pemilik tabel atau
role backend yang dikonfigurasi tepat; jangan mengekspos schema ini ke browser.

## Berkas dan konkurensi

Browser meminta izin `/api/files/prepare`, mengunggah langsung ke staging
Supabase, lalu memanggil `/api/files/complete`. Backend memeriksa kembali pemilik,
role, ukuran, dan isi file; gambar diproses Sharp menjadi WebP. Berkas tervalidasi
disimpan ke path final berbeda, sehingga izin staging tidak dapat mengubahnya.
Izin aplikasi berlaku 15 menit; URL unggah Supabase sendiri dapat berlaku dua jam.

Unduhan diperiksa backend dan diarahkan ke URL Storage bertanda tangan yang
berlaku 60 detik. PDF diunduh sebagai attachment. Payload dokumen 8 MB tidak
melewati body request/response Function Vercel.

Jalankan `npm run storage:cleanup` secara berkala untuk membuang hingga 100
staging yang sudah melewati masa izin plus tiga jam. Perintah ini tidak
menghapus file final; pembersihan final yatim akibat kegagalan lintas database
dan Storage memerlukan pemeriksaan referensi terpisah.

Semua write aplikasi memakai transaction advisory lock PostgreSQL untuk
mempertahankan perilaku single-writer SQLite dan melindungi setup Admin,
transisi status, serta versi edit. Respons dikirim setelah commit. Ini cocok
untuk volume awal; optimalkan ke penguncian per-record bila beban meningkat.
Rate limit login PostgreSQL disimpan di database, tidak hanya memori Function.

## Pengujian dan rilis

```powershell
npm test
npm run test:browser
npm run test:storage:browser
```

Tes mencakup SQLite, PostgreSQL lokal melalui PGlite, rollback, konflik edit,
impor, otorisasi berkas, dan PDF 8 MB dengan Storage tiruan. PGlite tidak
membuktikan TLS, pooler, advisory lock lintas proses, atau akses Storage nyata;
semuanya perlu smoke test di preview dengan database pengujian sebelum rilis.
Tes `test:storage:browser` menjalankan alur formulir unggah 8 MB di browser,
SDK Supabase asli, dan server HTTP Storage tiruan, termasuk CORS serta unduhan.

Push branch kerja untuk review/preview. Pastikan konfigurasi preview lengkap,
lalu uji login Admin/User, CRUD, submit/revisi, unggah, serta unduh sertifikat
melalui URL Vercel. Untuk perpindahan final, hentikan penulisan pada aplikasi
lama sebelum backup final dan impor ke database production kosong. Aktifkan
deployment production setelah verifikasi selesai. Simpan SQLite lama dan backup.

Jika rollback diperlukan setelah pengguna sudah menulis ke database online,
jangan mengaktifkan kembali SQLite lama tanpa rekonsiliasi data baru. Rollback
kode saja tidak mengembalikan data PostgreSQL atau Storage.

Dashboard publik masih membaca `public/data/innovations.json`. Migrasi tidak
mempublikasikan data pengajuan privat secara otomatis.

Referensi: [Supabase connection](https://supabase.com/docs/guides/database/connecting-to-postgres),
[private buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals),
[Vercel Node.js](https://vercel.com/docs/functions/runtimes/node-js),
[batas Function](https://vercel.com/docs/functions/limitations).
