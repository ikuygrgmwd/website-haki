import { api, state, refreshSession, type Slide, type About } from './portal-api';
import { esc, fileUrl, field, button, heading, formMessage, bindForm, toast } from './portal-ui';
import { workList, workDetail, workEditor, profile } from './work-views';
import { usersPage, regionsPage, permissions, carouselPage, aboutPage, aftercarePage } from './admin-views';
import { dashboardTemplate, mountDashboard } from './dashboard';
import './portal.css';

const app = document.querySelector<HTMLDivElement>('#app')!;
const logo = '<span class="brand-mark">s<span>·</span></span><span class="brand-word">Sapatri<span>INOVASI & HAK CIPTA</span></span>';
let dispose: (() => void) | undefined;
let renderVersion = 0;
const names: Record<string, string> = { dashboard: 'Dashboard', ciptaan: 'Daftar Ciptaan', baru: 'Permohonan Baru', edit: 'Edit Ciptaan', pasca: 'Pasca Hak Cipta', terkait: 'Hak Terkait', 'pasca-terkait': 'Pasca Hak Terkait', profil: 'Profil', pengguna: 'Manajemen Pengguna', 'hak-akses': 'Hak Akses', master: 'Master Data', landing: 'Landing Page', beranda: 'Beranda' };
function shell(page: string, path: string) {
  const u = state.user;
  const nav = (route: string, label: string, mark = '○') => `<a class="nav-item ${path === route || (route === 'ciptaan' && page === 'edit') ? 'active' : ''}" href="#/${route}" ${path === route ? 'aria-current="page"' : ''}><span class="nav-glyph" aria-hidden="true">${mark}</span><span>${label}</span></a>`;
  const group = (label: string, links: string, open = false) => `<details class="nav-group" ${open ? 'open' : ''}><summary>${label}<span>⌄</span></summary><div class="subnav">${links}</div></details>`;
  return `<a class="skip-link" href="#main-content">Lewati ke konten</a><button class="sidebar-backdrop" aria-label="Tutup navigasi"></button><aside class="sidebar"><a class="brand" href="#/beranda">${logo}</a><div class="workspace"><span class="workspace-icon">${u?.role === 'Admin' ? 'AD' : 'US'}</span><span>${u ? `Akun ${u.role}` : 'Portal publik'}<small>${u ? esc(u.name) : 'Inovasi Kota Bekasi'}</small></span></div><div class="nav-label">MENU UTAMA</div><nav aria-label="Navigasi utama">${nav('dashboard', 'Dashboard', '▦')}${group('Hak Cipta', `${nav('baru', 'Permohonan Baru', '+')}${nav('ciptaan', 'Daftar Ciptaan', '▤')}`, ['baru', 'ciptaan', 'edit'].includes(page))}${nav('pasca', 'Pasca Hak Cipta', '↗')}${nav('terkait', 'Hak Terkait', '▱')}${nav('pasca-terkait', 'Pasca Hak Terkait', '↗')}${nav('profil', 'Profil', '◎')}${u?.role === 'Admin' ? `<div class="nav-label">PENGATURAN</div>${group('Master Data', ['provinsi', 'kota', 'kecamatan', 'kelurahan'].map(l => nav(`master/${l}`, l.charAt(0).toUpperCase() + l.slice(1))).join(''), page === 'master')}${nav('pengguna', 'Manajemen Pengguna', '♧')}${nav('hak-akses', 'Hak Akses', '◇')}${group('Landing Page', `${nav('landing/carousel', 'Carousel')}${nav('landing/tentang', 'Tentang HAKI')}`, page === 'landing')}` : ''}</nav><div class="sidebar-bottom"><a class="build-status" href="#/beranda">Halaman depan <span>↗</span></a></div></aside><div class="main-shell"><header class="topbar"><div class="breadcrumbs"><button class="mobile-menu icon-button" id="toggle-menu" aria-label="Buka navigasi">☰</button><span>Portal Sapatri</span><span>›</span><span>${esc(names[page] || 'Halaman')}${page === 'master' || page === 'landing' ? ` › ${esc(path.split('/')[1])}` : ''}</span></div><div class="topbar-actions">${u ? `<a class="profile" href="#/profil"><span class="avatar">${u.photoId ? `<img src="${fileUrl(u.photoId)}" alt="Foto profil">` : esc(u.name.slice(0, 2).toUpperCase())}</span><span class="profile-text">${esc(u.name)}<small>${u.role}</small></span></a>${button('Keluar', 'id="logout"')}` : '<a class="button primary" href="#/login">Masuk</a>'}</div></header><main id="main-content" tabindex="-1"><p role="status" class="dashboard-status">Memuat halaman…</p></main><footer class="footer"><span>© ${new Date().getFullYear()} Sapatri</span><span>Portal Inovasi dan Hak Cipta Kota Bekasi</span></footer></div>`;
}
function authPage(reset = false) {
  const setup = state.setup && !reset;
  app.innerHTML = `<div class="login-page"><section class="login-story"><a class="brand" href="#/beranda">${logo}</a><div class="login-story-content"><span class="hero-eyebrow">UNTUK IDE YANG MENJADI NYATA</span><h1>Karya Anda.<br>Cerita Anda.<br><span>Hak Anda.</span></h1><p>Satu ruang untuk mengembangkan, mengajukan, dan memantau karya.</p></div><div class="login-story-footer">Portal Inovasi dan Hak Cipta Kota Bekasi</div></section><section class="login-form-side"><div class="login-form-container"><div class="eyebrow">SELAMAT DATANG DI SAPATRI</div><h2>${reset ? 'Atur Password Baru' : setup ? 'Siapkan Admin Pertama' : 'Masuk ke Akun Anda'}</h2><p>${reset ? 'Tautan reset hanya berlaku sekali selama 15 menit.' : setup ? 'Gunakan kode penyiapan yang ditampilkan di terminal server.' : 'Gunakan akun yang telah diberikan oleh Admin.'}</p><form id="auth-form">${setup ? `${field('token', 'Kode penyiapan', '', 'password', 'required autocomplete="off"')}${field('name', 'Nama lengkap', '', 'text', 'required')}` : ''}${!reset ? field('email', 'Email', '', 'email', 'required autocomplete="username"') : ''}${field('password', reset ? 'Password baru' : 'Password', '', 'password', `required ${reset || setup ? 'minlength="10" autocomplete="new-password"' : 'autocomplete="current-password"'}`)}${reset ? field('confirm', 'Konfirmasi password baru', '', 'password', 'required minlength="10" autocomplete="new-password"') : ''}<label class="check-field"><input id="auth-show" type="checkbox">Tampilkan password</label>${formMessage}${button(reset ? 'Perbarui Password' : setup ? 'Buat Admin' : 'Masuk', 'type="submit"', true)}</form><p>${!setup && !reset ? 'Lupa password? Hubungi Admin untuk mendapatkan tautan reset.' : ''}</p><a href="#/dashboard" class="text-link">Lihat dashboard publik →</a></div></section></div>`;
  document.querySelector<HTMLInputElement>('#auth-show')!.onchange = e => document.querySelectorAll<HTMLInputElement>('#password,#confirm').forEach(i => i.type = (e.target as HTMLInputElement).checked ? 'text' : 'password');
  bindForm(document.querySelector('#auth-form')!, async b => {
    if (reset) { const params = new URLSearchParams(location.hash.split('?')[1]); await api('/reset-password', 'POST', { ...b, token: params.get('token') }); history.replaceState(null, '', '#/login'); await render(); toast('Password diperbarui. Silakan masuk.'); }
    else if (setup) { await api('/setup', 'POST', b); state.setup = false; authPage(); toast('Admin berhasil dibuat. Silakan masuk.'); }
    else { await api('/login', 'POST', b); await refreshSession(); location.hash = '#/ciptaan'; }
  });
}
async function landing(root: HTMLElement) {
  const content = await api<{ slides: Slide[]; about: About | null }>('/landing');
  const slides = content.slides; let selected = 0;
  root.innerHTML = `<div class="landing-intro"><span class="eyebrow">SAPATRI / KOTA BEKASI</span><h1>Ruang tumbuh<br>untuk setiap <span class="coral">karya.</span></h1><p>Jelajahi inovasi dan mulai perjalanan karya Anda.</p><div class="row-actions"><a class="button primary" href="#/baru">Ajukan Ciptaan →</a><a class="button secondary" href="#/dashboard">Jelajahi Inovasi</a></div></div>${slides.length ? '<section id="public-carousel" class="card public-carousel" aria-label="Informasi pilihan"></section>' : ''}${content.about ? `<section class="card detail-card public-about"><div>${content.about.imageId ? `<img src="${fileUrl(content.about.imageId)}" alt="${esc(content.about.title)}">` : ''}</div><article><h2>${esc(content.about.title)}</h2>${content.about.html || ''}</article></section>` : ''}`;
  const paint = () => { const s = slides[selected]; root.querySelector('#public-carousel')!.innerHTML = `<img src="${fileUrl(s.imageId)}" alt="${esc(s.title)}"><div><span class="eyebrow">INFORMASI PILIHAN</span><h2>${esc(s.title)}</h2><p>${esc(s.description)}</p>${s.buttonText ? `<a class="button primary" href="${esc(s.url)}">${esc(s.buttonText)}</a>` : ''}<div class="carousel-dots">${slides.map((_, i) => `<button aria-label="Slide ${i + 1}" aria-pressed="${i === selected}" data-slide="${i}">${i + 1}</button>`).join('')}</div></div>`; root.querySelectorAll<HTMLButtonElement>('[data-slide]').forEach(b => b.onclick = () => { selected = Number(b.dataset.slide); paint(); }); }; if (slides.length) paint();
}
export async function render() {
  const version = ++renderVersion; dispose?.(); dispose = undefined; document.querySelector('#portal-dialog')?.remove();
  const raw = location.hash.replace(/^#\/?/, '') || 'dashboard'; const [path, query] = raw.split('?'); const [page, id] = path.split('/'); const params = new URLSearchParams(query);
  if (['draft', 'ciptaan-draft'].includes(page)) { location.replace('#/ciptaan?status=Draft'); return; }
  if (page === 'musik' || page === 'lagu') { location.replace('#/dashboard'); return; }
  document.title = `${names[page] || 'Akun'} — Sapatri`;
  try {
    if (!['dashboard', 'beranda', 'login', 'reset'].includes(page)) await refreshSession();
    if (version !== renderVersion) return;
    if (['login', 'reset'].includes(page)) { authPage(page === 'reset'); return; }
    if (!state.user && !['dashboard', 'beranda'].includes(page)) { location.hash = '#/login'; return; }
    app.innerHTML = shell(page, path); const root = document.querySelector<HTMLElement>('#main-content')!;
    document.querySelector('#toggle-menu')?.addEventListener('click', () => { document.querySelector('.sidebar')?.classList.toggle('mobile-open'); document.querySelector('.sidebar-backdrop')?.classList.toggle('visible'); });
    document.querySelector('.sidebar-backdrop')?.addEventListener('click', () => { document.querySelector('.sidebar')?.classList.remove('mobile-open'); document.querySelector('.sidebar-backdrop')?.classList.remove('visible'); });
    document.querySelector('#logout')?.addEventListener('click', async () => { try { await api('/logout', 'POST', {}); state.user = null; state.csrf = ''; state.regions = []; location.hash = '#/login'; } catch (e) { toast((e as Error).message, true); } });
    if (['master', 'pengguna', 'hak-akses', 'landing'].includes(page) && state.user?.role !== 'Admin') throw new Error('Halaman ini hanya dapat diakses Admin.');
    if (page === 'dashboard') { root.innerHTML = dashboardTemplate(); dispose = mountDashboard(); }
    else if (page === 'beranda') await landing(root);
    else if (page === 'ciptaan' && id) { await workDetail(root, id); if (params.has('status')) root.querySelector('#status-editor')?.scrollIntoView({ behavior: 'smooth' }); }
    else if (page === 'ciptaan') await workList(root, false, params.get('status') || '');
    else if (page === 'terkait') await workList(root, true);
    else if (page === 'baru' || page === 'edit') await workEditor(root, page === 'edit' ? id : undefined, params.get('jenis') === 'terkait');
    else if (page === 'profil') await profile(root, render);
    else if (page === 'pengguna') await usersPage(root);
    else if (page === 'hak-akses') permissions(root);
    else if (page === 'master') await regionsPage(root, id, params.get('parent') || '');
    else if (page === 'landing' && id === 'carousel') await carouselPage(root);
    else if (page === 'landing' && id === 'tentang') await aboutPage(root);
    else if (page === 'pasca' || page === 'pasca-terkait') await aftercarePage(root, page === 'pasca-terkait');
    else throw new Error('Halaman tidak ditemukan.');
  } catch (error) {
    if (version !== renderVersion) return;
    const target = document.querySelector('#main-content') || app;
    target.innerHTML = `${heading('Halaman belum tersedia', (error as Error).message)}${button('Coba Lagi', 'id="retry-page"')} <a class="button secondary" href="#/dashboard">Ke Dashboard</a>`;
    document.querySelector('#retry-page')?.addEventListener('click', () => void start());
  }
}
export async function start() {
  try { await refreshSession(); await render(); } catch (e) { app.innerHTML = `<div class="startup-error">${heading('Server belum tersedia', (e as Error).message)}<p>Jalankan npm run dev untuk memulai aplikasi dan server.</p>${button('Coba Lagi', 'id="retry-start"')}</div>`; document.querySelector('#retry-start')?.addEventListener('click', () => void start()); }
}
window.addEventListener('hashchange', () => void render());
