import 'dotenv/config';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { db } from '../server/db.js';
import { maxPrivateImageBytes } from '../server/storage-config.js';

// Copies only files referenced by the selected MongoDB database. It never deletes
// a source file or overwrites a different image with the same storage key.
const apply = process.argv.includes('--apply');
const source = path.resolve(process.env.COPY_UPLOADS_SOURCE_DIR || process.env.UPLOAD_DIR || 'private-uploads');
try {
  const [payments, players] = await Promise.all([
    db.payment.findMany({ select: { storageKey: true } }),
    db.registration.findMany({ select: { photoKey: true } })
  ]);
  const keys = new Set([...payments.map(p => p.storageKey), ...players.map(p => p.photoKey).filter((key): key is string => !!key)]);
  let ready = 0, existing = 0;
  for (const key of keys) {
    if (!/^[a-f0-9]{64}\.jpg$/.test(key)) throw new Error('Unexpected storage key; copy stopped');
    const stored = await db.privateImage.findUnique({ where: { key } });
    if (stored) { existing++; continue; }
    const file = path.resolve(source, key);
    if (path.dirname(file) !== source) throw new Error('Unsafe source image path');
    const bytes = await readFile(file);
    if (bytes.length > maxPrivateImageBytes) throw new Error('An image exceeds the supported 4 MB size');
    if (apply) await db.privateImage.create({ data: { key, data: new Uint8Array(bytes) } });
    ready++;
  }
  console.log(`${existing} images already in MongoDB; ${ready} ${apply ? 'copied' : 'ready to copy'}. Source files were not deleted.`);
  if (!apply) console.log('Read-only preview. Run again with --apply to copy the referenced files.');
} finally { await db.$disconnect(); }
