import { PrismaClient, Prisma } from '@prisma/client';
export const db = new PrismaClient();
export async function locked<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Settings" WHERE id = 1 FOR UPDATE`;
    return fn(tx);
  }, {
    maxWait: 15000,
    timeout: 15000
  });
}
export async function initialize() {
  await db.settings.upsert({
    where: {
      id: 1
    },
    create: {
      id: 1
    },
    update: {}
  });
}
