import { api, state, upload, type Work, type Person, type User, type WorkData } from './portal-api';
import { esc, fileUrl, date, status, field, area, select, button, heading, formMessage, bindForm, dataOf, bindRegions, regionFields, table, toast } from './portal-ui';

const admin = () => state.user?.role === 'Admin';
const person = (): Person => ({ name: '', address: '', districtId: null, villageId: null });
export async function workList(root: HTMLElement, related = false, initialStatus = '') {
  const records = (await api<Work[]>('/innovations')).filter(r => r.kind === (related ? 'Hak Terkait' : 'Hak Cipta'));
  root.innerHTML = heading(related ? 'Hak Terkait' : 'Daftar Ciptaan', admin() ? 'Kelola inovasi dari seluruh akun, termasuk draft dan data feeder.' : 'Kelola karya Anda, lanjutkan draft, dan pantau pengajuan.', `<a class="button primary" href="#/baru${related ? '?jenis=terkait' : ''}">+ Permohonan Baru</a>`) + `<section class="card" id="work-table"></section>`;
  const columns = [
    { label: 'Kode Pengajuan', html: (r: Work) => `<span class="code-text">${esc(r.code)}</span>`, sort: (r: Work) => r.code },
    { label: 'Judul Ciptaan', html: (r: Work) => `<a class="table-title" href="#/ciptaan/${r.id}">${esc(r.title || 'Tanpa judul')}</a>`, sort: (r: Work) => r.title },
    { label: 'Jenis Ciptaan', html: (r: Work) => esc(r.data.type || 'Belum diketahui'), sort: (r: Work) => r.data.type || '' },
    ...(admin() ? [{ label: 'Pemilik Akun', html: (r: Work) => esc(r.ownerName || 'Belum ditetapkan'), sort: (r: Work) => r.ownerName || '' }] : []),
    { label: 'Tanggal Dibuat', html: (r: Work) => date(r.created_at), sort: (r: Work) => r.created_at || '' },
    { label: 'Tanggal Diajukan', html: (r: Work) => date(r.submitted_at), sort: (r: Work) => r.submitted_at || '' },
    { label: 'Status', html: (r: Work) => status(r.status), sort: (r: Work) => r.status || '' },
    { label: 'Aksi', html: (r: Work) => `<div class="row-actions"><a href="#/ciptaan/${r.id}" class="action-link">Lihat</a><a href="#/edit/${r.id}" class="action-link">${r.status === 'Draft' ? 'Lanjutkan Draft' : 'Edit'}</a>${admin() ? `<a href="#/ciptaan/${r.id}?status=1" class="action-link">Status</a>` : ''}<button class="action-link danger" data-delete="${r.id}">Hapus</button></div>` },
  ];
  table(root.querySelector('#work-table')!, records, columns, r => `${r.title} ${r.code} ${admin() ? r.ownerName || '' : ''}`, [{ name: 'status-filter', label: 'Status', items: ['Draft', 'Diajukan', 'Diproses', 'Perlu Revisi', 'Selesai', 'Belum diketahui'], value: initialStatus, match: (r, v) => (r.status || 'Belum diketahui') === v }], () => {
    root.querySelectorAll<HTMLButtonElement>('[data-delete]').forEach(b => b.onclick = async () => { if (!confirm('Hapus ciptaan ini beserta lampirannya? Tindakan ini tidak dapat dibatalkan.')) return; try { await api(`/innovations/${b.dataset.delete}`, 'DELETE'); await workList(root, related, initialStatus); toast('Ciptaan dihapus.'); } catch (e) { toast((e as Error).message, true); } });
  });
}

