import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";
import "@fontsource/dm-sans/700.css";
import "@fontsource/plus-jakarta-sans/500.css";
import "@fontsource/plus-jakarta-sans/600.css";
import "@fontsource/plus-jakarta-sans/700.css";
import "./style.css";
import { dashboardTemplate, mountDashboard } from "./dashboard";
let disposeDashboard: (() => void) | undefined;

const paths: Record<string, string> = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
  copy: '<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4"/>',
  music:
    '<path d="M9 18V5l12-3v13M9 9l12-3"/><ellipse cx="6" cy="18" rx="3" ry="3"/><ellipse cx="18" cy="15" rx="3" ry="3"/>',
  shield:
    '<path d="M12 3 3 7v5c0 5 9 10 9 10s9-5 9-10V7z"/><path d="m8 12 3 3 5-6"/>',
  refresh: '<path d="M20 7a9 9 0 1 0 1 9M20 2v6h-6"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 4 3c-1 .5-1 1-1 2M12 17h.01"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  wallet:
    '<rect x="3" y="5" width="18" height="15" rx="2"/><path d="M3 7V4a2 2 0 0 1 2-2h13M21 11h-6v5h6M17 13.5h.01"/>',
  book: '<path d="M12 5v16M12 5C8 2 3 3 2 4v16c3-1 6-1 10 1 4-2 7-2 10-1V4c-1-1-6-2-10 1Z"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  users:
    '<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6M18 15a5 5 0 0 1 3 4v2"/>',
  upload: '<path d="M12 16V3m-5 5 5-5 5 5M3 16v5h18v-5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  logout: '<path d="M9 3H4v18h5M9 12h12m-5-5 5 5-5 5"/>',
  eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4M12 14v3"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 5 9 8 9-8"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  spark:
    '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z"/>',
};
const icon = (name: string, cls = "") =>
  `<svg class="icon ${cls}" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.file}</svg>`;
const logo = `<span class="brand-mark">s<span>·</span></span><span class="brand-word">Sapatri<span>INOVASI & HAK CIPTA</span></span>`;
const badge = (phase: number) =>
  `<span class="phase-badge">Direncanakan di fase ${phase}</span>`;
const app = document.querySelector<HTMLDivElement>("#app")!;
let authenticated = sessionStorage.getItem("sapatri-demo") === "true";
let step = 1;
let collapsed = false;
let mobileOpen = false;
let copyrightOpen = true;
let userMenuOpen = false;
const fields: Record<string, string> = {};
const pages: Record<string, string> = {
  dashboard: "Dashboard",
  baru: "Permohonan Baru",
  ciptaan: "Daftar Ciptaan",
  draft: "Daftar Ciptaan Draft",
  pasca: "Pasca Hak Cipta",
  musik: "Hak Cipta Lagu dan/atau Musik",
  terkait: "Hak Terkait",
  "pasca-terkait": "Pasca Hak Terkait",
  roadmap: "Tahapan Pengembangan",
};
const route = () =>
  location.hash.replace("#/", "") || "dashboard";
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );

function art() {
  return `<div class="hero-art" aria-hidden="true"><span class="art-orbit orbit-one"></span><span class="art-orbit orbit-two"></span><span class="art-dot dot-one"></span><span class="art-dot dot-two"></span><div class="paper paper-back"></div><div class="paper paper-front"><span class="paper-brand">sapatri.</span><div class="paper-lines"><i></i><i></i><i></i></div><span class="paper-title">Sebuah ide.<br>Sepenuhnya milikmu.</span><span class="paper-seal">${icon("check")}</span><span class="paper-signature">Karya orisinal</span></div><span class="floating-copyright">©</span><span class="floating-spark">✦</span></div>`;
}

