import { runGmailSyncForUser } from './syncRunner.js';
import type { SyncUserGmailResult } from './syncUserGmail.js';

function mapSyncResult(result: SyncUserGmailResult) {
  if (result.error === 'no_sync_label') {
    return { messagesAdded: 0, error: 'no_sync_label' as const };
  }
  if (result.error === 'label_not_found') {
    return { messagesAdded: 0, error: 'label_not_found' as const };
  }
  return {
    messagesAdded: result.messagesAdded,
    messagesUpdated: result.messagesRemoved,
    historyId: result.historyId,
  };
}

export async function manualGmailSync(userId: string, workspaceId: string) {
  const result = await runGmailSyncForUser(userId, 'manual', workspaceId);
  return mapSyncResult(result);
}
