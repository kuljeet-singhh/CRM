import { prisma } from '../db.js';
import { env } from '../env.js';
import { getAuthorizedClient } from '../auth/tokens.js';

export async function ensureGmailWatch(userId: string): Promise<{ expiresAt?: Date; warning?: string }> {
  if (!env.gmailPubsubTopic) {
    console.log('[gmail-watch] skipped: GMAIL_PUBSUB_TOPIC not configured');
    return { warning: 'pubsub_not_configured' };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { crmLabels: true },
  });
  if (!user) return { warning: 'user_not_found' };

  if (!user.gmailSyncLabel) {
    console.log('[gmail-watch] skipped: no sync label');
    return { warning: 'no_sync_label' };
  }

  const crmLabel = user.crmLabels[0];
  if (!crmLabel) {
    console.log('[gmail-watch] skipped: no CRM labels');
    return { warning: 'no_crm_labels' };
  }

  if (user.gmailWatchExpiry && user.gmailWatchExpiry.getTime() > Date.now() + 60_000) {
    console.log('[gmail-watch] already active');
    return { expiresAt: user.gmailWatchExpiry };
  }

  try {
    const gmail = await getAuthorizedClient(userId);
    const res = await gmail.users.watch({
      userId: 'me',
      requestBody: {
        topicName: env.gmailPubsubTopic,
        labelIds: [crmLabel.labelId],
        labelFilterAction: 'include',
      },
    });

    const expiryMs = res.data.expiration ? parseInt(res.data.expiration, 10) : Date.now() + 7 * 24 * 60 * 60 * 1000;
    const expiresAt = new Date(expiryMs);

    await prisma.user.update({
      where: { id: userId },
      data: {
        gmailWatchExpiry: expiresAt,
        gmailLastHistoryId: res.data.historyId ?? user.gmailLastHistoryId,
      },
    });

    console.log(`[gmail-watch] Gmail watch renewed for ${userId} (label: ${user.gmailSyncLabel})`);
    return { expiresAt };
  } catch (err) {
    console.error('[gmail-watch] registration_failed', err);
    return { warning: 'registration_failed' };
  }
}

export const startGmailWatch = ensureGmailWatch;
export const renewAllGmailWatches = renewExpiredWatches;

export async function renewExpiredWatches(): Promise<number> {
  const users = await prisma.user.findMany({
    where: {
      authProvider: 'gmail',
      gmailSyncLabel: { not: null },
      crmLabels: { some: {} },
      OR: [
        { gmailWatchExpiry: null },
        { gmailWatchExpiry: { lt: new Date(Date.now() + 24 * 60 * 60 * 1000) } },
      ],
    },
  });

  let renewed = 0;
  for (const u of users) {
    const result = await ensureGmailWatch(u.id);
    if (result.expiresAt) renewed++;
  }
  console.log('[gmail-watch] renewal_run', { renewed, total: users.length });
  return renewed;
}

export async function countWatchIssues(): Promise<number> {
  return prisma.user.count({
    where: {
      authProvider: 'gmail',
      gmailSyncLabel: { not: null },
      crmLabels: { some: {} },
      OR: [
        { gmailWatchExpiry: null },
        { gmailWatchExpiry: { lt: new Date() } },
      ],
    },
  });
}
