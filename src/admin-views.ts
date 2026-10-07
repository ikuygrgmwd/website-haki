import { api, state, upload, type User, type Region, type Slide, type About, type Care, type CareData, type Work } from './portal-api';
import { esc, date, fileUrl, field, area, select, check, button, heading, formMessage, bindForm, bindRegions, regionFields, table, toast, dialog } from './portal-ui';

export async function usersPage(root: HTMLElement) {
  const rows = await api<User[]>('/users');
  root.innerHTML = heading('Manajemen Pengguna', 'Kelola akun dan akses Admin atau User.', button('+ Tambah Pengguna', 'id="add-user"', true)) + '<section class="card" id="users-table"></section>';
  const edit = (u?: User) => {
    const d = dialog(u ? 'Edit Pengguna' : 'Tambah Pengguna', `<form>${field('name', 'Nama lengkap', u?.name, 'text', 'required')}${field('email', 'Email', u?.email, 'email', 'required')}${select('role', 'Role', ['User', 'Admin'], u?.role || 'User')}${!u ? field('password', 'Password awal', '', 'password', 'required minlength="10" autocomplete="new-password"') : ''}${check('active', 'Akun aktif', u?.active ?? true)}${formMessage}${button('Simpan', 'type="submit"', true)}</form>`);
    bindForm(d.querySelector('form')!, async b => { await api(u ? `/users/${u.id}` : '/users', u ? 'PUT' : 'POST', { ...b, active: b.active === 'on' }); d.close(); await usersPage(root); toast('Pengguna disimpan.'); });
  };
  table(root.querySelector('#users-table')!, rows, [
    { label: 'Nama', html: r => `<strong>${esc(r.name)}</strong>`, sort: r => r.name }, { label: 'Email', html: r => esc(r.email), sort: r => r.email },
    { label: 'Role', html: r => esc(r.role) }, { label: 'Status', html: r => r.active ? 'Aktif' : 'Nonaktif' },
    { label: 'Aksi', html: r => `<div class="row-actions">${button('Edit', `data-user="${r.id}"`)}${button('Reset Password', `data-reset="${r.id}"`)}</div>` },
  ], r => `${r.name} ${r.email}`, [{ name: 'role-filter', label: 'Role', items: ['Admin', 'User'], match: (r, v) => r.role === v }, { name: 'active-filter', label: 'Status', items: ['Aktif', 'Nonaktif'], match: (r, v) => r.active === (v === 'Aktif') }], () => {
    root.querySelectorAll<HTMLButtonElement>('[data-user]').forEach(b => b.onclick = () => edit(rows.find(r => r.id === b.dataset.user)));
    root.querySelectorAll<HTMLButtonElement>('[data-reset]').forEach(b => b.onclick = async () => { if (!confirm('Buat tautan reset dan akhiri semua sesi pengguna ini?')) return; try { const r = await api<{ token: string; message: string }>(`/users/${b.dataset.reset}/reset`, 'POST', {}); dialog('Tautan Reset Password', `<p>${esc(r.message)}</p>${field('reset-link', 'Tautan pribadi', `${location.origin}/#/reset?token=${r.token}`, 'text', 'readonly')}<p>Tautan hanya ditampilkan pada dialog ini. Tidak ada email yang dikirim otomatis.</p>`); } catch (e) { toast((e as Error).message, true); } });
  });
  root.querySelector<HTMLButtonElement>('#add-user')!.onclick = () => edit();
}

export async function regionsPage(root: HTMLElement, level: string, initialParent = '') {
  const levels = ['provinsi', 'kota', 'kecamatan', 'kelurahan']; if (!levels.includes(level)) throw new Error('Halaman wilayah tidak ditemukan.');
  state.regions = await api<Region[]>('/regions'); const index = levels.indexOf(level), label = level.charAt(0).toUpperCase() + level.slice(1);
  const rows = state.regions.filter(r => r.level === level);
  root.innerHTML = heading(label, 'Data wilayah untuk domisili dan formulir pengajuan.', button(`+ Tambah ${label}`, 'id="add-region"', true)) + (level === 'kelurahan' ? '<p class="inline-notice">Kode BIG: adalah ID sumber geografis, bukan kode administratif kelurahan. Admin dapat menggantinya setelah verifikasi.</p>' : '') + '<section class="card" id="regions-table"></section>';
  const edit = (r?: Region) => {
    const d = dialog(r ? `Edit ${label}` : `Tambah ${label}`, `<form>${index ? regionFields('master', null, null, index, r?.parent_id) : ''}${field('code', 'Kode / referensi wilayah', r?.code, 'text', 'required maxlength="40"')}${field('name', `Nama ${level}`, r?.name, 'text', 'required')}${check('active', 'Aktif', !!(r?.active ?? 1))}${formMessage}${button('Simpan', 'type="submit"', true)}</form>`);
    bindRegions(d); if (r) d.querySelectorAll<HTMLSelectElement>('.region-fields select').forEach(s => s.disabled = true);
    bindForm(d.querySelector('form')!, async b => { await api(r ? `/regions/${r.id}` : '/regions', r ? 'PUT' : 'POST', { ...b, level, parentId: r?.parent_id || b[`master-${levels[index - 1]}`] || null, active: b.active === 'on' }); d.close(); await regionsPage(root, level, initialParent); toast('Wilayah disimpan.'); });
  };
  table(root.querySelector('#regions-table')!, rows, [
    { label: 'Kode', html: r => esc(r.code), sort: r => r.code }, { label: 'Nama', html: r => `<strong>${esc(r.name)}</strong>`, sort: r => r.name },
    { label: 'Wilayah Induk', html: r => esc(state.regions.find(p => p.id === r.parent_id)?.name || '—') },
    { label: 'Status', html: r => r.active ? 'Aktif' : 'Nonaktif' },
    { label: 'Aksi', html: r => `<div class="row-actions">${button('Edit', `data-region="${r.id}"`)}${button('Hapus', `data-delete-region="${r.id}"`)}${index < 3 ? `<a class="action-link" href="#/master/${levels[index + 1]}?parent=${encodeURIComponent(r.id)}">Lihat ${levels[index + 1]}</a>` : ''}</div>` },
  ], r => `${r.name} ${r.code}`, index ? [{ name: 'parent-filter', label: `Filter ${levels[index - 1]}`, items: state.regions.filter(r => r.level === levels[index - 1]).map(r => r.name), value: state.regions.find(r => r.id === initialParent)?.name || '', match: (r, v) => state.regions.find(x => x.id === r.parent_id)?.name === v }] : [], () => {
    root.querySelectorAll<HTMLButtonElement>('[data-region]').forEach(b => b.onclick = () => edit(rows.find(r => r.id === b.dataset.region)));
    root.querySelectorAll<HTMLButtonElement>('[data-delete-region]').forEach(b => b.onclick = async () => { if (!confirm('Hapus wilayah ini? Data yang sedang dipakai tidak dapat dihapus.')) return; try { await api(`/regions/${b.dataset.deleteRegion}`, 'DELETE'); await regionsPage(root, level, initialParent); toast('Wilayah dihapus.'); } catch (e) { toast((e as Error).message, true); } });
  });
  root.querySelector<HTMLButtonElement>('#add-region')!.onclick = () => edit();
}

export function permissions(root: HTMLElement) {
  const rows = [ ['Daftar Ciptaan & Hak Terkait', 'Lihat dan kelola seluruh akun', 'Tambah, lihat, edit, hapus data sendiri'], ['Status pengajuan', 'Kelola alur status', 'Simpan draft dan ajukan data sendiri'], ['Sertifikat', 'Unggah dan kelola', 'Lihat sertifikat ciptaan sendiri'], ['Pasca Hak Cipta / Hak Terkait', 'Tambah, lihat, edit, hapus', 'Lihat data terkait ciptaan sendiri'], ['Master Data', 'Tambah, lihat, edit, hapus/nonaktifkan', 'Pilihan pada formulir'], ['Manajemen Pengguna', 'Kelola akun dan reset password', 'Tidak tersedia'], ['Landing Page', 'Kelola dan terbitkan konten', 'Lihat halaman publik'], ['Profil & Password', 'Kelola profil sendiri', 'Kelola profil sendiri'] ];
  root.innerHTML = heading('Hak Akses', 'Dua role tetap dengan pembatasan kepemilikan data.') + `<section class="card"><div class="table-scroll"><table class="data-table"><thead><tr><th>Fitur</th><th>Admin</th><th>User</th></tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></section>`;
}

export async function carouselPage(root: HTMLElement) {
  const content = await api<{ slides: Slide[] }>('/content'); let slides = content.slides;
  const save = async () => { slides = await api<Slide[]>('/content/carousel', 'PUT', { slides }); toast('Carousel disimpan.'); };
  const edit = (index = -1) => {
    const s = slides[index]; let imageId = s?.imageId || '';
    const d = dialog(s ? 'Edit Slide' : 'Tambah Slide', `<form>${field('title', 'Judul slide', s?.title, 'text', 'required maxlength="100"')}${area('description', 'Teks singkat', s?.description)}${field('buttonText', 'Teks tombol', s?.buttonText)}${field('url', 'Tautan tombol', s?.url, 'text', 'placeholder="https://… atau #/…"')}${field('slide-image', 'Gambar (maksimal 2 MB)', '', 'file', 'accept="image/png,image/jpeg,image/webp"')}${s?.imageId ? `<img class="content-thumbnail" src="${fileUrl(s.imageId)}" alt="Gambar slide">` : ''}${check('visible', 'Tampilkan di halaman depan', s?.visible ?? true)}${formMessage}${button('Simpan Slide', 'type="submit"', true)}</form>`);
    bindForm(d.querySelector('form')!, async b => { const f = d.querySelector<HTMLInputElement>('#slide-image')!.files?.[0]; if (f) imageId = (await upload(f, 'landing')).id; if (!imageId) throw new Error('Gambar slide wajib diunggah.'); const candidate: Slide = { id: s?.id || crypto.randomUUID(), title: b.title, description: b.description, buttonText: b.buttonText, url: b.url, visible: b.visible === 'on', imageId }; const previous = [...slides]; if (index === -1) slides.push(candidate); else slides[index] = candidate; try { await save(); } catch (e) { slides = previous; throw e; } d.close(); paint(); });
  };
  const paint = () => {
    root.innerHTML = heading('Carousel', 'Atur slide yang tampil pada halaman depan.', button('+ Tambah Slide', 'id="add-slide"', true)) + `<div class="two-columns"><section class="card detail-card">${slides.length ? slides.map((s, i) => `<article class="slide-row"><img src="${fileUrl(s.imageId)}" alt="${esc(s.title)}"><div><strong>${i + 1}. ${esc(s.title)}</strong><p>${esc(s.description)}</p><span class="status-label">${s.visible ? 'Tampil' : 'Disembunyikan'}</span><div class="row-actions">${button('Edit', `data-slide="${i}"`)}${button('Hapus', `data-delete-slide="${i}"`)}${button('↑', `data-up="${i}" aria-label="Naikkan slide ${i + 1}" ${i === 0 ? 'disabled' : ''}`)}${button('↓', `data-down="${i}" aria-label="Turunkan slide ${i + 1}" ${i === slides.length - 1 ? 'disabled' : ''}`)}</div></div></article>`).join('') : '<p>Belum ada slide. Tambahkan slide pertama.</p>'}</section><section class="card detail-card"><h2>Pratinjau Halaman Depan</h2>${slides.filter(s => s.visible).slice(0, 1).map(s => `<img class="landing-preview" src="${fileUrl(s.imageId)}" alt="${esc(s.title)}"><h3>${esc(s.title)}</h3><p>${esc(s.description)}</p>${s.buttonText ? `<span class="button primary">${esc(s.buttonText)}</span>` : ''}`).join('') || '<p>Tidak ada slide yang ditampilkan.</p>'}<p><a href="#/beranda">Buka halaman depan →</a></p></section></div>`;
    root.querySelector<HTMLButtonElement>('#add-slide')!.onclick = () => edit();
    root.querySelectorAll<HTMLButtonElement>('[data-slide]').forEach(b => b.onclick = () => edit(Number(b.dataset.slide)));
    root.querySelectorAll<HTMLButtonElement>('[data-delete-slide],[data-up],[data-down]').forEach(b => b.onclick = async () => {
      const before = [...slides]; if (b.dataset.deleteSlide !== undefined) { if (!confirm('Hapus slide ini?')) return; slides.splice(Number(b.dataset.deleteSlide), 1); }
      else { const i = Number(b.dataset.up ?? b.dataset.down); const j = i + (b.dataset.up !== undefined ? -1 : 1); [slides[i], slides[j]] = [slides[j], slides[i]]; }
      try { await save(); paint(); } catch (e) { slides = before; toast((e as Error).message, true); }
    });
  }; paint();
}

export async function aboutPage(root: HTMLElement) {
  const { about } = await api<{ about: About }>('/content'); let imageId = about.imageId || null;
  root.innerHTML = heading('Tentang HAKI', 'Kelola isi halaman informasi yang tampil di halaman depan.') + `<form id="about-form" class="card detail-card">${field('title', 'Judul halaman', about.title, 'text', 'required')}<label id="editor-label">Isi halaman</label><div class="editor-toolbar">${[['bold', 'Tebal'], ['italic', 'Miring'], ['underline', 'Garis bawah'], ['insertUnorderedList', 'Daftar poin'], ['insertOrderedList', 'Daftar nomor']].map(([cmd, name]) => button(name, `type="button" data-format="${cmd}"`)).join('')}${button('Tautan', 'type="button" id="insert-link"')}</div><div id="about-editor" class="rich-editor" contenteditable="true" role="textbox" aria-multiline="true" aria-labelledby="editor-label">${about.html || ''}</div>${field('about-image', 'Gambar pendukung (maksimal 2 MB)', '', 'file', 'accept="image/png,image/jpeg,image/webp"')}<div id="about-image-current">${imageId ? `<img class="content-thumbnail" src="${fileUrl(imageId)}" alt="Gambar pendukung">${button('Hapus Gambar', 'type="button" id="remove-about-image"')}` : ''}</div>${check('visible', 'Tampilkan di halaman depan', about.visible ?? true)}<p>Terakhir diubah: ${date(about.updatedAt)} ${esc(about.updatedBy || '')}</p>${formMessage}<div class="row-actions">${button('Pratinjau', 'type="button" id="preview-about"')}${button('Simpan', 'type="submit"', true)}</div></form>`;
  const editor = root.querySelector<HTMLElement>('#about-editor')!;
  editor.addEventListener('paste', e => { e.preventDefault(); document.execCommand('insertText', false, e.clipboardData?.getData('text/plain') || ''); });
  root.querySelectorAll<HTMLButtonElement>('[data-format]').forEach(b => { b.onmousedown = e => e.preventDefault(); b.onclick = () => { editor.focus(); document.execCommand(b.dataset.format!); }; });
  root.querySelector<HTMLButtonElement>('#insert-link')!.onmousedown = e => e.preventDefault();
  root.querySelector<HTMLButtonElement>('#insert-link')!.onclick = () => { const link = prompt('Masukkan tautan HTTPS:'); if (!link) return; if (!/^https:\/\/[^\s]+$/.test(link)) { toast('Tautan harus menggunakan HTTPS.', true); return; } editor.focus(); document.execCommand('createLink', false, link); };
  root.querySelector<HTMLButtonElement>('#remove-about-image')?.addEventListener('click', () => { imageId = null; root.querySelector('#about-image-current')!.innerHTML = ''; });
  root.querySelector<HTMLButtonElement>('#preview-about')!.onclick = () => { const d = dialog('Pratinjau Tentang HAKI', '<article id="about-preview"></article>'); const preview = d.querySelector('#about-preview')!; const title = document.createElement('h2'); title.textContent = root.querySelector<HTMLInputElement>('#title')!.value; preview.append(title); const clone = editor.cloneNode(true) as HTMLElement; clone.removeAttribute('id'); clone.removeAttribute('contenteditable'); preview.append(clone); };
  bindForm(root.querySelector('#about-form')!, async b => { const f = root.querySelector<HTMLInputElement>('#about-image')!.files?.[0]; if (f) imageId = (await upload(f, 'landing')).id; await api('/content/about', 'PUT', { title: b.title, html: editor.innerHTML, visible: b.visible === 'on', imageId }); await aboutPage(root); toast('Tentang HAKI disimpan.'); });
}

export async function aftercarePage(root: HTMLElement, related = false, selectedTab = 'Perorangan') {
  const records = (await api<Care[]>('/aftercare')).filter(r => r.innovation.kind === (related ? 'Hak Terkait' : 'Hak Cipta'));
  const isAdmin = state.user!.role === 'Admin';
  const edit = async (row?: Care) => {
    try {
      const works = (await api<Work[]>('/innovations')).filter(w => w.kind === (related ? 'Hak Terkait' : 'Hak Cipta') && w.status === 'Selesai');
      const v: CareData = row?.data || { participantType: selectedTab, name: '', groupType: 'Kelompok umum', university: '', members: '', districtId: null, program: 'Pelatihan', trainingStatus: 'Belum', startDate: '', endDate: '', product: '', description: '', photos: [] };
      let photos = [...v.photos];
      const d = dialog(row ? 'Edit Pembinaan' : 'Tambah Pembinaan', `<form><p>Jenis peserta: <strong>${esc(v.participantType)}</strong></p>${field('name', 'Nama peserta / kelompok / Posyantek', v.name, 'text', 'required')}${select('innovationId', 'Ciptaan terkait (status Selesai)', [{ value: '', label: 'Pilih ciptaan' }, ...works.map(w => ({ value: w.id, label: w.title }))], row?.innovation_id, 'required')}${v.participantType === 'Kelompok' ? `${select('groupType', 'Jenis kelompok', ['Kelompok umum', 'Tim mahasiswa'], v.groupType)}<div id="university-wrap">${field('university', 'Asal kampus', v.university)}</div>${area('members', 'Anggota dan peran (satu anggota per baris)', v.members)}` : ''}${v.participantType === 'Organisasi Posyantek' ? select('districtId', 'Kecamatan', [{ value: '', label: 'Pilih kecamatan' }, ...state.regions.filter(r => r.level === 'kecamatan' && r.active).map(r => ({ value: r.id, label: r.name }))], v.districtId, 'required') : ''}${select('program', 'Program', ['Pelatihan', 'Inkubasi Bisnis'], v.program)}${select('trainingStatus', 'Status pelatihan', ['Belum', 'Sudah'], v.trainingStatus)}<div class="form-grid">${field('startDate', 'Tanggal mulai', v.startDate, 'date')}${field('endDate', 'Tanggal selesai', v.endDate, 'date')}</div>${field('product', 'Hasil produk', v.product)}${area('description', 'Deskripsi produk / kegiatan', v.description)}${field('care-photos', 'Foto produk / kegiatan (maksimal 5, masing-masing 2 MB)', '', 'file', 'multiple accept="image/png,image/jpeg,image/webp"')}<div id="care-photo-list"></div>${formMessage}${button('Simpan', 'type="submit"', true)}</form>`);
      const renderPhotos = () => { d.querySelector('#care-photo-list')!.innerHTML = photos.map((id, i) => `<span class="photo-item"><img src="${fileUrl(id)}" alt="Foto kegiatan ${i + 1}">${button('Lepas', `type="button" data-photo="${i}"`)}</span>`).join(''); d.querySelectorAll<HTMLButtonElement>('[data-photo]').forEach(b => b.onclick = () => { photos.splice(Number(b.dataset.photo), 1); renderPhotos(); }); }; renderPhotos();
      const group = d.querySelector<HTMLSelectElement>('#groupType'); if (group) { const sync = () => { d.querySelector<HTMLElement>('#university-wrap')!.hidden = group.value !== 'Tim mahasiswa'; d.querySelector<HTMLInputElement>('#university')!.required = group.value === 'Tim mahasiswa'; }; group.onchange = sync; sync(); }
      d.querySelector<HTMLSelectElement>('#innovationId')!.onchange = () => { if (photos.length) { photos = []; renderPhotos(); } };
      bindForm(d.querySelector('form')!, async b => { const files = Array.from(d.querySelector<HTMLInputElement>('#care-photos')!.files || []); if (photos.length + files.length > 5) throw new Error('Maksimal 5 foto.'); for (const f of files) photos.push((await upload(f, 'pasca', b.innovationId)).id); d.querySelector<HTMLInputElement>('#care-photos')!.value = ''; renderPhotos(); await api(row ? `/aftercare/${row.id}` : '/aftercare', row ? 'PUT' : 'POST', { ...b, participantType: v.participantType, photos }); d.close(); await aftercarePage(root, related, selectedTab); toast('Pembinaan disimpan.'); });
    } catch (e) { toast((e as Error).message, true); }
  };
  root.innerHTML = heading(related ? 'Pasca Hak Terkait' : 'Pasca Hak Cipta', 'Pembinaan, pelatihan, dan inkubasi bisnis untuk pengembangan karya.', isAdmin ? button('+ Tambah Peserta', 'id="add-care"', true) : '') + `<section class="card"><div class="tab-bar">${['Perorangan', 'Kelompok', 'Organisasi Posyantek'].map(t => `<button class="${t === selectedTab ? 'selected' : ''}" data-tab="${t}">${t}</button>`).join('')}</div><div id="care-table"></div></section>`;
  root.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach(b => b.onclick = () => void aftercarePage(root, related, b.dataset.tab));
  root.querySelector<HTMLButtonElement>('#add-care')?.addEventListener('click', () => void edit());
  table(root.querySelector('#care-table')!, records.filter(r => r.data.participantType === selectedTab), [
    { label: 'Nama Peserta', html: r => `<strong>${esc(r.data.name)}</strong><small>${esc(r.data.university || state.regions.find(x => x.id === r.data.districtId)?.name || r.data.groupType)}</small>`, sort: r => r.data.name },
    { label: 'Ciptaan', html: r => esc(r.innovation.title), sort: r => r.innovation.title }, { label: 'Program', html: r => esc(r.data.program) },
    { label: 'Pelatihan', html: r => `<span class="status-label">${esc(r.data.trainingStatus)}</span>` }, { label: 'Hasil Produk', html: r => esc(r.data.product || '—') },
    { label: 'Foto', html: r => r.data.photos.map((id, i) => `<a href="${fileUrl(id)}" target="_blank" rel="noopener"><img class="table-photo" src="${fileUrl(id)}" alt="Foto kegiatan ${i + 1}"></a>`).join('') || '—' },
    { label: 'Aksi', html: r => `<div class="row-actions"><a class="action-link" href="#/ciptaan/${r.innovation_id}">Lihat HAKI</a>${r.innovation.data.certificateId ? `<a class="action-link" href="${fileUrl(r.innovation.data.certificateId)}">Sertifikat</a>` : '<span class="muted">Belum terbit</span>'}${isAdmin ? `${button('Edit', `data-care="${r.id}"`)}${button('Hapus', `data-delete-care="${r.id}"`)}` : ''}</div>` },
  ], r => `${r.data.name} ${r.innovation.title}`, [{ name: 'program-filter', label: 'Program', items: ['Pelatihan', 'Inkubasi Bisnis'], match: (r, v) => r.data.program === v }, { name: 'training-filter', label: 'Status pelatihan', items: ['Sudah', 'Belum'], match: (r, v) => r.data.trainingStatus === v }], () => {
    root.querySelectorAll<HTMLButtonElement>('[data-care]').forEach(b => b.onclick = () => void edit(records.find(r => r.id === b.dataset.care)));
    root.querySelectorAll<HTMLButtonElement>('[data-delete-care]').forEach(b => b.onclick = async () => { if (!confirm('Hapus data pembinaan ini?')) return; try { await api(`/aftercare/${b.dataset.deleteCare}`, 'DELETE'); await aftercarePage(root, related, selectedTab); toast('Pembinaan dihapus.'); } catch (e) { toast((e as Error).message, true); } });
  });
}
