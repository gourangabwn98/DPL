import { mkdir, writeFile, readFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileTypeFromBuffer } from 'file-type';
import sharp from 'sharp';
import { db } from './db.js';
import { storageDriver, maxPrivateImageBytes } from './storage-config.js';
const root = path.resolve(process.env.UPLOAD_DIR || 'private-uploads');
export async function cleanImage(buffer: Buffer) {
  if (buffer.length > 4 * 1024 * 1024) throw new Error('Image must be 4 MB or smaller');
  const type = await fileTypeFromBuffer(buffer);
  if (!type || !['image/png', 'image/jpeg', 'image/webp'].includes(type.mime)) throw new Error('Upload a valid PNG, JPEG or WebP image');
  let image: Buffer;
  try {
    image = await sharp(buffer, {
      limitInputPixels: 20000000,
      animated: false
    }).rotate().resize({
      width: 2400,
      height: 2400,
      fit: 'inside',
      withoutEnlargement: true
    }).jpeg({
      quality: 88
    }).toBuffer();
  } catch {
    throw new Error('Image could not be decoded; choose a valid screenshot');
  }
  if (image.length > maxPrivateImageBytes) throw new Error('Processed image must be 4 MB or smaller');
  return image;
}
function safeKey(key: string) {
  if (!/^[a-f0-9]{64}\.jpg$/.test(key)) throw new Error('Invalid storage key');
  return key;
}
export async function putProof(key: string, data: Buffer) {
  safeKey(key);
  if (data.length > maxPrivateImageBytes) throw new Error('Image must be 4 MB or smaller');
  if (storageDriver() === 'mongodb') {
    await db.privateImage.create({ data: { key, data: new Uint8Array(data) } });
    return;
  }
  await mkdir(root, { recursive: true, mode: 0o700 });
  await writeFile(path.join(root, key), data, { flag: 'wx', mode: 0o600 });
}
export async function getProof(key: string) {
  safeKey(key);
  if (storageDriver() === 'mongodb') {
    const image = await db.privateImage.findUnique({ where: { key } });
    if (!image) throw new Error('Private image not found');
    return Buffer.from(image.data);
  }
  return readFile(path.join(root, key));
}
export async function deleteProof(key: string) {
  safeKey(key);
  if (storageDriver() === 'mongodb') {
    await db.privateImage.deleteMany({ where: { key } });
    return;
  }
  await unlink(path.join(root, key)).catch((e: NodeJS.ErrnoException) => {
    if (e.code !== 'ENOENT') throw e;
  });
}