function sidebar() {
  const nav = (key: string, name: string, symbol: string) =>
    `<a href="#/${key}" class="nav-item ${route() === key ? "active" : ""}" ${route() === key ? 'aria-current="page"' : ""} title="${name}">${icon(symbol)}<span>${name}</span>${key !== "dashboard" ? '<span class="nav-planned"></span>' : ""}</a>`;
  return `<button class="sidebar-backdrop ${mobileOpen ? "visible" : ""}" aria-label="Tutup navigasi" data-action="close-menu"></button><aside class="sidebar ${collapsed ? "collapsed" : ""} ${mobileOpen ? "mobile-open" : ""}"><a href="#/dashboard" class="brand" aria-label="Sapatri Dashboard">${logo}</a><button class="collapse-button" data-action="collapse" aria-label="${collapsed ? "Perluas" : "Ciutkan"} sidebar">${icon("chevron")}</button><div class="workspace"><span class="workspace-icon">${icon("shield")}</span><span>Akun personal<small>Ruang karya Anda</small></span><span class="demo-dot"></span></div><div class="nav-label">MENU UTAMA</div><nav aria-label="Navigasi utama">${nav("dashboard", "Dashboard", "grid")}<button class="nav-item nav-parent ${["baru", "ciptaan", "draft"].includes(route()) ? "parent-current" : ""}" data-action="copyright" aria-expanded="${copyrightOpen}" title="Hak Cipta">${icon("file")}<span>Hak Cipta</span>${icon("down", copyrightOpen ? "" : "rotated")}</button><div class="subnav ${copyrightOpen ? "" : "hidden"}">${[
    ["baru", "Permohonan Baru"],
    ["ciptaan", "Daftar Ciptaan"],
    ["draft", "Daftar Ciptaan Draft"],
  ]
    .map(
      ([key, text]) =>
        `<a href="#/${key}" class="${route() === key ? "active" : ""}" ${route() === key ? 'aria-current="page"' : ""}><span class="sub-dot"></span>${text}${key === "baru" ? icon("plus") : ""}</a>`,
    )
    .join(
      "",
    )}</div>${nav("pasca", "Pasca Hak Cipta", "refresh")}${nav("musik", "Hak Cipta Lagu dan/atau Musik", "music")}<div class="nav-divider"></div>${nav("terkait", "Hak Terkait", "copy")}${nav("pasca-terkait", "Pasca Hak Terkait", "refresh")}</nav><div class="sidebar-bottom"><div class="sidebar-help"><span class="help-icon">${icon("help")}</span><strong>Ada yang bisa dibantu?</strong><p>Kenali langkah pertama<br>untuk melindungi karya Anda.</p><button data-action="help">Pusat bantuan ${icon("arrow")}</button></div><a class="build-status" href="#/roadmap"><span class="status-dot"></span><span>Sapatri <b>Portal Kota Bekasi</b></span>${icon("chevron")}</a></div></aside>`;
}

function shell(content: string) {
  return `${sidebar()}<div class="main-shell ${collapsed ? "expanded" : ""}"><header class="topbar"><div class="breadcrumbs"><button class="mobile-menu icon-button" data-action="menu" aria-label="Buka navigasi">${icon("menu")}</button><span class="breadcrumb-home">Portal Sapatri</span>${icon("chevron")}<span>${["baru", "ciptaan", "draft"].includes(route()) ? "Hak Cipta" + icon("chevron") : ""}${escape(pages[route()] || "Halaman tidak ditemukan")}</span></div><div class="topbar-actions"><button class="help-top" data-action="help">${icon("help")}<span>Bantuan</span></button><span class="top-divider"></span><button class="icon-button notification" data-action="notifications" aria-label="Lihat notifikasi">${icon("bell")}<span></span></button><div class="profile-wrap"><button class="profile" data-action="profile" aria-expanded="${userMenuOpen}"><span class="avatar">AK</span><span class="profile-text">Akun Kreator<small>Akun personal</small></span>${icon("down")}</button>${userMenuOpen ? `<div class="profile-menu"><small>SESI DEMO LOKAL</small><strong>Akun Kreator</strong><button data-action="logout">${icon("logout")} Keluar</button></div>` : ""}</div></div></header><main id="main-content" tabindex="-1">${content}</main><footer class="footer"><span>© ${new Date().getFullYear()} Sapatri. Ruang aman untuk ide Anda.</span><span>Kota Bekasi <i></i> Data feeder <span class="footer-version">v0.2.0</span></span></footer></div>`;
}

function dashboard() { return dashboardTemplate(); }

