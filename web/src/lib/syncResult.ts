import type { SyncResult } from '@/types';

function totalSynced(result: SyncResult): number {
  return result.messagesAdded + (result.messagesUpdated ?? 0);
}

export function syncToastMessage(result: SyncResult): string {
  if (result.error === 'no_sync_label' || result.error === 'no_sync_folder') {
    return 'Set a sync folder or label in Settings first.';
  }
  if (result.error === 'label_not_found') return 'Sync label not found in Gmail.';
  if (result.error === 'folder_not_found') return 'Sync folder not found in Outlook.';

  const total = totalSynced(result);
  const parts: string[] = [];
  if (result.messagesAdded > 0) {
    parts.push(`${result.messagesAdded} new`);
  }
  if ((result.messagesUpdated ?? 0) > 0) {
    parts.push(`${result.messagesUpdated} updated`);
  }

  if (result.notice === 'delta_reset' && parts.length > 0) {
    return `Sync state was reset. ${parts.join(', ')} message(s).`;
  }
  if (result.notice === 'delta_reset') {
    return 'Sync state was reset. Inbox is up to date.';
  }
  if (parts.length > 0) {
    return `Synced ${parts.join(', ')} message(s).`;
  }
  return 'Inbox is up to date.';
}

export function syncErrorToastMessage(code: string | undefined): string {
  if (code === 'reauth_required') return 'Reconnect your account in Settings.';
  if (code === 'no_sync_label' || code === 'no_sync_folder') {
    return 'Set a sync folder or label in Settings → Integrations.';
  }
  if (code === 'folder_not_found' || code === 'label_not_found') {
    return 'Sync folder or label not found. Check Settings → Integrations.';
  }
  if (code === 'delta_expired') return 'Sync state expired. Try syncing again.';
  if (code === 'sync_failed') {
    return 'Outlook sync failed. Check the API is running and try again.';
  }
  return 'Sync failed';
}
