import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });
//test
async function productionConfig(uploadDir: string) {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('DATABASE_URL', 'mongodb://127.0.0.1:27018/dpl_test?replicaSet=rs0');
  vi.stubEnv('TOKEN_SECRET', 'test-only-secret-012345678901234567890');
  vi.stubEnv('APP_ORIGIN', 'https://example.test');
  vi.stubEnv('RETENTION_DAYS', '180');
  vi.stubEnv('STORAGE_DRIVER', 'local');
  vi.stubEnv('VERCEL', '');
  vi.stubEnv('UPLOAD_DIR', uploadDir);
  return (await import('../server/config')).validateConfig;
}

describe('private production upload configuration', () => {
  it('accepts a private absolute volume path without cloud credentials', async () => {
    const validate = await productionConfig(path.resolve('private-uploads'));
    expect(validate).not.toThrow();
  });
  it('rejects relative production paths', async () => {
    const validate = await productionConfig('private-uploads');
    expect(validate).toThrow('absolute path');
  });
  it.each(['public', 'public/proofs', 'dist', 'dist/proofs'])('rejects a public upload path: %s', async directory => {
    const validate = await productionConfig(path.resolve(directory));
    expect(validate).toThrow('outside public and dist');
  });
  it('rejects a stale unsupported storage driver instead of silently switching', async () => {
    const validate = await productionConfig(path.resolve('private-uploads'));
    vi.stubEnv('STORAGE_DRIVER', 'unsupported');
    expect(validate).toThrow('migrate existing proofs');
  });
  it('supports private MongoDB image storage without a filesystem volume', async () => {
    const validate = await productionConfig('');
    vi.stubEnv('STORAGE_DRIVER', 'mongodb');
    expect(validate).not.toThrow();
  });
  it('defaults to MongoDB uploads on Vercel', async () => {
    const validate = await productionConfig('');
    vi.stubEnv('STORAGE_DRIVER', '');
    vi.stubEnv('VERCEL', '1');
    expect(validate).not.toThrow();
  });
  it('rejects ephemeral local uploads on Vercel', async () => {
    const validate = await productionConfig(path.resolve('private-uploads'));
    vi.stubEnv('VERCEL', '1');
    expect(validate).toThrow('STORAGE_DRIVER=mongodb');
  });
});
