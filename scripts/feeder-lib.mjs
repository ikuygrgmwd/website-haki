import { createHash, randomUUID } from 'node:crypto';

export const DISTRICTS = ['Bekasi Barat', 'Bekasi Selatan', 'Bekasi Timur', 'Bekasi Utara', 'Bantargebang', 'Jatiasih', 'Jatisampurna', 'Medan Satria', 'Mustikajaya', 'Pondok Gede', 'Pondok Melati', 'Rawalumbu'];
export const COLUMNS = ['number', 'innovation', 'name', 'nik', 'nationality', 'address', 'province', 'city', 'district', 'country', 'postalCode', 'contact', 'legalEntity'];
export const NOTES = {
  geography: 'Sebaran berdasarkan domisili pencipta. Satu inovasi dapat tercatat di beberapa kecamatan.',
  teamSize: 'Ukuran tim adalah jumlah pencipta tercatat pada bagian A per inovasi. Pendamping dan pembimbing yang ditandai secara eksplisit disimpan terpisah dan tidak dihitung sebagai pencipta.',
  identity: 'Pencipta teridentifikasi dihitung unik berdasarkan NIK berformat 16 digit, bukan kemiripan nama; identitas belum diverifikasi terhadap Dukcapil. Catatan tanpa NIK tetap masuk ukuran tim, tetapi tidak masuk jumlah pencipta teridentifikasi.',
};
const ISSUE_LABELS = {
  missing_identity: 'Catatan pencipta tanpa identitas yang dapat dipastikan',
  invalid_identity: 'Format identitas perlu diperiksa',
  identity_conflict: 'Identitas sama dengan nama berbeda perlu diperiksa',
  holder_identity_review: 'Catatan pemegang tanpa identitas atau berisi gabungan nama',
  supervisor_role: 'Peran pendamping dan pembimbing dipertahankan terpisah',
  title_variant: 'Perbedaan judul antarbagian',
  geography_correction: 'Ejaan kecamatan dinormalisasi dengan catatan sumber',
  outside_city: 'Domisili di luar master kecamatan Kota Bekasi',
  missing_geography: 'Domisili kecamatan belum tersedia',
  invalid_contact: 'Kontak sumber perlu diperiksa',
  orphan_continuation: 'Baris lanjutan tanpa nomor sebelumnya pada bagian yang sama',
  missing_title: 'Judul inovasi belum tersedia',
  incomplete_sections: 'Nomor inovasi tidak tersedia pada kedua bagian',
};

export function space(value) { return String(value ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim(); }
function titleCase(value) { return space(value).toLocaleLowerCase('id-ID').replace(/(^|[\s-])\p{L}/gu, c => c.toLocaleUpperCase('id-ID')); }
function canonicalName(value) { return space(value).replace(/^(?:dosen\s+)?(?:pendamping|pembimbing)\s*:?\s*/i, '').replace(/[;,.\s]+$/g, '').toLocaleUpperCase('id-ID'); }
function nullable(value) { return space(value) || null; }

/** Quoted TSV parser, including embedded tabs/newlines and escaped double quotes. */
export function parseTsv(text) {
  const rows = []; let cells = [], cell = '', quoted = false, rowLine = 1, line = 1;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++; }
      else if (quoted || cell === '') quoted = !quoted;
      else cell += c;
    } else if (c === '\t' && !quoted) { cells.push(cell); cell = ''; }
    else if ((c === '\n' || c === '\r') && !quoted) {
      if (c === '\r' && text[i + 1] === '\n') i++;
      cells.push(cell); rows.push({ line: rowLine, cells }); cells = []; cell = ''; line++; rowLine = line;
    } else { cell += c; if (c === '\n') line++; }
  }
  if (quoted) throw new Error('TSV memiliki tanda kutip yang belum ditutup.');
  if (cell || cells.length) { cells.push(cell); rows.push({ line: rowLine, cells }); }
  return rows;
}

