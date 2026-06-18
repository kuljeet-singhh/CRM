import type { InboxMessage } from '@/types';

const STORAGE_PREFIX = 'flycrm-inbox-read:';

export function loadReadIds(userId: string): Set<string> {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${userId}`);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is string => typeof id === 'string'));
  } catch {
    return new Set();
  }
}

export function saveReadIds(userId: string, ids: Set<string>): void {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${userId}`, JSON.stringify([...ids]));
  } catch {
    /* private mode or quota */
  }
}

export function isThreadRead(
  readIds: Set<string>,
  threadKey: string,
  latest: InboxMessage
): boolean {
  return (
    readIds.has(threadKey) ||
    readIds.has(latest.id) ||
    latest.direction === 'sent'
  );
}

export function countUnreadThreads(
  threads: { threadKey: string; latest: InboxMessage }[],
  readIds: Set<string>
): number {
  return threads.filter(
    (t) =>
      t.latest.direction === 'received' &&
      !readIds.has(t.threadKey) &&
      !readIds.has(t.latest.id)
  ).length;
}
