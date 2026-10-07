import { createRuntime } from '../server/runtime.mjs';

export function createVercelHandler(runtime = createRuntime) {
  let application;
  return async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      const route = url.searchParams.get('sapatriPath');
      if (route !== null) req.url = `/api/${route}`;
      application ||= runtime().catch(error => { application = undefined; throw error; });
      return await (await application).handler(req, res);
    } catch (error) {
      console.error('Application initialization failed', { code: error.code || 'configuration' });
      res.writeHead(503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ error: 'Layanan belum siap. Hubungi pengelola aplikasi.' }));
    }
  };
}
export default createVercelHandler();
