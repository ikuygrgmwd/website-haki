import { build } from 'esbuild';

// Vercel's instrumented runtime cannot require htmlparser2's ESM entry from
// sanitize-html's CommonJS module. Bundle both formats without downgrading the
// sanitizer or parser, so their security fixes remain in use.
await build({
  entryPoints: ['sanitize-html'],
  outfile: 'server/generated/sanitize-html.mjs',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
  legalComments: 'eof',
});
