import { defineConfig } from 'vite';

// The feeder is processed offline. Only its explicit public projection is served.
export default defineConfig({
  server: {
    host: '127.0.0.1',
    // Preserve the browser's Host so the API can verify same-origin requests.
    proxy: { '/api': { target: 'http://127.0.0.1:3001', changeOrigin: false } },
    fs: {
      strict: true,
      deny: ['**/private-data/**', '**/server/**', '**/*.sqlite*', '**/*.tsv', '**/.git/**', '**/.env*', '**/*.{pem,crt}'],
    },
  },
});
