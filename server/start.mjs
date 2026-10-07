import { createRuntime } from './runtime.mjs';
const app = await createRuntime();
const port = Number(process.env.PORT || 3001);
app.server.listen(port, process.env.HOST || '127.0.0.1', () => {
  console.log(`Server Sapatri: http://127.0.0.1:${port}`);
  if (app.needsSetup && !process.env.DATABASE_URL && !process.env.POSTGRES_URL) console.log(`Kode penyiapan Admin pertama (masukkan di halaman login): ${app.bootstrapToken}`);
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => app.server.close(async () => { await app.database.close(); process.exit(0); }));
