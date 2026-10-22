import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hash, randomToken, accessToken, invitation, csvCell } from '../server/security.ts';
process.env.TOKEN_SECRET = 'test-only-secret-012345678901234567890';
test('status tokens provide 256 bits of randomness and are unguessable by reference', () => {
  const tokens = new Set(Array.from({
    length: 1000
  }, () => randomToken()));
  assert.equal(tokens.size, 1000);
  for (const t of tokens) assert.match(t, /^[a-f0-9]{64}$/);
});
test('idempotency derivation is stable, secret-bound and key-bound', () => {
  assert.equal(accessToken('request-one'), accessToken('request-one'));
  assert.notEqual(accessToken('request-one'), accessToken('request-two'));
  const t = accessToken('request-one');
  process.env.TOKEN_SECRET = 'another-test-only-secret';
  assert.notEqual(accessToken('request-one'), t);
  assert.notEqual(hash(t), t);
});
test('invitation is disabled until explicitly verified', () => {
  process.env.WHATSAPP_INVITE_URL = 'https://chat.whatsapp.com/TestInvite';
  process.env.WHATSAPP_INVITE_VERIFIED = 'false';
  assert.equal(invitation(), undefined);
});
test('invitation rejects whitespace, unsafe protocols, credentials and other origins', () => {
  process.env.WHATSAPP_INVITE_VERIFIED = 'true';
  for (const value of ['https://chat.whatsapp.com/Invite? s=qt', 'javascript:alert(1)', 'https://chat.whatsapp.com.evil.test/Invite', 'https://user:pass@chat.whatsapp.com/Invite', 'http://chat.whatsapp.com/Invite', 'https://chat.whatsapp.com:8443/Invite', 'https://chat.whatsapp.com/a/b', 'invalid']) {
    process.env.WHATSAPP_INVITE_URL = value;
    assert.equal(invitation(), undefined, value);
  }
});
test('a verified HTTPS WhatsApp invitation is usable', () => {
  process.env.WHATSAPP_INVITE_URL = 'https://chat.whatsapp.com/TestInvite?s=qt&p=a';
  assert.equal(invitation(), process.env.WHATSAPP_INVITE_URL);
});
test('CSV encodes quotes, multiline text and empty values', () => {
  assert.equal(csvCell('a"b\nc'), '"a""b\nc"');
  assert.equal(csvCell(null), '""');
});
test('CSV neutralizes spreadsheet formulas including leading whitespace', () => {
  for (const formula of ['=1+1', '+SUM(1,1)', '-1+1', '@cmd', ' \t=HYPERLINK("evil")']) assert.ok(csvCell(formula).startsWith('"\''));
});
