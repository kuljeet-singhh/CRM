import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Mail,
  Search,
  Star,
  Archive,
  Reply,
  Forward,
  MoreHorizontal,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import { mailApiBase } from '@/lib/provider';
import { syncErrorToastMessage, syncToastMessage } from '@/lib/syncResult';
import { useFormatters } from '@/lib/preferences';
import { useAuth } from '@/hooks/useAuth';
import { groupMessagesIntoThreads } from '@/lib/inboxThreads';
import {
  countUnreadThreads,
  isThreadRead,
  loadReadIds,
  saveReadIds,
} from '@/lib/inboxReadState';
import { ApolloContactsPanel } from './ApolloContactsPanel';
import { EmailDetail } from './EmailDetail';
import type { InboxMessage, MailProvider, ReplyContext, SyncResult } from '@/types';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface EmailInboxProps {
  provider: MailProvider;
  onReply: (ctx: ReplyContext) => void;
  onCompose: (contact: { to: string; name?: string | null }) => void;
  onOpenSyncSettings: () => void;
}

export function EmailInbox({ provider, onReply, onCompose, onOpenSyncSettings }: EmailInboxProps) {
  const { user } = useAuth();
  const userId = user?.id;
  const [search, setSearch] = useState('');
  const [inboxFilter, setInboxFilter] = useState<'all' | 'apollo'>('all');
  const [readIds, setReadIds] = useState<Set<string>>(() => new Set());
  const [readStateHydrated, setReadStateHydrated] = useState(false);
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<InboxMessage | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const queryClient = useQueryClient();
  const { formatRelativeTime } = useFormatters();

  useEffect(() => {
    if (!userId) {
      setReadStateHydrated(false);
      return;
    }
    setReadIds(loadReadIds(userId));
    setReadStateHydrated(true);
  }, [userId]);

  useEffect(() => {
    if (!userId || !readStateHydrated) return;
    saveReadIds(userId, readIds);
  }, [userId, readIds, readStateHydrated]);

  const markRead = useCallback((keys: string[]) => {
    setReadIds((prev) => {
      const next = new Set(prev);
      for (const key of keys) next.add(key);
      return next;
    });
  }, []);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['messages', search],
    queryFn: () =>
      api<{ messages: InboxMessage[] }>(
        `/api/messages?search=${encodeURIComponent(search)}&limit=50`
      ),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const syncMutation = useMutation({
    mutationFn: () =>
      api<SyncResult>(`${mailApiBase(provider)}/sync`, { method: 'POST' }),
    onSuccess: (result) => {
      toast.success(syncToastMessage(result));
      void queryClient.invalidateQueries({ queryKey: ['messages'] });
    },
    onError: (err) => {
      const code = err instanceof ApiError ? err.code : undefined;
      toast.error(syncErrorToastMessage(code));
    },
  });

  const messages = data?.messages ?? [];
  const threads = useMemo(() => groupMessagesIntoThreads(messages), [messages]);

  const filteredThreads = useMemo(() => {
    if (inboxFilter === 'all') return threads;
    return threads.filter((t) => t.latest.contactCreatedFrom === 'apollo');
  }, [threads, inboxFilter]);

  const unreadCount = useMemo(
    () => countUnreadThreads(filteredThreads, readIds),
    [filteredThreads, readIds]
  );

  const openMessage = (email: InboxMessage, threadKey: string) => {
    markRead([threadKey, email.id]);
    setSelected(email);
    setDetailOpen(true);
  };

  const toggleStar = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setStarredIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleReply = (email: InboxMessage, e: React.MouseEvent) => {
    e.stopPropagation();
    const quoted = email.bodyText
      ? `\n\n---\n${email.bodyText}`
      : email.preview
        ? `\n\n---\n${email.preview}`
        : '';
    onReply({
      to: email.email,
      subject: email.subject.startsWith('Re:') ? email.subject : `Re: ${email.subject}`,
      body: quoted,
      inReplyTo: email.rfcMessageId ?? undefined,
      gmailThreadId: email.gmailThreadId ?? undefined,
    });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
      <div className="space-y-6 min-w-0">
      <Card className="bg-gradient-surface border-border/50">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search emails by subject, sender, or company..."
                className="pl-10 bg-background/50"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-1 rounded-md border border-border/50 p-1">
              <Button
                type="button"
                variant={inboxFilter === 'all' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setInboxFilter('all')}
              >
                All
              </Button>
              <Button
                type="button"
                variant={inboxFilter === 'apollo' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setInboxFilter('apollo')}
              >
                Apollo
              </Button>
            </div>
            <Button
              variant="outline"
              className="flex items-center gap-2"
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
            >
              <RefreshCw className={`h-4 w-4 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
              Sync
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-surface border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Inbox
            <Badge variant="secondary" className="ml-2">
              {unreadCount} unread
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm p-4">Loading messages…</p>
          ) : filteredThreads.length === 0 ? (
            <p className="text-muted-foreground text-sm p-4">
              {inboxFilter === 'apollo' && threads.length > 0
                ? 'No threads with Apollo contacts. Email an Apollo contact to see them here.'
                : 'No messages yet. Connect email,'}{' '}
              {inboxFilter === 'all' && (
              <>
              <button
                type="button"
                onClick={onOpenSyncSettings}
                className="text-primary underline-offset-4 hover:underline"
              >
                set a {provider === 'gmail' ? 'sync label' : 'sync folder'} in settings
              </button>
              , then run Sync.
              </>
              )}
            </p>
          ) : (
            <div className="space-y-2">
              {filteredThreads.map((thread) => {
                const email = thread.latest;
                const isRead = isThreadRead(readIds, thread.threadKey, email);
                const isStarred = starredIds.has(email.id);
                return (
                  <div
                    key={thread.threadKey}
                    className={`flex items-center gap-4 p-4 rounded-lg hover:bg-muted/30 transition-colors cursor-pointer ${
                      !isRead ? 'bg-primary/5 border border-primary/10' : 'bg-background/50'
                    }`}
                    onClick={() => openMessage(email, thread.threadKey)}
                  >
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={(e) => toggleStar(email.id, e)}
                    >
                      <Star
                        className={`h-4 w-4 ${isStarred ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`}
                      />
                    </Button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-medium ${!isRead ? 'text-foreground' : 'text-muted-foreground'}`}
                          >
                            {email.from}
                          </span>
                          {email.company && (
                            <Badge variant="outline" className="text-xs">
                              {email.company}
                            </Badge>
                          )}
                          {email.contactCreatedFrom === 'apollo' && (
                            <Badge variant="default" className="text-xs">
                              Apollo
                            </Badge>
                          )}
                          {thread.messageCount > 1 && (
                            <Badge variant="secondary" className="text-xs">
                              {thread.messageCount}
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatRelativeTime(email.timestamp)}
                        </span>
                      </div>
                      <h4
                        className={`font-medium text-sm mb-1 ${!isRead ? 'text-foreground' : 'text-muted-foreground'}`}
                      >
                        {email.subject}
                      </h4>
                      <p className="text-sm text-muted-foreground truncate">{email.preview}</p>
                    </div>
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => handleReply(email, e)}>
                        <Reply className="h-3 w-3" />
                      </Button>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6" disabled>
                            <Forward className="h-3 w-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Forward coming soon</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6" disabled>
                            <Archive className="h-3 w-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Archive is UI-only until Gmail actions are wired</TooltipContent>
                      </Tooltip>
                      <Button variant="ghost" size="icon" className="h-6 w-6" disabled>
                        <MoreHorizontal className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <Button variant="ghost" size="sm" className="mt-4" onClick={() => refetch()}>
            Refresh list
          </Button>
        </CardContent>
      </Card>

      <EmailDetail
        message={selected}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onThreadOpened={(ids) => {
          if (selected) {
            const threadKey =
              selected.gmailThreadId ?? selected.conversationId ?? selected.id;
            markRead([threadKey, ...ids]);
          }
        }}
      />
      </div>

      <ApolloContactsPanel onCompose={onCompose} onOpenSettings={onOpenSyncSettings} />
    </div>
  );
}
