import { prisma } from '../db.js';
import { publishMessagesChanged } from '../events/messageBus.js';
import { syncUserGmail, type SyncUserGmailResult } from './syncUserGmail.js';

const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
const inFlight = new Map<string, Promise<SyncUserGmailResult>>();

export type SyncLogPrefix = 'webhook' | 'settings' | 'daily' | 'manual' | 'cron';

async function getDefaultWorkspaceId(userId: string): Promise<string | null> {
  const membership = await prisma.membership.findFirst({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    select: { workspaceId: true },
  });
  return membership?.workspaceId ?? null;
}

function logSyncResult(userId: string, prefix: SyncLogPrefix, result: SyncUserGmailResult) {
  if (result.error === 'no_sync_label' || result.error === 'label_not_found' || result.error === 'no_workspace') {
    console.log(`[${prefix}] Gmail sync skipped for ${userId}: ${result.error}`);
    return;
  }

  const err = (result as { syncError?: string }).syncError;
  if (err === 'invalid_grant' || err === 'reauth_required') {
    console.log(`[${prefix}] Gmail sync skipped for ${userId}: invalid_grant`);
    return;
  }

  if (
    result.messagesAdded === 0 &&
    result.messagesRemoved === 0 &&
    result.messagesUpdated === 0 &&
    result.messagesLabeled === 0
  ) {
    console.log(`[${prefix}] Gmail sync ${userId}: no new labeled messages`);
    return;
  }

  console.log(
    `[${prefix}] Gmail sync ${userId}: +${result.messagesAdded} messages, ~${result.messagesUpdated} updated, -${result.messagesRemoved} removed, +${result.contactsTouched} contacts`
  );
}

async function notifyIfChanged(
  workspaceId: string | null,
  result: SyncUserGmailResult
): Promise<void> {
  if (!workspaceId || result.error) return;
  if (
    result.messagesAdded === 0 &&
    result.messagesRemoved === 0 &&
    result.messagesUpdated === 0 &&
    result.messagesLabeled === 0
  ) {
    return;
  }
  await publishMessagesChanged(workspaceId, {
    added: result.messagesAdded,
    updated: result.messagesUpdated,
    removed: result.messagesRemoved,
  });
}

export function scheduleGmailSync(userId: string, prefix: SyncLogPrefix = 'webhook') {
  if (debounceTimers.has(userId)) return;

  const timer = setTimeout(() => {
    debounceTimers.delete(userId);
    void runGmailSyncForUser(userId, prefix);
  }, 2000);

  debounceTimers.set(userId, timer);
}

export async function runGmailSyncForUser(
  userId: string,
  prefix: SyncLogPrefix = 'webhook',
  workspaceId?: string
): Promise<SyncUserGmailResult> {
  const existing = inFlight.get(userId);
  if (existing) return existing;

  const work = (async (): Promise<SyncUserGmailResult> => {
    try {
      const wsId = workspaceId ?? (await getDefaultWorkspaceId(userId)) ?? undefined;
      const result = await syncUserGmail(userId, wsId);
      logSyncResult(userId, prefix, result);
      await notifyIfChanged(wsId ?? null, result);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message === 'reauth_required' || message.includes('invalid_grant')) {
        console.log(`[${prefix}] Gmail sync skipped for ${userId}: invalid_grant`);
        return {
          messagesAdded: 0,
          messagesUpdated: 0,
          messagesRemoved: 0,
          messagesLabeled: 0,
          contactsTouched: 0,
        };
      }
      console.error(`[${prefix}] Gmail sync failed for ${userId}`, err);
      throw err;
    }
  })();

  inFlight.set(userId, work);
  try {
    return await work;
  } finally {
    inFlight.delete(userId);
  }
}
