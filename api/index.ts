import { app } from '../server/app.js';
import { validateConfig } from '../server/config.js';

// Vercel invokes the Express handler; do not start a listening server here.
validateConfig();
export default app;
