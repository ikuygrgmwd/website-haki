# Sapatri — Portal Inovasi dan Hak Cipta Kota Bekasi

Dashboard inovasi dengan tema koral/navy, DM Sans dan Plus Jakarta Sans, memakai arsitektur Vite + TypeScript yang sudah ada. Dashboard dan daftar inovasi dapat dibuka tanpa login. Formulir permohonan dan autentikasi lama tetap berupa prototipe lokal; login demo bukan pengamanan data pribadi.

## Menjalankan

```sh
npm ci
npm run dev
npm test
npm run build
npm run preview
```

Vite membutuhkan Node.js 20.19+ atau 22.12+. Pengujian TypeScript langsung melalui Node membutuhkan **22.18+** (diverifikasi pada Node 26). Buka URL localhost yang dicetak Vite. Hanya folder `dist/` yang boleh dipublikasikan.

## Impor feeder lokal

```sh
npm run import:feeder -- "PATH/Form_Isian_Data_Hak_Cipta.xlsx - Form Hak Cipta.tsv"
```

Gunakan `--source bekasi-hak-cipta` yang sama saat memperbarui feeder ini; itu juga nilai default. Impor mengganti snapshot sumber terkait, mempertahankan ID internal, dan menghapus relasi yang sudah tidak ada pada snapshot terbaru. Nomor yang sama dari sumber berbeda mempunyai ID berbeda. Impor ulang tidak menambah salinan data. Muat ulang browser setelah mengimpor dan bangun ulang sebelum menerbitkan perubahan.

- `private-data/feeder-db.json`: model relasional, registri ID, nilai asli, normalisasi, relasi, dan masalah untuk ditinjau.
- `private-data/<source>.tsv`: arsip sumber asli. Folder ini diabaikan Git, diblokir oleh Vite, dan tidak masuk build.
- `public/data/innovations.json`: proyeksi publik melalui daftar kolom yang diizinkan. Hanya judul, nomor sumber, ID acak, jumlah, kecamatan dan indikator peninjauan; tanpa nama orang, NIK, alamat, kode pos, email atau telepon.

Jangan menaruh feeder mentah di `public/` atau `src/`. Simpan cadangan folder privat secara terbatas untuk mempertahankan registri ID. Akses manajemen data pribadi melalui web memerlukan backend dan otorisasi sungguhan; data privat tidak disajikan oleh prototipe ini.

## Angka dan aturan hitung

Snapshot yang disertakan menghasilkan **20 inovasi**, **51 pencipta dengan NIK berformat 16 digit**, **54 relasi pencipta–inovasi**, **2 identitas pencipta belum lengkap**, dan **3 relasi pembimbing**. Validasi format NIK tidak merupakan verifikasi Dukcapil. Pembimbing eksplisit tetap memiliki peran aslinya dan tidak otomatis dihitung sebagai pencipta.

Ada **19 inovasi dapat dipetakan**, **1 belum dapat dipetakan**, dan **11 dari 12 kecamatan terwakili**. Medan Satria tetap ditampilkan dengan nilai 0.

| Kecamatan | Inovasi unik |
| --- | ---: |
| Bekasi Utara | 9 |
| Mustikajaya | 5 |
| Rawalumbu | 4 |
| Bekasi Timur | 3 |
| Jatiasih | 3 |
| Bekasi Barat | 2 |
| Pondok Gede | 2 |
| Bantargebang | 1 |
| Bekasi Selatan | 1 |
| Jatisampurna | 1 |
| Pondok Melati | 1 |
| Medan Satria | 0 |

Sebaran berdasarkan domisili pencipta. Satu inovasi dapat tercatat di beberapa kecamatan, tetapi hanya sekali dalam kecamatan yang sama. Total keseluruhan dihitung dari ID inovasi unik, sehingga angka kecamatan tidak dijumlahkan sebagai total inovasi. Jika model memiliki `verifiedOriginDistrict` yang valid, lokasi asal terverifikasi diprioritaskan dan dipertahankan saat impor ulang; feeder awal tidak memilikinya.

