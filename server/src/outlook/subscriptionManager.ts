import { prisma } from '../db.js';
import { getOutlookAccessToken } from '../auth/tokens.js';
import {
  env,
  isOutlookPushEnabled,
  outlookWebhookNotificationUrl,
} from '../env.js';
import { findFolderByDisplayName, listOutlookMailFolders } from './folders.js';
import { logGraphFailure, readGraphErrorBody } from './graph.js';

const MAX_SUBSCRIPTION_MINUTES = 4200;
const RENEW_MARGIN_MS = 24 * 60 * 60 * 1000;
const INBOX_CREATE_ATTEMPTS = 3;
const INBOX_CREATE_RETRY_MS = 2000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function notificationUrlMatchesOurs(url: string | undefined): boolean {
  if (!url) return false;
  const ours = outlookWebhookNotificationUrl();
  return url === ours || url.endsWith('/api/webhooks/outlook');
}

function subscriptionExpiration(): string {
  return new Date(Date.now() + MAX_SUBSCRIPTION_MINUTES * 60 * 1000).toISOString();
}

function subscriptionStillValid(expiry: Date | null | undefined): boolean {
  return Boolean(expiry && expiry.getTime() > Date.now() + RENEW_MARGIN_MS);
}

async function deleteGraphSubscription(token: string, subscriptionId: string): Promise<void> {
  const res = await fetch(`https://graph.microsoft.com/v1.0/subscriptions/${subscriptionId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 404) return;
  if (!res.ok) {
    const body = await readGraphErrorBody(res);
    logGraphFailure('subscription/delete', res.status, body);
  }
}

async function createGraphSubscription(
  token: string,
  resource: string,
  changeType: string,
  logTag: string
): Promise<{ id: string; expirationDateTime: string } | null> {
  const body = {
    changeType,
    notificationUrl: outlookWebhookNotificationUrl(),
    lifecycleNotificationUrl: outlookWebhookNotificationUrl(),
    resource,
    expirationDateTime: subscriptionExpiration(),
    clientState: env.outlookWebhookClientState,
  };

  const res = await fetch('https://graph.microsoft.com/v1.0/subscriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await readGraphErrorBody(res);
    logGraphFailure(logTag, res.status, errBody);
    return null;
  }

  return (await res.json()) as { id: string; expirationDateTime: string };
}

async function listGraphSubscriptions(
  token: string
): Promise<Array<{ id: string; notificationUrl?: string }>> {
  const res = await fetch('https://graph.microsoft.com/v1.0/subscriptions', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    logGraphFailure('subscription/list', res.status, await readGraphErrorBody(res));
    return [];
  }
  const data = (await res.json()) as {
    value: Array<{ id: string; notificationUrl?: string }>;
  };
  return data.value ?? [];
}

async function reconcileOutlookSubscriptions(userId: string, token: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;

  const known = new Set(
    [user.outlookSubscriptionId, user.outlookInboxSubscriptionId].filter(Boolean) as string[]
  );

  for (const sub of await listGraphSubscriptions(token)) {
    if (!notificationUrlMatchesOurs(sub.notificationUrl)) continue;
    if (known.has(sub.id)) continue;
    console.log('[outlook-subscription] deleting orphan', sub.id);
    await deleteGraphSubscription(token, sub.id);
  }
}

async function getInboxFolderId(token: string): Promise<string | null> {
  const res = await fetch('https://graph.microsoft.com/v1.0/me/mailFolders/inbox', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    logGraphFailure('subscription/inbox-folder', res.status, await readGraphErrorBody(res));
    return null;
  }
  const data = (await res.json()) as { id?: string };
  return data.id ?? null;
}

async function ensureCrmFolderSubscription(
  userId: string,
  token: string,
  syncFolder: string
): Promise<{ expiresAt?: Date; warning?: string }> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { warning: 'user_not_found' };

  if (
    subscriptionStillValid(user.outlookSubscriptionExpiry) &&
    user.outlookSubscriptionId &&
    user.outlookFolderId
  ) {
    console.log('[outlook-subscription] CRM folder already active', userId);
    return { expiresAt: user.outlookSubscriptionExpiry! };
  }

  const folders = await listOutlookMailFolders(token);
  const folder = findFolderByDisplayName(folders, syncFolder);
  if (!folder) {
    console.log('[outlook-subscription] folder_not_found', syncFolder);
    return { warning: 'folder_not_found' };
  }

  if (user.outlookSubscriptionId) {
    await deleteGraphSubscription(token, user.outlookSubscriptionId);
  }

  const sub = await createGraphSubscription(
    token,
    `/me/mailFolders/${folder.id}/messages`,
    'created,updated,deleted',
    'subscription/create-crm'
  );
  if (!sub) return { warning: 'registration_failed' };

  const expiresAt = new Date(sub.expirationDateTime);
  await prisma.user.update({
    where: { id: userId },
    data: {
      outlookFolderId: folder.id,
      outlookSubscriptionId: sub.id,
      outlookSubscriptionExpiry: expiresAt,
    },
  });

  console.log(
    `[outlook-subscription] CRM renewed for ${userId} (folder: ${syncFolder}, expires: ${expiresAt.toISOString()})`
  );
  return { expiresAt };
}

async function ensureInboxSubscription(
  userId: string,
  token: string
): Promise<{ expiresAt?: Date; warning?: string }> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { warning: 'user_not_found' };

  if (subscriptionStillValid(user.outlookInboxSubscriptionExpiry) && user.outlookInboxSubscriptionId) {
    console.log('[outlook-subscription] Inbox already active', userId);
    return { expiresAt: user.outlookInboxSubscriptionExpiry! };
  }

  const inboxId = await getInboxFolderId(token);
  if (!inboxId) return { warning: 'inbox_not_found' };

  if (user.outlookInboxSubscriptionId) {
    await deleteGraphSubscription(token, user.outlookInboxSubscriptionId);
  }

  let sub: { id: string; expirationDateTime: string } | null = null;
  for (let attempt = 1; attempt <= INBOX_CREATE_ATTEMPTS; attempt++) {
    sub = await createGraphSubscription(
      token,
      `/me/mailFolders/${inboxId}/messages`,
      'created,updated',
      'subscription/create-inbox'
    );
    if (sub) break;
    if (attempt < INBOX_CREATE_ATTEMPTS) {
      console.log(
        `[outlook-subscription] inbox create retry ${attempt}/${INBOX_CREATE_ATTEMPTS} for ${userId}`
      );
      await sleep(INBOX_CREATE_RETRY_MS);
    }
  }
  if (!sub) return { warning: 'inbox_registration_failed' };

  const expiresAt = new Date(sub.expirationDateTime);
  await prisma.user.update({
    where: { id: userId },
    data: {
      outlookInboxSubscriptionId: sub.id,
      outlookInboxSubscriptionExpiry: expiresAt,
    },
  });

  console.log(
    `[outlook-subscription] Inbox renewed for ${userId} (expires: ${expiresAt.toISOString()})`
  );
  return { expiresAt };
}

export async function ensureOutlookSubscription(
  userId: string
): Promise<{ expiresAt?: Date; warning?: string }> {
  if (!isOutlookPushEnabled()) {
    console.log('[outlook-subscription] skipped: webhook env not configured');
    return { warning: 'webhook_not_configured' };
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { warning: 'user_not_found' };
  if (user.authProvider !== 'outlook') return { warning: 'not_outlook_user' };
  if (!user.outlookSyncFolder) {
    console.log('[outlook-subscription] skipped: no sync folder');
    return { warning: 'no_sync_folder' };
  }

  try {
    const token = await getOutlookAccessToken(userId);
    await reconcileOutlookSubscriptions(userId, token);

    const crm = await ensureCrmFolderSubscription(userId, token, user.outlookSyncFolder);
    if (crm.warning) return crm;

    const inbox = await ensureInboxSubscription(userId, token);
    if (inbox.warning) {
      console.error(
        `[outlook-subscription] Inbox registration failed for ${userId} — reply webhooks may not sync until re-save CRM folder`
      );
      return { warning: inbox.warning, expiresAt: crm.expiresAt };
    }

    const expiresAt =
      crm.expiresAt && inbox.expiresAt
        ? new Date(Math.min(crm.expiresAt.getTime(), inbox.expiresAt.getTime()))
        : crm.expiresAt ?? inbox.expiresAt;

    return { expiresAt };
  } catch (err) {
    console.error('[outlook-subscription] registration_failed', err);
    if ((err as Error).message === 'reauth_required') {
      return { warning: 'reauth_required' };
    }
    return { warning: 'registration_failed' };
  }
}

export async function renewOutlookSubscription(userId: string): Promise<boolean> {
  const result = await ensureOutlookSubscription(userId);
  return !result.warning;
}

export async function renewAllOutlookSubscriptions(): Promise<number> {
  if (!isOutlookPushEnabled()) return 0;

  const margin = new Date(Date.now() + RENEW_MARGIN_MS);
  const users = await prisma.user.findMany({
    where: {
      authProvider: 'outlook',
      outlookSyncFolder: { not: null },
      OR: [
        { outlookSubscriptionExpiry: null },
        { outlookSubscriptionExpiry: { lt: margin } },
        { outlookInboxSubscriptionId: null },
        { outlookInboxSubscriptionExpiry: null },
        { outlookInboxSubscriptionExpiry: { lt: margin } },
      ],
    },
    select: { id: true },
  });

  let renewed = 0;
  for (const u of users) {
    const result = await ensureOutlookSubscription(u.id);
    if (!result.warning) renewed++;
  }
  return renewed;
}

export async function countOutlookSubscriptionIssues(): Promise<number> {
  if (!isOutlookPushEnabled()) return 0;

  const now = new Date();
  return prisma.user.count({
    where: {
      authProvider: 'outlook',
      outlookSyncFolder: { not: null },
      OR: [
        { outlookSubscriptionId: null },
        { outlookSubscriptionExpiry: null },
        { outlookSubscriptionExpiry: { lt: now } },
        { outlookInboxSubscriptionId: null },
        { outlookInboxSubscriptionExpiry: null },
        { outlookInboxSubscriptionExpiry: { lt: now } },
      ],
    },
  });
}

export async function clearOutlookSubscription(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;

  try {
    const token = await getOutlookAccessToken(userId);
    if (user.outlookSubscriptionId) {
      await deleteGraphSubscription(token, user.outlookSubscriptionId);
    }
    if (user.outlookInboxSubscriptionId) {
      await deleteGraphSubscription(token, user.outlookInboxSubscriptionId);
    }
  } catch {
    /* best effort */
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      outlookSubscriptionId: null,
      outlookSubscriptionExpiry: null,
      outlookInboxSubscriptionId: null,
      outlookInboxSubscriptionExpiry: null,
    },
  });
}

export async function handleSubscriptionLifecycle(
  subscriptionId: string,
  lifecycleEvent: string
): Promise<void> {
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { outlookSubscriptionId: subscriptionId },
        { outlookInboxSubscriptionId: subscriptionId },
      ],
    },
  });
  if (!user) return;

  const source =
    user.outlookInboxSubscriptionId === subscriptionId ? 'inbox' : 'crm';
  console.log(`[outlook-subscription] lifecycle ${lifecycleEvent} for ${user.id} (${source})`);

  if (lifecycleEvent === 'subscriptionRemoved' || lifecycleEvent === 'reauthorizationRequired') {
    if (user.outlookSubscriptionId === subscriptionId) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          outlookSubscriptionId: null,
          outlookSubscriptionExpiry: null,
        },
      });
    }
    if (user.outlookInboxSubscriptionId === subscriptionId) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          outlookInboxSubscriptionId: null,
          outlookInboxSubscriptionExpiry: null,
        },
      });
    }
  }
}
