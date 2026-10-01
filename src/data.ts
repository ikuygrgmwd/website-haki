export interface NewsItem {
  slug: string;
  title: string;
  category: string;
  date: string;
  author: string;
  image: string;
  alt: string;
  summary: string;
  body: string[];
}

export const news: NewsItem[] = [
  { slug: "gagasan-warga", title: "Gagasan warga, solusi nyata untuk Kota Bekasi", category: "Inovasi Masyarakat", date: "2026-09-28", author: "Admin PELITA", image: "/images/inovasi-bekasi.jpg", alt: "Kunjungan pada pameran teknologi tepat guna di Kota Bekasi", summary: "Dari persoalan sehari-hari, lahir teknologi sederhana yang membawa manfaat bagi lingkungan sekitar.", body: ["Warga Kota Bekasi mengembangkan gagasan teknologi tepat guna yang berangkat dari kebutuhan di lingkungan mereka. Solusi yang diusulkan mencakup pengelolaan lingkungan, peningkatan produktivitas, dan pelayanan masyarakat.", "Melalui PELITA, gagasan dapat dipetakan dan dihubungkan dengan Posyantek untuk mendapatkan pendampingan. Kolaborasi menjadi langkah awal agar inovasi dapat digunakan secara lebih luas."] },
  { slug: "kolaborasi-posyantek", title: "Posyantek memperkuat kolaborasi inovator di tingkat kecamatan", category: "Posyantek", date: "2026-09-24", author: "Tim Inovasi Daerah", image: "/images/posyantek-bekasi.jpg", alt: "Perwakilan Posyantek dan pemerintah Kota Bekasi", summary: "Ruang bertemu bagi masyarakat, pendamping, dan pelaku teknologi untuk mengembangkan inovasi bersama.", body: ["Pos Pelayanan Teknologi menjadi penghubung antara kebutuhan masyarakat dan pengembangan teknologi tepat guna. Pertemuan komunitas membuka kesempatan untuk berbagi pengalaman dan menyusun rencana pendampingan.", "Pengusul dapat menyampaikan kebutuhan melalui formulir Usulkan Inovasi. Setiap gagasan menjadi bahan untuk mengenali potensi inovasi di wilayahnya."] },
  { slug: "lomba-ttg", title: "Persiapkan inovasi terbaik untuk Lomba TTG Kota Bekasi 2026", category: "Program TTG", date: "2026-09-20", author: "Admin PELITA", image: "/images/komunitas-bekasi.jpg", alt: "Penyerahan penghargaan inovasi teknologi tepat guna", summary: "Kenali persyaratan dan siapkan dokumentasi inovasi melalui petunjuk teknis yang tersedia.", body: ["Inovator dapat mempersiapkan dokumentasi tentang permasalahan, tujuan, dan manfaat teknologi yang dikembangkan. Bukti penggunaan dan penjelasan cara kerja membantu memperjelas gagasan.", "Dokumen Petunjuk Teknis Lomba TTG Kota Bekasi 2026 tersedia pada halaman Petunjuk Teknis. Ketentuan dan jadwal resmi mengacu pada dokumen tersebut."] },
  { slug: "pendampingan-inovator", title: "Bappelitbangda membuka ruang pendampingan bagi inovator muda", category: "Inovasi Masyarakat", date: "2026-09-16", author: "Tim Inovasi Daerah", image: "/images/inovasi-bekasi.jpg", alt: "Diskusi tentang alat teknologi tepat guna pada pameran Bekasi", summary: "Gagasan pelajar dan masyarakat bertemu dengan pengalaman pendamping untuk menghasilkan solusi yang berguna.", body: ["Pendampingan menjadi kesempatan untuk menguji gagasan dan memperbaiki rancangan. Inovator muda dapat mengenali kebutuhan pengguna serta menyusun penjelasan manfaat teknologi yang dibuat.", "Pengembangan dilakukan bertahap, dimulai dari identifikasi masalah hingga evaluasi penggunaan. Kerja sama komunitas membantu gagasan terus berkembang."] },
  { slug: "apresiasi-inovasi", title: "Apresiasi untuk penggerak teknologi tepat guna di Kota Bekasi", category: "Program TTG", date: "2026-09-12", author: "Admin PELITA", image: "/images/penghargaan-bekasi.jpg", alt: "Dokumentasi penerimaan penghargaan teknologi tepat guna", summary: "Mengangkat semangat penggerak inovasi yang mendampingi masyarakat dan membangun budaya kolaborasi.", body: ["Inovasi tumbuh berkat kerja bersama masyarakat, pendamping, dan pemerintah daerah. Apresiasi menjadi pengingat bahwa perbaikan sederhana dapat memberi dampak yang berarti.", "PELITA menghadirkan ruang untuk mengenali gagasan tersebut dan membangun jejaring antarpengusul. Dokumentasi membantu pengalaman dibagikan kepada komunitas lainnya."] },
  { slug: "teknologi-lingkungan", title: "Komunitas mengembangkan teknologi untuk lingkungan yang lebih baik", category: "Posyantek", date: "2026-09-08", author: "Tim Inovasi Daerah", image: "/images/posyantek-bekasi.jpg", alt: "Komunitas penggerak Posyantek Kota Bekasi", summary: "Pengelolaan sampah dan pemanfaatan sumber daya menjadi inspirasi inovasi berbasis kebutuhan warga.", body: ["Kebutuhan menjaga lingkungan mendorong masyarakat mengembangkan alat dan metode yang mudah diterapkan. Teknologi tepat guna mengutamakan manfaat, keterjangkauan, dan kemudahan perawatan.", "Komunitas dapat bekerja sama dengan Posyantek untuk mengenali potensi penerapan. Pengalaman penggunaan menjadi bahan pengembangan solusi berikutnya."] },
];

export const categories = [
  { name: "Lingkungan", icon: "leaf", text: "Solusi untuk lingkungan yang lebih berkelanjutan." },
  { name: "Pertanian & Pangan", icon: "bulb", text: "Teknologi untuk ketahanan pangan masyarakat." },
  { name: "Teknologi Digital", icon: "cpu", text: "Layanan digital yang menjawab kebutuhan warga." },
  { name: "Kesehatan", icon: "health", text: "Inovasi untuk hidup yang lebih sehat." },
  { name: "Industri & UMKM", icon: "wrench", text: "Alat tepat guna untuk usaha yang produktif." },
  { name: "Pelayanan Publik", icon: "building", text: "Gagasan untuk pelayanan yang lebih baik." },
];
export const districts = ["Bantargebang", "Bekasi Barat", "Bekasi Selatan", "Bekasi Timur", "Bekasi Utara", "Jatiasih", "Jatisampurna", "Medansatria", "Mustikajaya", "Pondokgede", "Pondokmelati", "Rawalumbu"];
export const downloadUrl = "/downloads/petunjuk-teknis-lomba-ttg-kota-bekasi-2026.pdf";
// Coordinates from the map attached to the supplied PELITA contact reference.
export const office = { name: "Kantor Bappelitbangda Kota Bekasi", address: "Jl. Jend A Yani No.1, Kota Bekasi", email: "balitbangkotabekasi@gmail.com", phone: "087870137110", coordinates: [106.9950606, -6.2365671] as [number, number] };
