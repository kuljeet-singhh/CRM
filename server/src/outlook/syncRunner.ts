import { prisma } from '../db.js';
import { manualOutlookSync, type OutlookSyncResult } from './sync.js';

const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
const inFlight = new Map<string, Promise<void>>();

export type OutlookSyncLogPrefix = 'webhook' | 'settings' | 'daily' | 'manual';

async function getDefaultWorkspaceId(userId: string): Promise<string | null> {
  const membership = await prisma.membership.findFirst({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    select: { workspaceId: true },
  });
  return membership?.workspaceId ?? null;
}

function logSyncResult(userId: string, prefix: OutlookSyncLogPrefix, result: OutlookSyncResult) {
  if (result.error === 'no_sync_folder' || result.error === 'folder_not_found') {
    console.log(`[${prefix}] Outlook sync skipped for ${userId}: ${result.error}`);
    return;
  }

  if (result.messagesAdded === 0 && (result.messagesUpdated ?? 0) === 0) {
    console.log(`[${prefix}] Outlook sync ${userId}: no new folder messages`);
    return;
  }

  console.log(
    `[${prefix}] Outlook sync ${userId}: +${result.messagesAdded} messages, ~${result.messagesUpdated ?? 0} updated`
  );
}

export function scheduleOutlookSync(userId: string, prefix: OutlookSyncLogPrefix = 'webhook') {
  const existing = debounceTimers.get(userId);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(() => {
    debounceTimers.delete(userId);
    void runOutlookSyncForUser(userId, prefix);
  }, 2000);

  debounceTimers.set(userId, timer);
}

export async function runOutlookSyncForUser(
  userId: string,
  prefix: OutlookSyncLogPrefix = 'webhook'
) {
  const existing = inFlight.get(userId);
  if (existing) return existing;

  const work = (async () => {
    try {
      const workspaceId = await getDefaultWorkspaceId(userId);
      if (!workspaceId) {
        console.log(`[${prefix}] Outlook sync skipped for ${userId}: no_workspace`);
        return;
      }
      const result = await manualOutlookSync(userId, workspaceId);
      logSyncResult(userId, prefix, result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message === 'reauth_required') {
        console.log(`[${prefix}] Outlook sync skipped for ${userId}: reauth_required`);
      } else {
        console.error(`[${prefix}] Outlook sync failed for ${userId}`, err);
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