export async function workDetail(root: HTMLElement, id: string) {
  const r = await api<Work>(`/innovations/${id}`); const d = r.data;
  const people = (title: string, rows: Person[] = []) => `<section class="card detail-card"><h2>${title}</h2>${rows.length ? rows.map(p => `<p><strong>${esc(p.name || 'Belum diisi')}</strong><br>${esc(p.address)}<br>${esc(state.regions.find(r => r.id === p.districtId)?.name)} · ${esc(state.regions.find(r => r.id === p.villageId)?.name)}</p>`).join('') : '<p>Belum diisi.</p>'}</section>`;
  root.innerHTML = heading(r.title || 'Tanpa judul', r.code, `<a class="button primary" href="#/edit/${r.id}">${r.status === 'Draft' ? 'Lanjutkan Draft' : 'Edit Ciptaan'}</a>`) + `<div class="detail-meta">${status(r.status)}<span>Pemilik: ${esc(r.ownerName || 'Belum ditetapkan')}</span><span>Dibuat: ${date(r.created_at)}</span><span>Diajukan: ${date(r.submitted_at)}</span></div>${r.source_id ? '<p class="inline-notice">Data feeder: informasi yang belum tersedia tetap ditampilkan sebagai belum diketahui. Admin dapat menetapkan pemilik melalui Edit Ciptaan.</p>' : ''}<section class="card detail-card"><h2>Detail Ciptaan</h2><p>${esc(d.type || 'Jenis belum diketahui')}</p><p class="preserve-lines">${esc(d.description || 'Uraian belum diisi.')}</p><p>Nomor pencatatan: ${esc(d.registrationNumber || 'Belum tersedia')}</p>${d.certificateId ? `<a class="button secondary" href="${fileUrl(d.certificateId)}" target="_blank" rel="noopener">Unduh Sertifikat</a>` : '<span class="status-label">Sertifikat belum terbit</span>'}</section><div class="two-columns">${people('Pencipta', d.creators)}${people('Pemegang Hak', d.holders)}</div><section class="card detail-card"><h2>Lampiran</h2>${d.attachments?.length ? d.attachments.map(a => `<p><a href="${fileUrl(a.id)}" target="_blank" rel="noopener">${esc(a.name)}</a> <small>${esc(a.category)}</small></p>`).join('') : '<p>Belum ada lampiran.</p>'}</section><div id="status-editor"></div>`;
  if (admin()) {
    const next: Record<string, string[]> = { Draft: ['Diajukan'], Diajukan: ['Diproses'], Diproses: ['Perlu Revisi', 'Selesai'], 'Perlu Revisi': ['Diajukan'], Selesai: ['Diproses'] };
    const choices = r.status ? next[r.status] || [] : ['Draft'];
    root.querySelector('#status-editor')!.innerHTML = `<form class="card detail-card" id="status-form"><h2>Kelola Status</h2><p>Perubahan status dicatat dalam riwayat sistem. Penetapan Selesai tidak menerbitkan sertifikat secara otomatis.</p>${select('next-status', 'Status berikutnya', choices)}${formMessage}${button('Perbarui Status', 'type="submit"', true)}</form>`;
    bindForm(root.querySelector('#status-form')!, async b => { await api(`/innovations/${id}/status`, 'PUT', { status: b['next-status'] }); await workDetail(root, id); toast('Status diperbarui.'); });
  }
}

