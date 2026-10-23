import argon2 from 'argon2';
import { locked } from './db.js';

export async function resetAdminPassword(email: string, password: string) {
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  await locked(async tx => {
    const admin = await tx.admin.findUnique({ where: { email } });
    if (!admin) throw new Error('Admin email not found');
    await tx.admin.update({ where: { id: admin.id }, data: { passwordHash } });
    await tx.session.deleteMany({ where: { adminId: admin.id } });
    await tx.audit.create({ data: { adminId: admin.id, action: 'RESET_ADMIN_PASSWORD', target: admin.id } });
  });
}
