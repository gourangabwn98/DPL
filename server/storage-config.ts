export function storageDriver() {
  return process.env.STORAGE_DRIVER || (process.env.VERCEL ? 'mongodb' : 'local');
}
export const maxPrivateImageBytes = 4 * 1024 * 1024;