export async function workEditor(root: HTMLElement, id?: string, related = false) {
  let work: Work | null = id ? await api<Work>(`/innovations/${id}`) : null;
  const clientId = crypto.randomUUID();
  const users = admin() ? await api<User[]>('/users') : [];
  const data: WorkData = structuredClone(work?.data || {});
  data.creators ||= [person()]; data.holders ||= [person()]; data.attachments ||= [];
  let title = work?.title || '', ownerId = work ? work.owner_id || '' : state.user!.id, stage = 1, busy = false;
  const remember = () => {
    const f = root.querySelector<HTMLFormElement>('#work-form'); if (!f) return; const b = dataOf(f);
    if (stage === 1) { title = b.title; data.type = b.type; data.description = b.description; data.announcedAt = b.announcedAt; if (admin()) ownerId = b.ownerId; }
    if (stage === 2) for (const key of ['creators', 'holders'] as const) data[key] = data[key]!.map((_, i) => ({ name: b[`${key}-${i}-name`], address: b[`${key}-${i}-address`], districtId: b[`${key}-${i}-kecamatan`] || null, villageId: b[`${key}-${i}-kelurahan`] || null }));
    if (stage === 3 && admin()) data.registrationNumber = b.registrationNumber;
  };
  const persist = async () => {
    remember();
    if (!work) work = await api<Work>('/innovations', 'POST', { id: clientId, kind: related ? 'Hak Terkait' : 'Hak Cipta' });
    work = await api<Work>(`/innovations/${work.id}`, 'PUT', { title, data, ownerId, version: work.version });
    history.replaceState(null, '', `#/edit/${work.id}`);
  };
  const uploadFile = async (input: HTMLInputElement, purpose: 'attachment' | 'certificate') => {
    if (!input.files?.[0] || busy) return; busy = true; input.disabled = true;
    try { await persist(); const f = await upload(input.files[0], purpose, work!.id); if (purpose === 'certificate') data.certificateId = f.id; else data.attachments!.push({ ...f, category: root.querySelector<HTMLSelectElement>('#attachment-category')!.value }); await persist(); paint(); toast('Berkas tersimpan.'); } catch (e) { toast((e as Error).message, true); } finally { busy = false; input.disabled = false; }
  };
  const people = (key: 'creators' | 'holders', label: string) => `<section><div class="section-toolbar"><h2>${label}</h2>${button('+ Tambah', `type="button" data-add="${key}"`)}</div>${data[key]!.map((p, i) => `<fieldset class="person-card"><legend>${label} ${i + 1}</legend>${field(`${key}-${i}-name`, 'Nama lengkap / badan hukum', p.name)}${area(`${key}-${i}-address`, 'Alamat', p.address)}${regionFields(`${key}-${i}`, p.districtId, p.villageId)}${button('Hapus', `type="button" data-remove="${key}:${i}"`)}</fieldset>`).join('')}</section>`;
  function paint() {
    root.innerHTML = heading(work ? 'Edit Ciptaan' : 'Permohonan Baru', 'Simpan progres sebagai draft atau lengkapi seluruh bagian untuk mengajukan.', '<a class="button secondary" href="#/ciptaan">Kembali ke Daftar</a>') + `<section class="card wizard"><div class="wizard-steps">${['Detail Permohonan', 'Pencipta & Pemegang Hak', 'Lampiran'].map((s, i) => `<button type="button" class="wizard-step ${stage === i + 1 ? 'current' : ''}" data-stage="${i + 1}"><span class="step-circle">${i + 1}</span><strong>${s}</strong></button>`).join('')}</div><form id="work-form"><div class="wizard-body">${stage === 1 ? `<div class="form-grid">${field('title', 'Judul ciptaan', title, 'text', 'maxlength="300"')}${select('type', 'Jenis ciptaan', ['', 'Karya Tulis', 'Karya Seni', 'Program Komputer', 'Fotografi', 'Karya Audiovisual', 'Hak Terkait', 'Lainnya'], data.type)}${field('announcedAt', 'Tanggal pertama diumumkan', data.announcedAt, 'date')}${admin() ? select('ownerId', 'Pemilik akun', [{ value: '', label: 'Belum ditetapkan' }, ...users.map(u => ({ value: u.id, label: `${u.name} (${u.email})` }))], ownerId) : ''}${area('description', 'Uraian singkat', data.description, 'maxlength="5000"')}</div>` : stage === 2 ? `${people('creators', 'Pencipta')}${people('holders', 'Pemegang Hak')}` : `<h2>Lampiran Pendukung</h2><p>Untuk pengajuan, lengkapi identitas, surat pernyataan, dan contoh ciptaan. PNG, JPG, WebP, atau PDF; maksimal 8 MB per berkas.</p><div class="form-grid">${select('attachment-category', 'Kategori lampiran', [{ value: 'identitas', label: 'Identitas pemohon/pencipta' }, { value: 'pernyataan', label: 'Surat pernyataan' }, { value: 'contoh', label: 'Contoh ciptaan' }, { value: 'lainnya', label: 'Dokumen lain' }])}${field('attachment-file', 'Unggah lampiran', '', 'file', 'accept="image/png,image/jpeg,image/webp,application/pdf"')}</div><div class="attachment-list">${data.attachments!.map((a, i) => `<div class="attachment-row"><div><a href="${fileUrl(a.id)}" target="_blank" rel="noopener">${esc(a.name)}</a><small>${esc(a.category)}</small></div>${button('Lepas', `type="button" data-detach="${i}"`)}</div>`).join('')}</div>${admin() ? `<hr><h2>Sertifikat & Pencatatan</h2>${field('registrationNumber', 'Nomor pencatatan', data.registrationNumber)}${data.certificateId ? `<p><a href="${fileUrl(data.certificateId)}">Sertifikat tersimpan</a> ${button('Lepas sertifikat', 'type="button" id="remove-certificate"')}</p>` : '<p>Belum terbit</p>'}${field('certificate-file', 'Unggah sertifikat', '', 'file', 'accept="application/pdf,image/png,image/jpeg,image/webp"')}` : ''}`}${formMessage}</div><div class="wizard-footer">${button('Sebelumnya', `type="button" id="previous-step" ${stage === 1 ? 'disabled' : ''}`)}<span>Langkah ${stage} dari 3</span><div>${button(work?.status && work.status !== 'Draft' ? 'Simpan Perubahan' : 'Simpan Draft', 'type="submit" name="intent" value="save"')}${stage < 3 ? button('Selanjutnya →', 'type="button" id="next-step"', true) : (!work?.status || ['Draft', 'Perlu Revisi'].includes(work.status) ? button('Ajukan Ciptaan', 'type="submit" name="intent" value="submit"', true) : '')}</div></div></form></section><p class="chart-note">Perubahan oleh User pada pengajuan yang telah dikirim akan ditandai Perlu Revisi untuk diajukan kembali.</p>`;
    bindRegions(root);
    root.querySelectorAll<HTMLButtonElement>('[data-stage]').forEach(b => b.onclick = () => { if (busy) return; remember(); stage = Number(b.dataset.stage); paint(); });
    root.querySelector<HTMLButtonElement>('#previous-step')!.onclick = () => { if (busy) return; remember(); stage--; paint(); };
    root.querySelector<HTMLButtonElement>('#next-step')?.addEventListener('click', () => { if (busy) return; remember(); stage++; paint(); });
    root.querySelectorAll<HTMLButtonElement>('[data-add]').forEach(b => b.onclick = () => { remember(); data[b.dataset.add as 'creators' | 'holders']!.push(person()); paint(); });
    root.querySelectorAll<HTMLButtonElement>('[data-remove]').forEach(b => b.onclick = () => { remember(); const [key, index] = b.dataset.remove!.split(':'); data[key as 'creators' | 'holders']!.splice(Number(index), 1); paint(); });
    root.querySelectorAll<HTMLButtonElement>('[data-detach]').forEach(b => b.onclick = () => { remember(); data.attachments!.splice(Number(b.dataset.detach), 1); paint(); });
    root.querySelector<HTMLButtonElement>('#remove-certificate')?.addEventListener('click', () => { remember(); data.certificateId = null; paint(); });
    root.querySelector<HTMLInputElement>('#attachment-file')?.addEventListener('change', e => void uploadFile(e.target as HTMLInputElement, 'attachment'));
    root.querySelector<HTMLInputElement>('#certificate-file')?.addEventListener('change', e => void uploadFile(e.target as HTMLInputElement, 'certificate'));
    bindForm(root.querySelector('#work-form')!, async (_, event) => {
      if (busy) throw new Error('Tunggu unggahan selesai.'); busy = true;
      try { await persist(); if ((event.submitter as HTMLButtonElement)?.value === 'submit') { if (!confirm('Ajukan ciptaan ini untuk diproses?')) return; work = await api<Work>(`/innovations/${work!.id}/submit`, 'POST', {}); location.hash = `#/ciptaan/${work.id}`; toast('Ciptaan berhasil diajukan.'); } else { paint(); toast('Perubahan berhasil disimpan.'); } } finally { busy = false; }
    });
  }
  paint();
}

