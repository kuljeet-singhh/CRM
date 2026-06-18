import { Router, type Request, type Response } from 'express';
import { prisma } from '../../db.js';
import { env, isOutlookPushEnabled } from '../../env.js';
import { findOutlookUserBySubscriptionId } from '../findUserBySubscription.js';
import {
  ensureOutlookSubscription,
  handleSubscriptionLifecycle,
} from '../subscriptionManager.js';
import { scheduleOutlookSync } from '../syncRunner.js';

export const outlookWebhookRouter = Router();

function handleValidationToken(req: Request, res: Response): boolean {
  const token = (req.query.validationToken as string | undefined)?.trim();
  if (!token) return false;
  res.status(200).type('text/plain').send(token);
  return true;
}

function clientStateValid(state: string | undefined): boolean {
  return Boolean(state && state === env.outlookWebhookClientState);
}

async function handleNotifications(req: Request, res: Response) {
  if (!isOutlookPushEnabled()) {
    res.status(200).end();
    return;
  }

  const items = (req.body?.value ?? []) as Array<{
    subscriptionId?: string;
    clientState?: string;
    lifecycleEvent?: string;
    changeType?: string;
  }>;

  const userIds = new Set<string>();

  for (const item of items) {
    if (!clientStateValid(item.clientState)) {
      console.log('[outlook-webhook] invalid_client_state');
      continue;
    }

    if (item.lifecycleEvent && item.subscriptionId) {
      await handleSubscriptionLifecycle(item.subscriptionId, item.lifecycleEvent);
      continue;
    }

    if (!item.subscriptionId) continue;

    const user = await findOutlookUserBySubscriptionId(item.subscriptionId);

    if (!user) {
      console.log('[outlook-webhook] orphan_subscription', item.subscriptionId);
      const outlookUser = await prisma.user.findFirst({
        where: {
          authProvider: 'outlook',
          outlookSyncFolder: { not: null },
        },
      });
      if (outlookUser) {
        userIds.add(outlookUser.id);
        void ensureOutlookSubscription(outlookUser.id);
      }
      continue;
    }

    if (!user.outlookSyncFolder) {
      console.log('[outlook-webhook] no_sync_folder', user.id);
      continue;
    }

    const source =
      user.outlookInboxSubscriptionId === item.subscriptionId ? 'inbox' : 'crm';

    console.log('[outlook-webhook] notification', {
      userId: user.id,
      source,
      changeType: item.changeType ?? 'unknown',
      subscriptionId: item.subscriptionId,
    });

    userIds.add(user.id);
  }

  for (const userId of userIds) {
    console.log('[outlook-webhook] scheduling sync', userId);
    scheduleOutlookSync(userId, 'webhook');
  }

  res.status(200).end();
}

async function outlookWebhookHandler(req: Request, res: Response) {
  try {
    if (handleValidationToken(req, res)) return;
    await handleNotifications(req, res);
  } catch (err) {
    console.error('[outlook-webhook] processing_failed', err);
    if (!res.headersSent) res.status(200).end();
  }
}

outlookWebhookRouter.get('/outlook', outlookWebhookHandler);
outlookWebhookRouter.post('/outlook', outlookWebhookHandler);
