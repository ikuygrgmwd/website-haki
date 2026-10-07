import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { importSource, publicProjection, parseTsv, normalizeDistrict, COLUMNS } from '../scripts/feeder-lib.mjs';
import { summarize, filterInnovations, validateDataset, DISTRICTS } from '../src/data.ts';
import { getLegend, countColor } from '../src/map-scale.ts';

const row = values => COLUMNS.map(column => values[column] ?? '').join('\t');
const source = (a, b = []) => ['A. DATA PENCIPTA HAK CIPTA', ...a.map(row), 'B. DATA PEMEGANG HAK CIPTA', ...b.map(row)].join('\n');
const fixture = source([
  { number:'1', innovation:'Contoh Satu', name:'Pencipta Contoh', nik:'0000 0000 0000 0001', district:'Bekasi Utara', address:'ALAMAT PRIVAT CONTOH', contact:'contoh@example.invalid/081234567890', postalCode:'00123' },
  { name:'Pencipta Kedua', nik:'0000000000000002', district:'Bekasi Utara' },
  { name:'Pencipta Ketiga', nik:'0000000000000003', district:'Rawalumnu' },
  { name:'Dosen Pembimbing: Pengajar Contoh', nik:'0000000000000004', district:'Bekasi Barat' },
  { number:'2', innovation:'Contoh Dua', name:'Pencipta Contoh', nik:'0000000000000001', district:'Pondogede' },
  { name:'Nama Serupa' }, { name:'Nama Serupa' },
  { number:'3', innovation:'Contoh Luar', name:'Warga Luar', district:'Tambun Selatan', city:'Bekasi' },
  { number:'4', innovation:'Tanpa Lokasi', name:'Warga Tanpa Lokasi' },
], [
  { name:'Baris yatim tidak boleh mewarisi bagian A' },
  { number:'1', innovation:'Contoh Satu', name:'Pencipta Contoh', nik:'0000000000000001' },
  { number:'2', innovation:'Contoh  Dua berbeda', name:'Nama Satu; Nama Dua' },
  { number:'3', innovation:'Contoh Luar', name:'Warga Luar' },
  { number:'4', innovation:'Tanpa Lokasi', name:'Warga Tanpa Lokasi' },
]);

test('A/B join by source number; reimport updates without duplicate IDs or relationships', () => {
  const db = importSource(fixture, 'fixture');
  const again = importSource(fixture, 'fixture', db);
  assert.deepEqual(again, db);
  assert.equal(db.sources.fixture.innovations.length, 4);
  const update = importSource(fixture.replaceAll('Contoh Satu', 'Judul Diubah'), 'fixture', db);
  assert.equal(update.sources.fixture.innovations[0].id, db.sources.fixture.innovations[0].id);
  assert.equal(update.sources.fixture.innovations[0].title, 'Judul Diubah');
  assert.equal(update.sources.fixture.innovationCreators.length, db.sources.fixture.innovationCreators.length);
  const otherSource = importSource(fixture, 'another', db);
  assert.notEqual(otherSource.sources.another.innovations[0].id, db.sources.fixture.innovations[0].id);
});

test('continuations carry only innovation/number inside the same section; original strings preserved', () => {
  const model = importSource(fixture, 'fixture').sources.fixture;
  assert.equal(model.sourceRows[1].normalized.number, '1');
  assert.equal(model.sourceRows[1].normalized.address, null);
  assert.equal(model.sourceRows[5].normalized.district, null);
  assert.equal(model.sourceRows[5].normalized.nik, null);
  assert.equal(model.sourceRows[0].raw.nik, '0000 0000 0000 0001');
  assert.equal(model.sourceRows[0].normalized.nik, '0000000000000001');
  assert.equal(model.sourceRows[0].normalized.postalCode, '00123');
  assert.equal(typeof model.sourceRows[0].normalized.phones[0], 'string');
  assert.ok(model.reviewIssues.some(i => i.code === 'orphan_continuation'));
  assert.equal(model.innovationHolders.length, 4);
});

test('geography deduplicates within a district, permits multiple districts, and excludes outsiders/supervisors', () => {
  const data = publicProjection(importSource(fixture, 'fixture'), 'fixture');
  const summary = summarize(data.innovations);
  assert.equal(summary.districtCounts.find(d => d.name === 'Bekasi Utara').count, 1);
  assert.deepEqual(data.innovations[0].districts, ['Bekasi Utara','Rawalumbu']);
  assert.equal(summary.districtCounts.find(d => d.name === 'Bekasi Barat').count, 0);
  assert.equal(summary.mappedInnovations, 2);
  assert.equal(summary.unmappedInnovations, 2);
  assert.equal(summary.totalInnovations, 4);
  assert.equal(data.innovations[0].supervisorCount, 1);
  assert.equal(data.innovations[0].creatorCount, 3);
  assert.equal(normalizeDistrict('Pondogede').value, 'Pondok Gede');
  assert.equal(normalizeDistrict('Cabang BUngin').status, 'outside-master');
});

test('similar names without identity remain separate; explicit roles retained and verified origin takes precedence', () => {
  const db = importSource(fixture, 'fixture');
  const data = publicProjection(db, 'fixture');
  assert.equal(summarize(data.innovations).uniqueCreators, 3);
  assert.equal(data.innovations[1].creatorCount, 3);
  assert.equal(data.innovations[1].unresolvedCreatorCount, 2);
  assert.match(db.sources.fixture.innovationSupervisors[0].originalRoleDescription, /Dosen Pembimbing/);
  db.sources.fixture.innovations[0].verifiedOriginDistrict = 'Medan Satria';
  const again = importSource(fixture, 'fixture', db);
  assert.deepEqual(publicProjection(again, 'fixture').innovations[0].districts, ['Medan Satria']);
});