function field(
  id: string,
  label: string,
  type = "text",
  full = false,
  placeholder = "",
  options: string[] = [],
) {
  const value = escape(fields[id] || "");
  const control =
    type === "select"
      ? `<select id="${id}" name="${id}" data-field="${id}"><option value="">${placeholder}</option>${options.map((o) => `<option ${fields[id] === o ? "selected" : ""}>${escape(o)}</option>`).join("")}</select>`
      : type === "textarea"
        ? `<textarea id="${id}" data-field="${id}" placeholder="${placeholder}" rows="4">${value}</textarea>`
        : `<input id="${id}" data-field="${id}" type="${type}" value="${value}" placeholder="${placeholder}" />`;
  return `<div class="form-field ${full ? "full" : ""}"><label for="${id}">${label} <span aria-hidden="true">*</span></label>${control}${id === "description" ? "<small>Jelaskan secara singkat isi dan karakteristik karya Anda.</small>" : ""}</div>`;
}

function stepOne() {
  return `<div class="form-section-heading"><span class="section-icon">${icon("file")}</span><div><h2>Detail Permohonan</h2><p>Mulai dengan informasi dasar tentang karya Anda.</p></div><span class="required-note">* Wajib pada fase validasi</span></div><div class="form-grid">${field("application", "Jenis Permohonan", "select", false, "Pilih jenis permohonan", ["Umum (contoh)"])}${field("work", "Jenis Ciptaan", "select", false, "Pilih jenis ciptaan", ["Karya Tulis (contoh)", "Karya Seni (contoh)"])}${field("subtype", "Sub-Jenis Ciptaan", "select", false, "Pilih sub-jenis ciptaan", ["Buku (contoh)", "Ilustrasi (contoh)"])}${field("date", "Tanggal Pertama Kali Diumumkan", "date")}${field("title", "Judul", "text", true, "Tuliskan judul karya Anda")}${field("description", "Uraian Singkat", "textarea", true, "Ceritakan tentang karya yang ingin Anda daftarkan…")}${field("country", "Negara Pertama Kali Diumumkan", "select", false, "Pilih negara", ["Indonesia (contoh)"])}${field("city", "Kota Pertama Kali Diumumkan", "text", false, "Tuliskan nama kota")}</div><div class="inline-notice">${icon("info")}<span>Formulir pratinjau. Validasi, pilihan lengkap, kalender lanjutan, dan penyimpanan progres: <strong>Direncanakan di fase 2.</strong></span></div>`;
}

function stepTwo() {
  return `<div class="form-section-heading"><span class="section-icon">${icon("users")}</span><div><h2>Data Pencipta dan Pemegang Hak Cipta</h2><p>Informasi pihak yang terlibat dalam karya Anda.</p></div></div><div class="placeholder-sections">${[
    [
      "Data Kuasa",
      "Pilihan pengajuan secara langsung atau melalui kuasa.",
      "Melalui Kuasa",
    ],
    [
      "Data Pencipta Hak Cipta",
      "Nama, identitas, dan alamat pencipta karya.",
      "Tambah Pencipta",
    ],
    [
      "Data Pemegang Hak Cipta",
      "Informasi pemilik hak atas karya yang diajukan.",
      "Tambah Pemegang",
    ],
  ]
    .map(
      ([title, text, action]) =>
        `<section class="planned-section"><div><h3>${title}</h3><p>${text}</p>${badge(3)}</div><button disabled class="button secondary">${icon("plus")}${action}</button></section>`,
    )
    .join("")}</div>`;
}

function stepThree() {
  return `<div class="form-section-heading"><span class="section-icon">${icon("upload")}</span><div><h2>Lampiran</h2><p>Dokumen pendukung untuk melengkapi permohonan.</p></div>${badge(4)}</div><div class="attachment-list">${["Scan KTP Pemohon dan Pencipta", "Surat Pernyataan", "Contoh Ciptaan", "Bukti Pengalihan Hak Cipta", "Salinan Resmi Akta Pendirian Badan Hukum", "Scan NPWP Perorangan / Perusahaan", "Bukti Publikasi"].map((title) => `<div class="attachment-row"><span class="attachment-icon">${icon("file")}</span><div><strong>${title}</strong><small>${title === "Contoh Ciptaan" ? "Pilihan upload atau link · " : ""}Direncanakan di fase 4</small></div><button disabled class="button secondary compact">${icon("upload")} Unggah</button></div>`).join("")}</div><div class="inline-notice">${icon("info")}<span>Penyimpanan draft, konfirmasi, dan pengiriman permohonan: <strong>Direncanakan di fase 4.</strong></span></div>`;
}

