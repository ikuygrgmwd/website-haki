# PELITA Kota Bekasi

Pemetaan Inovasi Teknologi Tepat Guna Kota Bekasi. Portal publik dan layanan hak cipta yang dikembangkan dari aplikasi HAKI sebelumnya, menggunakan Vite dan TypeScript.

## Menjalankan aplikasi

Gunakan Node.js 22.12 atau versi lebih baru.

```sh
npm install
npm run dev
```

Buka alamat lokal yang ditampilkan Vite. Jika port 5173 sudah digunakan, Vite akan memilih port berikutnya.

```sh
npm run build
npm run preview
```

## Halaman

- `#/home`: pengantar PELITA, statistik ilustrasi, kategori inovasi, dan berita pilihan.
- `#/usulkan-inovasi`: formulir usulan, validasi isian, dokumen PDF/DOC/DOCX maksimal 10 MB, dan konfirmasi simulasi.
- `#/berita`: enam berita ilustrasi, pencarian, dan filter kategori.
- `#/berita/<slug>`: detail berita ilustrasi.
- `#/petunjuk-teknis`: unduhan PDF asli Petunjuk Teknis Lomba TTG Kota Bekasi 2026.
- `#/hubungi-kami`: kontak dan peta MapLibre dengan marker kantor.
- `#/login` dan `#/daftar`: halaman akun terpisah dengan validasi konfirmasi password.
- `#/dashboard` dan rute layanan hak cipta sebelumnya: dasbor dan alur tiga tahap permohonan tetap tersedia setelah masuk simulasi.

Rute lama `#/semangat` dialihkan ke `#/usulkan-inovasi`. Halaman dan menu Media tidak ditambahkan. Aplikasi lama belum memiliki peta inovasi tersendiri.

## Data dan layanan simulasi

Berita, statistik, dan pilihan Posyantek merupakan data contoh. Formulir usulan tidak mengirim atau menyimpan dokumen. Pendaftaran tidak membuat akun resmi. Masuk menerima email atau username dan password contoh yang tidak kosong. Status sesi simulasi disimpan pada `sessionStorage` menggunakan `pelita-demo`; password tidak disimpan. Keluar menghapus sesi tersebut.

Layanan hak cipta mempertahankan batasan prototipe sebelumnya: data detail permohonan tersedia dalam memori selama halaman terbuka; pengelolaan pencipta, lampiran, penyimpanan draf, dan pengajuan resmi masih direncanakan. Gunakan data contoh.

## Aset dan peta

PDF asli disimpan di `public/downloads/petunjuk-teknis-lomba-ttg-kota-bekasi-2026.pdf`.

Logo dan foto dokumentasi di `public/images/` berasal dari portal referensi [PELITA Kota Bekasi](https://pelita.bekasikota.online/). Foto digunakan untuk mendampingi konten berita ilustrasi.

Peta menggunakan MapLibre GL JS dan tile OpenStreetMap, dengan koordinat kantor dari peta portal referensi: `106.9950606, -6.2365671`. Peta memerlukan internet, sedangkan gambar dan PDF dilayani dari proyek. Worker MapLibre dibundel melalui pipeline worker Vite untuk pengembangan dan produksi. Tidak diperlukan API key untuk konfigurasi ini.

## Struktur

- `src/main.ts`: router hash, sesi simulasi, dan layanan hak cipta sebelumnya.
- `src/portal.ts`: halaman publik, formulir, berita, dan halaman akun.
- `src/data.ts`: data contoh, kontak, dan tautan unduhan.
- `src/office-map.ts`: MapLibre, marker, kontrol, serta pembersihan peta saat navigasi.
- `src/icons.ts`: ikon Lucide dan identitas PELITA.
- `src/style.css`: desain dasar aplikasi sebelumnya.
- `src/portal.css`: desain portal publik dan penyesuaian branding.
