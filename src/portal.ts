import { icon, logo, fullName, escapeHtml } from "./icons";
import { news, categories, districts, downloadUrl, office, type NewsItem } from "./data";

const dateText = (date: string) => new Intl.DateTimeFormat("id-ID", { dateStyle: "long" }).format(new Date(`${date}T12:00:00`));
export const publicPages: Record<string, string> = { home: "Home", "usulkan-inovasi": "Usulkan Inovasi", berita: "Berita", "petunjuk-teknis": "Petunjuk Teknis", "hubungi-kami": "Hubungi Kami", login: "Masuk", daftar: "Daftar" };

export function publicLayout(content: string, page: string, authenticated: boolean) {
  return `<div class="portal"><header class="portal-header"><div class="portal-container header-inner"><a class="brand portal-brand" href="#/home">${logo}</a><button class="icon-button portal-menu-toggle" data-action="public-menu" aria-label="Buka navigasi" aria-controls="public-nav" aria-expanded="false">${icon("menu")}</button><nav id="public-nav" class="portal-nav" aria-label="Navigasi utama">${Object.entries(publicPages).filter(([key]) => !["login", "daftar"].includes(key)).map(([key, label]) => `<a href="#/${key}" class="${page === key || (key === "berita" && page.startsWith("berita/")) ? "active" : ""}" ${page === key ? 'aria-current="page"' : ""}>${label}</a>`).join("")}<a class="nav-auth" href="#/${authenticated ? "dashboard" : "login"}">${icon(authenticated ? "grid" : "users")}${authenticated ? "Ruang Saya" : "Login / Daftar"}</a></nav></div></header><main id="main-content" tabindex="-1">${content}</main><footer class="portal-footer"><div class="portal-container footer-inner"><div><a class="brand portal-brand" href="#/home">${logo}</a><p>${fullName}</p><span>© ${new Date().getFullYear()} PELITA Kota Bekasi</span></div><div class="footer-links"><a href="#/petunjuk-teknis">Petunjuk Teknis</a><a href="#/hubungi-kami">Hubungi Kami</a><a href="#/login">Layanan Hak Cipta ${icon("arrow")}</a></div></div></footer></div>`;
}

function pageHeader(title: string, summary: string, eyebrow: string) {
  return `<section class="portal-page-header"><div class="portal-container"><nav class="portal-breadcrumb" aria-label="Jejak navigasi"><a href="#/home">Home</a>${icon("chevron")}<span>${title}</span></nav><span class="eyebrow">${eyebrow}</span><h1>${title}</h1><p>${summary}</p></div></section>`;
}

function newsCard(item: NewsItem) {
  return `<article class="news-card"><a class="news-image" href="#/berita/${item.slug}" tabindex="-1" aria-hidden="true"><img src="${item.image}" alt="" loading="lazy" width="640" height="400" /></a><div class="news-card-content"><span class="category-label">${item.category}</span><h2><a href="#/berita/${item.slug}">${item.title}</a></h2><p>${item.summary}</p><div class="news-meta"><span>${item.author}</span><time datetime="${item.date}">${dateText(item.date)}</time></div><a class="text-link" href="#/berita/${item.slug}">Baca selengkapnya ${icon("arrow")}</a></div></article>`;
}

