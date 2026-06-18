import { prisma } from '../db.js';
import { isOutlookPushEnabled } from '../env.js';
import { renewAllOutlookSubscriptions } from './subscriptionManager.js';
import { runOutlookSyncForUser } from './syncRunner.js';

export async function runDailyOutlookSync(): Promise<void> {
  if (!isOutlookPushEnabled()) return;

  const renewed = await renewAllOutlookSubscriptions();
  console.log('[daily] Outlook subscription renewal', { renewed });

  const users = await prisma.user.findMany({
    where: {
      authProvider: 'outlook',
      outlookSyncFolder: { not: null },
    },
    select: { id: true },
  });

  console.log('[daily] Outlook safety sync starting', { users: users.length });

  for (const u of users) {
    await runOutlookSyncForUser(u.id, 'daily');
  }

  console.log('[daily] Outlook safety sync finished', { users: users.length });
}