function newApplication() {
  return `<div class="page-heading application-heading"><div><div class="eyebrow">HAK CIPTA / PERMOHONAN BARU</div><h1>Permohonan Hak Cipta</h1><p>Satu langkah lebih dekat untuk melindungi karya Anda.</p></div><div class="fee"><span>Biaya permohonan</span><strong>Rp 200.000</strong><small>Nominal contoh dari brief</small></div></div><div class="application-toolbar"><span>${icon("shield")} Karya orisinal dimulai dari Anda.</span><div><button class="button secondary compact" data-action="letter">${icon("download")} Surat Pernyataan</button><button class="button secondary compact" data-action="transfer">${icon("download")} Surat Pengalihan Hak</button></div></div><section class="card wizard"><div class="wizard-steps" aria-label="Tahapan permohonan">${[
    ["Detail Permohonan", "Informasi tentang karya"],
    ["Pencipta & Pemegang Hak", "Data pihak terkait"],
    ["Lampiran", "Dokumen pendukung"],
  ]
    .map(
      ([title, desc], i) =>
        `<button class="wizard-step ${step === i + 1 ? "current" : ""} ${step > i + 1 ? "visited" : ""}" data-step="${i + 1}" ${step === i + 1 ? 'aria-current="step"' : ""}><span class="step-circle">${i + 1}</span><span><strong>${title}</strong><small>${desc}</small></span></button>`,
    )
    .join(
      "",
    )}</div><div class="wizard-body">${step === 1 ? stepOne() : step === 2 ? stepTwo() : stepThree()}</div><div class="wizard-footer"><button class="button secondary" data-action="previous" ${step === 1 ? "disabled" : ""}>${icon("arrow", "back-arrow")} Sebelumnya</button><span class="step-count">Langkah ${step} dari 3</span><div><button class="button secondary draft-button" data-action="draft">${icon("copy")} Simpan Sebagai Draft</button><button class="button primary" data-action="next" ${step === 3 ? 'disabled title="Pengiriman direncanakan di fase 4"' : ""}>Selanjutnya ${icon("arrow")}</button></div></div></section><p class="application-footnote">${icon("lock")} Prototipe lokal. Data tidak dikirim ke server dan tidak disimpan sebagai permohonan resmi.</p>`;
}

function tablePage(draft: boolean) {
  return `<div class="page-heading"><div><div class="eyebrow">ARSIP KARYA</div><h1>${draft ? "Daftar Ciptaan Draft" : "Daftar Ciptaan"}</h1><p>${draft ? "Tempat melanjutkan permohonan yang belum selesai." : "Pantau dan kelola perjalanan seluruh karya Anda."}</p></div><a href="#/baru" class="button primary">${icon("plus")} Permohonan Baru</a></div><section class="card"><div class="card-header"><h2>${draft ? "Draft permohonan" : "Semua ciptaan"} <span class="count-badge">0</span></h2>${badge(5)}</div><div class="table-scroll"><table><thead><tr><th>JUDUL CIPTAAN</th><th>JENIS CIPTAAN</th><th>TANGGAL</th><th>STATUS</th><th>AKSI</th></tr></thead><tbody><tr><td colspan="5"><div class="empty-state"><div class="empty-art">${icon(draft ? "copy" : "file")}</div><h3>${draft ? "Draft Anda akan tampil di sini" : "Karya Anda akan tampil di sini"}</h3><p>Tabel, data contoh, pencarian, dan filter<br>direncanakan di fase 5.</p>${draft ? "<small>Penyimpanan draft direncanakan di fase 4.</small>" : ""}</div></td></tr></tbody></table></div></section>`;
}

function plannedPage() {
  return `<div class="page-heading"><div><div class="eyebrow">LAYANAN KARYA</div><h1>${escape(pages[route()])}</h1><p>Ruang layanan untuk kebutuhan hak cipta Anda.</p></div>${badge(5)}</div><section class="card planned-page"><span class="large-icon">${icon(route() === "musik" ? "music" : "shield")}</span><span class="eyebrow">RUANG UNTUK LANGKAH BERIKUTNYA</span><h2>Sedang kami persiapkan</h2><p>Layanan ${escape(pages[route()])} akan tersedia<br>pada tahap pengembangan berikutnya.</p>${badge(5)}<a class="text-link" href="#/roadmap">Lihat tahapan pengembangan ${icon("arrow")}</a></section>`;
}