export async function profile(root: HTMLElement, refresh: () => Promise<void>) {
  const u = state.user!; let photoId = u.photoId;
  root.innerHTML = heading('Profil Saya', 'Perbarui identitas dan keamanan akun Anda.') + `<div class="two-columns"><form class="card detail-card" id="profile-form"><h2>Profil Saya</h2><div class="profile-photo" id="photo-preview">${photoId ? `<img src="${fileUrl(photoId)}" alt="Foto profil">` : `<span>${esc(u.name.slice(0, 2).toUpperCase())}</span>`}</div>${field('photo', 'Foto profil (PNG/JPG/WebP, maksimal 2 MB)', '', 'file', 'accept="image/png,image/jpeg,image/webp"')}${button('Hapus Foto', 'type="button" id="remove-photo"')}${field('name', 'Nama lengkap', u.name, 'text', 'required')}${field('email', 'Email', u.email, 'email', admin() ? 'required' : 'readonly')}${field('phone', 'Nomor HP', u.phone, 'tel')}${regionFields('profile', u.districtId, u.villageId)}${formMessage}${button('Simpan Perubahan', 'type="submit"', true)}</form><form class="card detail-card" id="password-form"><h2>Ubah Password</h2>${field('oldPassword', 'Password lama', '', 'password', 'required autocomplete="current-password"')}${field('password', 'Password baru', '', 'password', 'required minlength="10" maxlength="128" autocomplete="new-password"')}${field('confirm', 'Konfirmasi password baru', '', 'password', 'required autocomplete="new-password"')}<label class="check-field"><input type="checkbox" id="show-password">Tampilkan password</label><p id="password-strength" class="inline-notice">Gunakan minimal 10 karakter dengan kombinasi huruf, angka, dan simbol.</p>${formMessage}${button('Perbarui Password', 'type="submit"', true)}</form></div>`;
  bindRegions(root);
  root.querySelector<HTMLButtonElement>('#remove-photo')!.onclick = () => { photoId = null; root.querySelector<HTMLInputElement>('#photo')!.value = ''; root.querySelector('#photo-preview')!.textContent = u.name.slice(0, 2); };
  let previewUrl = '';
  root.querySelector<HTMLInputElement>('#photo')!.onchange = e => { const f = (e.target as HTMLInputElement).files?.[0]; if (!f) return; if (f.size > 2 * 1024 * 1024 || !['image/png', 'image/jpeg', 'image/webp'].includes(f.type)) { toast('Pilih gambar PNG/JPG/WebP maksimal 2 MB.', true); (e.target as HTMLInputElement).value = ''; return; } if (previewUrl) URL.revokeObjectURL(previewUrl); previewUrl = URL.createObjectURL(f); root.querySelector('#photo-preview')!.innerHTML = `<img src="${previewUrl}" alt="Pratinjau foto">`; };
  bindForm(root.querySelector('#profile-form')!, async b => { const f = root.querySelector<HTMLInputElement>('#photo')!.files?.[0]; if (f) photoId = (await upload(f, 'avatar')).id; state.user = await api<User>('/profile', 'PUT', { ...b, photoId, districtId: b['profile-kecamatan'], villageId: b['profile-kelurahan'] }); if (previewUrl) URL.revokeObjectURL(previewUrl); await refresh(); toast('Profil diperbarui.'); });
  root.querySelector<HTMLInputElement>('#show-password')!.onchange = e => root.querySelectorAll<HTMLInputElement>('#password-form input:not([type=checkbox])').forEach(i => i.type = (e.target as HTMLInputElement).checked ? 'text' : 'password');
  root.querySelector<HTMLInputElement>('#password')!.oninput = e => { const v = (e.target as HTMLInputElement).value; const strength = [v.length >= 10, /[A-Z]/.test(v), /[0-9]/.test(v), /[^a-zA-Z0-9]/.test(v)].filter(Boolean).length; root.querySelector('#password-strength')!.textContent = `Kekuatan: ${strength >= 4 ? 'Kuat' : strength >= 2 ? 'Sedang' : 'Lemah'}. Minimal 10 karakter.`; };
  bindForm(root.querySelector('#password-form')!, async b => { await api('/password', 'PUT', b); root.querySelector<HTMLFormElement>('#password-form')!.reset(); toast('Password diperbarui. Sesi perangkat lain diakhiri.'); });
}
