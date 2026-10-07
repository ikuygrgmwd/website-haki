import { migrationResources, command } from './cloud-config.mjs';

await command(async () => {
  const { database, storage } = migrationResources();
  try {
    await database.request(async () => {
      // Supabase signed upload URLs last two hours. Keep staging longer so a
      // still-valid URL cannot recreate an object after its record is removed.
      const rows = await database.q('SELECT id,path FROM pending_uploads WHERE expires<? ORDER BY expires LIMIT 100', Date.now() - 3 * 60 * 60000);
      await storage.remove(rows.map(row => row.path));
      for (const row of rows) await database.run('DELETE FROM pending_uploads WHERE id=?', row.id);
      console.log(`${rows.length} unggahan sementara dibersihkan. Berkas final tidak dihapus.`);
    }, true);
  } finally { await database.close(); }
});