function roadmap() {
  const phases = [
    [
      "Fondasi & alur utama",
      "Login demo, navigasi, dashboard, dan struktur formulir tiga langkah.",
    ],
    [
      "Perilaku formulir",
      "Validasi wajib, opsi dropdown lengkap, pemilih tanggal, persistensi progres, dan simulasi draft.",
    ],
    [
      "Pencipta & pemegang hak",
      "Data kuasa, tabel pencipta dan pemegang hak, modal data badan hukum, identitas dan alamat, serta tambah, ubah, hapus data.",
    ],
    [
      "Lampiran & pengiriman",
      "Upload atau link dokumen, simpan draft, konfirmasi pengiriman, dan status berhasil.",
    ],
    [
      "Penyempurnaan & data demo",
      "Detail dashboard, tabel contoh, pencarian, filter, layanan lanjutan, serta penyempurnaan responsivitas dan aksesibilitas.",
    ],
  ];
  return `<div class="page-heading"><div><div class="eyebrow">DIBANGUN SELANGKAH DEMI SELANGKAH</div><h1>Tahapan Pengembangan</h1><p>Transparan tentang yang tersedia dan yang sedang direncanakan.</p></div><span class="demo-pill"><span></span> Fase 1 dari 5</span></div><div class="roadmap-list">${phases.map(([title, desc], i) => `<section class="card roadmap-item"><span class="roadmap-number ${i === 0 ? "done" : ""}">${i === 0 ? icon("check") : "0" + (i + 1)}</span><div><h2>${title}</h2><p>${desc}</p></div>${i === 0 ? '<span class="available-tag">Tersedia sekarang</span>' : badge(i + 1)}</section>`).join("")}</div>`;
}

function login() {
  return `<div class="login-page"><section class="login-story"><a class="brand" href="#/login">${logo}</a><div class="login-story-content"><span class="hero-eyebrow">UNTUK IDE YANG MENJADI NYATA</span><h1>Karya Anda.<br>Cerita Anda.<br><span>Hak Anda.</span></h1><p>Setiap gagasan layak mendapat ruang.<br>Setiap karya layak mendapat perlindungan.</p>${art()}<div class="login-story-caption">${icon("shield")} Ruang baru untuk perjalanan kreatif Anda.</div></div><div class="login-story-footer">© ${new Date().getFullYear()} Sapatri <span>Portal Inovasi dan Hak Cipta</span></div></section><section class="login-form-side"><div class="login-top"><span>Belum punya akun?</span><button data-action="register" class="text-link">Buat akun ${icon("arrow")}</button></div><div class="login-form-container"><span class="login-welcome">SELAMAT DATANG DI SAPATRI</span><h2>Ruang karya Anda<br>menunggu.</h2><p>Masuk untuk mulai perjalanan melindungi karya.</p><form id="login-form"><div class="form-field"><label for="email">Alamat email</label><div class="input-with-icon">${icon("mail")}<input id="email" type="email" name="email" autocomplete="username" placeholder="nama@email.com" required /></div></div><div class="form-field"><label for="password">Kata sandi</label><div class="input-with-icon">${icon("lock")}<input id="password" type="password" name="password" autocomplete="current-password" placeholder="Masukkan kata sandi" required /><button type="button" class="password-toggle" data-action="password" aria-label="Tampilkan kata sandi" aria-pressed="false">${icon("eye")}</button></div></div><div class="login-options"><span>${icon("lock")} Sesi demo lokal</span><button type="button" data-action="forgot" class="text-link">Lupa kata sandi?</button></div><button type="submit" class="button primary login-submit">Masuk ${icon("arrow")}</button></form><div class="login-divider"><span>atau lanjutkan dengan</span></div><button class="button secondary sso-button" data-action="sso">${icon("shield")} Masuk dengan SSO <span>Segera</span></button><p class="verification-text">Belum menerima email verifikasi? <button class="text-link" data-action="verify">Kirim ulang</button></p><div class="demo-box"><span class="section-icon">${icon("spark")}</span><div><strong>Jelajahi tanpa akun</strong><p>Lihat sebaran inovasi dan ringkasan data Kota Bekasi.</p></div><button data-action="demo" class="text-link">Coba demo ${icon("arrow")}</button></div><p class="login-disclaimer">Login menggunakan email berformat valid dan kata sandi apa pun.<br>Gunakan data contoh, bukan kata sandi asli.</p></div><button class="login-help" data-action="help">${icon("help")} Perlu bantuan? <strong>Hubungi helpdesk</strong>${icon("arrow")}</button></section></div>`;
}

