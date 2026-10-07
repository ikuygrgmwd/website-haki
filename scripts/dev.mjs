import { spawn } from 'node:child_process';
const children = [spawn(process.execPath, ['--env-file-if-exists=.env.local', '--watch', 'server/start.mjs'], { stdio: 'inherit', windowsHide: true }), spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1'], { stdio: 'inherit', windowsHide: true })];
let stopping = false;
function stop(code = 0) { if (stopping) return; stopping = true; children.forEach(p => p.kill()); process.exitCode = code; }
children.forEach(p => { p.on('error', error => { console.error(error.message); stop(1); }); p.on('exit', code => stop(code || 0)); });
process.on('SIGINT', () => stop()); process.on('SIGTERM', () => stop());
