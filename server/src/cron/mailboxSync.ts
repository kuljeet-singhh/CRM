import { prisma } from '../db.js';
import { isOutlookPushEnabled } from '../env.js';
import { runGmailSyncForUser } from '../gmail/syncRunner.js';
import { runOutlookSyncForUser } from '../outlook/syncRunner.js';

export type IncrementalMailboxSyncResult = {
  gmailUsers: number;
  outlookUsers: number;
};

export async function runIncrementalMailboxSync(): Promise<IncrementalMailboxSyncResult> {
  const gmailUsers = await prisma.user.findMany({
    where: {
      authProvider: 'gmail',
      gmailSyncLabel: { not: null },
      crmLabels: { some: {} },
    },
    select: { id: true },
  });

  console.log('[cron] mailbox sync starting', { gmail: gmailUsers.length });

  for (const u of gmailUsers) {
    await runGmailSyncForUser(u.id, 'cron');
  }

  let outlookCount = 0;
  if (isOutlookPushEnabled()) {
    const outlookUsers = await prisma.user.findMany({
      where: {
        authProvider: 'outlook',
        outlookSyncFolder: { not: null },
      },
      select: { id: true },
    });
    outlookCount = outlookUsers.length;
    console.log('[cron] outlook sync', { users: outlookCount });
    for (const u of outlookUsers) {
      await runOutlookSyncForUser(u.id, 'cron');
    }
  }

  console.log('[cron] mailbox sync finished', {
    gmail: gmailUsers.length,
    outlook: outlookCount,
  });

  return { gmailUsers: gmailUsers.length, outlookUsers: outlookCount };
}
