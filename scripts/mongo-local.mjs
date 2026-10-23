import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import net from 'node:net';
import { config } from 'dotenv';
import { startMongo } from './mongo-server.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);
if (process.env.NODE_ENV === 'production') throw new Error('Use npm start for production.');
if (!existsSync('.env')) writeFileSync('.env', readFileSync('.env.example', 'utf8').replace('replace-with-at-least-32-random-characters', randomBytes(32).toString('hex')), { flag: 'wx', mode: 0o600 });
config({ quiet: true });
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error('Start with npm run dev');
let mongo, app;
let stopping = false;
function npm(args) {
  const child = spawn(process.execPath, [npmCli, ...args], { cwd: root, env: process.env, stdio: 'inherit', windowsHide: true });
  const done = new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', code => code === 0 || stopping ? resolve() : reject(new Error(`npm ${args.join(' ')} failed (${code})`))); });
  return { child, done };
}
async function cleanup() {
  if (stopping) return;
  stopping = true;
  if (app?.child.pid && app.child.exitCode === null) {
    if (process.platform === 'win32') await new Promise(resolve => {
      const killer = spawn('taskkill', ['/PID', String(app.child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
      killer.once('exit', resolve); killer.once('error', resolve);
    });
    else { app.child.kill('SIGTERM'); await app.done.catch(() => {}); }
  }
  await mongo?.stop();
}
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { void cleanup().then(() => process.exit(0)); });
try {
  if ((process.env.LOCAL_DATABASE_MODE || 'embedded') === 'embedded') {
    const url = new URL(process.env.DATABASE_URL || '');
    if (url.protocol !== 'mongodb:' || !['127.0.0.1', 'localhost'].includes(url.hostname) || !url.pathname.slice(1) || url.username || url.password || url.searchParams.get('replicaSet') !== 'rs0') throw new Error('Embedded mode requires a local MongoDB URL with a database name and replicaSet=rs0. Use LOCAL_DATABASE_MODE=external for Atlas.');
    const port = Number(url.port || 27017);
    await new Promise((resolve, reject) => { const probe = net.createServer(); probe.once('error', () => reject(new Error(`Port ${port} is occupied; stop the other launcher or use external mode.`))); probe.listen(port, '127.0.0.1', () => probe.close(resolve)); });
    mongo = await startMongo({ directory: path.join(root, '.local-mongodb'), port, persistent: true });
    console.log(`Local MongoDB replica set ready on port ${port}. Data persists in .local-mongodb/.`);
  } else if (process.env.LOCAL_DATABASE_MODE !== 'external') throw new Error('LOCAL_DATABASE_MODE must be embedded or external');
  await npm(['run', 'db:generate']).done;
  await npm(['run', 'db:push']).done;
  app = npm(['run', 'dev:app']);
  await app.done;
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Local startup failed');
  process.exitCode = 1;
} finally { await cleanup(); }