function home() {
  return `<section class="pelita-hero"><img class="hero-photo" src="/images/inovasi-bekasi.jpg" alt="Pameran inovasi teknologi tepat guna Kota Bekasi" fetchpriority="high" width="1400" height="700" /><div class="portal-container hero-inner"><div class="hero-copy"><span class="hero-eyebrow">INOVASI DARI WARGA, UNTUK WARGA</span><h1>PELITA<span>Kota Bekasi</span></h1><h2>Pemetaan Inovasi Teknologi Tepat Guna</h2><p>Ruang bagi gagasan masyarakat untuk tumbuh menjadi solusi yang bermanfaat bagi Kota Bekasi.</p><div class="hero-actions"><a class="button primary" href="#/usulkan-inovasi">${icon("plus")} Usulkan Inovasi ${icon("arrow")}</a><a class="hero-link" href="#/petunjuk-teknis">Petunjuk Teknis ${icon("chevron")}</a></div></div><div class="hero-location">${icon("pin")} Kota Bekasi, Jawa Barat</div></div></section>
  <section class="portal-stat-band"><div class="portal-container"><div class="stats-label"><span class="eyebrow">JEJAK INOVASI</span><p>Gagasan kecil.<br>Manfaat yang berarti.</p><small>Data ilustrasi</small></div><div class="public-stats">${[["128", "Inovasi", "bulb"], ["12", "Kecamatan", "pin"], ["6", "Kategori", "grid"], ["214", "Pengusul", "users"]].map(([value, label, symbol]) => `<div>${icon(symbol)}<strong>${value}</strong><span>${label}</span></div>`).join("")}</div></div></section>
  <section class="portal-section"><div class="portal-container program-layout"><div class="section-intro"><span class="eyebrow">TENTANG PELITA</span><h2>Memetakan potensi,<br>menghubungkan inovasi.</h2><p>PELITA mempertemukan gagasan warga, teknologi tepat guna, dan jejaring Posyantek. Bersama, kita mengenali kebutuhan lokal dan mengembangkan solusi yang mudah digunakan.</p><a class="text-link" href="#/hubungi-kami">Terhubung dengan kami ${icon("arrow")}</a></div><div class="program-features">${[["01", "bulb", "Gagasan berbasis kebutuhan", "Dimulai dari permasalahan nyata yang dihadapi masyarakat."], ["02", "users", "Kolaborasi dengan Posyantek", "Menghubungkan inovator dengan pendamping di wilayahnya."], ["03", "shield", "Karya yang terus berkembang", "Ruang pengembangan inovasi dan akses layanan hak cipta."]].map(([number, symbol, title, text]) => `<div class="program-feature"><span class="program-number">${number}</span><span class="feature-icon">${icon(symbol)}</span><div><h3>${title}</h3><p>${text}</p></div></div>`).join("")}</div></div></section>
  <section class="portal-section section-tint"><div class="portal-container"><div class="public-section-heading"><div><span class="eyebrow">TEKNOLOGI TEPAT GUNA</span><h2>Beragam bidang, satu tujuan.</h2><p>Solusi yang dekat dengan kehidupan masyarakat.</p></div><a class="text-link" href="#/usulkan-inovasi">Ajukan gagasan Anda ${icon("arrow")}</a></div><div class="category-grid">${categories.map((item, index) => `<a class="category-item category-${index}" href="#/usulkan-inovasi"><span>${icon(item.icon)}</span><h3>${item.name}</h3><p>${item.text}</p>${icon("arrow", "category-arrow")}</a>`).join("")}</div></div></section>
  <section class="portal-section"><div class="portal-container"><div class="public-section-heading"><div><span class="eyebrow">KABAR PELITA</span><h2>Cerita di balik inovasi.</h2><p>Kabar dan inspirasi dari ekosistem inovasi Kota Bekasi.</p></div><a class="text-link" href="#/berita">Semua berita ${icon("arrow")}</a></div><div class="news-grid home-news">${news.slice(0, 3).map(newsCard).join("")}</div><p class="sample-note">Konten berita ilustrasi. Foto dokumentasi dari portal PELITA Kota Bekasi.</p></div></section>
  <section class="public-cta"><div class="portal-container"><span class="cta-icon">${icon("bulb")}</span><div><span class="eyebrow">MULAI DARI GAGASAN ANDA</span><h2>Punya solusi untuk lingkungan sekitar?</h2><p>Sampaikan inovasi Anda dan jadi bagian dari perubahan Kota Bekasi.</p></div><a class="button primary" href="#/usulkan-inovasi">Usulkan Inovasi ${icon("arrow")}</a></div></section>`;
}

