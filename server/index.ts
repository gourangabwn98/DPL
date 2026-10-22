import { app } from './app.js';
import { validateConfig } from './config.js';
import { db, initialize } from './db.js';
validateConfig();
await initialize();
const server = app.listen(Number(process.env.PORT || 3001), () => console.log('DPL API listening'));
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.close(() => {
  void db.$disconnect().then(() => process.exit(0));
}));
