import { prisma } from '../db.js';
import { isOutlookPushEnabled } from '../env.js';
import { runGmailSyncForUser } from '../gmail/syncRunner.js';
import { runOutlookSyncForUser } from '../outlook/syncRunner.js';

export const CRON_MAILBOX_SYNC_BUDGET_MS = 45_000;
export const CRON_MAILBOX_SYNC_PER_USER_TIMEOUT_MS = 35_000;
export const CRON_SYNC_WORKER_RESPONSE_DEADLINE_MS = 48_000;

export type IncrementalMailboxSyncResult = {
  gmailUsers: number;
  outlookUsers: number;
  gmailUsersSynced: number;
  outlookUsersSynced: number;
  partial?: boolean;
  timedOut?: boolean;
};

export type IncrementalMailboxSyncOptions = {
  timeBudgetMs?: number;
  perUserTimeoutMs?: number;
};

async function withPerUserTimeout<T>(
  promise: Promise<T>,
  ms: number
): Promise<{ ok: true; value: T } | { ok: false; timedOut: true }> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      promise.then((value) => ({ ok: true as const, value })),
      new Promise<{ ok: false; timedOut: true }>((resolve) => {
        timer = setTimeout(() => resolve({ ok: false, timedOut: true }), ms);
      }),
    ]);
    return result;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function runIncrementalMailboxSync(
  options?: IncrementalMailboxSyncOptions
): Promise<IncrementalMailboxSyncResult> {
  const deadline =
    options?.timeBudgetMs != null ? Date.now() + options.timeBudgetMs : Number.POSITIVE_INFINITY;
  const perUserTimeoutMs = options?.perUserTimeoutMs ?? CRON_MAILBOX_SYNC_PER_USER_TIMEOUT_MS;

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

    const remainingMs = deadline - Date.now();
    const userTimeoutMs = Math.min(perUserTimeoutMs, remainingMs);

    const result = await withPerUserTimeout(runGmailSyncForUser(u.id, 'cron'), userTimeoutMs);
    if (!result.ok) {
      partial = true;
      console.log(`[cron] gmail sync timed out for ${u.id}`);
      continue;
    }
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

      const remainingMs = deadline - Date.now();
      const userTimeoutMs = Math.min(perUserTimeoutMs, remainingMs);

      const result = await withPerUserTimeout(runOutlookSyncForUser(u.id, 'cron'), userTimeoutMs);
      if (!result.ok) {
        partial = true;
        console.log(`[cron] outlook sync timed out for ${u.id}`);
        continue;
      }
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
