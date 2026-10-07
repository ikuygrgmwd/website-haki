# Sapatri — Portal Inovasi dan Hak Cipta Kota Bekasi

Portal Vite + TypeScript dengan backend Node.js. SQLite digunakan untuk lokal; PostgreSQL dan Supabase Storage didukung untuk Vercel. Antarmuka menggunakan Bahasa Indonesia dan dua role tetap: Admin dan User.

## Persiapan Supabase dan Vercel

Panduan lengkap: [docs/deployment.md](docs/deployment.md).

Jalankan `npm run setup:local`, isi konfigurasi Supabase pada `.env.local`, lalu
jalankan `npm run cloud:check`. File rahasia, database lokal, dan backup tidak
masuk Git maupun deployment. Build tidak menjalankan migrasi otomatis.

Sesudah project Vercel tertaut dan environment diverifikasi, gunakan
`npm run db:migrate`, `npm run storage:setup`, lalu pilih impor SQLite
(`npm run db:import:sqlite`) atau master wilayah kosong (`npm run db:seed:regions`).
Impor membuat backup, mempertahankan akun/hash password, memindahkan berkas ke
Storage private, dan menolak menimpa database yang sudah berisi data. Gunakan
`npm run db:verify -- "path/backup/sapatri.sqlite"` sebelum aplikasi online dipakai.

## Kondisi data saat ini

Aplikasi lokal menggunakan **data demonstrasi**, menggantikan feeder asli:

- 36 contoh pengajuan: 24 Hak Cipta dan 12 Hak Terkait.
- 6 Draft, 6 Diajukan, 6 Diproses, 6 Perlu Revisi, dan 12 Selesai.
- 106 pencipta fiktif, tersebar di seluruh 12 kecamatan Kota Bekasi.
- 108 lampiran PDF contoh, 12 sertifikat dummy, dan 12 catatan pembinaan dengan ilustrasi.
- Pembinaan mencakup Perorangan, Kelompok, dan Organisasi Posyantek pada kedua layanan.
- 3 slide carousel dan halaman Tentang HAKI terisi.
- 3 User demo tambahan. Akun, password, dan sesi pengguna yang sudah ada tetap dipertahankan.

Nama karya, pencipta, status, dokumen, dan kegiatan adalah fiktif. Dokumen PDF diberi penanda DATA DUMMY / BUKAN DOKUMEN RESMI. Gambar merupakan ilustrasi demo, bukan foto kegiatan nyata.

Data feeder sebelumnya dicadangkan di private-data/backups/<waktu>/ sebelum diganti. Database cadangan dibuat memakai API backup SQLite sehingga mencakup data WAL. Feeder mentah dipindahkan ke cadangan privat dan tidak lagi menjadi sumber data aktif. Cadangan mengandung data pribadi: jangan sajikan folder tersebut melalui web.

## Menjalankan

Gunakan Node.js 22.18+ (diverifikasi pada Node 26).

~~~sh
npm ci
npm run dev
~~~

Frontend berjalan pada http://127.0.0.1:5173 dan API pada port 3001. Proxy mempertahankan Host agar pemeriksaan asal permintaan tetap berjalan.

Pada database kosong, terminal menampilkan kode penyiapan Admin pertama. Buka #/login, buat Admin, lalu isi data demo jika diperlukan:

~~~sh
npm run seed:demo
~~~

Perintah ini mencadangkan database, mengganti karya impor/demo, mempertahankan karya yang dibuat manual serta akun lama, dan mengisi konten demo. Karya feeder yang diganti beserta lampiran/pembinaannya dikeluarkan dari data aktif. Carousel dan Tentang HAKI diganti dengan konten contoh.

Pengisian berulang diblokir untuk mencegah perubahan demo yang sedang dicoba terhapus tanpa sengaja. Untuk sengaja mengatur ulang seluruh contoh demo:

~~~sh
npm run seed:demo -- --replace-demo
~~~

Akun demo memakai domain example.test. Email dan password acak akun baru tersedia di private-data/demo-access.json (tidak masuk Git). Perintah ulang tidak mengubah password akun demo yang sudah ada. Admin dapat mereset password melalui Manajemen Pengguna.

## Penyimpanan dan deployment

Pada mode lokal, database, sesi, foto, serta unggahan tersimpan di private-data/sapatri.sqlite. SQLite memakai foreign key dan WAL; berkas disimpan sebagai BLOB. Data bertahan setelah restart. Kata sandi di-hash dengan scrypt.

Variabel lingkungan: SAPATRI_DB, SAPATRI_SETUP_TOKEN, PORT, HOST, dan NODE_ENV=production. Cookie Secure pada mode produksi memerlukan HTTPS.

~~~sh
npm run build
npm start
~~~

