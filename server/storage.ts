import { mkdir, writeFile, readFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { fileTypeFromBuffer } from 'file-type';
import sharp from 'sharp';
const root = path.resolve(process.env.UPLOAD_DIR || 'private-uploads');
const s3 = new S3Client({
  region: process.env.S3_REGION || 'ap-south-1',
  endpoint: process.env.S3_ENDPOINT || undefined,
  forcePathStyle: !!process.env.S3_ENDPOINT
});
const bucket = process.env.S3_BUCKET;
const isS3 = () => process.env.STORAGE_DRIVER === 's3';
export async function cleanImage(buffer: Buffer) {
  if (buffer.length > 4 * 1024 * 1024) throw new Error('Image must be 4 MB or smaller');
  const type = await fileTypeFromBuffer(buffer);
  if (!type || !['image/png', 'image/jpeg', 'image/webp'].includes(type.mime)) throw new Error('Upload a valid PNG, JPEG or WebP image');
  try {
    return await sharp(buffer, {
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
}
function safeKey(key: string) {
  if (!/^[a-f0-9]{64}\.jpg$/.test(key)) throw new Error('Invalid storage key');
  return key;
}
export async function putProof(key: string, data: Buffer) {
  safeKey(key);
  if (isS3()) {
    await s3.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: data,
      ContentType: 'image/jpeg',
      ServerSideEncryption: 'AES256'
    }));
  } else {
    await mkdir(root, {
      recursive: true
    });
    await writeFile(path.join(root, key), data, {
      flag: 'wx',
      mode: 0o600
    });
  }
}
export async function getProof(key: string) {
  safeKey(key);
  if (isS3()) {
    const r = await s3.send(new GetObjectCommand({
      Bucket: bucket,
      Key: key
    }));
    return Buffer.from(await r.Body!.transformToByteArray());
  }
  return readFile(path.join(root, key));
}
export async function deleteProof(key: string) {
  safeKey(key);
  if (isS3()) await s3.send(new DeleteObjectCommand({
    Bucket: bucket,
    Key: key
  }));else await unlink(path.join(root, key)).catch((e: NodeJS.ErrnoException) => {
    if (e.code !== 'ENOENT') throw e;
  });
}
