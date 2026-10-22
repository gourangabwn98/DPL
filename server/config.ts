import 'dotenv/config';
export { hash, randomToken, accessToken, invitation } from './security.js';
export const config = {
  production: process.env.NODE_ENV === 'production',
  origin: process.env.APP_ORIGIN || 'http://localhost:5173',
  secret: process.env.TOKEN_SECRET || '',
  retention: Number(process.env.RETENTION_DAYS || 180)
};
export function validateConfig() {
  if (config.secret.length < 32 || config.secret.startsWith('replace-')) throw new Error('TOKEN_SECRET must contain at least 32 random characters');
  if (!Number.isInteger(config.retention) || config.retention < 1) throw new Error('RETENTION_DAYS must be a positive integer');
  if (config.production && !config.origin.startsWith('https://')) throw new Error('HTTPS APP_ORIGIN required');
  if (config.production && process.env.STORAGE_DRIVER !== 's3') throw new Error('Production requires private S3-compatible persistent storage');
  if (config.production && !process.env.S3_BUCKET) throw new Error('S3_BUCKET is required');
  if (process.env.PAYMENT_QR_PATH && process.env.PAYMENT_QR_PATH !== '/images/payment-qr.png') throw new Error('The fixed QR path is /images/payment-qr.png');
}
