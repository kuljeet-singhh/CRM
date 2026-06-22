import { useQuery } from '@tanstack/react-query';
import { CalendarDays } from 'lucide-react';
import { api } from '@/lib/api';
import { useFormatters } from '@/lib/preferences';
import type { CalendarEventItem } from '@/types';

export function ContactUpcomingMeetings({
  contactId,
  enabled,
}: {
  contactId: string;
  enabled: boolean;
}) {
  const { formatDateTime } = useFormatters();

  const query = useQuery({
    queryKey: ['calendar', 'contact', contactId],
    queryFn: () => {
      const params = new URLSearchParams({
        contactId,
        from: new Date().toISOString(),
        limit: '3',
      });
      return api<{ events: CalendarEventItem[] }>(`/api/calendar/events?${params}`);
    },
    enabled,
  });

  const events = query.data?.events ?? [];
  if (!enabled || query.isLoading || events.length === 0) return null;

  return (
    <div className="space-y-1.5 pt-2 border-t border-border/50">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <CalendarDays className="h-3 w-3" />
        Upcoming meetings
      </div>
      <ul className="space-y-1">
        {events.map((event) => (
          <li key={event.id} className="text-xs text-muted-foreground truncate">
            {event.title || 'Meeting'} · {formatDateTime(event.startsAt)}
          </li>
        ))}
      </ul>
    </div>
  );
}
