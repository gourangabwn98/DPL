import { describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

const mocks = vi.hoisted(() => ({ validate: vi.fn(), initialize: vi.fn() }));
vi.mock('../server/config', () => ({ validateConfig: mocks.validate }));
vi.mock('../server/db', () => ({ initialize: mocks.initialize }));
vi.mock('../server/app', () => ({ app: (_req: unknown, res: express.Response) => res.json({ ok: true }) }));
import handler from '../api/index';

describe('Vercel startup responses', () => {
  it('returns safe JSON for missing configuration instead of a plain-text crash', async () => {
    mocks.validate.mockImplementationOnce(() => { throw new Error('TOKEN_SECRET must contain at least 32 random characters'); });
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const serverless = express(); serverless.use(handler);
      const response = await request(serverless).get('/api/tournament');
      expect(response.status).toBe(503);
      expect(response.type).toMatch(/json/);
      expect(response.body.error).toContain('database connection');
      expect(response.text).not.toContain('TOKEN_SECRET');
      expect(response.headers['cache-control']).toBe('no-store');
      expect(mocks.initialize).not.toHaveBeenCalled();
    } finally { log.mockRestore(); }
  });
  it('retries failed initialization and reuses a successful database cold start', async () => {
    const serverless = express(); serverless.use(handler);
    mocks.initialize.mockRejectedValueOnce(new Error('Connection refused')).mockResolvedValue(undefined);
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect((await request(serverless).get('/api/tournament')).status).toBe(503);
      expect((await request(serverless).get('/api/tournament')).body).toEqual({ ok: true });
      expect((await request(serverless).get('/api/tournament')).body).toEqual({ ok: true });
      expect(mocks.initialize).toHaveBeenCalledTimes(2);
    } finally { log.mockRestore(); }
  });
});
