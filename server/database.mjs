import { AsyncLocalStorage } from 'node:async_hooks';
import pg from 'pg';

// SQLite remains available for local development. All application writes run in
// one transaction so asynchronous validation cannot introduce check/write races.
export function sqliteDatabase(db) {
  let tail = Promise.resolve();
  return {
    dialect: 'sqlite', raw: db,
    q: (sql, ...params) => db.prepare(sql).all(...params),
    one: (sql, ...params) => db.prepare(sql).get(...params),
    run: (sql, ...params) => db.prepare(sql).run(...params),
    transaction: async fn => fn(),
    async request(fn, write = false) {
      const previous = tail;
      let release;
      tail = new Promise(resolve => { release = resolve; });
      await previous;
      try {
        if (write) db.exec('BEGIN IMMEDIATE');
        const result = await fn();
        if (write) db.exec('COMMIT');
        return result;
      } catch (error) {
        if (write) db.exec('ROLLBACK');
        throw error;
      } finally { release(); }
    },
    close: () => db.close(),
  };
}

export function postgresSql(sql) {
  let index = 0;
  // Preserve quoted SQL literals (including escaped single quotes).
  return sql.replace(/'(?:''|[^'])*'|\bIS\s+\?|\?/gi, part => {
    if (part.startsWith("'")) return part;
    return `${part === '?' ? '' : 'IS NOT DISTINCT FROM '}$${++index}`;
  });
}

export function postgresDatabase(connectionString, { pool: suppliedPool } = {}) {
  if (!connectionString && !suppliedPool) throw new Error('DATABASE_URL belum diatur.');
  const pool = suppliedPool || new pg.Pool({
    connectionString, max: 3, connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 20000, allowExitOnIdle: true,
  });
  const context = new AsyncLocalStorage();
  const query = async (sql, params = []) => {
    if (!context.getStore()) return store.request(() => query(sql, params));
    const response = await context.getStore().query(postgresSql(sql), params);
    const result = Array.isArray(response) ? response.at(-1) : response;
    // Existing API uses millisecond expiry values and numeric counts.
    for (const row of result.rows) for (const key of ['n', 'expires']) {
      if (typeof row[key] === 'string' && /^\d+$/.test(row[key])) row[key] = Number(row[key]);
    }
    return result;
  };
  const store = {
    dialect: 'postgres', raw: null, pool,
    q: async (sql, ...params) => (await query(sql, params)).rows,
    one: async (sql, ...params) => (await query(sql, params)).rows[0],
    run: async (sql, ...params) => ({ changes: (await query(sql, params)).rowCount }),
    transaction: async fn => context.getStore() ? fn() : store.request(fn, true),
    async consumeAttempt(key) {
      return store.request(async () => {
        const stamp = Date.now();
        await store.run('DELETE FROM rate_limits WHERE expires<?', stamp);
        const row = await store.one('INSERT INTO rate_limits(key,attempts,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=rate_limits.attempts+1 RETURNING attempts', key, stamp + 15 * 60000);
        return row.attempts <= 30;
      });
    },
    async request(fn, write = false) {
      if (context.getStore()) return fn();
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SET LOCAL search_path TO sapatri, pg_catalog');
        await client.query("SET LOCAL statement_timeout = '30s'");
        // Preserve the original SQLite single-writer semantics across instances.
        if (write) await client.query('SELECT pg_advisory_xact_lock(736170, 1)');
        const result = await context.run(client, fn);
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
      } finally { client.release(); }
    },
    close: () => pool.end(),
  };
  return store;
}
