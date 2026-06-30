import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, restoreSession } from '@/lib/api';
import { getAccessToken } from '@/lib/authStore';
import type { MessagesVersion } from '@/types';

const RECONNECT_MS = 50_000;
const RECONNECT_BACKOFF_MS = 3_000;
const MAX_BACKOFF_MS = 30_000;

function parseSseBlocks(buffer: string): { events: string[]; rest: string } {
  const events: string[] = [];
  const parts = buffer.split('\n\n');
  const rest = parts.pop() ?? '';
  for (const part of parts) {
    if (part.trim() && !part.startsWith(':')) {
      events.push(part);
    }
  }
  return { events, rest };
}

function blockHasMessagesUpdated(block: string): boolean {
  return block.split('\n').some((line) => line.trim() === 'event: messages_updated');
}

async function readMessagesSse(
  onMessagesUpdated: () => void,
  signal: AbortSignal
): Promise<'aborted' | 'ended' | 'error'> {
  await restoreSession();
  const token = getAccessToken();
  if (!token) return 'error';

  const res = await fetch('/api/events/messages', {
    headers: { Authorization: `Bearer ${token}` },
    signal,
    credentials: 'include',
  });

  if (!res.ok || !res.body) return 'error';

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parsed = parseSseBlocks(buffer);
      buffer = parsed.rest;
      for (const block of parsed.events) {
        if (blockHasMessagesUpdated(block)) {
          onMessagesUpdated();
        }
      }
    }
    return 'ended';
  } catch (err) {
    if (signal.aborted) return 'aborted';
    console.warn('[message-events] stream error', err);
    return 'error';
  }
}

export function useMessageEvents(enabled: boolean) {
  const queryClient = useQueryClient();
  const versionRef = useRef<string | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backoffRef = useRef(RECONNECT_BACKOFF_MS);

  useEffect(() => {
    if (!enabled) return;

    let disposed = false;
    let abortController: AbortController | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let maxConnectionTimer: ReturnType<typeof setTimeout> | null = null;

    const invalidateMessages = () => {
      void queryClient.invalidateQueries({ queryKey: ['messages'] });
      void queryClient.refetchQueries({ queryKey: ['messages', 'thread'], type: 'active' });
    };

    const checkVersionOnReconnect = async () => {
      try {
        const body = await api<MessagesVersion>('/api/messages/version');
        if (versionRef.current !== null && body.version !== versionRef.current) {
          invalidateMessages();
        }
        versionRef.current = body.version;
      } catch {
        /* ignore */
      }
    };

    const scheduleReconnect = (delayMs: number) => {
      if (disposed) return;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        void connect();
      }, delayMs);
      reconnectTimerRef.current = reconnectTimer;
    };

    const connect = async () => {
      if (disposed || document.visibilityState !== 'visible') return;

      abortController?.abort();
      abortController = new AbortController();

      if (maxConnectionTimer) clearTimeout(maxConnectionTimer);
      maxConnectionTimer = setTimeout(() => {
        abortController?.abort();
      }, RECONNECT_MS);

      await checkVersionOnReconnect();

      const outcome = await readMessagesSse(invalidateMessages, abortController.signal);

      if (maxConnectionTimer) {
        clearTimeout(maxConnectionTimer);
        maxConnectionTimer = null;
      }

      if (disposed) return;

      if (outcome === 'aborted' && !disposed) {
        scheduleReconnect(0);
        return;
      }

      backoffRef.current =
        outcome === 'error'
          ? Math.min(backoffRef.current * 2, MAX_BACKOFF_MS)
          : RECONNECT_BACKOFF_MS;
      scheduleReconnect(backoffRef.current);
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        backoffRef.current = RECONNECT_BACKOFF_MS;
        void checkVersionOnReconnect().then(invalidateMessages);
        void connect();
      } else {
        abortController?.abort();
        if (reconnectTimer) {
          clearTimeout(reconnectTimer);
          reconnectTimer = null;
        }
      }
    };

    document.addEventListener('visibilitychange', onVisibility);
    void connect();

    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', onVisibility);
      abortController?.abort();
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (maxConnectionTimer) clearTimeout(maxConnectionTimer);
    };
  }, [enabled, queryClient]);
}
