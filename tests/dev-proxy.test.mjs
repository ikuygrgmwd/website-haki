import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer as createHttpServer } from 'node:http';
import { once } from 'node:events';
import { createServer as createViteServer, loadConfigFromFile } from 'vite';
import { createApplication } from '../server/api.mjs';

test('development proxy accepts same-origin setup and login while rejecting cross-origin writes', async t => {
  const app = await createApplication({ dbPath: ':memory:', seed: false, bootstrapToken: 'proxy-test-token', secureCookies: false });
  app.server.listen(0, '127.0.0.1');
  await once(app.server, 'listening');
  t.after(async () => {
    app.server.closeAllConnections();
    await new Promise(resolve => app.server.close(resolve));
    app.db.close();
  });
  const { config } = await loadConfigFromFile({ command: 'serve', mode: 'test' });
  const configuredProxy = config.server.proxy['/api'];
  const vite = await createViteServer({
    configFile: false,
    server: {
      middlewareMode: true, hmr: false, watch: null,
      proxy: { '/api': { ...(typeof configuredProxy === 'string' ? { changeOrigin: true } : configuredProxy), target: `http://127.0.0.1:${app.server.address().port}` } },
    },
  });
  t.after(() => vite.close());
  const proxy = createHttpServer(vite.middlewares);
  proxy.listen(0, '127.0.0.1');
  await once(proxy, 'listening');
  t.after(async () => {
    proxy.closeAllConnections();
    await new Promise(resolve => proxy.close(resolve));
  });
  const origin = `http://127.0.0.1:${proxy.address().port}`;
  const post = (path, body, headers = {}) => fetch(`${origin}/api/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin, 'Sec-Fetch-Site': 'same-origin', ...headers },
    body: JSON.stringify(body),
  });
  const setup = { token: 'proxy-test-token', name: 'Admin Test', email: 'proxy@test.id', password: 'Proxy-test-2026!' };
  for (const headers of [{ Origin: 'https://example.com' }, { 'Sec-Fetch-Site': 'cross-site' }]) {
    const rejected = await post('setup', setup, headers);
    assert.equal(rejected.status, 403);
    assert.equal((await rejected.json()).error, 'Asal permintaan tidak diizinkan.');
  }
  const created = await post('setup', setup);
  assert.equal(created.status, 201, await created.text());
  const login = await post('login', { email: setup.email, password: setup.password });
  assert.equal(login.status, 200);
  assert.ok(login.headers.get('set-cookie')?.includes('HttpOnly'));
  assert.ok((await login.json()).csrf);
});
