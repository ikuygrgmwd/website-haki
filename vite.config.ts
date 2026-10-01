import { defineConfig } from 'vite';

// The feeder is processed offline. Only its explicit public projection is served.
export default defineConfig({
  server: {
    host: '127.0.0.1',
    fs: {
      strict: true,
      deny: ['**/private-data/**', '**/*.tsv', '**/.git/**', '**/.env*', '**/*.{pem,crt}'],
    },
  },
});
