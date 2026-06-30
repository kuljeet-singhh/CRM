import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { mailApiBase } from '@/lib/provider';
import { syncToastMessage } from '@/lib/syncResult';
import { usePreferences } from '@/lib/preferences';
import { useMessageEvents } from '@/hooks/useMessageEvents';
import type { CalendarSyncConfig, CalendarSyncResult, GmailSyncConfig, MailProvider, SyncResult } from '@/types';

const POLL_SYNC_INTERVAL_MS = 3 * 60 * 1000;
const DEFAULT_UI_REFRESH_FALLBACK_MS = 60_000;
const DEFAULT_MAIL_RECONCILE_MS = 180_000;
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

function dailyCalendarSyncStorageKey(userId: string) {
  return `flycrm:lastCalendarSync:${userId}`;
}

function shouldRunDailyCalendarSync(userId: string, intervalMs: number): boolean {
  const raw = localStorage.getItem(dailyCalendarSyncStorageKey(userId));
  if (!raw) return true;
  const last = parseInt(raw, 10);
  if (Number.isNaN(last)) return true;
  return Date.now() - last >= intervalMs;
}

function markDailyCalendarSync(userId: string) {
  localStorage.setItem(dailyCalendarSyncStorageKey(userId), String(Date.now()));
}

export function useBackgroundSync(
  provider: MailProvider | null | undefined,
  userId: string | undefined,
  enabled: boolean
) {
  const queryClient = useQueryClient();
  const { settings } = usePreferences();
  const calendarSyncEnabled = Boolean(settings?.calendarSyncEnabled);
  const mailSyncKeyRef = useRef<string | null>(null);

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

  const gmailCalendarSyncConfigQuery = useQuery({
    queryKey: ['gmail', 'calendar', 'sync-config'],
    queryFn: () => api<CalendarSyncConfig>('/api/gmail/calendar/sync-config'),
    enabled: enabled && provider === 'gmail' && calendarSyncEnabled,
    staleTime: 60_000,
  });

  const outlookCalendarSyncConfigQuery = useQuery({
    queryKey: ['outlook', 'calendar', 'sync-config'],
    queryFn: () => api<CalendarSyncConfig>('/api/outlook/calendar/sync-config'),
    enabled: enabled && provider === 'outlook' && calendarSyncEnabled,
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
  const eventsEnabled = Boolean(syncConfig?.eventsEnabled);
  const uiRefreshMs = syncConfig?.uiRefreshIntervalMs || DEFAULT_UI_REFRESH_FALLBACK_MS;
  const mailSyncMs = syncConfig?.mailSyncIntervalMs ?? DEFAULT_MAIL_SYNC_MS;
  const mailReconcileMs = syncConfig?.mailReconcileIntervalMs ?? DEFAULT_MAIL_RECONCILE_MS;
  const calendarSyncConfig =
    provider === 'gmail' ? gmailCalendarSyncConfigQuery.data : outlookCalendarSyncConfigQuery.data;
  const calendarSyncMs = calendarSyncConfig?.syncIntervalMs ?? DEFAULT_MAIL_SYNC_MS;

  useMessageEvents(Boolean(enabled && userId && pushEnabled && eventsEnabled));

  useEffect(() => {
    if (!provider || !enabled || !userId || !calendarSyncEnabled) return;

    const runCalendarSync = async () => {
      if (document.visibilityState !== 'visible') return;
      if (!shouldRunDailyCalendarSync(userId, calendarSyncMs)) return;
      try {
        await api<CalendarSyncResult>(`${mailApiBase(provider)}/calendar/sync`, {
          method: 'POST',
        });
        markDailyCalendarSync(userId);
        queryClient.invalidateQueries({ queryKey: ['calendar'] });
      } catch {
        /* silent */
      }
    };

    void runCalendarSync();
    const id = setInterval(runCalendarSync, calendarSyncMs);
    return () => clearInterval(id);
  }, [provider, enabled, userId, calendarSyncEnabled, calendarSyncMs, queryClient]);

  useEffect(() => {
    if (!provider || !enabled || !userId || syncConfigPending) return;

    const mailSyncKey = `${provider}:${userId}:${pushEnabled}:${eventsEnabled}`;
    if (mailSyncKeyRef.current === mailSyncKey) return;
    mailSyncKeyRef.current = mailSyncKey;

    if (pushEnabled) {
      const refreshUi = () => {
        if (document.visibilityState !== 'visible') return;
        queryClient.invalidateQueries({ queryKey: ['messages'] });
      };

      const onVisibilityChange = () => {
        if (document.visibilityState === 'visible') refreshUi();
      };

      const runSessionStartSync = async () => {
        if (document.visibilityState !== 'visible') return;
        if (hasSessionSyncDone(userId, provider)) return;
        try {
          const result = await api<SyncResult>(`${mailApiBase(provider)}/sync`, {
            method: 'POST',
          });
          markSessionSyncDone(userId, provider);
          if (result.messagesAdded > 0 || (result.messagesUpdated ?? 0) > 0) {
            queryClient.invalidateQueries({ queryKey: ['messages'] });
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

      const runReconcileMailSync = async () => {
        if (document.visibilityState !== 'visible') return;
        try {
          const result = await api<SyncResult>(`${mailApiBase(provider)}/sync`, {
            method: 'POST',
          });
          if (result.messagesAdded > 0 || (result.messagesUpdated ?? 0) > 0) {
            queryClient.invalidateQueries({ queryKey: ['messages'] });
            queryClient.refetchQueries({ queryKey: ['messages', 'thread'], type: 'active' });
          }
        } catch {
          /* silent */
        }
      };

      void runSessionStartSync();
      void runDailyMailSync();

      const reconcileId = setInterval(runReconcileMailSync, mailReconcileMs);

      if (!eventsEnabled) {
        refreshUi();
        document.addEventListener('visibilitychange', onVisibilityChange);
        const uiId = setInterval(refreshUi, uiRefreshMs);
        const mailId = setInterval(runDailyMailSync, mailSyncMs);
        return () => {
          document.removeEventListener('visibilitychange', onVisibilityChange);
          clearInterval(uiId);
          clearInterval(mailId);
          clearInterval(reconcileId);
          if (mailSyncKeyRef.current === mailSyncKey) {
            mailSyncKeyRef.current = null;
          }
        };
      }

      const mailId = setInterval(runDailyMailSync, mailSyncMs);
      return () => {
        clearInterval(mailId);
        clearInterval(reconcileId);
        if (mailSyncKeyRef.current === mailSyncKey) {
          mailSyncKeyRef.current = null;
        }
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

    void runPollSync();
    const id = setInterval(runPollSync, POLL_SYNC_INTERVAL_MS);
    return () => {
      clearInterval(id);
      if (mailSyncKeyRef.current === mailSyncKey) {
        mailSyncKeyRef.current = null;
      }
    };
  }, [
    provider,
    enabled,
    userId,
    pushEnabled,
    eventsEnabled,
    syncConfigPending,
    uiRefreshMs,
    mailSyncMs,
    mailReconcileMs,
    queryClient,
  ]);
}
