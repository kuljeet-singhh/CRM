import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { api, ApiError } from '@/lib/api';
import { usePreferences } from '@/lib/preferences';
import {
  defaultCreateFormState,
  parseAttendeesText,
  parseEventToFormState,
  toIsoFromDateAndTime,
  validateMeetingForm,
  type MeetingFormState,
} from '@/lib/calendarForm';
import { cn } from '@/lib/utils';
import type { CalendarEventItem, CalendarEventResponse } from '@/types';

export interface SchedulerContact {
  id: string;
  name: string | null;
  email: string;
}

interface MeetingSchedulerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  event?: CalendarEventItem;
  contact?: SchedulerContact;
}

function formatPickerDate(date: Date | undefined): string {
  if (!date) return 'Pick date';
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function mapApiError(code: string | undefined): string {
  if (code === 'insufficient_scope') {
    return 'Reconnect your account in Settings to grant calendar write access.';
  }
  if (code === 'calendar_permission_denied') {
    return 'You do not have permission to write to this calendar.';
  }
  if (code === 'invalid_dates') return 'Invalid start or end date/time.';
  if (code === 'invalid_body') return 'Please check all required fields.';
  return 'Something went wrong. Please try again.';
}

function DateTimeField({
  id,
  label,
  date,
  time,
  onDateChange,
  onTimeChange,
  disabled,
}: {
  id: string;
  label: string;
  date: Date | undefined;
  time: string;
  onDateChange: (d: Date | undefined) => void;
  onTimeChange: (t: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              id={id}
              variant="outline"
              disabled={disabled}
              className={cn('flex-1 justify-start text-left font-normal', !date && 'text-muted-foreground')}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {formatPickerDate(date)}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={date} onSelect={onDateChange} initialFocus />
          </PopoverContent>
        </Popover>
        <Input
          type="time"
          value={time}
          onChange={(e) => onTimeChange(e.target.value)}
          className="w-[120px]"
          disabled={disabled}
        />
      </div>
    </div>
  );
}

export function MeetingSchedulerModal({
  open,
  onOpenChange,
  mode,
  event,
  contact,
}: MeetingSchedulerModalProps) {
  const queryClient = useQueryClient();
  const { settings } = usePreferences();
  const [form, setForm] = useState<MeetingFormState>(defaultCreateFormState());
  const [loadingEvent, setLoadingEvent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enabledCalendars = useMemo(
    () => (settings?.userCalendars ?? []).filter((c) => c.syncEnabled),
    [settings?.userCalendars]
  );

  const writeScopeOk = settings?.calendarWriteScopeOk !== false;

  useEffect(() => {
    if (!open) return;

    setError(null);

    if (mode === 'create') {
      const initial = defaultCreateFormState(contact);
      const primary = enabledCalendars.find((c) => c.isPrimary) ?? enabledCalendars[0];
      setForm({ ...initial, calendarId: primary?.calendarId ?? '' });
      return;
    }

    if (!event) return;

    let cancelled = false;
    setLoadingEvent(true);

    api<CalendarEventResponse>(`/api/calendar/events/${event.id}`)
      .then((data) => {
        if (!cancelled) setForm(parseEventToFormState(data.event));
      })
      .catch(() => {
        if (!cancelled) setForm(parseEventToFormState(event));
      })
      .finally(() => {
        if (!cancelled) setLoadingEvent(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when dialog opens or target changes
  }, [open, mode, event?.id, contact?.id]);

  useEffect(() => {
    if (!open || mode !== 'create' || form.calendarId || enabledCalendars.length === 0) return;
    const primary = enabledCalendars.find((c) => c.isPrimary) ?? enabledCalendars[0];
    if (primary) setForm((prev) => ({ ...prev, calendarId: primary.calendarId }));
  }, [open, mode, form.calendarId, enabledCalendars]);

  function updateForm(patch: Partial<MeetingFormState>) {
    setForm((prev) => ({ ...prev, ...patch }));
  }

  async function handleSave() {
    const validationError = validateMeetingForm(form);
    if (validationError) {
      setError(validationError);
      return;
    }

    const startsAt = toIsoFromDateAndTime(form.startDate, form.startTime)!;
    const endsAt = toIsoFromDateAndTime(form.endDate, form.endTime)!;
    const attendeeEmails = parseAttendeesText(form.attendeesText);

    setSaving(true);
    setError(null);

    try {
      if (mode === 'create') {
        await api<CalendarEventResponse>('/api/calendar/events', {
          method: 'POST',
          body: JSON.stringify({
            calendarId: form.calendarId,
            title: form.title.trim(),
            startsAt,
            endsAt,
            attendeeEmails,
            location: form.location.trim() || undefined,
            contactId: contact?.id,
          }),
        });
        toast.success('Meeting scheduled.');
      } else if (event) {
        await api<CalendarEventResponse>(`/api/calendar/events/${event.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            title: form.title.trim(),
            startsAt,
            endsAt,
            attendeeEmails,
            location: form.location.trim() || undefined,
          }),
        });
        toast.success('Meeting updated.');
      }

      await queryClient.invalidateQueries({ queryKey: ['calendar'] });
      onOpenChange(false);
    } catch (err) {
      const message =
        err instanceof ApiError ? mapApiError(err.code) : 'Failed to save meeting.';
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleCancelMeeting() {
    if (!event) return;
    setCancelling(true);
    try {
      await api(`/api/calendar/events/${event.id}`, { method: 'DELETE' });
      toast.success('Meeting cancelled.');
      await queryClient.invalidateQueries({ queryKey: ['calendar'] });
      setConfirmCancelOpen(false);
      onOpenChange(false);
    } catch (err) {
      const message =
        err instanceof ApiError ? mapApiError(err.code) : 'Failed to cancel meeting.';
      toast.error(message);
    } finally {
      setCancelling(false);
    }
  }

  const title = mode === 'create' ? 'Schedule meeting' : 'Edit meeting';

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>

          {!writeScopeOk && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
              <p>Calendar write access is required to schedule meetings.</p>
              <Button variant="outline" size="sm" className="mt-2" asChild>
                <Link to="/settings">Open Settings</Link>
              </Button>
            </div>
          )}

          {writeScopeOk && enabledCalendars.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Enable at least one calendar in{' '}
              <Link to="/settings" className="text-primary underline">
                Settings
              </Link>
              .
            </p>
          )}

          {loadingEvent ? (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground justify-center">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading event…
            </div>
          ) : (
            <div className="space-y-4 py-1">
              <div className="space-y-1.5">
                <Label htmlFor="meeting-title">Title</Label>
                <Input
                  id="meeting-title"
                  value={form.title}
                  onChange={(e) => updateForm({ title: e.target.value })}
                  disabled={!writeScopeOk}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="meeting-attendees">Attendees</Label>
                <Textarea
                  id="meeting-attendees"
                  value={form.attendeesText}
                  onChange={(e) => updateForm({ attendeesText: e.target.value })}
                  placeholder="email@example.com, other@example.com"
                  rows={2}
                  disabled={!writeScopeOk}
                />
              </div>

              <DateTimeField
                id="meeting-start-date"
                label="Start"
                date={form.startDate}
                time={form.startTime}
                onDateChange={(d) => updateForm({ startDate: d })}
                onTimeChange={(t) => updateForm({ startTime: t })}
                disabled={!writeScopeOk}
              />

              <DateTimeField
                id="meeting-end-date"
                label="End"
                date={form.endDate}
                time={form.endTime}
                onDateChange={(d) => updateForm({ endDate: d })}
                onTimeChange={(t) => updateForm({ endTime: t })}
                disabled={!writeScopeOk}
              />

              <div className="space-y-1.5">
                <Label htmlFor="meeting-location">Location</Label>
                <Input
                  id="meeting-location"
                  value={form.location}
                  onChange={(e) => updateForm({ location: e.target.value })}
                  placeholder="Optional"
                  disabled={!writeScopeOk}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Calendar</Label>
                <Select
                  value={form.calendarId}
                  onValueChange={(v) => updateForm({ calendarId: v })}
                  disabled={!writeScopeOk || mode === 'edit' || enabledCalendars.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select calendar" />
                  </SelectTrigger>
                  <SelectContent>
                    {enabledCalendars.map((cal) => (
                      <SelectItem key={cal.calendarId} value={cal.calendarId}>
                        {cal.calendarName}
                        {cal.isPrimary ? ' (Primary)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            {mode === 'edit' && event && (
              <Button
                type="button"
                variant="destructive"
                onClick={() => setConfirmCancelOpen(true)}
                disabled={saving || cancelling || loadingEvent || !writeScopeOk}
              >
                Cancel meeting
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button
              type="button"
              onClick={() => void handleSave()}
              disabled={
                saving ||
                loadingEvent ||
                !writeScopeOk ||
                enabledCalendars.length === 0
              }
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === 'create' ? 'Schedule' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmCancelOpen} onOpenChange={setConfirmCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this meeting?</AlertDialogTitle>
            <AlertDialogDescription>
              This will cancel the meeting in your calendar provider and mark it cancelled in CRM.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelling}>Keep meeting</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleCancelMeeting();
              }}
              disabled={cancelling}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancelling ? 'Cancelling…' : 'Cancel meeting'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