function modal(title: string, content: string) {
  document.querySelector("dialog")?.remove();
  const opener = document.activeElement as HTMLElement;
  const dialog = document.createElement("dialog");
  dialog.className = "modal";
  dialog.setAttribute("aria-labelledby", "modal-title");
  dialog.innerHTML = `<div class="modal-header"><span class="section-icon">${icon("info")}</span><button class="icon-button" aria-label="Tutup" data-close>${icon("close")}</button></div><h2 id="modal-title">${title}</h2><div class="modal-content">${content}</div><button class="button primary" data-close>Mengerti ${icon("check")}</button>`;
  document.body.append(dialog);
  dialog
    .querySelectorAll("[data-close]")
    .forEach((button) =>
      button.addEventListener("click", () => dialog.close()),
    );
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) {
      const r = dialog.getBoundingClientRect();
      if (
        e.clientX < r.left ||
        e.clientX > r.right ||
        e.clientY < r.top ||
        e.clientY > r.bottom
      )
        dialog.close();
    }
  });
  dialog.addEventListener("close", () => {
    dialog.remove();
    opener?.focus();
  });
  dialog.showModal();
}

function render() {
  disposeDashboard?.();
  disposeDashboard = undefined;
  let page = route();
  if (!authenticated && !["login", "dashboard", "ciptaan"].includes(page)) {
    location.hash = "/login";
    return;
  }
  if (authenticated && page === "login") {
    location.hash = "/dashboard";
    return;
  }
  document.title = `${page === "login" ? "Masuk" : pages[page] || "Halaman tidak ditemukan"} — Sapatri`;
  const content =
    page === "dashboard"
      ? dashboard()
      : page === "baru"
        ? newApplication()
        : page === "ciptaan" || page === "draft"
          ? page === "ciptaan" ? dashboardTemplate(true) : tablePage(true)
          : page === "roadmap"
            ? roadmap()
            : pages[page]
              ? plannedPage()
              : `<section class="card planned-page"><h1>Halaman tidak ditemukan</h1><a class="button primary" href="#/dashboard">Kembali ke Dashboard</a></section>`;
  app.innerHTML = `<a class="skip-link" href="#main-content">Lewati ke konten</a>${page === "login" ? login() : shell(content)}`;
  if (page === "dashboard" || page === "ciptaan") disposeDashboard = mountDashboard();
  document
    .querySelectorAll<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >("[data-field]")
    .forEach((input) =>
      input.addEventListener("input", () => {
        fields[input.dataset.field!] = input.value;
      }),
    );
  document.querySelector("#login-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    signIn();
  });
  document
    .querySelectorAll<HTMLButtonElement>("[data-step]")
    .forEach((button) =>
      button.addEventListener("click", () => {
        step = Number(button.dataset.step);
        render();
        focusStep();
      }),
    );
  document.querySelector(".skip-link")?.addEventListener("click", (e) => {
    e.preventDefault();
    (
      document.querySelector("#main-content") ||
      document.querySelector("#email")
    )?.scrollIntoView();
    (
      document.querySelector<HTMLElement>("#main-content") ||
      document.querySelector<HTMLElement>("#email")
    )?.focus();
  });
}

function signIn() {
  authenticated = true;
  sessionStorage.setItem("sapatri-demo", "true");
  location.hash = "/dashboard";
}
function focusStep() {
  const heading = document.querySelector<HTMLElement>(
    ".form-section-heading h2",
  );
  if (heading) {
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
  }
}

