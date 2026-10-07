import { DISTRICTS, filterInnovations, loadDataset, summarize, type Filters, type PublicDataset, type Innovation } from './data';
import { getLegend, countColor } from './map-scale';
import './dashboard.css';

const escape = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const filters: Filters = { query: '', district: null, mapping: 'all' };
let cached: PublicDataset | undefined;

export function dashboardTemplate(listOnly = false) {
  return `<div id="innovation-dashboard" data-list-only="${listOnly}">
    <div class="page-heading innovation-heading"><div><div class="eyebrow">SAPATRI / KOTA BEKASI</div><h1>${listOnly ? 'Daftar inovasi' : 'Ruang ide. Jejak inovasi'}<span class="coral">.</span></h1><p>Portal Inovasi dan Hak Cipta Kota Bekasi</p></div><a class="button secondary" href="${listOnly ? '#/dashboard' : '#/baru'}">${listOnly ? 'Lihat dashboard' : '+ Permohonan baru'}</a></div>
    <div class="dashboard-status" role="status">Memuat data inovasi…</div>
  </div>`;
}

export function mountDashboard(): () => void {
  const root = document.querySelector<HTMLElement>('#innovation-dashboard')!;
  const listOnly = root.dataset.listOnly === 'true';
  let active = true;
  let mapVersion = 0;
  let data: PublicDataset;
  let map: Awaited<ReturnType<typeof import('./map')['createBekasiMap']>> | undefined;
  const heading = root.firstElementChild!.outerHTML;
  const dispose = () => { active = false; mapVersion++; map?.destroy(); };
  const el = <T extends HTMLElement = HTMLElement>(selector: string) => root.querySelector<T>(selector)!;

  function results() { return filterInnovations(data, filters); }
  // Keep regional totals independent of the selected district so regions remain comparable.
  function geographicSummary() { return summarize(filterInnovations(data, { ...filters, district: null })); }
  function selectDistrict(name: string) {
    filters.district = !name || filters.district === name ? null : name;
    update();
  }
  async function startMap() {
    const container = root.querySelector<HTMLElement>('#bekasi-map');
    if (!container) return;
    const version = ++mapVersion;
    map?.destroy();
    container.innerHTML = '';
    try {
      const { createBekasiMap } = await import('./map');
      if (!active || version !== mapVersion) return;
      const controller = await createBekasiMap(container, geographicSummary().districtCounts, filters.district ?? null, selectDistrict, summarize(data.innovations).districtCounts);
      if (!active || version !== mapVersion) { controller.destroy(); return; }
      map = controller;
      // A filter can change while geometry is loading.
      map.update(geographicSummary().districtCounts, filters.district ?? null);
    } catch {
      if (!active || version !== mapVersion) return;
      container.innerHTML = '<div class="map-failure" role="alert"><strong>Peta belum dapat dimuat</strong><p>Batas wilayah atau WebGL tidak tersedia. Gunakan grafik dan filter kecamatan di halaman ini.</p><button class="button secondary" id="retry-map">Coba muat peta</button></div>';
      el('#retry-map').addEventListener('click', startMap);
    }
  }

  function innovationRow(item: Innovation) {
    return `<article class="innovation-item" data-innovation-id="${escape(item.id)}"><div class="innovation-index">${escape(item.sourceNumber.padStart(2, '0'))}</div><div class="innovation-copy"><h3>${escape(item.title)}</h3><div class="innovation-meta"><span>${item.creatorCount} pencipta tercatat</span>${item.supervisorCount ? `<span>${item.supervisorCount} pembimbing</span>` : ''}<span class="mapping-tag ${item.mappingStatus}">${item.mappingStatus === 'mapped' ? 'Dapat dipetakan' : 'Belum dapat dipetakan'}</span></div><div class="innovation-districts">${item.districts.length ? item.districts.map(d => `<button data-district="${escape(d)}" aria-label="Filter ${escape(d)}">${escape(d)}</button>`).join('') : 'Domisili pencipta belum memiliki kecamatan Kota Bekasi yang dapat dipetakan.'}</div></div></article>`;
  }

  function update() {
    if (!active) return;
    const items = results();
    const summary = summarize(items);
    const geography = geographicSummary();
    const all = summarize(data.innovations);
    const filtered = !!(filters.query?.trim() || filters.district || filters.mapping !== 'all');
    el<HTMLSelectElement>('#district-filter').value = filters.district ?? '';
    el('#filter-scope').textContent = filtered
      ? `${items.length} dari ${data.innovations.length} inovasi · Ringkasan dan daftar mengikuti filter. Peta dan grafik wilayah tetap menampilkan semua kecamatan sesuai pencarian.`
      : `Seluruh ${data.innovations.length} inovasi · Klik kecamatan pada peta atau grafik untuk menjelajah.`;
    el('#summary-cards').innerHTML = [
      ['Total inovasi', summary.totalInnovations, filtered ? `Hasil filter dari ${all.totalInnovations} inovasi` : data.sourceId === 'sapatri-demo' ? 'Contoh karya Hak Cipta dan Hak Terkait' : 'Inovasi unik dari bagian A dan B', '◎'],
      [data.sourceId === 'sapatri-demo' ? 'Pencipta dalam demo' : 'Pencipta teridentifikasi', summary.uniqueCreators, data.sourceId === 'sapatri-demo' ? 'Pencipta fiktif untuk mencoba alur aplikasi' : `${summary.creatorRelationships} relasi pencipta–inovasi · ${summary.unresolvedCreators} identitas belum lengkap`, '♧'],
      ['Kecamatan terwakili', summary.representedDistricts, 'Dari 12 kecamatan Kota Bekasi', '⌖'],
    ].map(([label, value, detail, mark], index) => `<article class="insight-card"><div class="insight-label"><span>${label}</span><span class="insight-mark" aria-hidden="true">${mark}</span></div><strong class="insight-value" data-stat="${index}">${value}</strong><p>${detail}</p></article>`).join('');
    const max = Math.max(1, ...geography.districtCounts.map(d => d.count));
    el('#district-chart').innerHTML = geography.districtCounts.map(d => `<button class="district-bar ${filters.district === d.name ? 'selected' : ''}" data-district="${escape(d.name)}" aria-pressed="${filters.district === d.name}" aria-label="${escape(d.name)}, ${d.count} inovasi berdasarkan domisili pencipta" title="${escape(d.name)}: ${d.count} inovasi berdasarkan domisili pencipta"><span class="bar-name">${escape(d.name)}</span><span class="bar-track"><span class="bar-fill" style="width:${d.count / max * 100}%;background:${countColor(d.count, all.districtCounts)}"></span></span><strong>${d.count}</strong></button>`).join('');
    const teamMax = Math.max(1, ...summary.teamSizes.map(t => t.count));
    el('#team-chart').innerHTML = summary.teamSizes.map(t => `<div class="team-column" title="${t.label} pencipta: ${t.count} inovasi"><strong>${t.count}</strong><div class="team-track"><span style="height:${t.count / teamMax * 100}%"></span></div><span>${t.label}</span></div>`).join('');
    el('#list-count').textContent = `${items.length} inovasi`;
    el('#innovation-list').innerHTML = items.length ? items.map(innovationRow).join('') : `<div class="dashboard-empty"><strong>${data.innovations.length ? 'Tidak ada inovasi yang cocok' : 'Feeder belum berisi inovasi'}</strong><p>${data.innovations.length ? 'Ubah pencarian atau hapus filter untuk melihat inovasi lainnya.' : 'Impor data feeder untuk menampilkan ringkasan dan sebaran inovasi.'}</p></div>`;
    root.querySelectorAll<HTMLButtonElement>('[data-district]').forEach(button => button.addEventListener('click', () => selectDistrict(button.dataset.district!)));
    map?.update(geography.districtCounts, filters.district ?? null);
  }

  function display() {
    const all = summarize(data.innovations);
    root.innerHTML = `${heading}${data.sourceId === 'sapatri-demo' ? '<p class="inline-notice">Mode demonstrasi · Karya, pencipta, status, dan dokumen menggunakan data dummy.</p>' : ''}
      <section class="dashboard-filters card" aria-label="Filter seluruh dashboard"><div class="search-field"><label for="innovation-search">Cari inovasi</label><input id="innovation-search" type="search" placeholder="Judul atau nomor inovasi…" value="${escape(filters.query ?? '')}"></div><div><label for="district-filter">Domisili pencipta</label><select id="district-filter"><option value="">Semua kecamatan</option>${DISTRICTS.map(d => `<option>${d}</option>`).join('')}</select></div><button class="button secondary" id="clear-filters">Hapus filter</button></section>
      <p id="filter-scope" class="filter-scope" role="status" aria-live="polite"></p>
      <section id="summary-cards" class="insight-grid" aria-label="Ringkasan data feeder"></section>
      <div class="geography-note"><span aria-hidden="true">ⓘ</span><p>Sebaran berdasarkan domisili pencipta. Satu inovasi dapat tercatat di beberapa kecamatan.</p></div>
      ${listOnly ? '' : `<div class="geography-grid"><section class="card map-card" aria-labelledby="map-title"><div class="analytics-header"><div><div class="eyebrow">PETA INOVASI</div><h2 id="map-title">Jelajahi Kota Bekasi</h2><p>Arahkan penunjuk atau ketuk kecamatan untuk melihat jumlah inovasi.</p></div><span class="region-badge">12 kecamatan</span></div><div id="bekasi-map"></div><div class="map-legend" aria-label="Legenda jumlah inovasi">${getLegend(all.districtCounts).map(l => `<span><i style="background:${l.color}"></i>${l.label}</span>`).join('')}<p>Semakin banyak inovasi, semakin pekat atau gelap warna kecamatannya.</p></div></section><section class="card district-card" aria-labelledby="district-title"><div class="analytics-header"><div><div class="eyebrow">SEBARAN DOMISILI</div><h2 id="district-title">Inovasi per kecamatan</h2><p>Inovasi unik, bukan jumlah pencipta.</p></div></div><div id="district-chart" class="district-chart"></div><p class="chart-note">Jumlah inovasi · Satu inovasi dihitung sekali dalam setiap kecamatan.</p></section></div>`}
      <div class="secondary-charts ${listOnly ? 'list-hidden-charts' : ''}"><section class="card"><div class="analytics-header"><div><h2>Ukuran tim pencipta</h2><p>Jumlah inovasi menurut banyaknya pencipta</p></div></div><div class="team-axis-title">Jumlah inovasi</div><div id="team-chart" class="team-chart" aria-label="Jumlah inovasi menurut ukuran tim"></div><p class="chart-axis-label">Jumlah pencipta tercatat per inovasi</p><p class="chart-note">${escape(data.notes.teamSize)}</p></section></div>
      ${listOnly ? '<div id="district-chart" hidden></div>' : ''}
      <section class="card innovations-card" aria-labelledby="list-title"><div class="analytics-header"><div><div class="eyebrow">DARI IDE MENJADI MANFAAT</div><h2 id="list-title">Jelajahi inovasi</h2><p>Lokasi berikut menunjukkan domisili pencipta, bukan lokasi pelaksanaan.</p></div><span class="region-badge" id="list-count"></span></div><div id="innovation-list"></div></section>
      <details class="data-notes card"><summary>Tentang data dan catatan peninjauan</summary><div><p>${escape(data.notes.identity)}</p>${data.sourceId === 'sapatri-demo' ? '<p>Dashboard menampilkan snapshot contoh karya. Masuk ke akun untuk mencoba draft, pengajuan, lampiran, dan pembinaan. Perubahan data di area akun tidak otomatis dipublikasikan di dashboard.</p>' : `<p>Feeder tidak memuat tanggal, kategori, nomor sertifikat, atau status pendaftaran hak cipta. Keberadaan dalam daftar ini tidak menunjukkan bahwa hak cipta sudah terdaftar.</p><p>${all.supervisorRelationships} relasi pembimbing dipertahankan sesuai keterangan sumber dan tidak otomatis dihitung sebagai pencipta.</p>`}<ul>${data.reviewSummary.map(r => `<li>${escape(r.label)} <strong>(${r.count})</strong></li>`).join('')}</ul><p>Sumber: ${escape(data.sourceLabel)}</p></div></details>`;
    el<HTMLInputElement>('#innovation-search').addEventListener('input', event => { filters.query = (event.target as HTMLInputElement).value; update(); });
    el('#district-filter').addEventListener('change', event => { filters.district = (event.target as HTMLSelectElement).value || null; update(); });
    el('#clear-filters').addEventListener('click', () => { filters.query = ''; filters.district = null; filters.mapping = 'all'; el<HTMLInputElement>('#innovation-search').value = ''; update(); });
    update();
    void startMap();
  }
  async function load() {
    try {
      data = cached ?? await loadDataset();
      cached = data;
      if (active) display();
    } catch {
      if (!active) return;
      root.innerHTML = `${heading}<div class="dashboard-status error" role="alert"><h2>Data feeder belum dapat dimuat</h2><p>Ringkasan dan warna peta belum tersedia. Periksa koneksi atau hasil impor feeder.</p><button class="button primary" id="retry-data">Coba lagi</button></div>`;
      el('#retry-data').addEventListener('click', () => { el('.dashboard-status').innerHTML = '<p role="status">Memuat ulang data inovasi…</p>'; void load(); });
    }
  }
  void load();
  return dispose;
}
