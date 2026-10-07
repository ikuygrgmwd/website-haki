import { sqliteDatabase } from './database.mjs';
import { bufferedResponse } from './response.mjs';
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import sharp from 'sharp';
import sanitizeHtml from 'sanitize-html';
import { openStore, uid, token, digest, now, publicUser, hashPassword, verifyPassword } from './store.mjs';
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
// Drain every validation query before rollback/releasing a pooled connection.
const completeAll = async promises => {
    const results = await Promise.allSettled(promises);
    const failed = results.find(result => result.status === 'rejected');
    if (failed) throw failed.reason;
    return results.map(result => result.value);
};
const text = (v, max = 200) => typeof v === 'string' ? v.trim().slice(0, max) : '';
const email = v => { const s = text(v, 150).toLowerCase(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s))
    fail('Email tidak valid.'); return s; };
const role = v => { if (!['Admin', 'User'].includes(v))
    fail('Role harus Admin atau User.'); return v; };
const levels = ['provinsi', 'kota', 'kecamatan', 'kelurahan'];
const transitions = { Draft: ['Diajukan'], Diajukan: ['Diproses'], Diproses: ['Perlu Revisi', 'Selesai'], 'Perlu Revisi': ['Diajukan'], Selesai: ['Diproses'] };
const cleanHtml = html => sanitizeHtml(text(html, 30000), { allowedTags: ['p', 'br', 'strong', 'em', 'u', 'ul', 'ol', 'li', 'a', 'h2', 'h3'], allowedAttributes: { a: ['href'] }, allowedSchemes: ['https', 'http'], allowProtocolRelative: false });
const safeLink = v => { const s = text(v, 500); if (s && !/^(https:\/\/[^\s]+|#\/[\w/?=&%-]*)$/.test(s))
    fail('Tautan harus HTTPS atau jalur internal #/.'); return s; };
export async function createApplication({ database, storage = null, dbPath = 'private-data/sapatri.sqlite', seed = true, bootstrapToken = token(), secureCookies = process.env.NODE_ENV === 'production' } = {}) {
    const db = database ? database.raw : openStore(dbPath, seed);
    database ||= sqliteDatabase(db);
    const q = (...p) => database.q(...p);
    const one = (...p) => database.one(...p);
    const run = (...p) => database.run(...p);
    const transaction = fn => database.transaction(fn);
    const audit = async (u, action, id) => (await run('INSERT INTO audit(actor_id,action,record_id,created_at) VALUES(?,?,?,?)', u?.id || null, action, id || null, now()));
    const admin = u => { if (u?.role !== 'Admin')
        fail('Akses hanya untuk Admin.', 403); };
    const getInnovation = async (id, u) => { const row = (await one('SELECT * FROM innovations WHERE id=?', id)); if (!row || (u.role !== 'Admin' && row.owner_id !== u.id))
        fail('Ciptaan tidak ditemukan.', 404); return row; };
    const expand = async (row) => ({ ...row, data: JSON.parse(row.data), ownerName: (await one('SELECT name FROM users WHERE id=?', row.owner_id))?.name || null });
    const getContent = async (key) => JSON.parse((await one('SELECT data FROM content WHERE key=?', key))?.data || (key === 'carousel' ? '[]' : '{}'));
    const setContent = async (key, data) => (await run('INSERT INTO content(key,data) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET data=excluded.data', key, JSON.stringify(data)));
    const activeRegion = async (id, level) => { const r = (await one('SELECT * FROM regions WHERE id=? AND level=? AND active=1', id || '', level)); if (!r)
        fail(`Pilihan ${level} tidak aktif atau tidak valid.`); return r; };
    async function address(data, required = false) {
        if (required && (!data.districtId || !data.villageId || !text(data.address, 500)))
            fail('Lengkapi alamat, kecamatan, dan kelurahan.');
        if (data.districtId)
            (await activeRegion(data.districtId, 'kecamatan'));
        if (data.villageId && (await activeRegion(data.villageId, 'kelurahan')).parent_id !== data.districtId)
            fail('Kelurahan tidak sesuai kecamatan.');
    }
    async function checkFile(id, purpose, u, innovationId) {
        if (!id)
            return null;
        const f = (await one('SELECT id,purpose,owner_id,innovation_id,mime FROM files WHERE id=?', id));
        if (!f || f.purpose !== purpose || (innovationId ? f.innovation_id !== innovationId : f.owner_id !== u.id && u.role !== 'Admin'))
            fail('Berkas tidak valid atau bukan milik Anda.');
        return id;
    }
    async function validateApplication(row) {
        const d = JSON.parse(row.data);
        if (!row.owner_id || !text(row.title) || !text(d.type) || !text(d.description, 5000))
            fail('Lengkapi pemilik, judul, jenis ciptaan, dan uraian.');
        if (!Array.isArray(d.creators) || !d.creators.length || !Array.isArray(d.holders) || !d.holders.length)
            fail('Tambahkan pencipta dan pemegang hak.');
        for (const p of [...d.creators, ...d.holders]) {
            if (!text(p.name))
                fail('Nama pencipta dan pemegang hak wajib diisi.');
            (await address(p, true));
        }
        for (const key of ['identitas', 'pernyataan', 'contoh']) {
            const attachment = d.attachments?.find(a => a.category === key && a.id);
            if (!attachment || !(await one("SELECT id FROM files WHERE id=? AND innovation_id=? AND purpose='attachment'", attachment.id, row.id)))
                fail('Lampiran identitas, surat pernyataan, dan contoh ciptaan wajib diunggah.');
        }
    }
    const attempts = new Map();
    function limit(req) {
        if (database.consumeAttempt) return;
        const key = req.socket.remoteAddress || 'local';
        const previous = attempts.get(key);
        const a = previous && previous.until > Date.now() ? previous : { count: 0, until: Date.now() + 15 * 60000 };
        a.count++;
        attempts.set(key, a);
        if (a.count > 30)
            fail('Terlalu banyak percobaan. Coba lagi dalam 15 menit.', 429);
        if (attempts.size > 10000)
            for (const [k, v] of attempts)
                if (v.until < Date.now())
                    attempts.delete(k);
    }
    async function body(req) {
        if (!req.headers['content-type']?.startsWith('application/json'))
            fail('Gunakan format JSON.', 415);
        if (req.body !== undefined) {
            let value;
            try { value = typeof req.body === 'string' || Buffer.isBuffer(req.body) ? JSON.parse(String(req.body)) : req.body; }
            catch { fail('JSON tidak valid.'); }
            if (!value || typeof value !== 'object' || Array.isArray(value)) fail('JSON tidak valid.');
            if (Buffer.byteLength(JSON.stringify(value)) > 12 * 1024 * 1024) fail('Berkas terlalu besar.', 413);
            return value;
        }
        let size = 0;
        const chunks = [];
        for await (const chunk of req) {
            size += chunk.length;
            if (size > 12 * 1024 * 1024)
                fail('Berkas terlalu besar.', 413);
            chunks.push(chunk);
        }
        try {
            const value = JSON.parse(Buffer.concat(chunks).toString());
            if (!value || typeof value !== 'object' || Array.isArray(value))
                fail('Data tidak valid.');
            return value;
        }
        catch {
            fail('JSON tidak valid.');
        }
    }
    function json(res, value, status = 200) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(value)); }
    const cookie = (res, value, age = 43200) => res.setHeader('Set-Cookie', `sapatri=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${secureCookies ? '; Secure' : ''}`);
    async function session(req) {
        const value = (req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith('sapatri='))?.slice(8);
        if (!value)
            return null;
        const s = (await one('SELECT * FROM sessions WHERE hash=? AND expires>?', digest(value), Date.now()));
        if (!s)
            return null;
        const u = (await one('SELECT * FROM users WHERE id=? AND active=1', s.user_id));
        return u ? { ...s, user: u } : null;
    }
    const dispatch = async (req, res) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Referrer-Policy', 'no-referrer');
        res.setHeader('X-Frame-Options', 'DENY');
        {
            const url = new URL(req.url, 'http://localhost');
            const path = url.pathname;
            const method = req.method;
            if (!path.startsWith('/api/')) {
                const root = resolve('dist');
                const file = resolve(root, '.' + decodeURIComponent(path === '/' ? '/index.html' : path));
                if (!file.startsWith(root + sep) || !existsSync(file))
                    fail('Halaman tidak ditemukan.', 404);
                const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.geojson': 'application/geo+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
                res.setHeader('Content-Type', types[extname(file)] || 'application/octet-stream');
                res.end(readFileSync(file));
                return;
            }
            const s = (await session(req));
            const u = s?.user;
            const mutating = !['GET', 'HEAD'].includes(method);
            if (mutating) {
                const origin = req.headers.origin;
                const host = req.headers.host;
                if (req.headers['sec-fetch-site'] === 'cross-site' || (origin && new URL(origin).host !== host))
                    fail('Asal permintaan tidak diizinkan.', 403);
            }
            if (path === '/api/session' && method === 'GET')
                return json(res, { user: publicUser(u) || null, csrf: s?.csrf || '', setup: !(await one('SELECT id FROM users LIMIT 1')) });
            if (path === '/api/landing' && method === 'GET')
                return json(res, { slides: (await getContent('carousel')).filter(x => x.visible), about: (await getContent('about')).visible ? (await getContent('about')) : null });
            if (['/api/setup', '/api/login', '/api/reset-password'].includes(path) && method === 'POST') {
                limit(req);
                const b = await body(req);
                if (path === '/api/setup') {
                    if ((await one('SELECT id FROM users LIMIT 1')))
                        fail('Admin awal sudah dibuat.', 409);
                    if (typeof b.token !== 'string' || digest(b.token) !== digest(bootstrapToken))
                        fail('Kode penyiapan tidak valid.', 403);
                    const id = uid();
                    const name = text(b.name);
                    if (!name)
                        fail('Nama wajib diisi.');
                    const passwordHash = await hashPassword(b.password);
                    const mail = email(b.email);
                    // Check again after the asynchronous password derivation.
                    (await transaction(async () => { if ((await one('SELECT id FROM users LIMIT 1')))
                        fail('Admin awal sudah dibuat.', 409); (await run('INSERT INTO users(id,name,email,password_hash,role,created_at) VALUES(?,?,?,?,?,?)', id, name, mail, passwordHash, 'Admin', now())); }));
                    return json(res, { message: 'Admin berhasil dibuat. Silakan masuk.' }, 201);
                }
                if (path === '/api/reset-password') {
                    const r = (await one('SELECT * FROM resets WHERE hash=? AND expires>?', digest(text(b.token, 100)), Date.now()));
                    if (!r)
                        fail('Tautan reset tidak valid atau sudah kedaluwarsa.');
                    if (b.password !== b.confirm)
                        fail('Konfirmasi password tidak sama.');
                    const hash = await hashPassword(b.password);
                    (await transaction(async () => { if (!(await one('SELECT hash FROM resets WHERE hash=? AND expires>?', r.hash, Date.now())))
                        fail('Tautan reset sudah digunakan.'); (await run('UPDATE users SET password_hash=? WHERE id=?', hash, r.user_id)); (await run('DELETE FROM sessions WHERE user_id=?', r.user_id)); (await run('DELETE FROM resets WHERE user_id=?', r.user_id)); }));
                    return json(res, { message: 'Password diperbarui. Silakan masuk.' });
                }
                const account = (await one('SELECT * FROM users WHERE email=? AND active=1', email(b.email)));
                const valid = await verifyPassword(b.password, account?.password_hash || '00000000000000000000000000000000:' + '00'.repeat(64));
                if (!account || !valid)
                    fail('Email atau password tidak sesuai.', 401);
                const value = token(), csrf = token();
                (await run('DELETE FROM sessions WHERE expires<?', Date.now()));
                (await run('INSERT INTO sessions(hash,user_id,csrf,expires) VALUES(?,?,?,?)', digest(value), account.id, csrf, Date.now() + 43200000));
                cookie(res, value);
                return json(res, { user: publicUser(account), csrf });
            }
            // Public images are exposed only while referenced by published content.
            if (path.startsWith('/api/files/') && method === 'GET') {
                const id = path.split('/')[3];
                const f = (await one('SELECT * FROM files WHERE id=?', id));
                if (!f)
                    fail('Berkas tidak ditemukan.', 404);
                const about = (await getContent('about'));
                const published = f.purpose === 'landing' && ((await getContent('carousel')).some(x => x.visible && x.imageId === id) || (about.visible && about.imageId === id));
                if (!published) {
                    if (!u)
                        fail('Silakan masuk.', 401);
                    if (f.innovation_id)
                        (await getInnovation(f.innovation_id, u));
                    else if (u.role !== 'Admin' && f.owner_id !== u.id)
                        fail('Berkas tidak ditemukan.', 404);
                }
                if (f.storage_path) {
                    if (!storage) fail('Penyimpanan berkas belum dikonfigurasi.', 503);
                    res.setHeader('Location', await storage.signDownload(f.storage_path, f.name, f.mime));
                    res.setHeader('Cache-Control', 'private, no-store');
                    res.writeHead(302);
                    res.end();
                    return;
                }
                res.setHeader('Content-Type', f.mime);
                res.setHeader('Cache-Control', 'private, no-store');
                res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
                res.setHeader('Content-Disposition', `${f.mime.startsWith('image/') ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(f.name)}`);
                res.end(Buffer.from(f.bytes));
                return;
            }
            if (!u)
                fail('Silakan masuk terlebih dahulu.', 401);
            if (mutating && req.headers['x-csrf-token'] !== s.csrf)
                fail('Sesi tidak valid. Muat ulang halaman.', 403);
            if (path === '/api/logout' && method === 'POST') {
                (await run('DELETE FROM sessions WHERE hash=?', s.hash));
                cookie(res, '', 0);
                return json(res, { ok: true });
            }
            if (path === '/api/profile' && method === 'PUT') {
                const b = await body(req);
                const name = text(b.name);
                if (!name)
                    fail('Nama wajib diisi.');
                (await address(b));
                const phone = text(b.phone, 20);
                if (phone && !/^(\+62|08)[0-9]{7,13}$/.test(phone))
                    fail('Nomor HP harus diawali 08 atau +62.');
                (await checkFile(b.photoId, 'avatar', u));
                (await run('UPDATE users SET name=?,email=?,phone=?,district_id=?,village_id=?,photo_id=? WHERE id=?', name, u.role === 'Admin' ? email(b.email) : u.email, phone, b.districtId || null, b.villageId || null, b.photoId || null, u.id));
                return json(res, publicUser((await one('SELECT * FROM users WHERE id=?', u.id))));
            }
            if (path === '/api/password' && method === 'PUT') {
                const b = await body(req);
                limit(req);
                if (!await verifyPassword(b.oldPassword, u.password_hash))
                    fail('Password lama tidak sesuai.');
                if (b.password === b.oldPassword || b.password !== b.confirm)
                    fail('Gunakan password baru dan konfirmasi yang sama.');
                const hash = await hashPassword(b.password);
                (await transaction(async () => { (await run('UPDATE users SET password_hash=? WHERE id=?', hash, u.id)); (await run('DELETE FROM sessions WHERE user_id=? AND hash<>?', u.id, s.hash)); (await run('DELETE FROM resets WHERE user_id=?', u.id)); }));
                return json(res, { message: 'Password diperbarui. Sesi perangkat lain diakhiri.' });
            }
            if (path === '/api/users' && method === 'GET') {
                admin(u);
                return json(res, (await q('SELECT * FROM users ORDER BY name')).map(publicUser));
            }
            if (path === '/api/users' && method === 'POST') {
                admin(u);
                const b = await body(req);
                const name = text(b.name);
                if (!name)
                    fail('Nama wajib diisi.');
                const id = uid();
                const hash = await hashPassword(b.password);
                (await run('INSERT INTO users(id,name,email,password_hash,role,active,created_at) VALUES(?,?,?,?,?,?,?)', id, name, email(b.email), hash, role(b.role), b.active === false ? 0 : 1, now()));
                (await audit(u, 'pengguna.tambah', id));
                return json(res, publicUser((await one('SELECT * FROM users WHERE id=?', id))), 201);
            }
            const userMatch = path.match(/^\/api\/users\/([^/]+)(\/reset)?$/);
            if (userMatch) {
                admin(u);
                const id = userMatch[1];
                const target = (await one('SELECT * FROM users WHERE id=?', id));
                if (!target)
                    fail('Pengguna tidak ditemukan.', 404);
                if (userMatch[2] && method === 'POST') {
                    const value = token();
                    (await run('DELETE FROM resets WHERE user_id=?', id));
                    (await run('INSERT INTO resets(hash,user_id,expires) VALUES(?,?,?)', digest(value), id, Date.now() + 15 * 60000));
                    (await run('DELETE FROM sessions WHERE user_id=?', id));
                    (await audit(u, 'password.reset', id));
                    return json(res, { token: value, message: 'Tautan berlaku 15 menit dan hanya dapat digunakan sekali. Sampaikan secara pribadi kepada pemilik akun.' });
                }
                if (method === 'PUT' && !userMatch[2]) {
                    const b = await body(req);
                    const r = role(b.role);
                    const active = b.active ? 1 : 0;
                    const name = text(b.name);
                    if (!name)
                        fail('Nama wajib diisi.');
                    const current = (await one('SELECT * FROM users WHERE id=?', id));
                    if (current.role === 'Admin' && current.active && (r !== 'Admin' || !active) && (await one("SELECT COUNT(*) AS n FROM users WHERE role='Admin' AND active=1")).n <= 1)
                        fail('Admin aktif terakhir tidak dapat dinonaktifkan atau diubah rolenya.');
                    (await transaction(async () => { (await run('UPDATE users SET name=?,email=?,role=?,active=? WHERE id=?', name, email(b.email), r, active, id)); if (!active || r !== target.role)
                        (await run('DELETE FROM sessions WHERE user_id=?', id)); }));
                    (await audit(u, 'pengguna.ubah', id));
                    return json(res, publicUser((await one('SELECT * FROM users WHERE id=?', id))));
                }
            }
            if (path === '/api/regions' && method === 'GET')
                return json(res, (await q('SELECT * FROM regions ORDER BY name')));
            const regionMatch = path.match(/^\/api\/regions(?:\/([^/]+))?$/);
            if (regionMatch && ['POST', 'PUT', 'DELETE'].includes(method)) {
                admin(u);
                const id = regionMatch[1] || uid();
                const old = (await one('SELECT * FROM regions WHERE id=?', id));
                if (method !== 'POST' && !old)
                    fail('Wilayah tidak ditemukan.', 404);
                if (method === 'DELETE') {
                    const referenced = (await one('SELECT id FROM regions WHERE parent_id=?', id)) || (await one('SELECT id FROM users WHERE district_id=? OR village_id=?', id, id)) || (await q('SELECT data FROM innovations')).some(x => { const d = JSON.parse(x.data); return [...(d.creators || []), ...(d.holders || [])].some(p => p.districtId === id || p.villageId === id); }) || (await q('SELECT data FROM aftercare')).some(x => JSON.parse(x.data).districtId === id);
                    if (referenced)
                        fail('Wilayah sedang dipakai. Nonaktifkan sebagai gantinya.');
                    (await run('DELETE FROM regions WHERE id=?', id));
                    return json(res, { ok: true });
                }
                const b = await body(req);
                if (!levels.includes(b.level) || !text(b.name) || !text(b.code, 40))
                    fail('Lengkapi jenis, kode, dan nama wilayah.');
                const index = levels.indexOf(b.level);
                const parent = index ? (await activeRegion(b.parentId, levels[index - 1])) : null;
                if (old && (old.level !== b.level || old.parent_id !== (parent?.id || null)))
                    fail('Jenis dan induk wilayah yang sudah tersimpan tidak dapat diubah.');
                if ((await one('SELECT id FROM regions WHERE name=? AND parent_id IS ? AND id<>?', text(b.name), parent?.id || null, id)))
                    fail('Nama sudah dipakai pada wilayah induk ini.');
                (await transaction(async () => {
                    (await run('INSERT INTO regions(id,level,parent_id,code,name,active) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET code=excluded.code,name=excluded.name,active=excluded.active', id, b.level, parent?.id || null, text(b.code, 40), text(b.name), b.active ? 1 : 0));
                    if (!b.active)
                        (await run('WITH RECURSIVE descendants(id) AS (SELECT id FROM regions WHERE parent_id=? UNION ALL SELECT r.id FROM regions r JOIN descendants d ON r.parent_id=d.id) UPDATE regions SET active=0 WHERE id IN (SELECT id FROM descendants)', id));
                }));
                (await audit(u, 'wilayah.simpan', id));
                return json(res, (await one('SELECT * FROM regions WHERE id=?', id)));
            }
            if (path === '/api/innovations' && method === 'GET')
                return json(res, (await completeAll((u.role === 'Admin' ? (await q('SELECT * FROM innovations ORDER BY updated_at DESC')) : (await q('SELECT * FROM innovations WHERE owner_id=? ORDER BY updated_at DESC', u.id))).map(expand))));
            if (path === '/api/innovations' && method === 'POST') {
                const b = await body(req);
                const id = text(b.id, 50) || uid();
                if (!/^[a-f0-9-]{36}$/.test(id))
                    fail('ID tidak valid.');
                const existing = (await one('SELECT * FROM innovations WHERE id=?', id));
                if (existing)
                    return json(res, (await expand((await getInnovation(id, u)))));
                const kind = b.kind === 'Hak Terkait' ? 'Hak Terkait' : 'Hak Cipta';
                (await run('INSERT INTO innovations(id,owner_id,code,title,kind,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)', id, u.id, `SP-${id.slice(0, 8).toUpperCase()}`, '', kind, 'Draft', now(), now()));
                (await audit(u, 'ciptaan.tambah', id));
                return json(res, (await expand((await getInnovation(id, u)))), 201);
            }
            const im = path.match(/^\/api\/innovations\/([^/]+)(\/submit|\/status)?$/);
            if (im) {
                const input = method === 'PUT' ? await body(req) : null;
                const id = im[1], row = (await getInnovation(id, u));
                if (method === 'GET' && !im[2])
                    return json(res, (await expand(row)));
                if (method === 'DELETE' && !im[2]) {
                    if ((await one('SELECT id FROM aftercare WHERE innovation_id=?', id)))
                        fail('Ciptaan digunakan dalam pembinaan. Hapus data pembinaan terlebih dahulu.');
                    (await run('DELETE FROM innovations WHERE id=?', id));
                    (await audit(u, 'ciptaan.hapus', id));
                    return json(res, { ok: true });
                }
                if (method === 'POST' && im[2] === '/submit') {
                    if (!['Draft', 'Perlu Revisi'].includes(row.status)) {
                        if (row.status === 'Diajukan')
                            return json(res, (await expand(row)));
                        fail('Status saat ini tidak dapat diajukan.');
                    }
                    (await validateApplication(row));
                    (await run("UPDATE innovations SET status='Diajukan',submitted_at=COALESCE(submitted_at,?),updated_at=?,version=version+1 WHERE id=?", now(), now(), id));
                    (await audit(u, 'ciptaan.ajukan', id));
                    return json(res, (await expand((await getInnovation(id, u)))));
                }
                if (method === 'PUT' && im[2] === '/status') {
                    admin(u);
                    const b = input;
                    if (!(transitions[row.status] || ['Draft']).includes(b.status))
                        fail('Perubahan status tidak diizinkan.');
                    if (b.status === 'Diajukan')
                        (await validateApplication(row));
                    (await run('UPDATE innovations SET status=?,submitted_at=CASE WHEN ?=\'Diajukan\' THEN COALESCE(submitted_at,?) ELSE submitted_at END,updated_at=?,version=version+1 WHERE id=?', b.status, b.status, now(), now(), id));
                    (await audit(u, `status.${b.status}`, id));
                    return json(res, (await expand((await getInnovation(id, u)))));
                }
                if (method === 'PUT' && !im[2]) {
                    const b = input;
                    if (b.version !== row.version)
                        fail('Data sudah berubah. Muat ulang sebelum menyimpan.', 409);
                    const previous = JSON.parse(row.data);
                    const d = b.data || {};
                    if (!Array.isArray(d.creators) || !Array.isArray(d.holders) || !Array.isArray(d.attachments) || d.creators.length > 50 || d.holders.length > 50 || d.attachments.length > 20)
                        fail('Format pencipta atau lampiran tidak valid.');
                    if ([...d.creators, ...d.holders].some(p => !p || typeof p !== 'object' || Array.isArray(p)))
                        fail('Data pencipta dan pemegang hak tidak valid.');
                    if (d.attachments.some(a => !a || typeof a.id !== 'string' || !a.id))
                        fail('Setiap lampiran harus merujuk berkas yang telah diunggah.');
                    const person = async (p) => { (await address(p)); return { name: text(p.name), address: text(p.address, 500), districtId: p.districtId || null, villageId: p.villageId || null }; };
                    const data = { ...previous, type: text(d.type), description: text(d.description, 5000), announcedAt: text(d.announcedAt, 10), creators: (await completeAll(d.creators.map(person))), holders: (await completeAll(d.holders.map(person))), attachments: (await completeAll(d.attachments.map(async (a) => ({ id: (await checkFile(a.id, 'attachment', u, id)), name: text(a.name), category: ['identitas', 'pernyataan', 'contoh', 'lainnya'].includes(a.category) ? a.category : 'lainnya' })))) };
                    if (u.role === 'Admin') {
                        data.certificateId = (await checkFile(d.certificateId, 'certificate', u, id));
                        data.registrationNumber = text(d.registrationNumber);
                    }
                    const ownerId = u.role === 'Admin' ? b.ownerId || null : row.owner_id;
                    if (ownerId && !(await one('SELECT id FROM users WHERE id=?', ownerId)))
                        fail('Pemilik akun tidak ditemukan.');
                    const changedStatus = u.role === 'User' && ['Diajukan', 'Diproses', 'Selesai'].includes(row.status) ? 'Perlu Revisi' : row.status;
                    (await run('UPDATE innovations SET owner_id=?,title=?,data=?,status=?,updated_at=?,version=version+1 WHERE id=?', ownerId, text(b.title, 300), JSON.stringify(data), changedStatus, now(), id));
                    (await audit(u, 'ciptaan.ubah', id));
                    return json(res, (await expand((await getInnovation(id, u)))));
                }
            }
            if (path === '/api/files/prepare' && method === 'POST') {
                const b = await body(req);
                const purpose = b.purpose;
                if (!['avatar', 'attachment', 'certificate', 'landing', 'pasca'].includes(purpose)) fail('Jenis unggahan tidak valid.');
                if (['certificate', 'landing', 'pasca'].includes(purpose)) admin(u);
                const innovationId = ['attachment', 'certificate', 'pasca'].includes(purpose) ? (await getInnovation(b.innovationId, u)).id : null;
                const max = ['attachment', 'certificate'].includes(purpose) ? 8 : 2;
                if (!Number.isInteger(b.size) || b.size <= 0 || b.size > max * 1024 * 1024) fail(`Ukuran maksimal ${max} MB.`);
                if (!storage) return json(res, { mode: 'inline' });
                const pending = await one('SELECT COUNT(*) AS n FROM pending_uploads WHERE owner_id=? AND expires>? AND file_id IS NULL', u.id, Date.now());
                if (pending.n >= 20) fail('Terlalu banyak unggahan tertunda. Coba lagi nanti.', 429);
                const id = uid(), path = `staging/${u.id}/${id}`;
                const signedUrl = await storage.signUpload(path);
                await run('INSERT INTO pending_uploads(id,owner_id,innovation_id,purpose,name,path,expires) VALUES(?,?,?,?,?,?,?)', id, u.id, innovationId, purpose, text(b.name, 150), path, Date.now() + 15 * 60000);
                return json(res, { mode: 'storage', id, signedUrl });
            }
            if (['/api/files', '/api/files/complete'].includes(path) && method === 'POST') {
                const b = await body(req);
                let pending;
                if (path === '/api/files/complete') {
                    if (!storage) fail('Penyimpanan berkas belum dikonfigurasi.', 503);
                    pending = await one('SELECT * FROM pending_uploads WHERE id=? AND owner_id=?', text(b.id, 50), u.id);
                    if (!pending) fail('Unggahan tidak ditemukan.', 404);
                    if (pending.innovation_id) await getInnovation(pending.innovation_id, u);
                    if (['certificate', 'landing', 'pasca'].includes(pending.purpose)) admin(u);
                    if (pending.file_id) {
                        const existing = await one('SELECT id,name,mime FROM files WHERE id=?', pending.file_id);
                        if (!existing) fail('Berkas tidak ditemukan.', 404);
                        return json(res, existing);
                    }
                    if (pending.expires <= Date.now()) fail('Izin unggah sudah kedaluwarsa.', 410);
                    Object.assign(b, { purpose: pending.purpose, innovationId: pending.innovation_id, name: pending.name });
                } else if (storage) fail('Gunakan izin unggah langsung ke penyimpanan.', 400);
                const purpose = b.purpose;
                if (!['avatar', 'attachment', 'certificate', 'landing', 'pasca'].includes(purpose))
                    fail('Jenis unggahan tidak valid.');
                if (['certificate', 'landing', 'pasca'].includes(purpose))
                    admin(u);
                const innovationId = ['attachment', 'certificate', 'pasca'].includes(purpose) ? (await getInnovation(b.innovationId, u)).id : null;
                if (!pending && (typeof b.base64 !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(b.base64)))
                    fail('Berkas tidak valid.');
                const max = ['attachment', 'certificate'].includes(purpose) ? 8 : 2;
                let bytes = pending ? await storage.download(pending.path, max * 1024 * 1024) : Buffer.from(b.base64, 'base64');
                if (!bytes.length || bytes.length > max * 1024 * 1024)
                    fail(`Ukuran maksimal ${max} MB.`);
                let mime, name = text(b.name, 150).replace(/[\r\n\\/]/g, '_');
                if (bytes.subarray(0, 5).toString() === '%PDF-' && ['attachment', 'certificate'].includes(purpose)) {
                    mime = 'application/pdf';
                    name = name.replace(/\.[^.]+$/, '') + '.pdf';
                }
                else {
                    try {
                        const input = sharp(bytes, { limitInputPixels: 24000000 });
                        const meta = await input.metadata();
                        if (!['jpeg', 'png', 'webp'].includes(meta.format))
                            fail('Gunakan gambar PNG, JPG, atau WebP.');
                        bytes = await input.rotate().resize({ width: purpose === 'avatar' ? 400 : 1920, height: purpose === 'avatar' ? 400 : 1920, fit: purpose === 'avatar' ? 'cover' : 'inside', withoutEnlargement: true }).webp().toBuffer();
                        mime = 'image/webp';
                        name = name.replace(/\.[^.]+$/, '') + '.webp';
                    }
                    catch {
                        fail('Berkas harus gambar valid atau PDF untuk lampiran.');
                    }
                }
                const id = uid();
                if (storage) {
                    const storagePath = `files/${u.id}/${id}`;
                    await storage.put(storagePath, bytes, mime);
                    await run('INSERT INTO files(id,owner_id,innovation_id,purpose,name,mime,bytes,storage_path,created_at) VALUES(?,?,?,?,?,?,?,?,?)', id, u.id, innovationId, purpose, name || 'berkas', mime, Buffer.alloc(0), storagePath, now());
                    await run('UPDATE pending_uploads SET file_id=? WHERE id=?', id, pending.id);
                } else {
                    await run('INSERT INTO files(id,owner_id,innovation_id,purpose,name,mime,bytes,created_at) VALUES(?,?,?,?,?,?,?,?)', id, u.id, innovationId, purpose, name || 'berkas', mime, bytes, now());
                }
                return json(res, { id, name, mime }, 201);
            }
            if (path === '/api/content' && method === 'GET') {
                admin(u);
                return json(res, { slides: (await getContent('carousel')), about: (await getContent('about')) });
            }
            if (path === '/api/content/carousel' && method === 'PUT') {
                admin(u);
                const b = await body(req);
                if (!Array.isArray(b.slides) || b.slides.length > 20)
                    fail('Maksimal 20 slide.');
                const slides = (await completeAll(b.slides.map(async (x) => { if (!text(x.title) || !x.imageId)
                    fail('Judul dan gambar slide wajib diisi.'); if (x.buttonText && !x.url)
                    fail('Tautan tombol wajib diisi.'); return { id: text(x.id, 50) || uid(), title: text(x.title, 100), description: text(x.description, 500), imageId: (await checkFile(x.imageId, 'landing', u)), buttonText: text(x.buttonText, 50), url: safeLink(x.url), visible: !!x.visible }; })));
                (await setContent('carousel', slides));
                (await audit(u, 'carousel.simpan'));
                return json(res, slides);
            }
            if (path === '/api/content/about' && method === 'PUT') {
                admin(u);
                const b = await body(req);
                const data = { title: text(b.title), html: cleanHtml(b.html), visible: !!b.visible, imageId: (await checkFile(b.imageId, 'landing', u)), updatedAt: now(), updatedBy: u.name };
                if (!data.title || !sanitizeHtml(data.html, { allowedTags: [] }).trim())
                    fail('Judul dan isi wajib diisi.');
                (await setContent('about', data));
                (await audit(u, 'tentang.simpan'));
                return json(res, data);
            }
            if (path === '/api/aftercare' && method === 'GET') {
                return json(res, (await completeAll((await q(u.role === 'Admin' ? 'SELECT * FROM aftercare ORDER BY updated_at DESC' : 'SELECT a.* FROM aftercare a JOIN innovations i ON i.id=a.innovation_id WHERE i.owner_id=? ORDER BY a.updated_at DESC', ...(u.role === 'Admin' ? [] : [u.id]))).map(async (x) => ({ ...x, data: JSON.parse(x.data), innovation: (await expand((await getInnovation(x.innovation_id, u)))) })))));
            }
            const am = path.match(/^\/api\/aftercare(?:\/([^/]+))?$/);
            if (am && ['POST', 'PUT', 'DELETE'].includes(method)) {
                admin(u);
                const id = am[1] || uid();
                const old = (await one('SELECT * FROM aftercare WHERE id=?', id));
                if (method !== 'POST' && !old)
                    fail('Pembinaan tidak ditemukan.', 404);
                if (method === 'DELETE') {
                    (await run('DELETE FROM aftercare WHERE id=?', id));
                    return json(res, { ok: true });
                }
                const b = await body(req);
                const i = (await getInnovation(b.innovationId, u));
                if (i.status !== 'Selesai')
                    fail('Pembinaan memerlukan ciptaan berstatus Selesai.');
                if (!['Perorangan', 'Kelompok', 'Organisasi Posyantek'].includes(b.participantType) || !['Pelatihan', 'Inkubasi Bisnis'].includes(b.program) || !['Sudah', 'Belum'].includes(b.trainingStatus) || !text(b.name))
                    fail('Lengkapi peserta, program, dan status.');
                if (b.participantType === 'Kelompok' && b.groupType === 'Tim mahasiswa' && !text(b.university))
                    fail('Asal kampus wajib diisi.');
                if (b.participantType === 'Organisasi Posyantek')
                    (await activeRegion(b.districtId, 'kecamatan'));
                if ((b.endDate && b.startDate && b.endDate < b.startDate) || (b.trainingStatus === 'Sudah' && (!b.endDate || !text(b.product))))
                    fail('Lengkapi tanggal selesai dan hasil produk; urutan tanggal harus benar.');
                const photos = Array.isArray(b.photos) ? (await completeAll(b.photos.slice(0, 5).map(async (f) => (await checkFile(f, 'pasca', u, i.id))))) : [];
                const data = { participantType: b.participantType, name: text(b.name), groupType: b.groupType === 'Tim mahasiswa' ? 'Tim mahasiswa' : 'Kelompok umum', university: text(b.university), members: text(b.members, 4000), districtId: b.districtId || null, program: b.program, trainingStatus: b.trainingStatus, startDate: text(b.startDate, 10), endDate: text(b.endDate, 10), product: text(b.product), description: text(b.description, 4000), photos };
                (await run('INSERT INTO aftercare(id,innovation_id,data,updated_at) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET innovation_id=excluded.innovation_id,data=excluded.data,updated_at=excluded.updated_at', id, i.id, JSON.stringify(data), now()));
                (await audit(u, 'pembinaan.simpan', id));
                return json(res, { id, data });
            }
            fail('Endpoint tidak ditemukan.', 404);
        }
    };
    const handler = async (req, res) => {
        const buffered = bufferedResponse();
        try {
            const pathname = new URL(req.url, 'http://localhost').pathname;
            const isApi = pathname.startsWith('/api/');
            if (database.consumeAttempt && ((req.method === 'POST' && ['/api/setup', '/api/login', '/api/reset-password'].includes(pathname)) || (req.method === 'PUT' && pathname === '/api/password'))) {
                // Vercel overwrites this header; never trust arbitrary forwarded headers locally.
                const ip = process.env.VERCEL ? String(req.headers['x-vercel-forwarded-for'] || req.socket?.remoteAddress || 'unknown') : req.socket?.remoteAddress || 'unknown';
                if (!await database.consumeAttempt(digest(ip))) fail('Terlalu banyak percobaan. Coba lagi dalam 15 menit.', 429);
            }
            if (isApi)
                await database.request(() => dispatch(req, buffered), !['GET', 'HEAD'].includes(req.method));
            else
                await dispatch(req, buffered);
            buffered.flush(res);
        }
        catch (error) {
            const constraint = /UNIQUE constraint/.test(error.message) || error.code === '23505';
            const status = error.status || (constraint ? 409 : 500);
            if (status === 500)
                console.error('API request failed', { code: error.code || 'internal' });
            json(res, { error: status === 500 ? 'Terjadi kesalahan server.' : constraint ? 'Email atau kode sudah digunakan.' : error.message }, status);
        }
    };
    const server = createServer(handler);
    return { server, handler, db: db || database, database, bootstrapToken, needsSetup: !(await one('SELECT id FROM users LIMIT 1')) };
}
