import { describe, expect, it, vi } from 'vitest';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import request from 'supertest';

const mocks = vi.hoisted(() => ({ validate: vi.fn(), initialize: vi.fn() }));
vi.mock('../server/config', () => ({ validateConfig: mocks.validate }));
vi.mock('../server/db', () => ({ initialize: mocks.initialize }));
vi.mock('../server/app', () => ({ app: (_req: IncomingMessage, res: ServerResponse) => {
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ ok: true }));
} }));
import handler from '../api/index';

const serverless = () => createServer((req, res) => { void handler(req, res); });

describe('Vercel startup responses', () => {
  it('returns safe JSON for missing configuration instead of a plain-text crash', async () => {
    mocks.validate.mockImplementationOnce(() => { throw new Error('TOKEN_SECRET must contain at least 32 random characters'); });
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const response = await request(serverless()).get('/api/tournament');
      expect(response.status).toBe(503);
      expect(response.type).toMatch(/json/);
      expect(response.body.error).toContain('database connection');
      expect(response.text).not.toContain('TOKEN_SECRET');
      expect(response.headers['cache-control']).toBe('no-store');
      expect(mocks.initialize).not.toHaveBeenCalled();
    } finally { log.mockRestore(); }
  });
  it('retries failed initialization and reuses a successful database cold start', async () => {
    const server = serverless();
    mocks.initialize.mockRejectedValueOnce(new Error('Connection refused')).mockResolvedValue(undefined);
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect((await request(server).get('/api/tournament')).status).toBe(503);
      expect((await request(server).get('/api/tournament')).body).toEqual({ ok: true });
      expect((await request(server).get('/api/tournament')).body).toEqual({ ok: true });
      expect(mocks.initialize).toHaveBeenCalledTimes(2);
    } finally { log.mockRestore(); }
  });
});
