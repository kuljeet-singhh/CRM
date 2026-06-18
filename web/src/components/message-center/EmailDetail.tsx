import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { api } from '@/lib/api';
import { useFormatters } from '@/lib/preferences';
import { EmailMessageBody } from './EmailMessageBody';
import type { InboxMessage } from '@/types';

interface EmailDetailProps {
  message: InboxMessage | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onThreadOpened?: (messageIds: string[]) => void;
}

export function EmailDetail({
  message,
  open,
  onOpenChange,
  onThreadOpened,
}: EmailDetailProps) {
  const { formatRelativeTime } = useFormatters();
  const threadId = message?.gmailThreadId ?? message?.conversationId ?? null;

  const threadQuery = useQuery({
    queryKey: ['messages', 'thread', threadId],
    queryFn: () =>
      api<{ messages: InboxMessage[] }>(
        `/api/messages/thread/${encodeURIComponent(threadId!)}`
      ),
    enabled: open && Boolean(threadId),
  });

  const threadMessages = threadId
    ? (threadQuery.data?.messages ?? (message ? [message] : []))
    : message
      ? [message]
      : [];

  useEffect(() => {
    if (!open || !onThreadOpened || threadMessages.length === 0) return;
    onThreadOpened(threadMessages.map((m) => m.id));
  }, [open, threadMessages, onThreadOpened]);

  if (!message) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{message.subject}</DialogTitle>
        </DialogHeader>
        {threadQuery.isLoading && threadId ? (
          <p className="text-sm text-muted-foreground py-4">Loading conversation…</p>
        ) : (
          <div className="space-y-4">
            {threadMessages.map((msg, index) => (
              <div
                key={msg.id}
                className={`text-sm ${index > 0 ? 'border-t pt-4' : ''}`}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <p>
                    <span className="text-muted-foreground">From:</span> {msg.from} &lt;
                    {msg.email}&gt;
                  </p>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {formatRelativeTime(msg.timestamp)}
                  </span>
                </div>
                {msg.direction === 'sent' && (
                  <p className="text-xs text-muted-foreground mb-2">Sent by you</p>
                )}
                <EmailMessageBody
                  bodyText={msg.bodyText}
                  bodyHtml={msg.bodyHtml}
                  preview={msg.preview}
                />
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
