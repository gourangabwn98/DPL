import { PrismaClient, Prisma } from '@prisma/client';
export const db = new PrismaClient();
export async function locked<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  // A real write to the singleton creates a shared MongoDB transaction conflict.
  // Retry the entire operation so approvals re-read capacity and payment status.
  for (let attempt = 0; ; attempt++) {
    try {
      return await db.$transaction(async tx => {
        await tx.settings.update({ where: { id: '1' }, data: { lockVersion: { increment: 1 } } });
        return fn(tx);
      }, { maxWait: 15000, timeout: 15000 });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2034' || attempt >= 9) throw error;
      await new Promise(resolve => setTimeout(resolve, Math.min(20 * 2 ** attempt, 500) + Math.random() * 25));
    }
  }
}
export async function initialize() {
  try {
    await db.settings.upsert({ where: { id: '1' }, create: { id: '1' }, update: {} });
  } catch (error) {
    // Another cold-start instance may have inserted the same singleton first.
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
  }
}
