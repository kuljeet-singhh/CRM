import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { mailApiBase } from '@/lib/provider';
import { syncToastMessage } from '@/lib/syncResult';
import type { GmailSyncConfig, MailProvider, SyncResult } from '@/types';

const POLL_SYNC_INTERVAL_MS = 3 * 60 * 1000;
const DEFAULT_UI_REFRESH_MS = 15_000;
const DEFAULT_MAIL_SYNC_MS = 86_400_000;

function dailySyncStorageKey(userId: string) {
  return `flycrm:lastMailSync:${userId}`;
}

function sessionSyncKey(userId: string, provider: MailProvider) {
  return `flycrm:sessionMailSync:${provider}:${userId}`;
}

function hasSessionSyncDone(userId: string, provider: MailProvider): boolean {
  return sessionStorage.getItem(sessionSyncKey(userId, provider)) === '1';
}

function markSessionSyncDone(userId: string, provider: MailProvider) {
  sessionStorage.setItem(sessionSyncKey(userId, provider), '1');
}

function shouldRunDailySync(userId: string, intervalMs: number): boolean {
  const raw = localStorage.getItem(dailySyncStorageKey(userId));
  if (!raw) return true;
  const last = parseInt(raw, 10);
  if (Number.isNaN(last)) return true;
  return Date.now() - last >= intervalMs;
}

function markDailySync(userId: string) {
  localStorage.setItem(dailySyncStorageKey(userId), String(Date.now()));
}

export function useBackgroundSync(
  provider: MailProvider | null | undefined,
  userId: string | undefined,
  enabled: boolean
) {
  const queryClient = useQueryClient();

  const gmailSyncConfigQuery = useQuery({
    queryKey: ['gmail', 'sync-config'],
    queryFn: () => api<GmailSyncConfig>('/api/gmail/sync-config'),
    enabled: enabled && provider === 'gmail',
    staleTime: 60_000,
  });

  const outlookSyncConfigQuery = useQuery({
    queryKey: ['outlook', 'sync-config'],
    queryFn: () => api<GmailSyncConfig>('/api/outlook/sync-config'),
    enabled: enabled && provider === 'outlook',
    staleTime: 60_000,
  });

  const syncConfig =
    provider === 'gmail' ? gmailSyncConfigQuery.data : outlookSyncConfigQuery.data;
  const syncConfigPending =
    provider === 'gmail'
      ? gmailSyncConfigQuery.isPending
      : provider === 'outlook'
        ? outlookSyncConfigQuery.isPending
        : false;

  const pushEnabled = Boolean(syncConfig?.pushEnabled);
  const uiRefreshMs = syncConfig?.uiRefreshIntervalMs ?? DEFAULT_UI_REFRESH_MS;
  const mailSyncMs = syncConfig?.mailSyncIntervalMs ?? DEFAULT_MAIL_SYNC_MS;

  useEffect(() => {
    if (!provider || !enabled || !userId) return;
    if (syncConfigPending) return;

    if (pushEnabled) {
      const refreshUi = () => {
        if (document.visibilityState !== 'visible') return;
        queryClient.invalidateQueries({ queryKey: ['messages'] });
      };

      const runSessionStartSync = async () => {
        if (document.visibilityState !== 'visible') return;
        if (hasSessionSyncDone(userId, provider)) return;
        try {
          const result = await api<SyncResult>(`${mailApiBase(provider)}/sync`, {
            method: 'POST',
          });
          markSessionSyncDone(userId, provider);
          queryClient.invalidateQueries({ queryKey: ['messages'] });
          if (result.messagesAdded > 0 || (result.messagesUpdated ?? 0) > 0) {
            toast.success(syncToastMessage(result));
          }
        } catch {
          markSessionSyncDone(userId, provider);
        }
      };

      const runDailyMailSync = async () => {
        if (document.visibilityState !== 'visible') return;
        if (!shouldRunDailySync(userId, mailSyncMs)) return;
        try {
          const result = await api<SyncResult>(`${mailApiBase(provider)}/sync`, {
            method: 'POST',
          });
          markDailySync(userId);
          if (result.messagesAdded > 0 || (result.messagesUpdated ?? 0) > 0) {
            toast.success(syncToastMessage(result));
            queryClient.invalidateQueries({ queryKey: ['messages'] });
          }
        } catch {
          /* silent */
        }
      };

      refreshUi();
      void runSessionStartSync();
      void runDailyMailSync();
      const uiId = setInterval(refreshUi, uiRefreshMs);
      const mailId = setInterval(runDailyMailSync, mailSyncMs);
      return () => {
        clearInterval(uiId);
        clearInterval(mailId);
      };
    }

    const runPollSync = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const result = await api<SyncResult>(`${mailApiBase(provider)}/sync`, {
          method: 'POST',
        });
        if (result.messagesAdded > 0) {
          toast.success(syncToastMessage(result));
          queryClient.invalidateQueries({ queryKey: ['messages'] });
        }
      } catch {
        /* silent background sync */
      }
    };

    runPollSync();
    const id = setInterval(runPollSync, POLL_SYNC_INTERVAL_MS);
    return () => clearInterval(id);
  }, [
    provider,
    enabled,
    userId,
    pushEnabled,
    syncConfigPending,
    uiRefreshMs,
    mailSyncMs,
    queryClient,
  ]);
}