Perintah start menyajikan dist beserta API pada port 3001. Preview Vite hanya menyajikan frontend. Hosting mode SQLite memerlukan volume persisten dan HTTPS. Pada Vercel, `api/index.mjs` menjalankan API dengan PostgreSQL dan Storage; frontend disajikan dari `dist`. Konfigurasi yang belum lengkap menghasilkan error, tanpa fallback ke SQLite di Vercel. Deployment cloud memerlukan pengujian koneksi nyata setelah environment disiapkan.

## Fitur dan hak akses

- Admin: semua ciptaan, pemilik, edit/status/sertifikat, pengguna, master wilayah, landing page, dan pembinaan.
- User: CRUD ciptaan sendiri, melanjutkan draft, mengajukan, profil/password sendiri, serta melihat pembinaan/sertifikat milik sendiri.
- Draft digabung dalam Daftar Ciptaan. Menu musik serta Kelengkapan Pemetaan dihapus.
- Tabel memiliki pencarian, filter, pengurutan, paginasi, dan aksi. Hak Terkait memakai alur yang sama dengan jenis layanan terpisah.
- Form mencakup detail, pencipta/pemegang hak, alamat bertingkat, dan lampiran. Draft boleh belum lengkap. Submit memerlukan detail, pemilik, pencipta/pemegang hak beralamat lengkap, serta lampiran identitas, pernyataan, dan contoh. Ini aturan aplikasi awal, bukan klaim persyaratan resmi.
- Alur status: Draft → Diajukan → Diproses → Selesai. Admin dapat mengembalikan Diproses menjadi Perlu Revisi, atau membuka kembali Selesai menjadi Diproses. Perlu Revisi dapat diajukan ulang.
- Edit oleh User terhadap data Diajukan/Diproses/Selesai menjadikannya Perlu Revisi. Penghapusan diblokir jika masih dirujuk pembinaan.
- Penetapan Selesai tidak menerbitkan sertifikat otomatis. Admin mengunggah dokumen setelah tersedia; sertifikat demo hanya contoh.
- Master wilayah: 1 provinsi, 1 kota, 12 kecamatan, 56 kelurahan. Kode BIG:<objectid> adalah referensi sumber, bukan kode resmi kelurahan, dan masih perlu diverifikasi.
- Reset password oleh Admin menghasilkan tautan sekali pakai berlaku 15 menit; email otomatis belum dikonfigurasi.
- Foto maksimal 2 MB, lampiran/sertifikat maksimal 8 MB. Gambar diproses Sharp menjadi WebP; PDF disajikan sebagai unduhan. Berkas yang dilepas dari formulir tidak langsung dihapus; kebijakan pembersihan berkas yatim perlu disiapkan jika volume meningkat.
- Sesi 12 jam, cookie HttpOnly/SameSite, pemeriksaan origin, token CSRF, pembatasan role/kepemilikan di API, audit aktivitas, dan pemeriksaan versi edit.

## Dashboard dan feeder

Dashboard publik memakai snapshot public/data/innovations.json yang berisi proyeksi contoh karya tanpa identitas/kontak privat. Saat seeding, judul, jumlah pencipta, dan domisili cocok dengan record SQLite. Edit/pengajuan privat sesudahnya tidak otomatis dipublikasikan; dashboard bukan daftar transaksi langsung.

Pencarian menyaring semua bagian dashboard. Pilihan kecamatan menyaring kartu ringkasan, ukuran tim, dan daftar karya; peta serta grafik wilayah tetap menghitung seluruh kecamatan sesuai pencarian agar angka dan warna daerah lain tidak berubah saat satu daerah dipilih. Satu karya dapat muncul di beberapa kecamatan berdasarkan domisili pencipta, tetapi total keseluruhan dihitung dari ID karya unik. Pembimbing tidak dihitung sebagai pencipta.

Impor feeder asli masih tersedia bila diperlukan nanti:

~~~sh
npm run import:feeder -- "PATH/data.tsv"
~~~

Impor memperbarui snapshot dashboard dan arsip privat; tidak menimpa transaksi SQLite yang sudah dikelola. Jangan menjalankannya jika ingin mempertahankan dataset demo publik. Jangan taruh feeder mentah dalam public atau src.

Peta menggunakan MapLibre dan geometri lokal 12 kecamatan dari sumber BIG; dokumentasi sumber dan lisensi berada di docs/boundaries.md. Tile peta memerlukan internet, sedangkan geometri/statistik tersedia lokal.

## Verifikasi

~~~sh
npm test
npm run test:browser
~~~

Pengujian mencakup otorisasi, persistensi, status, file privat, proxy lokal, pengisian demo dan cadangannya, perlindungan akun/karya manual, pengajuan draft demo, statistik, serta alur browser. Pengujian impor feeder privat lama dilewati apabila sumber aslinya telah diarsipkan. Browser test memakai Edge headless, database sementara, dan screenshot di .browser-check/.