const inputField = (id: string, label: string, type: string, placeholder: string, extra = "") => `<div class="form-field"><label for="${id}">${label} <span aria-hidden="true">*</span></label><input id="${id}" name="${id}" type="${type}" placeholder="${placeholder}" required ${extra} /></div>`;

function proposal() {
  return `${pageHeader("Usulkan Inovasi", "Sampaikan gagasan teknologi tepat guna untuk menjawab kebutuhan masyarakat.", "GAGASAN ANDA BERARTI")}<section class="portal-section"><div class="portal-container proposal-layout"><aside class="proposal-intro"><span class="feature-icon">${icon("bulb")}</span><h2>Mulai dari masalah.<br>Hadirkan solusi.</h2><p>Setiap inovasi berangkat dari kebutuhan. Ceritakan gagasan Anda dan pilih Posyantek yang dituju.</p><div class="proposal-reference">${icon("book")}<div><h3>Petunjuk Teknis</h3><p>Informasi persyaratan dan dokumen pendukung.</p><a class="text-link" href="#/petunjuk-teknis">Lihat dokumen ${icon("arrow")}</a></div></div></aside><div class="proposal-form-wrap"><div class="form-title"><h2>Form Usulan Inovasi Masyarakat</h2><span>* Wajib diisi</span></div><form id="proposal-form"><div class="proposal-fields">${inputField("judul", "Judul Inovasi", "text", "Tuliskan judul inovasi", 'maxlength="160"')}<div class="form-field"><label for="masalah">Identifikasi Masalah <span aria-hidden="true">*</span></label><textarea id="masalah" name="masalah" rows="3" placeholder="Jelaskan permasalahan yang ingin diselesaikan" required maxlength="3000"></textarea></div><div class="form-field"><label for="tujuan">Tujuan Inovasi <span aria-hidden="true">*</span></label><textarea id="tujuan" name="tujuan" rows="3" placeholder="Jelaskan tujuan dan manfaat inovasi" required maxlength="3000"></textarea></div>${inputField("pengusul", "Nama Pengusul", "text", "Nama lengkap pengusul", 'autocomplete="name" maxlength="120"')}<div class="form-field"><label for="posyantek">Posyantek yang Dituju <span aria-hidden="true">*</span></label><select id="posyantek" name="posyantek" required><option value="">Pilih Posyantek</option>${districts.map(d => `<option value="${d}">Posyantek ${d} (contoh)</option>`).join("")}</select></div><div class="proposal-contact">${inputField("kontak", "Nomor Kontak", "tel", "08xxxxxxxxxx", 'autocomplete="tel" pattern="[+]?[0-9][0-9 ]{7,18}" title="Masukkan 8 hingga 20 karakter nomor telepon"')}${inputField("email-usulan", "Email", "email", "nama@email.com", 'autocomplete="email"')}</div><div class="form-field"><label for="dokumen">Pilih Dokumen <span aria-hidden="true">*</span></label><div class="document-input">${icon("upload")}<span class="file-picker">Pilih berkas<input id="dokumen" name="dokumen" type="file" accept=".pdf,.doc,.docx" required aria-describedby="file-hint" /></span><span id="selected-file" class="selected-file">Belum ada dokumen</span><button type="button" class="icon-button" data-action="clear-document" aria-label="Hapus dokumen" title="Hapus dokumen" hidden>${icon("close")}</button></div><small id="file-hint">PDF, DOC, atau DOCX. Maksimal 10 MB.</small><span id="file-error" class="field-error" role="alert"></span></div></div><div class="proposal-submit"><span>${icon("info")} Simulasi pengajuan, belum dikirim ke layanan resmi.</span><button class="button primary" type="submit">Kirim ${icon("arrow")}</button></div><div id="proposal-result" class="form-result" role="status" hidden></div></form></div></div></section>`;
}

