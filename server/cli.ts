import 'dotenv/config';
import argon2 from 'argon2';
import { db, initialize, locked } from './db.js';
import { config } from './config.js';
import { deleteProof } from './storage.js';
import { resetAdminPassword } from './admin-accounts.js';
import { z } from 'zod';
try {
  await initialize();
  if (process.argv[2] === 'admin' || process.argv[2] === 'admin-reset') {
    const email = z.email().parse(process.env.ADMIN_EMAIL).toLowerCase();
    const password = z.string().min(14).max(200).parse(process.env.ADMIN_PASSWORD);
    if (process.argv[2] === 'admin-reset') {
      await resetAdminPassword(email, password);
      console.log('Administrator password reset and existing sessions revoked. Remove ADMIN_PASSWORD from your environment.');
    } else {
      const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
      await locked(async tx => {
        if (await tx.admin.count()) throw new Error('First-admin setup is disabled because an admin already exists');
        await tx.admin.create({ data: { email, passwordHash } });
      });
      console.log('First administrator created. Remove ADMIN_PASSWORD from your environment.');
    }
  } else if (process.argv[2] === 'purge') {
    if (!Number.isInteger(config.retention) || config.retention < 1) throw new Error('Invalid retention');
    const cutoff = new Date(Date.now() - config.retention * 86400000);
    const old = await db.registration.findMany({
      where: {
        createdAt: {
          lt: cutoff
        }
      },
      include: {
        payments: true
      }
    });
    for (const r of old) {
      for (const p of r.payments) await deleteProof(p.storageKey);
      if (r.photoKey) await deleteProof(r.photoKey);
      await db.registration.delete({
        where: {
          id: r.id
        }
      });
    }
    await db.session.deleteMany({
      where: {
        expiresAt: {
          lt: new Date()
        }
      }
    });
    await db.rateBucket.deleteMany({ where: { resetAt: { lt: new Date() } } });
    await db.audit.deleteMany({
      where: {
        createdAt: {
          lt: cutoff
        }
      }
    });
    console.log(`Purged ${old.length} expired registrations and expired sessions/audits`);
  } else throw new Error('Use admin, admin-reset or purge');
} finally {
  await db.$disconnect();
}
