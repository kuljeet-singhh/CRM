import { startWorker } from './queue/worker.js';
import { renewExpiredWatches } from './gmail/watchManager.js';
import { runDailyGmailSync } from './gmail/dailySync.js';
import {
  renewAllOutlookSubscriptions,
} from './outlook/subscriptionManager.js';
import { runDailyOutlookSync } from './outlook/dailySync.js';
import { env, isOutlookPushEnabled } from './env.js';
import { prisma } from './db.js';

export async function startBackgroundJobs() {
  if (env.gmailPubsubTopic) {
    console.log('Gmail push enabled → webhook POST /api/webhooks/gmail');
    console.log('[gmail-push] topic', env.gmailPubsubTopic);
  }
  if (isOutlookPushEnabled()) {
    console.log('Outlook push enabled → webhook POST /api/webhooks/outlook');
    console.log('[outlook-push] url', env.outlookWebhookUrl);
  }

  startWorker();

  try {
    const renewed = await renewExpiredWatches();
    console.log('[gmail-watch] startup renewal', { renewed });
  } catch (e) {
    console.error('[gmail-watch] startup renewal failed', e);
  }

  setInterval(
    () => renewExpiredWatches().catch((e) => console.error('[gmail-watch]', e)),
    6 * 60 * 60 * 1000
  );
  setInterval(
    () => runDailyGmailSync().catch((e) => console.error('[daily]', e)),
    24 * 60 * 60 * 1000
  );

  if (isOutlookPushEnabled()) {
    try {
      const outlookRenewed = await renewAllOutlookSubscriptions();
      console.log('[outlook-subscription] startup renewal', { renewed: outlookRenewed });
      const missingInbox = await prisma.user.count({
        where: {
          authProvider: 'outlook',
          outlookSyncFolder: { not: null },
          outlookInboxSubscriptionId: null,
        },
      });
      if (missingInbox > 0) {
        console.warn(
          `[outlook-subscription] Inbox subscription missing for ${missingInbox} user(s) — re-save CRM folder in Settings`
        );
      }
    } catch (e) {
      console.error('[outlook-subscription] startup renewal failed', e);
    }
    setInterval(
      () => renewAllOutlookSubscriptions().catch((e) => console.error('[outlook-subscription]', e)),
      6 * 60 * 60 * 1000
    );
    setInterval(
      () => runDailyOutlookSync().catch((e) => console.error('[daily-outlook]', e)),
      24 * 60 * 60 * 1000
    );
  }
}
