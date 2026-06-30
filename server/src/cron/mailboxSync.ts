import { prisma } from '../db.js';
import { isOutlookPushEnabled } from '../env.js';
import { runGmailSyncForUser } from '../gmail/syncRunner.js';
import { runOutlookSyncForUser } from '../outlook/syncRunner.js';

export const CRON_MAILBOX_SYNC_BUDGET_MS = 50_000;

export type IncrementalMailboxSyncResult = {
  gmailUsers: number;
  outlookUsers: number;
  gmailUsersSynced: number;
  outlookUsersSynced: number;
  partial?: boolean;
};

export type IncrementalMailboxSyncOptions = {
  timeBudgetMs?: number;
};

export async function runIncrementalMailboxSync(
  options?: IncrementalMailboxSyncOptions
): Promise<IncrementalMailboxSyncResult> {
  const deadline =
    options?.timeBudgetMs != null ? Date.now() + options.timeBudgetMs : Number.POSITIVE_INFINITY;

  const gmailUsers = await prisma.user.findMany({
    where: {
      authProvider: 'gmail',
      gmailSyncLabel: { not: null },
      crmLabels: { some: {} },
    },
    select: { id: true },
  });

  console.log('[cron] mailbox sync starting', { gmail: gmailUsers.length });

  let gmailUsersSynced = 0;
  let partial = false;

  for (const u of gmailUsers) {
    if (Date.now() >= deadline) {
      partial = true;
      console.log('[cron] mailbox sync partial — time budget exceeded (gmail)');
      break;
    }
    await runGmailSyncForUser(u.id, 'cron');
    gmailUsersSynced++;
  }

  let outlookCount = 0;
  let outlookUsersSynced = 0;
  if (isOutlookPushEnabled() && !partial) {
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
      if (Date.now() >= deadline) {
        partial = true;
        console.log('[cron] mailbox sync partial — time budget exceeded (outlook)');
        break;
      }
      await runOutlookSyncForUser(u.id, 'cron');
      outlookUsersSynced++;
    }
  }

  console.log('[cron] mailbox sync finished', {
    gmail: gmailUsers.length,
    gmailUsersSynced,
    outlook: outlookCount,
    outlookUsersSynced,
    partial,
  });

  return {
    gmailUsers: gmailUsers.length,
    outlookUsers: outlookCount,
    gmailUsersSynced,
    outlookUsersSynced,
    partial: partial || undefined,
  };
}
