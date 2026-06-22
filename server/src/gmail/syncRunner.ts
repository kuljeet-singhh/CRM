import { syncUserGmail } from './syncUserGmail.js';

const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
const inFlight = new Map<string, Promise<void>>();

export type SyncLogPrefix = 'webhook' | 'settings' | 'daily' | 'manual' | 'cron';

function logSyncResult(userId: string, prefix: SyncLogPrefix, result: Awaited<ReturnType<typeof syncUserGmail>>) {
  if (result.error === 'no_sync_label' || result.error === 'label_not_found' || result.error === 'no_workspace') {
    console.log(`[${prefix}] Gmail sync skipped for ${userId}: ${result.error}`);
    return;
  }

  const err = (result as { syncError?: string }).syncError;
  if (err === 'invalid_grant' || err === 'reauth_required') {
    console.log(`[${prefix}] Gmail sync skipped for ${userId}: invalid_grant`);
    return;
  }

  if (result.messagesAdded === 0 && result.messagesRemoved === 0) {
    console.log(`[${prefix}] Gmail sync ${userId}: no new labeled messages`);
    return;
  }

  console.log(
    `[${prefix}] Gmail sync ${userId}: +${result.messagesAdded} messages, -${result.messagesRemoved} removed, +${result.contactsTouched} contacts`
  );
}

export function scheduleGmailSync(userId: string, prefix: SyncLogPrefix = 'webhook') {
  if (debounceTimers.has(userId)) return;

  const timer = setTimeout(() => {
    debounceTimers.delete(userId);
    void runGmailSyncForUser(userId, prefix);
  }, 2000);

  debounceTimers.set(userId, timer);
}

export async function runGmailSyncForUser(userId: string, prefix: SyncLogPrefix = 'webhook') {
  const existing = inFlight.get(userId);
  if (existing) return existing;

  const work = (async () => {
    try {
      const result = await syncUserGmail(userId);
      logSyncResult(userId, prefix, result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message === 'reauth_required' || message.includes('invalid_grant')) {
        console.log(`[${prefix}] Gmail sync skipped for ${userId}: invalid_grant`);
      } else {
        console.error(`[${prefix}] Gmail sync failed for ${userId}`, err);
      }
    }
  })();

  inFlight.set(userId, work);
  try {
    await work;
  } finally {
    inFlight.delete(userId);
  }
}