function newsPage() {
  return `${pageHeader("Berita", "Kabar, kegiatan, dan cerita inovasi teknologi tepat guna di Kota Bekasi.", "KABAR PELITA")}<section class="portal-section"><div class="portal-container"><div class="news-toolbar"><span id="news-count">${news.length} berita</span><div class="news-filters"><div class="search-input">${icon("search")}<input type="search" id="news-search" placeholder="Cari berita" aria-label="Cari berita" /></div><select id="news-category" aria-label="Kategori berita"><option value="">Semua kategori</option>${[...new Set(news.map(n => n.category))].map(c => `<option>${c}</option>`).join("")}</select></div></div><div class="news-grid" id="news-list">${news.map(newsCard).join("")}</div><p class="sample-note">Konten berita ilustrasi. Foto dokumentasi dari portal PELITA Kota Bekasi.</p></div></section>`;
}

function newsDetail(slug: string) {
  const item = news.find(n => n.slug === slug);
  if (!item) return notFound();
  return `${pageHeader("Berita", item.category, "KABAR PELITA")}<article class="portal-container article-page"><a href="#/berita" class="text-link">${icon("arrow", "back-arrow")} Kembali ke berita</a><h1>${item.title}</h1><div class="article-meta">${item.author}<span>·</span><time datetime="${item.date}">${dateText(item.date)}</time><span>·</span>Berita ilustrasi</div><img src="${item.image}" alt="${item.alt}" width="1100" height="600" /><p class="article-lead">${item.summary}</p>${item.body.map(p => `<p>${p}</p>`).join("")}<a href="#/usulkan-inovasi" class="button primary">Usulkan Inovasi ${icon("arrow")}</a><p class="sample-note">Foto dokumentasi: portal PELITA Kota Bekasi.</p></article>`;
}

function technical() {
  return `${pageHeader("Petunjuk Teknis", "Dokumen acuan untuk mempersiapkan inovasi dan kelengkapan pengajuan Anda.", "DOKUMEN & PANDUAN")}<section class="portal-section technical-section"><div class="portal-container"><div class="public-section-heading"><div><h2>Dokumen Petunjuk Teknis</h2><p>Unduh dokumen untuk melihat ketentuan selengkapnya.</p></div><span class="document-count">1 dokumen</span></div><div class="download-table"><div class="download-table-head"><span>Nama dokumen</span><span>Format</span><span>Unduh</span></div><div class="download-row"><span class="download-file-icon">${icon("file")}</span><div><h3>Petunjuk Teknis Lomba TTG Kota Bekasi 2026</h3><p>Pedoman dan ketentuan Lomba Teknologi Tepat Guna Kota Bekasi.</p><span class="download-file-meta">PDF · 445 KB · Tahun 2026</span></div><span class="format-tag">PDF</span><a href="${downloadUrl}" class="button primary" download="petunjuk-teknis-lomba-ttg-kota-bekasi-2026.pdf">${icon("download")} Download</a></div></div><div class="technical-contact">${icon("help")}<p>Ada pertanyaan mengenai petunjuk teknis? <a href="#/hubungi-kami">Hubungi kami ${icon("arrow")}</a></p></div></div></section>`;
}

function contact() {
  return `${pageHeader("Hubungi Kami", "Terhubung dengan pengelola PELITA Kota Bekasi.", "KAMI SIAP MEMBANTU")}<section class="portal-section"><div class="portal-container"><div class="contact-grid"><article class="contact-card"><span>${icon("pin")}</span><div><h2>Alamat Kami</h2><p>${office.name}<br>${office.address}</p></div></article><article class="contact-card"><span>${icon("mail")}</span><div><h2>Email</h2><a href="mailto:${office.email}">${office.email}</a></div></article><article class="contact-card"><span>${icon("phone")}</span><div><h2>Telepon</h2><a href="tel:+6287870137110">${office.phone}</a></div></article></div><div class="map-heading"><div><h2>Lokasi Kantor</h2><p>${office.address}</p></div><a href="https://www.openstreetmap.org/?mlat=${office.coordinates[1]}&mlon=${office.coordinates[0]}#map=17/${office.coordinates[1]}/${office.coordinates[0]}" class="text-link" target="_blank" rel="noopener">Buka peta ${icon("arrow")}</a></div><div class="office-map-wrap"><div id="office-map" role="region" aria-label="Peta lokasi kantor Bappelitbangda"></div><p id="map-status" role="status">Memuat peta lokasi kantor...</p></div></div></section>`;
}