Ukuran tim dari bagian A adalah 1, 2, 3, 4, dan 5+ pencipta; jumlah inovasi masing-masing **5, 2, 9, 2, 2**. Pembimbing eksplisit disimpan terpisah. Semua kartu, grafik, tooltip, dan daftar memakai subset yang sama berdasarkan pencarian judul/nomor, kecamatan dan kelengkapan pemetaan. Legenda tetap mengikuti rentang dataset penuh (0; 1–2; 3–4; 5–6; 7–9) agar warna konsisten ketika filter berubah.

## Peta

MapLibre GL JS menampilkan 12 poligon kecamatan dari **56 kelurahan BIG, edisi Semester 1 2025, melalui Geoportal Kementan**. Geometri didissolve menggunakan kode administrasi Kota Bekasi `32.75`. Rincian sumber, hash snapshot, proses, pemeriksaan topologi dan keterangan lisensi tersedia di [docs/boundaries.md](docs/boundaries.md).

Peta memakai `fitBounds`, batas navigasi/zoom, garis luar kota, garis internal, mask di luar kota, zoom, reset, hover, ketuk dan pilihan kecamatan melalui keyboard. Angka tampil pada poligon; nama juga muncul ketika zoom diperbesar dan di tooltip. MapLibre v6 worker dibundel melalui pipeline worker Vite sesuai [dokumentasi resmi](https://maplibre.org/maplibre-gl-js/docs/). Tile OpenStreetMap memerlukan internet; jika tile gagal, geometri lokal dan statistik tetap tersedia. Gagal memuat geometri/worker menampilkan pesan dan tombol coba lagi, bukan warna 0 inovasi.

## Data yang masih perlu ditinjau

- Dua pencipta tidak memiliki NIK; tidak digabung berdasarkan kemiripan nama.
- Inovasi No. 19 (JELITA) belum memiliki kecamatan yang dapat dipetakan.
- Tiga catatan pembimbing memerlukan konfirmasi jika hendak diubah menjadi pencipta.
- Delapan belas catatan pemegang hak tidak memiliki identitas pasti atau berisi gabungan nama. Data disimpan sebagai pernyataan sumber yang belum diurai, bukan diasumsikan satu orang atau dicocokkan secara samar dengan pencipta. Model mendukung banyak pemegang per inovasi.
- Variasi judul SEPTiQ pada bagian A/B dipertahankan; penggabungan menggunakan nomor, bukan kesamaan judul.
- `Rawalumnu` → `Rawalumbu` dan `Pondogede` → `Pondok Gede` dicatat sebagai koreksi beserta sumber verifikasinya; nilai mentah tidak ditimpa.
- Domisili luar Kota Bekasi dan kontak yang salah format tetap tersimpan untuk pemeriksaan lokal.
- Feeder tidak menyediakan tanggal, kategori, nomor sertifikat atau status pendaftaran hak cipta. Tidak dibuat tren atau status pendaftaran berdasarkan asumsi.

## Struktur dan verifikasi

- `src/main.ts`: shell, branding, navigasi dan formulir prototipe yang sudah ada.
- `src/dashboard.ts`, `src/data.ts`: tampilan, filter dan agregasi bersama.
- `src/map.ts`, `src/map-scale.ts`: peta dan satu sumber rentang warna.
- `src/style.css`: token ukuran font asli +2px, tanpa penggandaan pada elemen bersarang; `dashboard.css`/`map.css` mengatur tata letak tambahan.
- `scripts/feeder-lib.mjs`, `scripts/import-feeder.mjs`: impor privat dan proyeksi publik.
- `tests/feeder.test.mjs`: relasi/idempotensi, normalisasi, privasi, hitungan, filter, rentang warna dan kelengkapan geometri. Uji sumber privat dilewati jika file lokal belum diimpor.

Uji browser mencakup hit-test seluruh 12 poligon, tooltip, klik/filter, ukuran layar 360–1440px, halaman login dan formulir lama, pemulihan kegagalan feeder/peta, data kosong, dan penolakan HTTP terhadap file privat. Pemeriksaan topologi tambahan dapat dijalankan dengan `python scripts/boundaries-build.py --check` dalam lingkungan yang menyediakan Shapely 2.x.
