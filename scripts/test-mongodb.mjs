import { mkdtemp, rm, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { startMongo } from './mongo-server.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const directory = await mkdtemp(path.join(root, '.dpl-test-'));
const relative = path.relative(root, directory);
if (relative.startsWith('..') || path.isAbsolute(relative) || !relative.startsWith('.dpl-test-')) throw new Error('Unsafe temporary database directory');
let mongo;
try {
  mongo = await startMongo({ directory });
  const env = {
    ...process.env, DATABASE_URL: mongo.uri('dpl_test'), TOKEN_SECRET: randomBytes(32).toString('hex'),
    NODE_ENV: 'test', TEST_DATABASE_CONFIRMED: 'true', STORAGE_DRIVER: 'local',
    UPLOAD_DIR: path.join(directory, 'proofs'), APP_ORIGIN: 'http://localhost:5173'
  };
  async function npm(args) {
    if (!process.env.npm_execpath) throw new Error('Use npm run test:integration');
    await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [process.env.npm_execpath, ...args], { cwd: root, env, stdio: 'inherit', windowsHide: true });
      child.once('error', reject);
      child.once('exit', code => code === 0 ? resolve() : reject(new Error(`Check failed with exit ${code}`)));
    });
  }
  // Reuse only an exactly current client; Windows cannot overwrite its DLL while
  // the developer's API is running. Index synchronization does not need to regenerate.
  const schema = await readFile(path.join(root, 'prisma/schema.prisma'), 'utf8');
  const generated = await readFile(path.join(root, 'node_modules/.prisma/client/schema.prisma'), 'utf8').catch(() => '');
  const canonical = text => text.replace(/"(?:\\.|[^"\\])*"|\s+/g, token => token.startsWith('"') ? token : '');
  if (canonical(schema) !== canonical(generated)) await npm(['run', 'db:generate']);
  await npm(['run', 'db:push', '--', '--skip-generate']);
  await npm(['test']);
} catch (error) {
  console.error(error instanceof Error ? error.message : 'MongoDB integration check failed');
  process.exitCode = 1;
} finally {
  await mongo?.stop();
  await rm(directory, { recursive: true, force: true, maxRetries: 6, retryDelay: 250 });
}
