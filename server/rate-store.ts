import type { Store, Options } from 'express-rate-limit';
import { db } from './db.js';
import { hash } from './security.js';

/** Atomic PostgreSQL counters shared across Vercel function instances. */
export class DatabaseRateStore implements Store {
  windowMs = 60000;
  localKeys = false;
  constructor(private readonly namespace: string) {}
  // Expose the already-isolated namespace to express-rate-limit's double-count check.
  get prefix() { return `${this.namespace}:`; }
  init(options: Options) { this.windowMs = options.windowMs; }
  private key(value: string) { return hash(`${this.namespace}:${value}`); }
  async increment(value: string) {
    const now = new Date();
    const reset = new Date(now.getTime() + this.windowMs);
    const key = this.key(value);
    const [row] = await db.$queryRaw<{ hits: number; resetAt: Date }[]>`
      INSERT INTO "RateBucket" ("key", "hits", "resetAt") VALUES (${key}, 1, ${reset})
      ON CONFLICT ("key") DO UPDATE SET
        "hits" = CASE WHEN "RateBucket"."resetAt" <= ${now} THEN 1 ELSE "RateBucket"."hits" + 1 END,
        "resetAt" = CASE WHEN "RateBucket"."resetAt" <= ${now} THEN ${reset} ELSE "RateBucket"."resetAt" END
      RETURNING "hits", "resetAt"
    `;
    return { totalHits: row.hits, resetTime: row.resetAt };
  }
  async decrement(value: string) {
    const key = this.key(value);
    await db.$executeRaw`UPDATE "RateBucket" SET "hits" = GREATEST(0, "hits" - 1) WHERE "key" = ${key}`;
  }
  async resetKey(value: string) {
    await db.rateBucket.deleteMany({ where: { key: this.key(value) } });
  }
}
export const rateStore = (namespace: string) => process.env.NODE_ENV === 'production' ? new DatabaseRateStore(namespace) : undefined;