export function normalizeDistrict(value) {
  const raw = space(value); const key = raw.toLowerCase().replace(/[\s-]+/g, '');
  const exact = DISTRICTS.find(d => d.toLowerCase().replace(/\s/g, '') === key);
  if (exact) return { value: exact, status: 'matched', correction: null };
  const corrections = { rawalumnu: 'Rawalumbu', pondogede: 'Pondok Gede' };
  if (corrections[key]) return { value: corrections[key], status: 'corrected', correction: { original: raw, canonical: corrections[key], reference: key === 'pondogede' ? 'https://kec-pondokgede.bekasikota.go.id/User/sejarah' : 'https://geoportal.pertanian.go.id/arcgis/rest/services/Hosted/Batas_Administrasi_Desa/FeatureServer/0', reason: 'Ejaan sumber tidak ada dalam master 12 kecamatan Kota Bekasi; padanan nama resmi diverifikasi pada referensi geografis Kota Bekasi.' } };
  return { value: raw ? titleCase(raw) : null, status: raw ? 'outside-master' : 'missing', correction: null };
}

function normalizedFields(raw) {
  const district = normalizeDistrict(raw.district);
  const contact = nullable(raw.contact);
  const parts = (contact ?? '').split('/').map(part => space(part).replace(/^[:\s-]+/, '')).filter(Boolean);
  const emailMatch = parts.filter(part => part.includes('@'));
  const phoneMatch = parts.filter(part => /^(?:\+?62|0)[\d\s().-]+$/.test(part));
  const invalidContact = parts.some(part => part.includes('@')
    ? !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(part)
    : !/^(?:\+?62|0)\d{7,14}$/.test(part.replace(/[\s().-]/g, '')));
  return {
    name: canonicalName(raw.name) || null,
    nik: nullable(raw.nik)?.replace(/\s+/g, '') ?? null,
    nationality: titleCase(raw.nationality) || null,
    address: nullable(raw.address),
    province: /^dki\s+jakarta$/i.test(space(raw.province)) ? 'DKI Jakarta' : titleCase(raw.province) || null,
    city: titleCase(raw.city) || null,
    district: district.value,
    districtStatus: district.status,
    country: titleCase(raw.country) || null,
    postalCode: nullable(raw.postalCode),
    contact,
    emails: emailMatch,
    phones: phoneMatch.map(v => v.replace(/[^\d+]/g, '')),
    invalidContact,
    legalEntity: nullable(raw.legalEntity),
    geographyCorrection: district.correction,
  };
}

