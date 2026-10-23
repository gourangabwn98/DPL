import 'dotenv/config';
import path from 'node:path';
import { storageDriver } from './storage-config.js';
export { hash, randomToken, accessToken, invitation } from './security.js';
export const config = {
  production: process.env.NODE_ENV === 'production',
  origin: process.env.APP_ORIGIN || 'http://localhost:5173',
  secret: process.env.TOKEN_SECRET || '',
  retention: Number(process.env.RETENTION_DAYS || 180)
};
export function validateConfig() {
  const databaseUrl = process.env.DATABASE_URL || '';
  if (!/^mongodb(?:\+srv)?:\/\//.test(databaseUrl)) throw new Error('DATABASE_URL must be a MongoDB replica-set connection string');
  try { if (!new URL(databaseUrl).pathname.slice(1)) throw new Error(); } catch { throw new Error('DATABASE_URL must be valid and include a database name'); }
  if (config.secret.length < 32 || config.secret.startsWith('replace-')) throw new Error('TOKEN_SECRET must contain at least 32 random characters');
  if (!Number.isInteger(config.retention) || config.retention < 1) throw new Error('RETENTION_DAYS must be a positive integer');
  if (config.production && !config.origin.startsWith('https://')) throw new Error('HTTPS APP_ORIGIN required');
  if (process.env.PAYMENT_QR_PATH && process.env.PAYMENT_QR_PATH !== '/images/payment-qr.png') throw new Error('The fixed QR path is /images/payment-qr.png');
  const driver = storageDriver();
  if (!['local', 'mongodb'].includes(driver)) throw new Error('Use STORAGE_DRIVER=local or mongodb; migrate existing proofs before switching storage');
  if (process.env.VERCEL && driver !== 'mongodb') throw new Error('Vercel requires STORAGE_DRIVER=mongodb for persistent private uploads');
  if (driver === 'mongodb') return;
  if (config.production && (!process.env.UPLOAD_DIR || !path.isAbsolute(process.env.UPLOAD_DIR))) throw new Error('Production UPLOAD_DIR must be an absolute path on a persistent private volume');
  const uploadDir = path.resolve(process.env.UPLOAD_DIR || 'private-uploads');
  for (const publicDir of ['public', 'dist']) {
    const relative = path.relative(path.resolve(publicDir), uploadDir);
    if (!relative || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative))) throw new Error('UPLOAD_DIR must be outside public and dist');
  }
}
