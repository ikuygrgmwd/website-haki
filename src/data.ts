export const DISTRICTS = ['Bekasi Barat', 'Bekasi Selatan', 'Bekasi Timur', 'Bekasi Utara', 'Bantargebang', 'Jatiasih', 'Jatisampurna', 'Medan Satria', 'Mustikajaya', 'Pondok Gede', 'Pondok Melati', 'Rawalumbu'] as const;
export type District = typeof DISTRICTS[number];
export type Innovation = {
  id: string; sourceNumber: string; title: string; creatorIds: string[]; identifiedCreatorIds: string[];
  creatorCount: number; unresolvedCreatorCount: number; supervisorCount: number; holderCount: number; holderRecordCount: number;
  districts: District[]; geographyBasis: 'verified-origin' | 'creator-residence'; mappingStatus: 'mapped' | 'unmapped'; reviewFlags: string[];
};
export type PublicDataset = {
  schemaVersion: 1; sourceId: string; sourceLabel: string;
  notes: { geography: string; teamSize: string; identity: string };
  innovations: Innovation[]; reviewSummary: { code: string; count: number; label: string }[];
};
export type Filters = { query?: string; district?: string | null; mapping?: 'all' | 'mapped' | 'unmapped' };
export type DistrictCount = { name: District; count: number };
export type Summary = {
  totalInnovations: number; uniqueCreators: number; creatorRelationships: number; unresolvedCreators: number;
  representedDistricts: number; unmappedInnovations: number; mappedInnovations: number; supervisorRelationships: number;
  districtCounts: DistrictCount[]; teamSizes: { label: string; count: number }[];
};

export function filterInnovations(dataset: PublicDataset | Innovation[], filters: Filters = {}): Innovation[] {
  const query = (filters.query ?? '').trim().toLocaleLowerCase('id-ID');
  const innovations = Array.isArray(dataset) ? dataset : dataset.innovations;
  return innovations.filter(i => (!query || `${i.title} ${i.sourceNumber}`.toLocaleLowerCase('id-ID').includes(query))
    && (!filters.district || i.districts.includes(filters.district as District))
    && (!filters.mapping || filters.mapping === 'all' || i.mappingStatus === filters.mapping));
}

export function summarize(innovations: Innovation[]): Summary {
  const unique = [...new Map(innovations.map(i => [i.id, i])).values()];
  const districtCounts = DISTRICTS.map(name => ({ name, count: unique.filter(i => i.districts.includes(name)).length }));
  const teamSizes = ['1', '2', '3', '4', '5+'].map((label, index) => ({ label, count: unique.filter(i => index === 4 ? i.creatorCount >= 5 : i.creatorCount === index + 1).length }));
  return {
    totalInnovations: unique.length,
    uniqueCreators: new Set(unique.flatMap(i => i.identifiedCreatorIds)).size,
    creatorRelationships: unique.reduce((sum, i) => sum + i.creatorCount, 0),
    unresolvedCreators: new Set(unique.flatMap(i => i.creatorIds.filter(id => !i.identifiedCreatorIds.includes(id)))).size,
    representedDistricts: districtCounts.filter(d => d.count > 0).length,
    mappedInnovations: unique.filter(i => i.mappingStatus === 'mapped').length,
    unmappedInnovations: unique.filter(i => i.mappingStatus === 'unmapped').length,
    supervisorRelationships: unique.reduce((sum, i) => sum + i.supervisorCount, 0),
    districtCounts: districtCounts.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'id')),
    teamSizes,
  };
}

export function validateDataset(value: unknown): PublicDataset {
  if (!value || typeof value !== 'object') throw new Error('Format feeder tidak valid.');
  const data = value as PublicDataset;
  if (data.schemaVersion !== 1 || !Array.isArray(data.innovations) || !data.notes || !Array.isArray(data.reviewSummary)) throw new Error('Skema feeder tidak didukung.');
  const ids = new Set<string>();
  for (const i of data.innovations) {
    if (!i || typeof i.id !== 'string' || typeof i.title !== 'string' || typeof i.sourceNumber !== 'string'
      || ids.has(i.id) || !Array.isArray(i.creatorIds) || !Array.isArray(i.identifiedCreatorIds) || !Array.isArray(i.districts)
      || !Array.isArray(i.reviewFlags) || i.districts.some(d => !DISTRICTS.includes(d))
      || !Number.isInteger(i.creatorCount) || i.creatorCount !== new Set(i.creatorIds).size
      || i.identifiedCreatorIds.some(id => !i.creatorIds.includes(id))
      || i.mappingStatus !== (i.districts.length ? 'mapped' : 'unmapped')) throw new Error('Data feeder tidak konsisten.');
    ids.add(i.id);
  }
  return data;
}

export async function loadDataset(): Promise<PublicDataset> {
  const response = await fetch(`${import.meta.env.BASE_URL}data/innovations.json`, { cache: 'no-cache', signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`Feeder tidak dapat dimuat (${response.status}).`);
  return validateDataset(await response.json());
}
