import { state, type Region } from './portal-api';
export const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
export const fileUrl = (id: string) => `/api/files/${encodeURIComponent(id)}`;
export const date = (v: string | null | undefined) => v ? new Date(v).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
export const status = (v: string | null) => `<span class="status-label status-${v === 'Draft' ? 'draft' : v === 'Selesai' ? 'done' : v ? 'process' : 'unknown'}">${esc(v || 'Belum diketahui')}</span>`;
export const field = (name: string, label: string, value: unknown = '', type = 'text', extra = '') => `<div class="form-field"><label for="${esc(name)}">${esc(label)}</label>${type === 'file' ? `<div class="file-picker"><input id="${esc(name)}" name="${esc(name)}" type="file" ${extra}><span>Pilih Berkas</span><small>Belum ada berkas dipilih</small></div>` : `<input id="${esc(name)}" name="${esc(name)}" type="${type}" value="${esc(value)}" ${extra}>`}</div>`;
export const area = (name: string, label: string, value: unknown = '', extra = '') => `<div class="form-field full"><label for="${esc(name)}">${esc(label)}</label><textarea id="${esc(name)}" name="${esc(name)}" rows="4" ${extra}>${esc(value)}</textarea></div>`;
export const options = (items: (string | { value: string; label: string })[], selected: unknown) => items.map(i => { const v = typeof i === 'string' ? i : i.value; return `<option value="${esc(v)}" ${v === selected ? 'selected' : ''}>${esc(typeof i === 'string' ? i : i.label)}</option>`; }).join('');
export const select = (name: string, label: string, items: (string | { value: string; label: string })[], selected: unknown = '', extra = '') => `<div class="form-field"><label for="${esc(name)}">${esc(label)}</label><select id="${esc(name)}" name="${esc(name)}" ${extra}>${options(items, selected)}</select></div>`;
export const check = (name: string, label: string, yes: boolean) => `<label class="check-field"><input type="checkbox" name="${name}" ${yes ? 'checked' : ''}>${esc(label)}</label>`;
export const button = (label: string, attrs = '', primary = false) => `<button class="button ${primary ? 'primary' : 'secondary'}" ${attrs}>${label}</button>`;
export const heading = (title: string, desc: string, action = '') => `<div class="page-heading"><div><div class="eyebrow">SAPATRI / RUANG KARYA</div><h1>${esc(title)}</h1><p>${esc(desc)}</p></div>${action}</div>`;
export const formMessage = '<div class="form-message" role="status" aria-live="polite"></div>';
export const dataOf = (form: HTMLFormElement) => Object.fromEntries(new FormData(form).entries()) as Record<string, string>;
let toastTimer: number | undefined;
export function toast(message: string, error = false) { window.clearTimeout(toastTimer); let node = document.querySelector('#portal-toast'); if (!node) { node = document.createElement('div'); node.id = 'portal-toast'; node.setAttribute('role', 'status'); document.body.append(node); } node.className = error ? 'toast error' : 'toast'; node.textContent = message; toastTimer = window.setTimeout(() => node?.remove(), 6500); }
export function bindForm(form: HTMLFormElement, task: (data: Record<string, string>, event: SubmitEvent) => Promise<void>) {
  let busy = false;
  form.noValidate = true;
  form.addEventListener('submit', async e => {
    e.preventDefault(); if (busy) return;
    const invalid = Array.from(form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input,select,textarea')).find(i => !i.disabled && !i.validity.valid);
    if (invalid) {
      const label = form.querySelector<HTMLLabelElement>(`label[for="${invalid.id}"]`)?.textContent || 'Isian';
      const message = `${label}: ${invalid.validity.valueMissing ? 'wajib diisi.' : invalid.validity.typeMismatch ? 'format tidak valid.' : invalid.validity.tooShort ? `minimal ${(invalid as HTMLInputElement).minLength} karakter.` : 'periksa kembali nilai yang diisi.'}`;
      const target = form.querySelector<HTMLElement>('.form-message'); if (target) { target.textContent = message; target.classList.add('error'); } else toast(message, true);
      invalid.focus(); return;
    }
    busy = true;
    const buttons = Array.from(form.querySelectorAll<HTMLButtonElement>('button[type=submit],button:not([type])'));
    buttons.forEach(b => b.disabled = true); form.setAttribute('aria-busy', 'true');
    const message = form.querySelector<HTMLElement>('.form-message'); if (message) { message.textContent = 'Menyimpan…'; message.classList.remove('error'); }
    try { await task(dataOf(form), e as SubmitEvent); if (message) message.textContent = ''; }
    catch (err) { if (message) { message.textContent = (err as Error).message; message.classList.add('error'); } else toast((err as Error).message, true); }
    finally { busy = false; buttons.forEach(b => b.disabled = false); form.removeAttribute('aria-busy'); }
  });
}
document.addEventListener('change', e => {
  const input = e.target as HTMLInputElement;
  if (input.type !== 'file') return;
  const label = input.closest('.file-picker')?.querySelector('small');
  if (label) label.textContent = input.files?.length ? Array.from(input.files).map(f => f.name).join(', ') : 'Belum ada berkas dipilih';
});
export function dialog(title: string, html: string): HTMLDialogElement {
  document.querySelector('#portal-dialog')?.remove(); const d = document.createElement('dialog'); d.id = 'portal-dialog'; d.className = 'portal-dialog';
  d.innerHTML = `<div class="dialog-heading"><h2>${esc(title)}</h2>${button('×', 'type="button" data-close aria-label="Tutup dialog"')}</div>${html}`;
  document.body.append(d); d.querySelector('[data-close]')?.addEventListener('click', () => d.close()); d.addEventListener('close', () => d.remove()); d.showModal(); return d;
}
export function regionFields(prefix: string, districtId: string | null = null, villageId: string | null = null, depth = 4, parentId?: string | null) {
  const chosen: Record<string, string> = {}; let r: Region | undefined = state.regions.find(r => r.id === (parentId || villageId || districtId));
  while (r) { chosen[r.level] = r.id; r = state.regions.find(x => x.id === r?.parent_id); }
  return `<div class="region-fields form-grid" data-region-prefix="${prefix}">${['provinsi', 'kota', 'kecamatan', 'kelurahan'].slice(0, depth).map((level, index) => select(`${prefix}-${level}`, level.charAt(0).toUpperCase() + level.slice(1), [{ value: '', label: `Pilih ${level}` }, ...state.regions.filter(r => r.level === level && (r.active || r.id === chosen[level]) && (index === 0 || r.parent_id === chosen[['provinsi', 'kota', 'kecamatan'][index - 1]])).map(r => ({ value: r.id, label: r.name + (r.active ? '' : ' (nonaktif)') }))], chosen[level] || '', `data-region-level="${index}"`)).join('')}</div>`;
}
export function bindRegions(root: ParentNode) {
  root.querySelectorAll<HTMLElement>('[data-region-prefix]').forEach(group => {
    const controls = Array.from(group.querySelectorAll<HTMLSelectElement>('select'));
    controls.forEach((control, index) => control.addEventListener('change', () => {
      for (let next = index + 1; next < controls.length; next++) { const level = ['provinsi', 'kota', 'kecamatan', 'kelurahan'][next]; controls[next].innerHTML = options([{ value: '', label: `Pilih ${level}` }, ...state.regions.filter(r => r.active && r.level === level && r.parent_id === controls[next - 1].value).map(r => ({ value: r.id, label: r.name }))], ''); }
    }));
  });
}
export type TableColumn<T> = { label: string; html: (row: T) => string; sort?: (row: T) => string };
export function table<T>(root: HTMLElement, rows: T[], columns: TableColumn<T>[], searchText: (r: T) => string, filters: { name: string; label: string; items: string[]; value?: string; match: (r: T, v: string) => boolean }[] = [], afterRender?: () => void) {
  let page = 1, pageSize = 10, query = '', sortCol = -1, descending = false;
  root.innerHTML = `<div class="list-controls">${field('table-search', 'Cari', '', 'search', 'placeholder="Cari data…"')}${filters.map(f => select(f.name, f.label, [{ value: '', label: 'Semua' }, ...f.items], f.value || '')).join('')}${select('page-size', 'Baris per halaman', ['10', '25', '50'], '10')}</div><div class="table-scroll"><table class="data-table"><thead><tr>${columns.map((c, i) => `<th>${c.sort ? `<button type="button" class="sort-button" data-sort="${i}">${esc(c.label)} ↕</button>` : esc(c.label)}</th>`).join('')}</tr></thead><tbody></tbody></table></div><div class="pagination"></div>`;
  const paint = () => {
    let filtered = rows.filter(r => searchText(r).toLocaleLowerCase('id').includes(query.toLocaleLowerCase('id')) && filters.every(f => !f.value || f.match(r, f.value)));
    if (sortCol >= 0) { const fn = columns[sortCol].sort!; filtered = [...filtered].sort((a, b) => fn(a).localeCompare(fn(b), 'id', { numeric: true }) * (descending ? -1 : 1)); }
    const pages = Math.max(1, Math.ceil(filtered.length / pageSize)); page = Math.min(page, pages);
    root.querySelector('tbody')!.innerHTML = filtered.length ? filtered.slice((page - 1) * pageSize, page * pageSize).map(r => `<tr>${columns.map(c => `<td>${c.html(r)}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${columns.length}"><div class="dashboard-empty"><strong>Belum ada data yang sesuai</strong><p>Tambahkan data baru atau ubah pencarian dan filter.</p></div></td></tr>`;
    root.querySelector('.pagination')!.innerHTML = `<span>Menampilkan ${filtered.length ? (page - 1) * pageSize + 1 : 0}–${Math.min(page * pageSize, filtered.length)} dari ${filtered.length} data</span><div>${button('Sebelumnya', `data-page="-1" ${page === 1 ? 'disabled' : ''}`)}<span>${page} / ${pages}</span>${button('Berikutnya', `data-page="1" ${page === pages ? 'disabled' : ''}`)}</div>`;
    root.querySelectorAll<HTMLButtonElement>('[data-page]').forEach(b => b.onclick = () => { page += Number(b.dataset.page); paint(); }); afterRender?.();
  };
  root.querySelector<HTMLInputElement>('#table-search')!.oninput = e => { query = (e.target as HTMLInputElement).value; page = 1; paint(); };
  root.querySelector<HTMLSelectElement>('#page-size')!.onchange = e => { pageSize = Number((e.target as HTMLSelectElement).value); page = 1; paint(); };
  filters.forEach(f => root.querySelector<HTMLSelectElement>(`#${f.name}`)!.onchange = e => { f.value = (e.target as HTMLSelectElement).value; page = 1; paint(); });
  root.querySelectorAll<HTMLButtonElement>('[data-sort]').forEach(b => b.onclick = () => { const next = Number(b.dataset.sort); descending = sortCol === next ? !descending : false; sortCol = next; paint(); }); paint();
}
