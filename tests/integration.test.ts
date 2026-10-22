/** Requires an EMPTY disposable PostgreSQL database, never a production URL. */
import { beforeAll, afterAll, beforeEach, describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import argon2 from 'argon2';
import sharp from 'sharp';
import { app } from '../server/app';
import { db, initialize } from '../server/db';
import { config } from '../server/config';
import { deleteProof } from '../server/storage';
import * as storage from '../server/storage';
import { DatabaseRateStore } from '../server/rate-store';
import { readRules } from '../server/tournament-rules';
// Exercise the production shared rate store while keeping each disposable test isolated.
vi.mock('../server/rate-store', async importOriginal => {
  const actual = await importOriginal<typeof import('../server/rate-store')>();
  return { ...actual, rateStore: (namespace: string) => new actual.DatabaseRateStore(namespace) };
});
const integration = process.env.TEST_DATABASE_CONFIRMED === 'true' ? describe : describe.skip;
integration('real PostgreSQL API workflows', () => {
  let image: Buffer;
  let cookie: string;
  let serial = 0;
  const origin = config.origin;
  const post = (url: string) => request(app).post(url).set('Origin', origin);
  async function register(key = randomUUID(), mobile = '98765' + String(++serial).padStart(5, '0')) {
    return post('/api/registrations').set('Idempotency-Key', key).send({
      fullName: 'Test Player',
      mobile,
      role: 'Batter',
      consent: true
    });
  }
  async function proof(token: string, txn = 'TXN' + randomUUID().replaceAll('-', '')) {
    return post('/api/payment').set('Authorization', 'Bearer ' + token).field('transactionId', txn).field('declaration', 'true').attach('proof', image, 'receipt.png');
  }
  async function review(id: string, status = 'APPROVED') {
    return post(`/api/admin/players/${id}/review`).set('Cookie', cookie).send({
      status,
      reason: status === 'REJECTED' ? 'Reference does not match' : ''
    });
  }
  function ensureTestDatabase() {
    if (!new URL(process.env.DATABASE_URL || 'http://invalid').pathname.startsWith('/dpl_test')) throw new Error('Integration database name must start with dpl_test');
  }
  async function cleanup() {
    ensureTestDatabase();
    const payments = await db.payment.findMany();
    for (const p of payments) await deleteProof(p.storageKey);
    await db.verification.deleteMany();
    await db.payment.deleteMany();
    await db.registration.deleteMany();
    await db.audit.deleteMany();
  }
  beforeAll(async () => {
    ensureTestDatabase();
    await initialize();
    await cleanup();
    await db.session.deleteMany();
    await db.admin.deleteMany();
    await db.admin.create({
      data: {
        email: 'admin@example.test',
        passwordHash: await argon2.hash('testing-password-12345')
      }
    });
    image = await sharp({
      create: {
        width: 12,
        height: 12,
        channels: 3,
        background: '#fff'
      }
    }).png().toBuffer();
    const r = await post('/api/admin/login').send({
      email: 'admin@example.test',
      password: 'testing-password-12345'
    });
    expect(r.status).toBe(200);
    cookie = r.headers['set-cookie'][0].split(';')[0];
  });
  beforeEach(async () => {
    await cleanup();
    await db.rateBucket.deleteMany();
    await db.settings.update({
      where: {
        id: 1
      },
      data: {
        capacity: 150,
        open: true,
        opensAt: null,
        closesAt: null,
        fields: {},
        rules: 'Previously saved organiser rules'
      }
    });
  });
  afterAll(async () => {
    await cleanup();
    await db.session.deleteMany();
    await db.admin.deleteMany();
    await db.$disconnect();
  });
  it('validates input and does not return success on failure', async () => {
    const r = await post('/api/registrations').set('Idempotency-Key', randomUUID()).send({
      fullName: 'x'
    });
    expect(r.status).toBe(400);
    expect(await db.registration.count()).toBe(0);
  });
  it('shares atomic rate counters across instances and resets expired windows', async () => {
    const first = new DatabaseRateStore('integration-shared');
    const second = new DatabaseRateStore('integration-shared');
    const results = await Promise.all(Array.from({ length: 20 }, (_, i) => (i % 2 ? first : second).increment('test-ip')));
    expect(results.map(r => r.totalHits).sort((a, b) => a - b)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    await db.rateBucket.updateMany({ data: { resetAt: new Date(Date.now() - 1000) } });
    expect((await first.increment('test-ip')).totalHits).toBe(1);
    await second.resetKey('test-ip');
  });
  it('is idempotent and prevents duplicate mobile numbers', async () => {
    const key = randomUUID(),
      mobile = '9876543210';
    const [a, b] = await Promise.all([register(key, mobile), register(key, mobile)]);
    expect(a.status).toBe(201);
    expect(b.body.token).toBe(a.body.token);
    expect(await db.registration.count()).toBe(1);
    expect((await register(randomUUID(), mobile)).status).toBe(409);
  });
  it('rejects a changed payload for the same key', async () => {
    const key = randomUUID();
    await register(key, '9876543210');
    expect((await register(key, '9876543211')).status).toBe(409);
  });
  it('requires correct private access and hides contact data from public APIs', async () => {
    const r = await register();
    expect((await request(app).get('/api/status')).status).toBe(401);
    expect((await request(app).get('/api/status').set('Authorization', 'Bearer ' + 'a'.repeat(64))).status).toBe(404);
    const s = await request(app).get('/api/status').set('Authorization', 'Bearer ' + r.body.token);
    expect(s.status).toBe(200);
    expect(s.body).not.toHaveProperty('mobile');
    expect(s.body).not.toHaveProperty('data');
    expect(s.body).not.toHaveProperty('invitation');
    const pub = await request(app).get('/api/tournament');
    expect(JSON.stringify(pub.body)).not.toContain(r.body.token);
    expect(pub.body).not.toHaveProperty('players');
  });
  it('protects every admin API and checks mutation origin', async () => {
    for (const url of ['/api/admin/me', '/api/admin/players', '/api/admin/export', '/api/admin/audit', '/api/admin/proofs/invalid']) expect((await request(app).get(url)).status).toBe(401);
    expect((await post('/api/admin/players/invalid/review').send({
      status: 'APPROVED'
    })).status).toBe(401);
    expect((await request(app).post('/api/admin/players/invalid/review').set('Cookie', cookie).send({
      status: 'APPROVED'
    })).status).toBe(403);
  });
  it('rejects a wrong password', async () => {
    expect((await post('/api/admin/login').send({
      email: 'admin@example.test',
      password: 'wrong'
    })).status).toBe(401);
  });
  it('moves proof to review only, protects proof and releases invite only on approval', async () => {
    process.env.WHATSAPP_INVITE_VERIFIED = 'true';
    process.env.WHATSAPP_INVITE_URL = 'https://chat.whatsapp.com/ConfirmedTestInvite';
    const r = await register();
    expect((await proof(r.body.token)).body.status).toBe('UNDER_REVIEW');
    let s = await request(app).get('/api/status').set('Authorization', 'Bearer ' + r.body.token);
    expect(s.body).not.toHaveProperty('invitation');
    const record = await db.registration.findFirstOrThrow();
    const payment = await db.payment.findFirstOrThrow();
    const detail = await request(app).get('/api/admin/players/' + record.id).set('Cookie', cookie);
    expect(detail.body.payments[0].transactionId).toBe(payment.transactionId);
    expect((await request(app).get('/api/admin/proofs/' + payment.id)).status).toBe(401);
    expect((await request(app).get('/api/admin/proofs/' + payment.id).set('Cookie', cookie)).status).toBe(200);
    expect((await review(record.id)).status).toBe(200);
    s = await request(app).get('/api/status').set('Authorization', 'Bearer ' + r.body.token);
    expect(s.body.invitation).toBe(process.env.WHATSAPP_INVITE_URL);
    expect(await db.verification.count()).toBe(1);
    expect(await db.audit.count({ where: { action: 'APPROVED', target: record.id } })).toBe(1);
    expect((await review(record.id)).status).toBe(409);
  });
  it('supports rejection, reason and resubmission without invitation', async () => {
    const r = await register();
    await proof(r.body.token);
    const record = await db.registration.findFirstOrThrow();
    expect((await review(record.id, 'REJECTED')).status).toBe(200);
    const s = await request(app).get('/api/status').set('Authorization', 'Bearer ' + r.body.token);
    expect(s.body.history[0].reason).toBe('Reference does not match');
    expect(s.body).not.toHaveProperty('invitation');
    expect((await proof(r.body.token)).status).toBe(200);
  });
  it.each(['AWAITING_PAYMENT', 'UNDER_REVIEW', 'REJECTED'] as const)('does not expose an invite for %s even with forged query parameters', async status => {
    process.env.WHATSAPP_INVITE_URL = 'https://chat.whatsapp.com/PrivateTestInvite?s=sh&p=a&mlu=4&ilr=4';
    process.env.WHATSAPP_INVITE_VERIFIED = 'true';
    const registration = await register();
    await db.registration.updateMany({ data: { status } });
    const result = await request(app).get('/api/status?status=APPROVED&approved=true&invitation=true').set('Authorization', 'Bearer ' + registration.body.token);
    expect(result.status).toBe(200);
    expect(result.body.status).toBe(status);
    expect(result.body).not.toHaveProperty('invitation');
    expect(result.headers['cache-control']).toBe('no-store');
    expect((await request(app).get('/api/tournament')).text).not.toContain('PrivateTestInvite');
  });
  it('requires the private token even after approval and keeps the manual verification gate', async () => {
    const registration = await register();
    const record = await db.registration.findFirstOrThrow();
    await proof(registration.body.token);
    expect((await post(`/api/admin/players/${record.id}/review`).set('Authorization', 'Bearer ' + registration.body.token).send({ status: 'APPROVED' })).status).toBe(401);
    expect((await review(record.id)).status).toBe(200);
    expect((await request(app).get('/api/status?reference=' + registration.body.reference)).status).toBe(401);
    expect((await request(app).get('/api/status').set('Authorization', 'Bearer ' + 'b'.repeat(64))).status).toBe(404);
    process.env.WHATSAPP_INVITE_VERIFIED = 'false';
    expect((await request(app).get('/api/status').set('Authorization', 'Bearer ' + registration.body.token)).body).not.toHaveProperty('invitation');
    process.env.WHATSAPP_INVITE_VERIFIED = 'true';
    process.env.WHATSAPP_INVITE_URL = 'https://chat.whatsapp.com/PrivateTestInvite?s=sh&p=a&mlu=4&ilr=4';
    const approved = await request(app).get('/api/status').set('Authorization', 'Bearer ' + registration.body.token);
    expect(approved.body.invitation).toBe(process.env.WHATSAPP_INVITE_URL);
    expect((await request(app).post('/api/status').set('Origin', origin).send({ status: 'APPROVED' })).status).toBe(404);
  });
  it('protects rule drafts, preserves legacy settings, and audits authenticated publication', async () => {
    expect((await request(app).get('/api/admin/rules')).status).toBe(401);
    expect((await request(app).put('/api/admin/rules').set('Origin', origin).send(readRules(''))).status).toBe(401);
    const draft = await request(app).get('/api/admin/rules').set('Cookie', cookie);
    expect(draft.body.document.rules).toHaveLength(9);
    expect(draft.body.document.legacyText).toBe('Previously saved organiser rules');
    expect(draft.body.reviewNotes['9']).toContain('ভাতার ব্রক');
    let publicResponse = await request(app).get('/api/tournament');
    expect(publicResponse.body).not.toHaveProperty('rules');
    expect(publicResponse.text).not.toContain('ভাতার ব্রক');
    expect(publicResponse.text).not.toContain('Previously saved organiser rules');
    expect(publicResponse.body.tournamentRules[8].text).toBeNull();
    const document = draft.body.document;
    document.rules[0].text = { en: 'Confirmed test wording.', bn: 'নিশ্চিত করা পরীক্ষামূলক পাঠ।' };
    document.rules[0].confirmed = true;
    const saved = await request(app).put('/api/admin/rules').set('Cookie', cookie).set('Origin', origin).send(document);
    expect(saved.status).toBe(200);
    publicResponse = await request(app).get('/api/tournament');
    expect(publicResponse.body.tournamentRules[0].text).toEqual(document.rules[0].text);
    expect(publicResponse.body.tournamentRules[8].text).toBeNull();
    expect(await db.audit.count({ where: { action: 'UPDATE_RULES' } })).toBe(1);
    expect(readRules((await db.settings.findUniqueOrThrow({ where: { id: 1 } })).rules).legacyText).toBe('Previously saved organiser rules');
    document.rules[8].confirmed = true;
    expect((await request(app).put('/api/admin/rules').set('Cookie', cookie).set('Origin', origin).send(document)).status).toBe(400);
    expect((await request(app).put('/api/admin/rules').set('Cookie', cookie).set('Origin', origin).send({ ...document, rules: document.rules.slice(1) })).status).toBe(400);
  });
  it('enforces capacity under concurrent approvals', async () => {
    await db.settings.update({
      where: {
        id: 1
      },
      data: {
        capacity: 1
      }
    });
    const a = await register(),
      b = await register();
    await proof(a.body.token);
    await proof(b.body.token);
    const records = await db.registration.findMany();
    const results = await Promise.all(records.map(r => review(r.id)));
    expect(results.map(r => r.status).sort()).toEqual([200, 409]);
    expect(await db.registration.count({
      where: {
        status: 'APPROVED'
      }
    })).toBe(1);
    expect((await register()).status).toBe(409);
    const pub = await request(app).get('/api/tournament');
    expect(pub.body.available).toBe(0);
    expect(pub.body.accepting).toBe(false);
  });
  it('rejects malicious and missing uploads without changing status', async () => {
    const r = await register();
    const bad = await post('/api/payment').set('Authorization', 'Bearer ' + r.body.token).field('transactionId', 'ABC123456').field('declaration', 'true').attach('proof', Buffer.from('not an image'), 'test.png');
    expect(bad.status).toBe(400);
    const missing = await post('/api/payment').set('Authorization', 'Bearer ' + r.body.token).field('transactionId', 'ABC123456').field('declaration', 'true');
    expect(missing.status).toBe(400);
    expect(await db.payment.count()).toBe(0);
    expect((await db.registration.findFirstOrThrow()).status).toBe('AWAITING_PAYMENT');
  });
  it('rejects duplicate transaction references', async () => {
    const a = await register(),
      b = await register();
    expect((await proof(a.body.token, 'SAME123456')).status).toBe(200);
    expect((await proof(b.body.token, 'SAME123456')).status).toBe(409);
    expect(await db.payment.count()).toBe(1);
  });
  it('reports failed storage writes without claiming success', async () => {
    const r = await register();
    const failure = vi.spyOn(storage, 'putProof').mockRejectedValueOnce(new Error('Storage unavailable'));
    try {
      const response = await proof(r.body.token);
      expect(response.status).toBe(500);
      expect(await db.payment.count()).toBe(0);
    } finally {
      failure.mockRestore();
    }
  });
  it('closes registration by configured date', async () => {
    await db.settings.update({
      where: {
        id: 1
      },
      data: {
        closesAt: new Date(Date.now() - 1000)
      }
    });
    expect((await register()).status).toBe(409);
  });
  it('returns structured errors on unknown routes', async () => {
    const r = await request(app).get('/api/missing');
    expect(r.status).toBe(404);
    expect(r.body.error).toBeTruthy();
  });
});
