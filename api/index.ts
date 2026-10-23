import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Request, Response } from 'express';

let ready: Promise<typeof import('../server/app.js').app> | undefined;
async function initializeApi() {
  const { validateConfig } = await import('../server/config.js');
  try { validateConfig(); } catch (error) {
    // Validation messages name settings, never print their secret values.
    console.error('Invalid tournament configuration:', error instanceof Error ? error.message : 'Unknown setting');
    throw error;
  }
  const [{ app }, { initialize }] = await Promise.all([import('../server/app.js'), import('../server/db.js')]);
  await initialize();
  return app;
}

// Import native libraries and connect inside the handler so startup failures also
// return JSON instead of Vercel's plain-text FUNCTION_INVOCATION_FAILED page.
export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    ready ||= initializeApi().catch(error => { ready = undefined; throw error; });
    const app = await ready;
    return app(req as Request, res as Response);
  } catch (error) {
    console.error('Tournament API startup unavailable', { name: error instanceof Error ? error.name : 'UnknownError', code: (error as { code?: string })?.code });
    // Vercel passes a Node response here; Express has not decorated it yet.
    res.statusCode = 503;
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: 'The tournament service cannot start. The organiser must check the database connection and hosting configuration.' }));
  }
}
