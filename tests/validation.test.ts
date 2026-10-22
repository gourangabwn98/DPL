import { describe, it, expect } from 'vitest';
import { playerSchema, settingsSchema } from '../shared/validation';
import { cleanImage } from '../server/storage';
import sharp from 'sharp';
import { invitation, hash, accessToken } from '../server/config';
import { csvCell } from '../server/app';
const player = {
  fullName: 'Test Player',
  mobile: '9876543210',
  role: 'Batter',
  consent: true
};
describe('registration validation', () => {
  it('accepts minimal details', () => expect(playerSchema.safeParse(player).success).toBe(true));
  it.each([{
    mobile: '123'
  }, {
    fullName: ' '
  }, {
    role: 'Admin'
  }, {
    consent: false
  }, {
    age: '-1'
  }, {
    age: '17'
  }, {
    pin: '123'
  }, {
    email: 'not-an-email'
  }, {
    status: 'APPROVED'
  }])('rejects invalid or extra fields %j', patch => expect(playerSchema.safeParse({
    ...player,
    ...patch
  }).success).toBe(false));
  it('requires guardian confirmation for a known minor', () => expect(playerSchema.safeParse({
    ...player,
    age: '17',
    guardianConsent: true
  }).success).toBe(true));
  it('does not accept negative capacity', () => expect(settingsSchema.safeParse({
    capacity: -1
  }).success).toBe(false));
});
describe('upload content checks', () => {
  it('rejects files renamed to images', async () => {
    await expect(cleanImage(Buffer.from('<svg onload="alert(1)"></svg>'))).rejects.toThrow('valid PNG');
  });
  it('rejects oversized uploads', async () => {
    await expect(cleanImage(Buffer.alloc(4 * 1024 * 1024 + 1))).rejects.toThrow('4 MB');
  });
  it('decodes and re-encodes a genuine image', async () => {
    const input = await sharp({
      create: {
        width: 10,
        height: 10,
        channels: 3,
        background: '#111'
      }
    }).png().toBuffer();
    const out = await cleanImage(input);
    expect((await sharp(out).metadata()).format).toBe('jpeg');
  });
  it('rejects a corrupt image with a valid signature', async () => {
    await expect(cleanImage(Buffer.from('89504e470d0a1a0a000000000000000000000000', 'hex'))).rejects.toThrow();
  });
});
describe('private links and export', () => {
  it('hashes status tokens and deterministically handles retries', () => {
    expect(accessToken('key')).toHaveLength(64);
    expect(accessToken('key')).toBe(accessToken('key'));
    expect(hash(accessToken('key'))).not.toBe(accessToken('key'));
  });
  it('blocks unverified or malformed WhatsApp links', () => {
    process.env.WHATSAPP_INVITE_VERIFIED = 'false';
    process.env.WHATSAPP_INVITE_URL = 'https://chat.whatsapp.com/example';
    expect(invitation()).toBeUndefined();
    process.env.WHATSAPP_INVITE_VERIFIED = 'true';
    process.env.WHATSAPP_INVITE_URL = 'https://chat.whatsapp.com/example? s=qt';
    expect(invitation()).toBeUndefined();
    process.env.WHATSAPP_INVITE_URL = 'https://evil.test/example';
    expect(invitation()).toBeUndefined();
  });
  it('escapes CSV and neutralizes formulas', () => {
    expect(csvCell('=1+2')).toBe('"\'=1+2"');
    expect(csvCell('a"b')).toBe('"a""b"');
  });
});
