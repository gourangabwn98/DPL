import { createHash, createHmac, randomBytes } from 'node:crypto';
export const hash = (v: string) => createHash('sha256').update(v).digest('hex');
export const randomToken = () => randomBytes(32).toString('hex');
export const accessToken = (key: string) => createHmac('sha256', process.env.TOKEN_SECRET || '').update(key).digest('hex');
export function invitation() {
  const raw = process.env.WHATSAPP_INVITE_URL;
  if (process.env.WHATSAPP_INVITE_VERIFIED !== 'true' || !raw || /\s/.test(raw)) return undefined;
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' && u.hostname === 'chat.whatsapp.com' && /^\/[A-Za-z0-9]+$/.test(u.pathname) && !u.username && !u.password && !u.port ? u.href : undefined;
  } catch {
    return undefined;
  }
}
export const csvCell = (value: unknown) => {
  let s = String(value ?? '');
  if (/^[\s]*[=+@-]/.test(s)) s = "'" + s;
  return '"' + s.replaceAll('"', '""') + '"';
};
