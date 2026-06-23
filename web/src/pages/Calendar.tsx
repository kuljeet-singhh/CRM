import { useCallback, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { CalendarDays, CalendarPlus, ExternalLink, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MeetingSchedulerModal } from '@/components/calendar/MeetingSchedulerModal';
import { api, ApiError } from '@/lib/api';
import { mailApiBase } from '@/lib/provider';
import { useAuth } from '@/hooks/useAuth';
import { useFormatters, usePreferences } from '@/lib/preferences';
import type { CalendarEventItem, CalendarSyncResult } from '@/types';

export default function CalendarPage() {
  const { user } = useAuth();
  const { settings } = usePreferences();
  const provider = user?.mailProvider;
  const queryClient = useQueryClient();
  const { formatRelativeTime, formatCalendarEventRange } = useFormatters();
  const [syncing, setSyncing] = useState(false);
  const [schedulerOpen, setSchedulerOpen] = useState(false);
  const [schedulerMode, setSchedulerMode] = useState<'create' | 'edit'>('create');
  const [selectedEvent, setSelectedEvent] = useState<CalendarEventItem | undefined>();

  const calendarWriteScopeOk = settings?.calendarWriteScopeOk !== false;

  const { fromIso, toIso } = useMemo(() => {
    const from = new Date();
    from.setDate(from.getDate() - 7);
    from.setHours(0, 0, 0, 0);
    const to = new Date();
    to.setDate(to.getDate() + 90);
    to.setHours(23, 59, 59, 999);
    return { fromIso: from.toISOString(), toIso: to.toISOString() };
  }, []);

  const eventsQuery = useQuery({
    queryKey: ['calendar', 'events', fromIso, toIso],
    queryFn: () => {
      const params = new URLSearchParams({
        from: fromIso,
        to: toIso,
        limit: '100',
      });
      return api<{ events: CalendarEventItem[] }>(`/api/calendar/events?${params}`);
    },
    enabled: Boolean(provider),
    staleTime: 60_000,
  });

  const syncConfigQuery = useQuery({
    queryKey: [provider, 'calendar', 'sync-config'],
    queryFn: () =>
      api<{ enabled: boolean; lastSyncedAt: string | null }>(
        `${mailApiBase(provider!)}/calendar/sync-config`
      ),
    enabled: Boolean(provider),
  });

  const runSync = useCallback(async () => {
    if (!provider) return;
    setSyncing(true);
    try {
      const result = await api<CalendarSyncResult>(`${mailApiBase(provider)}/calendar/sync`, {
        method: 'POST',
      });
      toast.success(
        `Synced ${result.imported} new, ${result.updated} updated, ${result.cancelled} cancelled`
      );
      await queryClient.invalidateQueries({ queryKey: ['calendar'] });
      await syncConfigQuery.refetch();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'insufficient_scope') {
        toast.error('Reconnect your account in Settings to grant calendar access.');
      } else if (err instanceof ApiError && err.code === 'calendar_sync_disabled') {
        toast.error('Enable calendar sync in Settings first.');
      } else {
        toast.error('Calendar sync failed.');
      }
    } finally {
      setSyncing(false);
    }
  }, [provider, queryClient, syncConfigQuery]);

  function openCreateModal() {
    setSchedulerMode('create');
    setSelectedEvent(undefined);
    setSchedulerOpen(true);
  }

  function openEvent(event: CalendarEventItem) {
    if (!event.createdFromCrm) {
      toast.message('Only CRM-created meetings can be edited here.');
      return;
    }
    setSchedulerMode('edit');
    setSelectedEvent(event);
    setSchedulerOpen(true);
  }

  if (!provider) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Calendar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-muted-foreground text-sm">
              Connect Gmail or Outlook in Settings to sync your calendars.
            </p>
            <Button asChild variant="outline">
              <Link to="/settings">Go to Settings</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const events = eventsQuery.data?.events ?? [];
  const calendarEnabled = syncConfigQuery.data?.enabled;
  const canCreate = calendarEnabled && calendarWriteScopeOk;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Calendar</h1>
          <p className="text-muted-foreground text-sm">
            Calendar events synced from {provider === 'gmail' ? 'Google' : 'Outlook'}
            {syncConfigQuery.data?.lastSyncedAt
              ? ` · Last sync ${formatRelativeTime(syncConfigQuery.data.lastSyncedAt)}`
              : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={openCreateModal} disabled={!canCreate}>
            <CalendarPlus className="h-4 w-4 mr-2" />
            New event
          </Button>
          <Button onClick={() => void runSync()} disabled={syncing || !calendarEnabled}>
            <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
            Sync now
          </Button>
        </div>
      </div>

      {!calendarEnabled && (
        <Card className="border-dashed">
          <CardContent className="py-6 text-sm text-muted-foreground">
            Calendar sync is off. Enable <strong>Sync calendars</strong> in{' '}
            <Link to="/settings" className="text-primary underline">
              Settings
            </Link>
            .
          </CardContent>
        </Card>
      )}

      {eventsQuery.isLoading && !eventsQuery.data && (
        <p className="text-sm text-muted-foreground text-center py-8">Loading events…</p>
      )}

      {!eventsQuery.isLoading && events.length === 0 && calendarEnabled && (
        <Card>
          <CardContent className="py-12 text-center space-y-2">
            <CalendarDays className="h-10 w-10 mx-auto text-muted-foreground" />
            <p className="font-medium">No upcoming events</p>
            <p className="text-sm text-muted-foreground">
              Try Sync now, create a new event, or check your synced calendars.
            </p>
            {canCreate && (
              <Button variant="outline" size="sm" className="mt-2" onClick={openCreateModal}>
                New event
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {events.map((event) => {
          const link = event.htmlLink ?? event.webLink;
          return (
            <Card
              key={event.id}
              className={`bg-gradient-surface border-border/50 ${
                event.createdFromCrm ? 'cursor-pointer hover:border-primary/40' : ''
              }`}
              onClick={() => openEvent(event)}
            >
              <CardContent className="p-4 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-medium truncate">{event.title || '(No title)'}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatCalendarEventRange(event.startsAt, event.endsAt, event.allDay)}
                  </p>
                  {event.location && (
                    <p className="text-xs text-muted-foreground mt-1 truncate">{event.location}</p>
                  )}
                  {event.createdFromCrm && (
                    <p className="text-xs text-primary mt-1">Created in CRM · click to edit</p>
                  )}
                </div>
                {link && (
                  <Button
                    variant="ghost"
                    size="sm"
                    asChild
                    onClick={(e) => e.stopPropagation()}
                  >
                    <a href={link} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <MeetingSchedulerModal
        open={schedulerOpen}
        onOpenChange={setSchedulerOpen}
        mode={schedulerMode}
        event={selectedEvent}
      />
    </div>
  );
}
