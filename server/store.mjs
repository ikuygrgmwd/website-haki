import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { randomUUID, randomBytes, scrypt, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';

const derive = promisify(scrypt);
export const uid = () => randomUUID();
export const token = () => randomBytes(32).toString('hex');
export const digest = value => createHash('sha256').update(value).digest('hex');
export const now = () => new Date().toISOString();
export async function hashPassword(password) {
  if (typeof password !== 'string' || password.length < 10 || password.length > 128) throw Object.assign(new Error('Password harus terdiri dari 10–128 karakter.'), { status: 400 });
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${(await derive(password, salt, 64)).toString('hex')}`;
}
export async function verifyPassword(password, hash) {
  if (typeof password !== 'string' || password.length > 128) return false;
  const [salt, key] = hash.split(':');
  return timingSafeEqual(await derive(password, salt, 64), Buffer.from(key, 'hex'));
}
export function openStore(path, seed = true) {
  if (path !== ':memory:') mkdirSync(dirname(resolve(path)), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS regions(id TEXT PRIMARY KEY, level TEXT NOT NULL, parent_id TEXT REFERENCES regions(id), code TEXT UNIQUE NOT NULL, name TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('Admin','User')), active INTEGER NOT NULL DEFAULT 1, phone TEXT NOT NULL DEFAULT '', district_id TEXT REFERENCES regions(id), village_id TEXT REFERENCES regions(id), photo_id TEXT, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions(hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, csrf TEXT NOT NULL, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS resets(hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS innovations(id TEXT PRIMARY KEY, owner_id TEXT REFERENCES users(id), code TEXT UNIQUE NOT NULL, title TEXT NOT NULL DEFAULT '', kind TEXT NOT NULL DEFAULT 'Hak Cipta', status TEXT, created_at TEXT, submitted_at TEXT, updated_at TEXT NOT NULL, source_id TEXT UNIQUE, data TEXT NOT NULL DEFAULT '{}', version INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE IF NOT EXISTS files(id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id), innovation_id TEXT REFERENCES innovations(id) ON DELETE CASCADE, purpose TEXT NOT NULL, name TEXT NOT NULL, mime TEXT NOT NULL, bytes BLOB NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS aftercare(id TEXT PRIMARY KEY, innovation_id TEXT NOT NULL REFERENCES innovations(id), data TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS content(key TEXT PRIMARY KEY, data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY, actor_id TEXT, action TEXT NOT NULL, record_id TEXT, created_at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS innovations_owner ON innovations(owner_id);
    CREATE INDEX IF NOT EXISTS files_innovation ON files(innovation_id);
    CREATE INDEX IF NOT EXISTS aftercare_innovation ON aftercare(innovation_id);
    CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
    CREATE TABLE IF NOT EXISTS pending_uploads(id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id), innovation_id TEXT REFERENCES innovations(id) ON DELETE CASCADE, purpose TEXT NOT NULL, name TEXT NOT NULL, path TEXT NOT NULL UNIQUE, expires INTEGER NOT NULL, file_id TEXT);
  `);
  if (!db.prepare('PRAGMA table_info(files)').all().some(column => column.name === 'storage_path')) db.exec('ALTER TABLE files ADD COLUMN storage_path TEXT');
  if (seed) {
    const source = resolve('public/data/innovations.json');
    if (existsSync(source) && !db.prepare("SELECT key FROM content WHERE key='_feeder_seed_v1'").get()) {
      db.exec('BEGIN');
      try {
      for (const item of JSON.parse(readFileSync(source, 'utf8')).innovations) {
      db.prepare('INSERT OR IGNORE INTO innovations(id,code,title,kind,status,created_at,updated_at,source_id,data) VALUES(?,?,?,?,NULL,NULL,?,?,?)')
        .run(uid(), `FEED-${item.sourceNumber}`, item.title, 'Hak Cipta', now(), item.id, JSON.stringify({ sourceNumber: item.sourceNumber, districts: item.districts }));
      }
      db.prepare('INSERT INTO content(key,data) VALUES(?,?)').run('_feeder_seed_v1', '{}');
      db.exec('COMMIT');
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    }
    // Seed only codes already evidenced by the checked-in geographic source.
    const geoPath = resolve('scripts/boundaries-source.geojson');
    if (existsSync(geoPath) && !db.prepare("SELECT key FROM content WHERE key='_regions_seed_v1'").get()) {
      const features = JSON.parse(readFileSync(geoPath, 'utf8')).features;
      const put = db.prepare('INSERT OR IGNORE INTO regions(id,level,parent_id,code,name) VALUES(?,?,?,?,?)');
      put.run('32', 'provinsi', null, '32', 'Jawa Barat');
      put.run('32.75', 'kota', '32', '32.75', 'Kota Bekasi');
      const names = new Map(JSON.parse(readFileSync(resolve('public/data/bekasi-kecamatan.geojson'), 'utf8')).features.map(f => [f.properties.code, f.properties.name]));
      for (const { properties: p } of features) {
        put.run(p.kdcpum, 'kecamatan', '32.75', p.kdcpum, names.get(p.kdcpum) || p.wadmkc);
        // Snapshot contains BIG object IDs, but not official kelurahan codes.
        // Keep provenance explicit instead of inventing administrative codes.
        put.run(`BIG:${p.objectid}`, 'kelurahan', p.kdcpum, `BIG:${p.objectid}`, p.namobj);
      }
      db.prepare('INSERT INTO content(key,data) VALUES(?,?)').run('_regions_seed_v1', '{}');
    }
  }
  return db;
}
export const publicUser = u => u && ({ id: u.id, name: u.name, email: u.email, role: u.role, active: !!u.active, phone: u.phone, districtId: u.district_id, villageId: u.village_id, photoId: u.photo_id });
