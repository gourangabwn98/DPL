import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import net from 'node:net';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);
if (process.env.NODE_ENV === 'production') throw new Error('Use npm start for production.');
if (!existsSync('.env')) {
  const template = readFileSync('.env.example', 'utf8').replace('replace-with-at-least-32-random-characters', randomBytes(32).toString('hex'));
  writeFileSync('.env', template, { flag: 'wx', mode: 0o600 });
  console.log('Created .env with a random local access-token secret.');
}
let dotenv;
try { dotenv = await import('dotenv'); }
catch { console.error('Dependencies are missing. Run npm.cmd install in the VS Code terminal first.'); process.exit(1); }
dotenv.config({ quiet: true });
const npmCli = process.env.npm_execpath;
if (!npmCli || !existsSync(npmCli)) throw new Error('Start using npm.cmd run dev.');
let postgres;
let app;
let stopping = false;

function runNpm(args) {
  const child = spawn(process.execPath, [npmCli, ...args], { cwd: root, env: process.env, stdio: 'inherit', windowsHide: true });
  const done = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => code === 0 || stopping ? resolve() : reject(new Error(`npm ${args.join(' ')} failed (${signal || code}).`)));
  });
  return { child, done };
}
async function portAvailable(port) {
  await new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', () => reject(new Error(`Database port ${port} is occupied. Stop the other launcher, or use LOCAL_DATABASE_MODE=external for an existing PostgreSQL service.`)));
    probe.listen(port, '127.0.0.1', () => probe.close(resolve));
  });
}
async function cleanup() {
  if (stopping) return;
  stopping = true;
  if (app?.child.pid && app.child.exitCode === null) {
    if (process.platform === 'win32') {
      await new Promise(resolve => {
        const killer = spawn('taskkill', ['/PID', String(app.child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
        killer.once('exit', resolve); killer.once('error', resolve);
      });
    } else {
      app.child.kill('SIGTERM');
      await Promise.race([app.done.catch(() => {}), new Promise(resolve => setTimeout(resolve, 5000))]);
    }
  }
  if (postgres) await postgres.stop();
}
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => {
  void cleanup().then(() => process.exit(0)).catch(() => process.exit(1));
});
try {
  if ((process.env.LOCAL_DATABASE_MODE || 'embedded') === 'embedded') {
    const url = new URL(process.env.DATABASE_URL || '');
    if (!['postgresql:', 'postgres:'].includes(url.protocol) || !['localhost', '127.0.0.1'].includes(url.hostname)) throw new Error('Embedded mode needs a local PostgreSQL DATABASE_URL. Use LOCAL_DATABASE_MODE=external for other servers.');
    const port = Number(url.port || 5432);
    const database = decodeURIComponent(url.pathname.slice(1));
    if (!/^[A-Za-z][A-Za-z0-9_]{0,62}$/.test(database) || !url.username || !url.password) throw new Error('DATABASE_URL needs a username, password and simple database name.');
    await portAvailable(port);
    const { default: EmbeddedPostgres } = await import('embedded-postgres');
    const databaseDir = path.join(root, '.local-postgres');
    postgres = new EmbeddedPostgres({ databaseDir, port, user: decodeURIComponent(url.username), password: decodeURIComponent(url.password), persistent: true, authMethod: 'scram-sha-256', createPostgresUser: false, initdbFlags: ['--encoding=UTF8'], postgresFlags: ['-h', '127.0.0.1'] });
    if (!existsSync(path.join(databaseDir, 'PG_VERSION'))) {
      console.log('Initializing persistent local PostgreSQL (no Docker required)…');
      await postgres.initialise();
    }
    await postgres.start();
    const client = postgres.getPgClient('postgres', '127.0.0.1');
    await client.connect();
    try {
      const result = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [database]);
      if (!result.rowCount) await client.query(`CREATE DATABASE "${database}"`);
    } finally { await client.end(); }
    console.log(`Local PostgreSQL ready on 127.0.0.1:${port}. Data persists in .local-postgres/.`);
  } else if (process.env.LOCAL_DATABASE_MODE !== 'external') throw new Error('LOCAL_DATABASE_MODE must be embedded or external.');
  await runNpm(['run', 'db:generate']).done;
  await runNpm(['run', 'db:migrate']).done;
  console.log('Starting API and frontend. Open the Local URL printed by Vite.');
  app = runNpm(['run', 'dev:app']);
  await app.done;
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Local startup failed.');
  process.exitCode = 1;
} finally { await cleanup(); }
