import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../src/api';
afterEach(() => vi.unstubAllGlobals());
describe('hosting error messages', () => {
  it('explains a Vercel plain-text server failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('FUNCTION_INVOCATION_FAILED', { status: 500 })));
    await expect(api('/tournament')).rejects.toThrow('hosting configuration');
  });
  it('explains an HTML fallback instead of treating it as tournament data', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>App</html>', { headers: { 'Content-Type': 'text/html' } })));
    await expect(api('/tournament')).rejects.toThrow('hosting API routes');
  });
  it('explains platform upload limits', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('FUNCTION_PAYLOAD_TOO_LARGE', { status: 413 })));
    await expect(api('/payment')).rejects.toThrow('4 MB');
  });
  it('preserves structured API errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'Registration is currently closed' }), { status: 409 })));
    await expect(api('/registrations')).rejects.toThrow('Registration is currently closed');
  });
});
