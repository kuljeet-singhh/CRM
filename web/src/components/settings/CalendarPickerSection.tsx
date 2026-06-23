import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { api, ApiError } from '@/lib/api';
import { mailApiBase } from '@/lib/provider';
import { usePreferences } from '@/lib/preferences';
import { isCalendarWritable } from '@/lib/calendarAccess';
import type {
  CalendarListItem,
  CalendarListResponse,
  MailProvider,
  UserCalendarInput,
  UserCalendarSettings,
  UserSettings,
} from '@/types';

const GMAIL_PRIMARY_CALENDAR: CalendarListItem = {
  id: 'primary',
  name: 'Primary calendar',
  isPrimary: true,
};

interface PickerCalendar extends CalendarListItem {
  syncEnabled: boolean;
}

function gmailCalendarsFromSaved(saved: UserCalendarSettings[]): CalendarListItem[] {
  if (saved.length === 0) return [GMAIL_PRIMARY_CALENDAR];
  return saved.map((s) => ({
    id: s.calendarId,
    name: s.calendarName,
    isPrimary: s.isPrimary,
  }));
}

function mergeCalendars(
  providerCalendars: CalendarListItem[],
  saved: UserCalendarSettings[]
): PickerCalendar[] {
  return providerCalendars.map((cal) => {
    const savedRow = saved.find((s) => s.calendarId === cal.id);
    return {
      ...cal,
      syncEnabled: savedRow?.syncEnabled ?? cal.isPrimary,
    };
  });
}

function toCalendarInputs(calendars: PickerCalendar[]): UserCalendarInput[] {
  return calendars.map((c) => ({
    calendarId: c.id,
    calendarName: c.name,
    isPrimary: c.isPrimary,
    syncEnabled: c.syncEnabled,
  }));
}

interface CalendarPickerSectionProps {
  provider: MailProvider;
  enabled: boolean;
  savedCalendars: UserCalendarSettings[];
  onCalendarsChange: (calendars: UserCalendarSettings[]) => void;
}

export function CalendarPickerSection({
  provider,
  enabled,
  savedCalendars,
  onCalendarsChange,
}: CalendarPickerSectionProps) {
  const { refreshSettings } = usePreferences();
  const [providerCalendars, setProviderCalendars] = useState<CalendarListItem[]>([]);
  const [calendars, setCalendars] = useState<PickerCalendar[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savingCalendarId, setSavingCalendarId] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setProviderCalendars([]);
      setCalendars([]);
      setLoadError(null);
      return;
    }

    if (provider === 'gmail') {
      setLoadError(null);
      setLoading(false);
      setProviderCalendars(gmailCalendarsFromSaved(savedCalendars));
      return;
    }

    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    api<CalendarListResponse>(`${mailApiBase(provider)}/calendars`)
      .then((data) => {
        if (!cancelled) setProviderCalendars(data.calendars);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.code === 'insufficient_scope') {
          setLoadError('insufficient_scope');
        } else {
          setLoadError('load_failed');
          toast.error('Failed to load calendars.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, provider, savedCalendars]);

  useEffect(() => {
    if (providerCalendars.length > 0) {
      setCalendars(mergeCalendars(providerCalendars, savedCalendars));
    }
  }, [providerCalendars, savedCalendars]);

  async function toggleCalendar(calendarId: string, checked: boolean) {
    const target = calendars.find((c) => c.id === calendarId);
    if (!target) return;

    if (!isCalendarWritable(target.accessRole)) {
      toast.error('This calendar is view-only.');
      return;
    }

    const wasEnabled = target.syncEnabled;
    const prev = calendars;
    const next = calendars.map((c) =>
      c.id === calendarId ? { ...c, syncEnabled: checked } : c
    );
    setCalendars(next);
    setSavingCalendarId(calendarId);

    try {
      const data = await api<UserSettings>('/api/settings', {
        method: 'PUT',
        body: JSON.stringify({ calendars: toCalendarInputs(next) }),
      });
      onCalendarsChange(data.userCalendars ?? []);
      await refreshSettings();

      if (!wasEnabled && checked) {
        void api(`${mailApiBase(provider)}/calendar/sync`, { method: 'POST' }).catch(() => {
          toast.error('Calendar saved but sync failed. Try Sync now on the Calendar page.');
        });
      }
    } catch (err) {
      setCalendars(prev);
      if (err instanceof ApiError) {
        toast.error(err.message || 'Failed to save calendar selection.');
      } else {
        toast.error('Failed to save calendar selection.');
      }
    } finally {
      setSavingCalendarId(null);
    }
  }

  if (!enabled) return null;

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading calendars…
      </div>
    );
  }

  if (loadError === 'insufficient_scope') {
    return (
      <p className="text-sm text-muted-foreground">
        Reconnect your account above to load and select calendars.
      </p>
    );
  }

  if (loadError) {
    return (
      <p className="text-sm text-muted-foreground">
        Could not load calendars. Try reopening Settings.
      </p>
    );
  }

  if (calendars.length === 0) {
    return <p className="text-sm text-muted-foreground">No calendars found.</p>;
  }

  return (
    <div className="space-y-2 pt-1">
      <p className="text-xs font-medium text-muted-foreground">Calendars to sync</p>
      <ul className="space-y-2">
        {calendars.map((cal) => {
          const writable = isCalendarWritable(cal.accessRole);
          const saving = savingCalendarId === cal.id;
          return (
            <li
              key={cal.id}
              className="flex items-center gap-3 rounded-md border border-border/40 bg-background/50 px-3 py-2"
            >
              <Checkbox
                id={`cal-sync-${cal.id}`}
                checked={cal.syncEnabled}
                disabled={!writable || saving}
                onCheckedChange={(checked) => void toggleCalendar(cal.id, checked === true)}
              />
              <label
                htmlFor={`cal-sync-${cal.id}`}
                className={`flex flex-1 flex-wrap items-center gap-2 text-sm ${writable ? 'cursor-pointer' : 'cursor-not-allowed opacity-70'}`}
              >
                <span className="font-medium">{cal.name}</span>
                {cal.isPrimary && (
                  <Badge variant="secondary" className="text-xs">
                    Primary
                  </Badge>
                )}
                {!writable && (
                  <Badge variant="outline" className="text-xs">
                    View only
                  </Badge>
                )}
              </label>
              {saving && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