test('conflicting identity and composite holders stay under review', () => {
  const db = importSource(source([
    {number:'1', innovation:'Contoh', name:'Nama A', nik:'0000000000000001'},
    {name:'Nama B', nik:'0000000000000001'},
  ], [{number:'1', innovation:'Contoh', name:'Nama A; Nama B'}]), 'fixture');
  const projection = publicProjection(db, 'fixture');
  assert.equal(projection.innovations[0].identifiedCreatorIds.length, 0);
  assert.equal(projection.innovations[0].creatorCount, 2);
  assert.equal(projection.innovations[0].holderCount, 0);
  assert.equal(projection.innovations[0].holderRecordCount, 1);
  assert.ok(projection.innovations[0].reviewFlags.includes('holder_identity_review'));
});

test('public allowlist excludes identity, address, names and contacts, even from review details', () => {
  const data = publicProjection(importSource(fixture, 'fixture'), 'fixture');
  const json = JSON.stringify(data);
  for (const sensitive of ['0000000000000001','ALAMAT PRIVAT CONTOH','contoh@example.invalid','081234567890','Pencipta Contoh','Nama Satu; Nama Dua']) assert.ok(!json.includes(sensitive));
  assert.doesNotMatch(json, /"(?:nik|address|contact|emails|phones|raw|normalized|postalCode)"\s*:/);
});

test('quoted TSV accepts embedded tab/newline and rejects incomplete quotes', () => {
  assert.deepEqual(parseTsv('"nama\tdengan tab"\t"dua\nbaris"')[0].cells, ['nama\tdengan tab','dua\nbaris']);
  assert.throws(() => parseTsv('"belum ditutup'), /kutip/);
});

test('choropleth has contiguous numerical ranges and progressively darker colors', () => {
  const counts=[{name:'Example',count:9}];
  const legend=getLegend(counts);
  assert.deepEqual(legend.map(r=>[r.min,r.max]),[[0,0],[1,2],[3,4],[5,6],[7,9]]);
  for(let n=0;n<=9;n++) assert.equal(legend.filter(r=>n>=r.min && n<=r.max).length,1);
  const lightness=color=>color.slice(1).match(/../g).map(x=>parseInt(x,16)).reduce((a,b)=>a+b);
  const levels=legend.slice(1).map(r=>lightness(r.color));
  assert.ok(levels.every((value,i)=>i===0 || value<levels[i-1]));
  assert.notEqual(countColor(0,counts),countColor(1,counts));
  assert.deepEqual(getLegend([]).map(r=>r.label),['0 inovasi']);
});

test('delivered demo has consistent counts and every district filter matches summary/list', () => {
  const data = validateDataset(JSON.parse(readFileSync(new URL('../public/data/innovations.json', import.meta.url))));
  const s = summarize(data.innovations);
  assert.equal(data.sourceId, 'sapatri-demo');
  assert.deepEqual([s.totalInnovations,s.uniqueCreators,s.creatorRelationships,s.unresolvedCreators,s.representedDistricts,s.mappedInnovations,s.unmappedInnovations,s.supervisorRelationships], [36,106,106,0,12,36,0,0]);
  assert.deepEqual(s.teamSizes.map(t=>t.count), [8,7,7,7,7]);
  assert.ok(data.innovations.every(i => i.id.startsWith('demo-work-')));
  for (const district of s.districtCounts) assert.equal(filterInnovations(data,{district:district.name}).length,district.count);
  assert.equal(filterInnovations(data,{query:'PilahKita'}).length,1);
  assert.equal(filterInnovations(data,{query:'nothing matches'}).length,0);
  assert.equal(summarize([...data.innovations,data.innovations[0]]).totalInnovations,36);
  assert.equal(summarize([]).totalInnovations,0);
});

test('delivered geometry contains exactly the 12 master districts and a separate city outline', () => {
  const geometry = JSON.parse(readFileSync(new URL('../public/data/bekasi-kecamatan.geojson',import.meta.url)));
  const city = JSON.parse(readFileSync(new URL('../public/data/bekasi-boundary.geojson',import.meta.url)));
  assert.equal(geometry.features.length,12);
  assert.deepEqual(geometry.features.map(f=>f.properties.name).sort(),[...DISTRICTS].sort());
  assert.equal(city.features.length,1);
  for (const f of geometry.features) { assert.ok(['Polygon','MultiPolygon'].includes(f.geometry.type)); assert.match(f.properties.code,/^32\.75\./); }
});

const privateFile = new URL('../private-data/bekasi-hak-cipta.tsv', import.meta.url);
test('local real feeder reimport and public privacy check', {skip:!existsSync(privateFile)}, () => {
  const original = readFileSync(privateFile,'utf8');
  const db = importSource(original,'bekasi-hak-cipta');
  assert.deepEqual(importSource(original,'bekasi-hak-cipta',db),db);
  const projection = publicProjection(db,'bekasi-hak-cipta');
  assert.equal(summarize(projection.innovations).uniqueCreators,51);
  const json = JSON.stringify(projection);
  for (const row of db.sources['bekasi-hak-cipta'].sourceRows) {
    for (const key of ['nik','address','contact']) if (row.raw[key]?.trim()) assert.ok(!json.includes(row.raw[key].trim()), `Public leak of ${key}`);
  }
});
