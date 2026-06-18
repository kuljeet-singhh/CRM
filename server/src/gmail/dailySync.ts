import { prisma } from '../db.js';
import { runGmailSyncForUser } from './syncRunner.js';

export async function runDailyGmailSync(): Promise<void> {
  const users = await prisma.user.findMany({
    where: {
      authProvider: 'gmail',
      gmailSyncLabel: { not: null },
      crmLabels: { some: {} },
    },
    select: { id: true },
  });

  console.log('[daily] Gmail safety sync starting', { users: users.length });

  for (const u of users) {
    await runGmailSyncForUser(u.id, 'daily');
  }

  console.log('[daily] Gmail safety sync finished', { users: users.length });
}
