import { mkdtemp } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import EmbeddedPostgres from 'embedded-postgres';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const databaseDir = await mkdtemp(path.join(root, '.dpl-test-'));
// The embedded library removes its temporary cluster on stop. Verify its target first.
const relative = path.relative(root, databaseDir);
if (relative.startsWith('..') || path.isAbsolute(relative) || !relative.startsWith('.dpl-test-')) throw new Error('Unsafe test directory');
const password = randomBytes(24).toString('hex');
const port = 54339;
const env = {
  ...process.env, DATABASE_URL: `postgresql://dpl_test:${password}@127.0.0.1:${port}/dpl_test?schema=public`,
  TOKEN_SECRET: randomBytes(32).toString('hex'), NODE_ENV: 'test', TEST_DATABASE_CONFIRMED: 'true', STORAGE_DRIVER: 'local',
  UPLOAD_DIR: path.join(databaseDir, 'proofs'), APP_ORIGIN: 'http://localhost:5173'
};
const postgres = new EmbeddedPostgres({
  databaseDir, user: 'dpl_test', password, port, persistent: false, authMethod: 'scram-sha-256',
  postgresFlags: ['-h', '127.0.0.1'], initdbFlags: ['--encoding=UTF8'], onLog: () => {},
  onError: () => console.error('Temporary PostgreSQL reported an error.')
});
async function npm(args) {
  if (!process.env.npm_execpath) throw new Error('Use npm run test:integration');
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [process.env.npm_execpath, ...args], { cwd: root, env, stdio: 'inherit', windowsHide: true });
    child.once('error', reject);
    child.once('exit', code => code === 0 ? resolve() : reject(new Error(`Check failed with exit ${code}`)));
  });
}
let failed = false;
try {
  await postgres.initialise();
  await postgres.start();
  await postgres.createDatabase('dpl_test');
  await npm(['run', 'db:migrate']);
  await npm(['test']);
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Integration test runner failed');
  failed = true;
} finally {
  await postgres.stop();
}
// embedded-postgres registers a beforeExit hook that otherwise forces code 0.
// Cleanup is already complete, so an explicit failure exit is safe here.
if (failed) process.exit(1);
