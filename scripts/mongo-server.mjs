import { MongoMemoryReplSet } from 'mongodb-memory-server';
import path from 'node:path';
import fs from 'node:fs/promises';

export async function startMongo({ directory, port, name = 'rs0', persistent = false } = {}) {
  if (directory) await fs.mkdir(directory, { recursive: true });
  const server = await MongoMemoryReplSet.create({
    binary: { version: '7.0.24' },
    replSet: { count: 1, name, storageEngine: 'wiredTiger', spawn: { windowsHide: true } },
    instanceOpts: [{ ...(port ? { port } : {}), ...(directory ? { dbPath: path.resolve(directory) } : {}) }]
  });
  return {
    uri: database => server.getUri(database),
    stop: () => server.stop({ doCleanup: !persistent, force: false })
  };
}