/** Replace one complete source snapshot; the private ID registry survives repeated imports. */
export function importSource(text, sourceId, previous = null) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/.test(sourceId)) throw new Error('Source ID harus berupa slug stabil.');
  const db = structuredClone(previous ?? { schemaVersion: 1, idRegistry: {}, sources: {} });
  if (db.schemaVersion !== 1) throw new Error('Versi penyimpanan feeder tidak didukung.');
  const id = (kind, key) => db.idRegistry[`${kind}:${key}`] ??= `${kind}_${randomUUID()}`;
  const model = { sourceId, digest: createHash('sha256').update(text).digest('hex'), innovations: [], people: [], creators: [], copyrightHolders: [], innovationCreators: [], innovationSupervisors: [], innovationHolders: [], sourceRows: [], reviewIssues: [] };
  const innovations = new Map(), people = new Map(), creators = new Map(), holders = new Map(), occurrences = new Map(), identityNames = new Map();
  const addIssue = (code, row, details = {}) => model.reviewIssues.push({ code, sourceRowId: row?.id ?? null, innovationId: row?.innovationId ?? null, ...details });
  let section = null, currentNo = null, currentTitle = null;
  for (const parsed of parseTsv(text.replace(/^\uFEFF/, ''))) {
    const first = space(parsed.cells[0]);
    if (/^A\.\s*DATA PENCIPTA/i.test(first) || /^B\.\s*DATA PEMEGANG/i.test(first)) {
      section = first[0]; currentNo = null; currentTitle = null; continue;
    }
    if (!section || /^No\.?$/i.test(first) || parsed.cells.every(v => !space(v))) continue;
    if (!parsed.cells.slice(0, 13).some(v => space(v))) continue;
    const raw = Object.fromEntries(COLUMNS.map((key, i) => [key, parsed.cells[i] ?? '']));
    if (first && !/^\d+$/.test(first)) { currentNo = null; currentTitle = null; continue; }
    if (first) { currentNo = String(Number(first)); currentTitle = nullable(raw.innovation); }
    else if (space(raw.innovation)) currentTitle = space(raw.innovation);
    if (!currentNo) { addIssue('orphan_continuation', null, { section, line: parsed.line, raw }); continue; }
    const innovationKey = `${sourceId}:${currentNo}`;
    if (!innovations.has(currentNo)) innovations.set(currentNo, { id: id('innovation', innovationKey), sourceId, sourceNumber: currentNo, title: currentTitle, titles: [], sections: [], verifiedOriginDistrict: db.sources[sourceId]?.innovations.find(i => i.sourceNumber === currentNo)?.verifiedOriginDistrict ?? null });
    const innovation = innovations.get(currentNo);
    if (!innovation.sections.includes(section)) innovation.sections.push(section);
    if (currentTitle && !innovation.titles.some(t => t.section === section && t.normalized === currentTitle)) innovation.titles.push({ section, raw: raw.innovation || currentTitle, normalized: space(currentTitle) });
    if (!innovation.title || section === 'A' && first) innovation.title = currentTitle;
    // Only No. and Inovasi are carried forward. Every other field comes from this row.
    const recordKey = `${sourceId}:${section}:${currentNo}`;
    const ordinal = (occurrences.get(recordKey) ?? 0) + 1; occurrences.set(recordKey, ordinal);
    const row = { id: id('row', `${recordKey}:${ordinal}`), sourceId, section, line: parsed.line, ordinal, innovationId: innovation.id, carried: { number: !first, innovation: !space(raw.innovation) }, raw, normalized: { number: currentNo, innovation: currentTitle, ...normalizedFields(raw) } };
    model.sourceRows.push(row);
    if (!space(raw.name)) continue;
    const name = row.normalized.name;
    const nik = row.normalized.nik;
    const validNik = Boolean(nik && /^\d{16}$/.test(nik));
    const supervisor = section === 'A' && /^(?:dosen\s+)?(?:pendamping|pembimbing)\b/i.test(space(raw.name));
    if (section === 'B') {
      // A holder cell can contain a list with ambiguous boundaries and academic titles.
      // Preserve that cell as a source assertion until a reviewer identifies each person.
      const composite = /;.+\S|,.+\S|(?:pendamping|pembimbing)\b/i.test(space(raw.name).replace(/[;,]+$/g, ''));
      const identified = validNik && !composite;
      const holderKey = identified ? `${sourceId}:nik:${nik}` : `${recordKey}:${ordinal}`;
      const holderId = id('holder', holderKey);
      if (!holders.has(holderId)) holders.set(holderId, { id: holderId, sourceId, identityStatus: identified ? 'identified' : 'review', kind: composite ? 'unresolved-composite' : 'person', sourceRowIds: [], rawName: raw.name, normalizedName: name, nik });
      holders.get(holderId).sourceRowIds.push(row.id);
      model.innovationHolders.push({ id: id('holder_relation', `${recordKey}:${ordinal}`), innovationId: innovation.id, holderId, sourceRowId: row.id, originalRoleDescription: raw.name });
      if (!identified) addIssue('holder_identity_review', row, { composite });
      continue;
    }
    let identityKey = validNik ? `${sourceId}:nik:${nik}` : `${recordKey}:${ordinal}`;
    if (validNik && identityNames.has(nik) && identityNames.get(nik) !== name) {
      // Exact NIK collisions with conflicting names are retained separately for review.
      identityKey += `:conflict:${name}`; addIssue('identity_conflict', row);
      const priorPerson = [...people.values()].find(person => person.nik === nik);
      if (priorPerson) {
        priorPerson.identityStatus = 'review';
        const priorCreator = [...creators.values()].find(creator => creator.personId === priorPerson.id);
        if (priorCreator) priorCreator.identityStatus = 'review';
      }
    } else if (validNik) identityNames.set(nik, name);
    const personId = id('person', identityKey);
    const identityStatus = !validNik ? 'unresolved' : identityKey.includes(':conflict:') ? 'review' : 'identified';
    if (!people.has(personId)) people.set(personId, { id: personId, sourceId, identityStatus, normalizedName: name, nik, sourceRowIds: [] });
    people.get(personId).sourceRowIds.push(row.id);
    if (!nik) addIssue('missing_identity', row);
    else if (!validNik) addIssue('invalid_identity', row);
    if (supervisor) {
      model.innovationSupervisors.push({ id: id('supervisor_relation', `${recordKey}:${ordinal}`), innovationId: innovation.id, personId, sourceRowId: row.id, role: /pembimbing/i.test(raw.name) ? 'pembimbing' : 'pendamping', originalRoleDescription: raw.name });
      addIssue('supervisor_role', row);
    } else {
      const creatorId = id('creator', personId);
      if (!creators.has(creatorId)) creators.set(creatorId, { id: creatorId, personId, sourceId, identityStatus });
      // The relationship is unique per innovation/person even if a source row repeats.
      let relation = model.innovationCreators.find(r => r.innovationId === innovation.id && r.creatorId === creatorId);
      if (!relation) { relation = { id: id('creator_relation', `${innovation.id}:${creatorId}`), innovationId: innovation.id, creatorId, sourceRowIds: [], districts: [] }; model.innovationCreators.push(relation); }
      relation.sourceRowIds.push(row.id);
      if (['matched', 'corrected'].includes(row.normalized.districtStatus) && !relation.districts.includes(row.normalized.district)) relation.districts.push(row.normalized.district);
      if (row.normalized.districtStatus === 'outside-master') addIssue('outside_city', row);
      if (row.normalized.districtStatus === 'missing') addIssue('missing_geography', row);
    }
    if (row.normalized.geographyCorrection) addIssue('geography_correction', row, { correction: row.normalized.geographyCorrection });
    if (row.normalized.invalidContact) addIssue('invalid_contact', row);
  }
  for (const innovation of innovations.values()) {
    if (!innovation.title) { innovation.title = ''; addIssue('missing_title', { innovationId: innovation.id }); }
    if (new Set(innovation.titles.map(t => t.normalized)).size > 1) addIssue('title_variant', { innovationId: innovation.id });
    if (innovation.sections.length < 2) addIssue('incomplete_sections', { innovationId: innovation.id });
  }
  model.innovations = [...innovations.values()].sort((a, b) => Number(a.sourceNumber) - Number(b.sourceNumber));
  model.people = [...people.values()]; model.creators = [...creators.values()]; model.copyrightHolders = [...holders.values()];
  db.sources[sourceId] = model;
  return db;
}