document.addEventListener("click", (event) => {
  const button = (event.target as HTMLElement).closest<HTMLElement>(
    "[data-action]",
  );
  if (!button) return;
  const action = button.dataset.action;
  if (action === "demo") signIn();
  else if (action === "collapse") {
    collapsed = !collapsed;
    render();
  } else if (action === "menu" || action === "close-menu") {
    mobileOpen = action === "menu";
    render();
  } else if (action === "copyright") {
    if (collapsed) collapsed = false;
    copyrightOpen = !copyrightOpen;
    render();
  } else if (action === "profile") {
    userMenuOpen = !userMenuOpen;
    render();
  } else if (action === "logout") {
    authenticated = false;
    sessionStorage.removeItem("sapatri-demo");
    Object.keys(fields).forEach((key) => delete fields[key]);
    step = 1;
    userMenuOpen = false;
    location.hash = "/login";
  } else if (action === "next" || action === "previous") {
    step = Math.max(1, Math.min(3, step + (action === "next" ? 1 : -1)));
    render();
    focusStep();
  } else if (action === "password") {
    const input = document.querySelector<HTMLInputElement>("#password")!;
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    button.setAttribute(
      "aria-label",
      show ? "Sembunyikan kata sandi" : "Tampilkan kata sandi",
    );
    button.setAttribute("aria-pressed", String(show));
  } else if (action === "draft")
    modal(
      "Penyimpanan draft akan hadir",
      `<p>Fase 1 menampilkan alur formulir. Permohonan ini belum disimpan sebagai draft.</p><div class="modal-plan">${badge(2)}<p>Simulasi penyimpanan dan notifikasi.</p>${badge(4)}<p>Penyimpanan draft dalam alur permohonan lengkap.</p></div><p class="muted">Isian hanya tersedia selama halaman ini terbuka dan akan hilang saat dimuat ulang.</p>`,
    );
  else if (action === "letter" || action === "transfer")
    modal(
      action === "letter" ? "Surat Pernyataan" : "Surat Pengalihan Hak",
      `<p>Unduhan templat dokumen akan tersedia bersama fitur lampiran. Belum ada dokumen yang diunduh.</p>${badge(4)}`,
    );
  else if (action === "notifications")
    modal(
      "Belum ada notifikasi",
      `<p>Aktivitas dan pembaruan status permohonan akan tampil di sini pada pengembangan berikutnya.</p>${badge(5)}`,
    );
  else if (action === "help")
    modal(
      "Halo, kami siap membantu.",
      `<p>Ini adalah Sapatri, portal inovasi dan hak cipta Kota Bekasi. Jelajahi dashboard, pilih <strong>Permohonan Baru</strong>, dan coba tiga langkah formulir.</p><div class="help-detail">${icon("clock")} Helpdesk dan kontak layanan<br><strong>Direncanakan di fase 5</strong></div><p class="muted">Belum ada layanan kontak aktif pada prototipe lokal.</p>`,
    );
  else if (action === "guide")
    modal(
      "Mulai dari sebuah karya",
      `<ol class="guide-list"><li><strong>Detail permohonan</strong><p>Kenalkan jenis, judul, dan uraian karya.</p></li><li><strong>Pencipta dan pemegang hak</strong><p>Pengelolaan identitas direncanakan di fase 3.</p></li><li><strong>Lampiran dan pengiriman</strong><p>Dokumen pendukung dan pengajuan direncanakan di fase 4.</p></li></ol><p>Validasi formulir direncanakan di fase 2. Dashboard feeder tersedia dengan peta dan filter kecamatan.</p>`,
    );
  else if (["sso", "forgot", "verify", "register"].includes(action || ""))
    modal(
      (
        {
          sso: "Masuk dengan SSO",
          forgot: "Pulihkan kata sandi",
          verify: "Kirim ulang verifikasi",
          register: "Buat akun Sapatri",
        } as Record<string, string>
      )[action!],
      `<p>Prototipe ini menggunakan login simulasi. Integrasi akun dan layanan autentikasi tidak termasuk implementasi fase 1–5.</p><p>Tampilan layanan lanjutan: <strong>Direncanakan di fase 5.</strong> Aktivasi autentikasi memerlukan fase backend terpisah.</p><p class="muted">Gunakan “Coba demo” untuk menjelajahi aplikasi. Tidak ada email yang dikirim.</p>`,
    );
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && (mobileOpen || userMenuOpen)) {
    mobileOpen = false;
    userMenuOpen = false;
    render();
  }
});
window.addEventListener("hashchange", () => {
  mobileOpen = false;
  userMenuOpen = false;
  render();
  window.scrollTo(0, 0);
});
render();
