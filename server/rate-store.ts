import type { Store, Options } from 'express-rate-limit';
import { db } from './db.js';
import { hash } from './security.js';

/** Atomic MongoDB counters shared across API processes. */
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
    const expired = { $lte: [{ $ifNull: ['$resetAt', { $date: new Date(0).toISOString() }] }, { $date: now.toISOString() }] };
    for (let attempt = 0; ; attempt++) {
      try {
        const result = await db.$runCommandRaw({
          findAndModify: 'RateBucket', query: { _id: key }, upsert: true, new: true,
          update: [{ $set: {
            hits: { $cond: [expired, 1, { $add: [{ $ifNull: ['$hits', 0] }, 1] }] },
            resetAt: { $cond: [expired, { $date: reset.toISOString() }, '$resetAt'] }
          } }]
        });
        const row = result.value as unknown as { hits: number; resetAt: { $date: string } };
        return { totalHits: row.hits, resetTime: new Date(row.resetAt.$date) };
      } catch (error) {
        if (attempt >= 2 || !(error instanceof Error) || !/E11000|11000/.test(error.message)) throw error;
      }
    }
  }
  async decrement(value: string) {
    const key = this.key(value);
    await db.$runCommandRaw({ update: 'RateBucket', updates: [{ q: { _id: key }, u: [{ $set: { hits: { $max: [0, { $subtract: ['$hits', 1] }] } } }] }] });
  }
  async resetKey(value: string) {
    await db.rateBucket.deleteMany({ where: { key: this.key(value) } });
  }
}
export const rateStore = (namespace: string) => process.env.NODE_ENV === 'production' ? new DatabaseRateStore(namespace) : undefined;
