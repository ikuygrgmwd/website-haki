export type User = { id: string; name: string; email: string; role: 'Admin' | 'User'; active: boolean; phone: string; districtId: string | null; villageId: string | null; photoId: string | null };
export type Region = { id: string; level: string; parent_id: string | null; code: string; name: string; active: number };
export type Person = { name: string; address: string; districtId: string | null; villageId: string | null };
export type Attachment = { id: string; name: string; category: string };
export type WorkData = { type?: string; description?: string; announcedAt?: string; creators?: Person[]; holders?: Person[]; attachments?: Attachment[]; certificateId?: string | null; registrationNumber?: string; districts?: string[] };
export type Work = { id: string; owner_id: string | null; ownerName: string | null; code: string; title: string; kind: string; status: string | null; created_at: string | null; submitted_at: string | null; version: number; data: WorkData; source_id?: string };
export type Slide = { id: string; title: string; description: string; imageId: string; buttonText: string; url: string; visible: boolean };
export type About = { title?: string; html?: string; imageId?: string | null; visible?: boolean; updatedAt?: string; updatedBy?: string };
export type CareData = { participantType: string; name: string; groupType: string; university: string; members: string; districtId: string | null; program: string; trainingStatus: string; startDate: string; endDate: string; product: string; description: string; photos: string[] };
export type Care = { id: string; innovation_id: string; innovation: Work; data: CareData };
export const state: { user: User | null; csrf: string; setup: boolean; regions: Region[] } = { user: null, csrf: '', setup: false, regions: [] };
export async function api<T = unknown>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(`/api${path}`, { method, credentials: 'same-origin', headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(method !== 'GET' ? { 'X-CSRF-Token': state.csrf } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const result = await response.json().catch(() => ({ error: 'Layanan belum tersedia. Silakan coba kembali beberapa saat lagi.' }));
  if (!response.ok) throw new Error(result.error || 'Permintaan gagal.');
  return result as T;
}
export async function refreshSession() { const result = await api<{ user: User | null; csrf: string; setup: boolean }>('/session'); Object.assign(state, result); if (state.user) state.regions = await api<Region[]>('/regions'); }
export async function upload(file: File, purpose: string, innovationId?: string): Promise<Attachment> {
  const max = ['attachment', 'certificate'].includes(purpose) ? 8 : 2;
  if (file.size > max * 1024 * 1024) throw new Error(`Ukuran maksimal ${max} MB.`);
  const allowed = ['image/png', 'image/jpeg', 'image/webp', ...(['attachment', 'certificate'].includes(purpose) ? ['application/pdf'] : [])];
  if (!allowed.includes(file.type)) throw new Error('Format berkas tidak didukung. Gunakan PNG, JPG, WebP atau PDF untuk lampiran.');
  const prepared = await api<{ mode: 'inline' | 'storage'; id?: string; signedUrl?: string }>('/files/prepare', 'POST', { purpose, innovationId, name: file.name, size: file.size });
  if (prepared.mode === 'storage') {
    if (!prepared.id || !prepared.signedUrl) throw new Error('Izin unggah tidak valid.');
    const response = await fetch(prepared.signedUrl, { method: 'PUT', headers: { 'Content-Type': file.type, 'x-upsert': 'false' }, body: file });
    if (!response.ok) throw new Error('Unggahan gagal. Silakan coba kembali.');
    return api<Attachment>('/files/complete', 'POST', { id: prepared.id });
  }
  const base64 = await new Promise<string>((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result).split(',')[1]); r.onerror = reject; r.readAsDataURL(file); });
  return api<Attachment>('/files', 'POST', { purpose, innovationId, name: file.name, base64 });
}