export function authPage(register: boolean) {
  return `<section class="auth-section"><div class="portal-container auth-layout"><div class="auth-intro"><span class="eyebrow">RUANG INOVATOR KOTA BEKASI</span><h2 class="auth-brand-title">PELITA</h2><p class="auth-fullname">${fullName}</p><img src="/images/inovasi-bekasi.jpg" alt="Pameran inovasi teknologi tepat guna di Kota Bekasi" width="720" height="480" /><h2>Gagasan Anda,<br>manfaat untuk bersama.</h2><p>Terhubung dengan ekosistem inovasi Kota Bekasi dan akses layanan perlindungan karya Anda.</p></div><div class="auth-form-panel"><span class="auth-icon">${icon(register ? "users" : "lock")}</span><h1>${register ? "Daftar" : "Masuk"}</h1><p>${register ? "Mulai perjalanan inovasi Anda bersama PELITA." : "Selamat datang kembali di PELITA Kota Bekasi."}</p><form id="${register ? "register" : "login"}-form">${register ? inputField("nama", "Nama Lengkap", "text", "Nama lengkap Anda", 'autocomplete="name" maxlength="120"') : ""}${inputField("email", register ? "Email" : "Email atau Username", register ? "email" : "text", register ? "nama@email.com" : "Email atau username Anda", `autocomplete="${register ? "email" : "username"}"`)}<div class="form-field"><label for="password">Password <span aria-hidden="true">*</span></label><div class="auth-password"><input id="password" name="password" type="password" autocomplete="${register ? "new-password" : "current-password"}" placeholder="Masukkan kata sandi" required ${register ? 'minlength="8"' : ""} /><button class="icon-button" type="button" data-action="password" aria-label="Tampilkan kata sandi" aria-pressed="false" title="Tampilkan kata sandi">${icon("eye")}</button></div>${register ? "<small>Minimal 8 karakter.</small>" : ""}</div>${register ? inputField("confirm-password", "Konfirmasi Password", "password", "Ulangi kata sandi", 'autocomplete="new-password" minlength="8"') : ""}<p class="auth-demo-note">${icon("info")} Akun simulasi. Gunakan data dan kata sandi contoh.</p><button class="button primary auth-submit" type="submit">${register ? "Daftar" : "Masuk"} ${icon("arrow")}</button><div class="form-result" id="auth-result" role="status" hidden></div></form><p class="auth-switch"><a href="#/${register ? "login" : "daftar"}">${register ? "Sudah punya akun? Masuk" : "Belum punya akun? Daftar"}</a></p>${register ? "" : `<div class="auth-demo"><span>Ingin melihat layanan hak cipta?</span><button class="text-link" data-action="demo">Coba demo ${icon("arrow")}</button></div>`}<a class="text-link auth-home" href="#/home">${icon("arrow", "back-arrow")} Kembali ke Home</a></div></div></section>`;
}

function notFound() { return `${pageHeader("Halaman tidak ditemukan", "Halaman yang Anda tuju belum tersedia.", "PELITA KOTA BEKASI")}<div class="portal-container not-found"><a href="#/home" class="button primary">Kembali ke Home ${icon("arrow")}</a></div>`; }

export function publicContent(page: string): string {
  if (page.startsWith("berita/")) return newsDetail(page.slice(7));
  switch (page) { case "home": return home(); case "usulkan-inovasi": return proposal(); case "berita": return newsPage(); case "petunjuk-teknis": return technical(); case "hubungi-kami": return contact(); case "login": return authPage(false); case "daftar": return authPage(true); default: return notFound(); }
}