/** Strict allowlist projection: no raw/normalized identities, contacts or addresses. */
export function publicProjection(db, sourceId) {
  const source = db.sources[sourceId];
  if (!source) throw new Error('Feeder belum diimpor.');
  const innovations = source.innovations.map(innovation => {
    const relations = source.innovationCreators.filter(r => r.innovationId === innovation.id);
    const creatorIds = [...new Set(relations.map(r => r.creatorId))];
    const identifiedCreatorIds = creatorIds.filter(id => source.creators.find(c => c.id === id)?.identityStatus === 'identified');
    const holderRelations = source.innovationHolders.filter(r => r.innovationId === innovation.id);
    const holderIds = new Set(holderRelations.map(r => r.holderId).filter(id => source.copyrightHolders.find(h => h.id === id)?.identityStatus === 'identified'));
    const verifiedOrigin = DISTRICTS.includes(innovation.verifiedOriginDistrict) ? innovation.verifiedOriginDistrict : null;
    const districts = verifiedOrigin ? [verifiedOrigin] : [...new Set(relations.flatMap(r => r.districts))].sort((a, b) => DISTRICTS.indexOf(a) - DISTRICTS.indexOf(b));
    return { id: innovation.id, sourceNumber: innovation.sourceNumber, title: innovation.title, creatorIds, identifiedCreatorIds, creatorCount: creatorIds.length, unresolvedCreatorCount: creatorIds.length - identifiedCreatorIds.length, supervisorCount: source.innovationSupervisors.filter(r => r.innovationId === innovation.id).length, holderCount: holderIds.size, holderRecordCount: holderRelations.length, districts, geographyBasis: verifiedOrigin ? 'verified-origin' : 'creator-residence', mappingStatus: districts.length ? 'mapped' : 'unmapped', reviewFlags: [...new Set(source.reviewIssues.filter(i => i.innovationId === innovation.id).map(i => i.code))] };
  });
  const counts = new Map(); for (const issue of source.reviewIssues) counts.set(issue.code, (counts.get(issue.code) ?? 0) + 1);
  return { schemaVersion: 1, sourceId, sourceLabel: 'Form Isian Data Hak Cipta · Bagian A dan B', notes: NOTES, innovations, reviewSummary: [...counts].map(([code, count]) => ({ code, count, label: ISSUE_LABELS[code] ?? code })) };
}
