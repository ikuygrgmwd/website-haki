import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { once } from 'node:events';
import { PGlite } from '@electric-sql/pglite';
import { postgresDatabase, postgresSql } from '../server/database.mjs';
import { createApplication } from '../server/api.mjs';
import { openStore } from '../server/store.mjs';
import { importSnapshot } from '../scripts/import-sqlite.mjs';
import { createVercelHandler } from '../api/index.mjs';
import { bufferedResponse } from '../server/response.mjs';

const schema = readFileSync(new URL('../migrations/001-postgres.sql', import.meta.url), 'utf8');
async function fixture(t) {
  const engine = new PGlite();
  let tail = Promise.resolve();
  const pool = {
    async connect() {
      const before = tail;
      let release;
      tail = new Promise(resolve => { release = resolve; });
      await before;
      return {
        async query(sql, params = []) {
          // PGlite has one connection; it exercises PostgreSQL SQL/types but not
          // network pooling or cross-process advisory lock implementation.
          if (sql.includes('pg_advisory_xact_lock')) return { rows: [], rowCount: 1 };
          if (sql === schema) { const results = await engine.exec(sql); return { rows: results.at(-1).rows || [], rowCount: 0 }; }
          const result = await engine.query(sql, params);
          return { ...result, rowCount: result.affectedRows || 0 };
        },
        release,
      };
    },
    end: () => engine.close(),
  };
  const database = postgresDatabase(null, { pool });
  await database.request(() => database.run(schema), true);
  const objects = new Map();
  const storage = {
    ensureBucket: async () => {},
    signUpload: async path => `https://storage.example.test/${path}`,
    download: async (path, max = 8 * 1024 * 1024) => {
      const bytes = objects.get(path);
      if (!bytes || bytes.length > max) throw Object.assign(new Error('Berkas tidak valid.'), { status: 400 });
      return bytes;
    },
    put: async (path, bytes) => { if (objects.has(path)) throw new Error('exists'); objects.set(path, Buffer.from(bytes)); },
    signDownload: async path => `https://storage.example.test/${path}?signed=yes`,
  };
  const app = await createApplication({ database, storage, seed: false, bootstrapToken: 'postgres-setup-token', secureCookies: false });
  app.server.listen(0, '127.0.0.1'); await once(app.server, 'listening');
  const base = `http://127.0.0.1:${app.server.address().port}/api`;
  const client = () => ({ cookie: '', csrf: '', async req(path, method = 'GET', body) {
    const r = await fetch(base + path, { method, redirect: 'manual', headers: { Cookie: this.cookie, 'X-CSRF-Token': this.csrf, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    if (r.headers.get('set-cookie')) this.cookie = r.headers.get('set-cookie').split(';')[0];
    const data = r.headers.get('content-type')?.includes('application/json') ? await r.json() : await r.text();
    if (data.csrf) this.csrf = data.csrf;
    return { status: r.status, data, headers: r.headers };
  }, async ok(...args) { const r = await this.req(...args); assert.ok(r.status < 300, JSON.stringify(r)); return r.data; } });
  t.after(async () => { app.server.closeAllConnections(); await new Promise(resolve => app.server.close(resolve)); await database.close(); });
  return { database, storage, objects, app, client, engine };
}

test('SQL translation preserves literals and nullable region comparison', () => {
  assert.equal(postgresSql("SELECT '?' WHERE parent_id IS ? AND name=?"), "SELECT '?' WHERE parent_id IS NOT DISTINCT FROM $1 AND name=$2");
  assert.equal(postgresSql("SELECT 'IS ?' WHERE name=?"), "SELECT 'IS ?' WHERE name=$1");
});

test('PostgreSQL API: custom login, concurrent edits, private 8 MB storage and rollback', async t => {
  const { database, objects, client } = await fixture(t);
  const admin = client(), owner = client(), stranger = client();
  const password = 'Postgres-Test-2026!';
  await admin.ok('/setup', 'POST', { token: 'postgres-setup-token', name: 'Admin', email: 'admin@example.test', password });
  await admin.ok('/login', 'POST', { email: 'admin@example.test', password });
  for (const [name, c] of [['owner', owner], ['stranger', stranger]]) {
    await admin.ok('/users', 'POST', { name, email: `${name}@example.test`, password, role: 'User', active: true });
    await c.ok('/login', 'POST', { email: `${name}@example.test`, password });
  }
  let work = await owner.ok('/innovations', 'POST', {});
  const edit = { title: 'Judul', version: work.version, data: { creators: [], holders: [], attachments: [] } };
  const edits = await Promise.all([owner.req(`/innovations/${work.id}`, 'PUT', edit), owner.req(`/innovations/${work.id}`, 'PUT', edit)]);
  assert.deepEqual(edits.map(r => r.status).sort(), [200, 409]);
  const permit = await owner.ok('/files/prepare', 'POST', { purpose: 'attachment', innovationId: work.id, name: 'dokumen.pdf', size: 8 * 1024 * 1024 });
  const pending = await database.one('SELECT * FROM pending_uploads WHERE id=?', permit.id);
  const bytes = Buffer.alloc(8 * 1024 * 1024, 32); bytes.write('%PDF-1.4'); objects.set(pending.path, bytes);
  assert.equal((await stranger.req('/files/complete', 'POST', { id: permit.id })).status, 404);
  const file = await owner.ok('/files/complete', 'POST', { id: permit.id });
  assert.equal((await owner.ok('/files/complete', 'POST', { id: permit.id })).id, file.id);
  assert.equal((await database.one('SELECT bytes FROM files WHERE id=?', file.id)).bytes.length, 0);
  assert.equal((await stranger.req(`/files/${file.id}`)).status, 404);
  assert.equal((await client().req(`/files/${file.id}`)).status, 401);
  const download = await owner.req(`/files/${file.id}`);
  assert.equal(download.status, 302); assert.match(download.headers.get('location'), /signed=yes/);
  assert.equal((await owner.req('/files', 'POST', { purpose: 'attachment', innovationId: work.id, base64: 'JVBERi0=' })).status, 400);
  assert.equal((await owner.req('/files/prepare', 'POST', { purpose: 'certificate', innovationId: work.id, size: 100 })).status, 403);
  const bad = await owner.ok('/files/prepare', 'POST', { purpose: 'avatar', name: 'fake.png', size: 50 });
  const badPending = await database.one('SELECT * FROM pending_uploads WHERE id=?', bad.id);
  objects.set(badPending.path, Buffer.from('<script>bad</script>'));
  assert.equal((await owner.req('/files/complete', 'POST', { id: bad.id })).status, 400);
  assert.equal((await database.one('SELECT COUNT(*) AS n FROM files')).n, 1);
  await admin.ok('/regions', 'POST', { level: 'provinsi', code: 'test', name: 'Test', active: true });
  assert.equal((await admin.req('/regions', 'POST', { level: 'provinsi', code: 'test2', name: 'Test', active: true })).status, 400);
  await assert.rejects(database.request(async () => { await database.run("INSERT INTO content(key,data) VALUES('rollback','{}')"); throw new Error('rollback'); }, true));
  assert.equal(await database.one("SELECT * FROM content WHERE key='rollback'"), undefined);
  assert.equal((await database.one('SELECT COUNT(*) AS n FROM users')).n, 3);
  const limiterKey = 'separate-limit-test';
  for (let i = 0; i < 30; i++) assert.equal(await database.consumeAttempt(limiterKey), true);
  assert.equal(await database.consumeAttempt(limiterKey), false);
  assert.equal((await database.one('SELECT attempts FROM rate_limits WHERE key=?', limiterKey)).attempts, 31);
});

test('SQLite import preserves records and file bytes, omits sessions, refuses repeat import', async t => {
  const { database, storage, objects } = await fixture(t);
  const source = openStore(':memory:', false); t.after(() => source.close());
  source.prepare('INSERT INTO users(id,name,email,password_hash,role,created_at) VALUES(?,?,?,?,?,?)').run('user1', 'Test', 'test@example.test', 'hashed', 'Admin', '2026-01-01');
  source.prepare('INSERT INTO sessions(hash,user_id,csrf,expires) VALUES(?,?,?,?)').run('hash', 'user1', 'csrf', Date.now() + 60000);
  source.prepare('INSERT INTO files(id,owner_id,purpose,name,mime,bytes,created_at) VALUES(?,?,?,?,?,?,?)').run('file1', 'user1', 'attachment', 'demo.pdf', 'application/pdf', Buffer.from('%PDF-test'), '2026-01-01');
  const counts = await importSnapshot(source, database, storage, 'snapshot-test');
  assert.equal(counts.users, 1); assert.equal(counts.files, 1);
  assert.equal((await database.one('SELECT COUNT(*) AS n FROM sessions')).n, 0);
  assert.equal((await database.one('SELECT password_hash FROM users')).password_hash, 'hashed');
  assert.equal(objects.get('migration/snapshot-test/file1').toString(), '%PDF-test');
  await assert.rejects(importSnapshot(source, database, storage, 'snapshot-test'), /Impor sudah pernah/);
  assert.equal((await database.one('SELECT COUNT(*) AS n FROM users')).n, 1);
});

test('failed Storage verification rolls back imported PostgreSQL records', async t => {
  const { database, storage } = await fixture(t);
  const source = openStore(':memory:', false); t.after(() => source.close());
  source.prepare('INSERT INTO users(id,name,email,password_hash,role,created_at) VALUES(?,?,?,?,?,?)').run('user1', 'Test', 'test@example.test', 'hashed', 'Admin', '2026-01-01');
  source.prepare('INSERT INTO files(id,owner_id,purpose,name,mime,bytes,created_at) VALUES(?,?,?,?,?,?,?)').run('file1', 'user1', 'attachment', 'demo.pdf', 'application/pdf', Buffer.from('%PDF-test'), '2026-01-01');
  await assert.rejects(importSnapshot(source, database, { ...storage, download: async () => Buffer.from('corrupted') }, 'failed-import'), /Verifikasi berkas/);
  assert.equal((await database.one('SELECT COUNT(*) AS n FROM users')).n, 0);
  assert.equal((await database.one('SELECT COUNT(*) AS n FROM content')).n, 0);
});

test('Vercel rewrite and parsed JSON body reach the API; configuration errors reveal no secrets', async t => {
  const { app } = await fixture(t);
  const handler = createVercelHandler(async () => app);
  const headers = { host: 'website-haki.vercel.app', origin: 'https://website-haki.vercel.app', 'content-type': 'application/json' };
  const capture = () => ({ headers: {}, status: 0, data: '', setHeader(key, value) { this.headers[key] = value; }, writeHead(status, headers = {}) { this.status = status; Object.assign(this.headers, headers); }, end(data) { this.data = data; } });
  const res = capture();
  await handler({ url: '/api/index?sapatriPath=setup', method: 'POST', headers, body: { token: 'postgres-setup-token', name: 'Admin', email: 'vercel@example.test', password: 'Vercel-Password-2026!' }, socket: { remoteAddress: '127.0.0.1' } }, res);
  assert.equal(res.status, 201);
  const session = capture();
  await handler({ url: '/api/index?sapatriPath=session', method: 'GET', headers }, session);
  assert.equal(JSON.parse(session.data).setup, false);
  const failed = capture();
  await createVercelHandler(async () => { throw new Error('secret-do-not-log'); })({ url: '/api/session' }, failed);
  assert.equal(failed.status, 503); assert.ok(!failed.data.includes('secret-do-not-log'));
  const buffered = bufferedResponse(); buffered.writeHead(302); buffered.setHeader('Location', 'https://example.test'); buffered.end();
  const redirect = capture(); buffered.flush(redirect);
  assert.equal(redirect.status, 302); assert.equal(redirect.headers.location, 'https://example.test');
});