export function bindPublicEvents() {
  const search = document.querySelector<HTMLInputElement>("#news-search");
  const filter = document.querySelector<HTMLSelectElement>("#news-category");
  const updateNews = () => {
    const term = search?.value.trim().toLocaleLowerCase("id-ID") || "";
    const items = news.filter(n => (!filter?.value || n.category === filter.value) && `${n.title} ${n.summary} ${n.category}`.toLocaleLowerCase("id-ID").includes(term));
    document.querySelector("#news-list")!.innerHTML = items.length ? items.map(newsCard).join("") : '<div class="news-empty"><h2>Berita tidak ditemukan</h2><p>Coba kata kunci atau kategori lain.</p></div>';
    document.querySelector("#news-count")!.textContent = `${items.length} berita`;
  };
  search?.addEventListener("input", updateNews);
  filter?.addEventListener("change", updateNews);
  const registration = document.querySelector<HTMLFormElement>("#register-form");
  const password = document.querySelector<HTMLInputElement>("#password");
  const confirmation = document.querySelector<HTMLInputElement>("#confirm-password");
  const checkPassword = () => confirmation?.setCustomValidity(confirmation.value !== password?.value ? "Konfirmasi password belum sama." : "");
  confirmation?.addEventListener("input", checkPassword);
  password?.addEventListener("input", checkPassword);
  registration?.addEventListener("input", () => { const result = document.querySelector<HTMLElement>("#auth-result"); if (result) result.hidden = true; });
  registration?.addEventListener("submit", event => {
    event.preventDefault();
    const result = document.querySelector<HTMLElement>("#auth-result")!;
    result.hidden = false;
    result.innerHTML = `${icon("check")}<div><strong>Simulasi pendaftaran selesai.</strong><p>Akun belum dibuat di layanan resmi. Anda dapat melanjutkan ke halaman Masuk untuk mencoba layanan.</p><a class="text-link" href="#/login">Masuk ${icon("arrow")}</a></div>`;
    registration.reset();
  });
  const proposalForm = document.querySelector<HTMLFormElement>("#proposal-form");
  const file = document.querySelector<HTMLInputElement>("#dokumen");
  const validateFile = () => {
    const selected = file?.files?.[0];
    const name = document.querySelector("#selected-file");
    if (name) name.textContent = selected?.name || "Belum ada dokumen";
    const error = selected && selected.size > 10 * 1024 * 1024 ? "Ukuran dokumen melebihi 10 MB." : selected && !/\.(pdf|doc|docx)$/i.test(selected.name) ? "Pilih dokumen PDF, DOC, atau DOCX." : "";
    file?.setCustomValidity(error);
    const message = document.querySelector("#file-error");
    if (message) message.textContent = error;
    const clear = document.querySelector<HTMLButtonElement>('[data-action="clear-document"]');
    if (clear) clear.hidden = !selected;
  };
  file?.addEventListener("change", validateFile);
  document.querySelector('[data-action="clear-document"]')?.addEventListener("click", () => { if (file) file.value = ""; validateFile(); const result = document.querySelector<HTMLElement>("#proposal-result"); if (result) result.hidden = true; });
  proposalForm?.addEventListener("input", () => { const result = document.querySelector<HTMLElement>("#proposal-result"); if (result) result.hidden = true; });
  proposalForm?.addEventListener("submit", event => {
    event.preventDefault();
    validateFile();
    if (!proposalForm.reportValidity()) return;
    const result = document.querySelector<HTMLElement>("#proposal-result")!;
    const title = (proposalForm.elements.namedItem("judul") as HTMLInputElement).value;
    result.hidden = false;
    result.innerHTML = `${icon("check")}<div><strong>Simulasi usulan selesai.</strong><p>Usulan "${escapeHtml(title)}" telah diperiksa pada formulir ini. Usulan dan dokumen belum dikirim atau disimpan di layanan resmi.</p></div>`;
    result.scrollIntoView({ block: "nearest", behavior: "smooth" });
  });
}
