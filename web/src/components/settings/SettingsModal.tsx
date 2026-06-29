import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { api, ApiError } from '@/lib/api';
import { initiateConnect, mailApiBase } from '@/lib/provider';
import { usePreferences } from '@/lib/preferences';
import { CalendarPickerSection } from '@/components/settings/CalendarPickerSection';
import type { GmailSyncConfig, LinkedInImportResult, MailProvider, UserCalendarSettings, UserSettings } from '@/types';

interface SettingsModalProps {
  open: boolean;
  provider: MailProvider;
  onClose: () => void;
  onWiped: () => void;
  onContactsChanged?: () => void;
}

type ErrorKind = 'label_not_found' | 'folder_not_found' | 'insufficient_scope' | 'other' | null;

const BROWSER_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;
const SYSTEM_DEFAULT = '__system__';

function allTimezones(): string[] {
  type IntlExt = typeof Intl & {
    supportedValuesOf?: (key: string) => string[];
  };
  const fn = (Intl as IntlExt).supportedValuesOf;
  return fn ? fn('timeZone') : [BROWSER_TIMEZONE];
}

function errorKindFromCode(code?: string): ErrorKind {
  if (code === 'label_not_found') return 'label_not_found';
  if (code === 'folder_not_found') return 'folder_not_found';
  if (code === 'insufficient_scope') return 'insufficient_scope';
  return code ? 'other' : null;
}

export function SettingsModal({
  open,
  provider,
  onClose,
  onWiped,
  onContactsChanged,
}: SettingsModalProps) {
  const { refreshSettings } = usePreferences();
  const [label, setLabel] = useState('');
  const [savedLabel, setSavedLabel] = useState<string | null>(null);
  const [timezone, setTimezone] = useState<string>(SYSTEM_DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creatingLabel, setCreatingLabel] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<ErrorKind>(null);
  const [wipeConfirm, setWipeConfirm] = useState('');
  const [wiping, setWiping] = useState(false);

  const [apolloConnected, setApolloConnected] = useState(false);
  const [apolloLastSyncedAt, setApolloLastSyncedAt] = useState<string | null>(null);
  const [apolloKey, setApolloKey] = useState('');
  const [apolloSaving, setApolloSaving] = useState(false);
  const [apolloSyncing, setApolloSyncing] = useState(false);
  const [apolloError, setApolloError] = useState<string | null>(null);
  const [linkedinFile, setLinkedinFile] = useState<File | null>(null);
  const [linkedinImporting, setLinkedinImporting] = useState(false);
  const [linkedinError, setLinkedinError] = useState<string | null>(null);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [calendarSyncEnabled, setCalendarSyncEnabled] = useState(false);
  const [calendarWriteScopeOk, setCalendarWriteScopeOk] = useState<boolean | null>(null);
  const [userCalendars, setUserCalendars] = useState<UserCalendarSettings[]>([]);
  const [calendarToggling, setCalendarToggling] = useState(false);

  const timezones = useMemo(() => allTimezones(), []);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    setErrorKind(null);
    setWipeConfirm('');
    setApolloKey('');
    setApolloError(null);
    setLinkedinFile(null);
    setLinkedinError(null);

    const syncConfigPromise =
      provider === 'gmail'
        ? api<GmailSyncConfig>('/api/gmail/sync-config').catch(() => null)
        : provider === 'outlook'
          ? api<GmailSyncConfig>('/api/outlook/sync-config').catch(() => null)
          : Promise.resolve(null);

    Promise.all([
      api<{ connected: boolean; lastSyncedAt: string | null }>('/api/apollo/status').catch(
        () => null
      ),
      api<UserSettings>('/api/settings').catch(() => null),
      syncConfigPromise,
    ])
      .then(([apolloStatus, settingsData, syncConfig]) => {
        setPushEnabled(Boolean(syncConfig?.pushEnabled));
        if (apolloStatus) {
          setApolloConnected(apolloStatus.connected);
          setApolloLastSyncedAt(apolloStatus.lastSyncedAt);
        }
        if (settingsData) {
          setSavedLabel(settingsData.syncSelector);
          setTimezone(settingsData.timezone ?? SYSTEM_DEFAULT);
          setCalendarSyncEnabled(Boolean(settingsData.calendarSyncEnabled));
          setCalendarWriteScopeOk(settingsData.calendarWriteScopeOk ?? null);
          setUserCalendars(settingsData.userCalendars ?? []);
          const pending = sessionStorage.getItem('pendingLabel');
          if (pending && !settingsData.syncSelector) {
            setLabel(pending);
            sessionStorage.removeItem('pendingLabel');
          } else {
            setLabel(settingsData.syncSelector ?? '');
          }
        }
      })
      .finally(() => setLoading(false));
  }, [open, provider]);

  async function toggleCalendarSync(enabled: boolean) {
    setCalendarToggling(true);
    setError(null);
    setErrorKind(null);
    try {
      const data = await api<UserSettings>('/api/settings', {
        method: 'PUT',
        body: JSON.stringify({ calendarSyncEnabled: enabled }),
      });
      setCalendarSyncEnabled(Boolean(data.calendarSyncEnabled));
      setCalendarWriteScopeOk(data.calendarWriteScopeOk ?? null);
      setUserCalendars(data.userCalendars ?? []);
      await refreshSettings();
      toast.success(enabled ? 'Calendar sync enabled.' : 'Calendar sync disabled.');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setErrorKind(errorKindFromCode(err.code));
      } else {
        setError('Failed to update calendar sync');
        setErrorKind('other');
      }
    } finally {
      setCalendarToggling(false);
    }
  }

  async function save() {
    const trimmed = label.trim();
    if (!trimmed) {
      setError('Sync label or folder name is required.');
      setErrorKind('other');
      return;
    }

    setSaving(true);
    setError(null);
    setErrorKind(null);
    try {
      const data = await api<UserSettings>('/api/settings', {
        method: 'PUT',
        body: JSON.stringify({
          syncSelector: trimmed,
          timezone: timezone === SYSTEM_DEFAULT ? null : timezone,
        }),
      });
      setSavedLabel(data.syncSelector ?? null);
      if (data.watchWarning) toast.warning(`Watch: ${data.watchWarning}`);
      await refreshSettings();
      toast.success('Settings saved.');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setErrorKind(errorKindFromCode(err.code));
      } else {
        setError('Failed to save settings');
        setErrorKind('other');
      }
    } finally {
      setSaving(false);
    }
  }

  async function createLabel() {
    const name = label.trim();
    if (!name) return;
    setCreatingLabel(true);
    setError(null);
    setErrorKind(null);
    try {
      const path =
        provider === 'outlook'
          ? `${mailApiBase(provider)}/folders`
          : `${mailApiBase(provider)}/labels`;
      await api<{ id: string; name: string }>(path, {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
      await save();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setErrorKind(errorKindFromCode(err.code));
      } else {
        setError('Failed to create label or folder');
        setErrorKind('other');
      }
    } finally {
      setCreatingLabel(false);
    }
  }

  async function wipe() {
    setWiping(true);
    try {
      const data = await api<{ deletedEmails: number; deletedContacts: number }>(
        `${mailApiBase(provider)}/reset-sync`,
        {
          method: 'POST',
          body: JSON.stringify({ confirm: 'WIPE' }),
        }
      );
      toast.success(
        `Wiped ${data.deletedEmails} message${data.deletedEmails === 1 ? '' : 's'} + ${data.deletedContacts} contact${data.deletedContacts === 1 ? '' : 's'}.`
      );
      setWipeConfirm('');
      onWiped();
    } catch {
      toast.error('Wipe failed');
    } finally {
      setWiping(false);
    }
  }

  function apolloErrorMessage(err: unknown): string {
    if (!(err instanceof ApiError)) return 'Request failed';
    if (err.code === 'missing_api_key') return 'Enter your Apollo API key.';
    if (err.code === 'invalid_api_key') return 'Apollo rejected this API key. Check or create a new key.';
    if (err.code === 'apollo_not_connected') return 'Save your Apollo API key first.';
    if (err.code === 'apollo_reauth_required') {
      return 'Your Apollo API key was rejected. Re-enter it to reconnect.';
    }
    if (err.code === 'apollo_rate_limited') return 'Apollo rate limit hit. Wait a moment and try again.';
    return err.message || 'Request failed';
  }

  async function saveApolloKey() {
    const key = apolloKey.trim();
    if (!key) return;
    setApolloSaving(true);
    setApolloError(null);
    try {
      await api<{ connected: boolean }>('/api/apollo/key', {
        method: 'PUT',
        body: JSON.stringify({ apiKey: key }),
      });
      setApolloConnected(true);
      setApolloKey('');
      toast.success('Apollo connected.');
    } catch (err) {
      setApolloError(apolloErrorMessage(err));
    } finally {
      setApolloSaving(false);
    }
  }

  async function syncApollo() {
    setApolloSyncing(true);
    setApolloError(null);
    try {
      const data = await api<{
        imported: number;
        created: number;
        skippedNoEmail?: number;
        pages?: number;
        capped?: boolean;
      }>('/api/apollo/sync', { method: 'POST' });
      setApolloLastSyncedAt(new Date().toISOString());
      toast.success(
        `Imported ${data.imported} contact${data.imported === 1 ? '' : 's'} (${data.created} new).`
      );
      if (data.capped) {
        toast.warning('Import capped at 20,000 contacts. Run sync again if needed.');
      }
      onContactsChanged?.();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'apollo_reauth_required') {
        setApolloConnected(false);
      }
      setApolloError(apolloErrorMessage(err));
    } finally {
      setApolloSyncing(false);
    }
  }

  async function disconnectApollo() {
    try {
      await api('/api/apollo/key', { method: 'DELETE' });
      setApolloConnected(false);
      setApolloLastSyncedAt(null);
      setApolloKey('');
      toast.success('Apollo disconnected.');
    } catch {
      toast.error('Failed to disconnect Apollo');
    }
  }

  async function importLinkedInContacts() {
    if (!linkedinFile) return;
    setLinkedinImporting(true);
    setLinkedinError(null);
    try {
      const csv = await linkedinFile.text();
      const res = await fetch('/api/contacts/import/linkedin-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'text/csv' },
        credentials: 'include',
        body: csv,
      });
      if (!res.ok) {
        let message = `HTTP ${res.status}`;
        try {
          const body = (await res.json()) as { error?: string };
          if (body.error === 'missing_csv') message = 'CSV file is empty.';
          else if (body.error === 'invalid_csv') message = 'Not a valid LinkedIn Connections.csv file.';
          else if (body.error) message = body.error;
        } catch {
          /* ignore */
        }
        throw new Error(message);
      }
      const data = (await res.json()) as LinkedInImportResult;
      toast.success(
        `Imported ${data.imported} contact${data.imported === 1 ? '' : 's'} (${data.created} new, ${data.updated} updated).`
      );
      setLinkedinFile(null);
      onContactsChanged?.();
    } catch (err) {
      setLinkedinError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setLinkedinImporting(false);
    }
  }

  const wipeArmed = wipeConfirm.trim() === 'WIPE';
  const providerName = provider === 'outlook' ? 'Outlook' : 'Gmail';

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Configure which {providerName} messages land in this CRM and how timestamps are
            displayed.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-4 text-sm text-muted-foreground">Loading…</div>
        ) : (
          <div className="flex flex-col gap-4">
            {pushEnabled && (
              <p className="text-sm text-muted-foreground rounded-md border border-border/50 bg-muted/30 px-3 py-2">
                {provider === 'outlook'
                  ? 'Real-time sync via Outlook webhooks is active. The inbox refreshes from the database about once per minute.'
                  : 'Real-time sync via Gmail push is active. The inbox refreshes from the database about once per minute.'}
              </p>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="settings-label">
                {provider === 'outlook' ? 'Outlook sync folder' : 'Gmail sync label'}
              </Label>
              <Input
                id="settings-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder={
                  provider === 'outlook'
                    ? 'e.g. CRM'
                    : 'e.g. CRM1'
                }
              />
              <p className="text-xs leading-relaxed text-muted-foreground">
                {provider === 'outlook'
                  ? 'Choose an Outlook folder to sync into CRM. We can create it for you if missing.'
                  : 'Apply this label to Gmail threads you want logged here. Messages you send from this app get the label automatically.'}
              </p>
              {savedLabel === null && (
                <p className="text-xs text-muted-foreground">
                  Currently: <strong>selective sync is OFF</strong> — no {providerName} messages
                  are being pulled.
                </p>
              )}
            </div>

            {error && (
              <div className="rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
                {error}
                {(errorKind === 'label_not_found' || errorKind === 'folder_not_found') && (
                  <div className="mt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={creatingLabel || !label.trim()}
                      onClick={createLabel}
                    >
                      <Sparkles className="h-4 w-4 mr-1" />
                      {creatingLabel
                        ? 'Creating…'
                        : `Create "${label.trim()}" in ${providerName}`}
                    </Button>
                  </div>
                )}
                {errorKind === 'insufficient_scope' && (
                  <div className="mt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        sessionStorage.setItem('pendingLabel', label.trim());
                        sessionStorage.setItem('reopenSettings', '1');
                        void initiateConnect(provider, '/settings');
                      }}
                    >
                      Reconnect {providerName}
                    </Button>
                  </div>
                )}
              </div>
            )}

            <Separator />

            <div className="space-y-3 rounded-md border border-border/50 bg-muted/20 px-3 py-3">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <Label htmlFor="settings-calendar-sync">Sync calendars</Label>
                  <p className="text-xs text-muted-foreground">
                    Import selected {providerName} calendars into CRM. Choose which calendars to
                    sync below. Reconnect after a scope upgrade to create or edit meetings from the
                    CRM.
                  </p>
                </div>
                <Switch
                  id="settings-calendar-sync"
                  checked={calendarSyncEnabled}
                  disabled={calendarToggling || loading}
                  onCheckedChange={(checked) => void toggleCalendarSync(checked)}
                />
              </div>
              {calendarSyncEnabled && calendarWriteScopeOk === false && (
                <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-950 dark:text-amber-100">
                  <p>
                    Calendar write access is not granted on your current connection. Reconnect{' '}
                    {providerName} to schedule or edit meetings from the CRM.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => {
                      sessionStorage.setItem('reopenSettings', '1');
                      void initiateConnect(provider, '/settings');
                    }}
                  >
                    Reconnect {providerName}
                  </Button>
                </div>
              )}
              {calendarSyncEnabled && (
                <CalendarPickerSection
                  provider={provider}
                  enabled={calendarSyncEnabled}
                  savedCalendars={userCalendars}
                  onCalendarsChange={setUserCalendars}
                />
              )}
            </div>

            <Separator />

            <div className="space-y-1.5">
              <Label htmlFor="settings-tz">Timezone</Label>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger id="settings-tz" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value={SYSTEM_DEFAULT}>
                    System default ({BROWSER_TIMEZONE})
                  </SelectItem>
                  {timezones.map((tz) => (
                    <SelectItem key={tz} value={tz}>
                      {tz}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Used to format every date and time in the app.
              </p>
            </div>

            <Separator />

            <div className="space-y-1.5">
              <Label htmlFor="settings-linkedin-csv">LinkedIn connections</Label>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  id="settings-linkedin-csv"
                  type="file"
                  accept=".csv,text/csv"
                  className="max-w-full"
                  onChange={(e) => {
                    setLinkedinFile(e.target.files?.[0] ?? null);
                    setLinkedinError(null);
                  }}
                />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!linkedinFile || linkedinImporting}
                  onClick={importLinkedInContacts}
                >
                  {linkedinImporting ? 'Importing…' : 'Import LinkedIn contacts'}
                </Button>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Export your connections from LinkedIn (Settings → Data privacy → Get a copy of your
                data → Connections). Upload the <code className="text-[11px]">Connections.csv</code>{' '}
                file from the ZIP.
              </p>
              {linkedinError && (
                <div className="rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
                  {linkedinError}
                </div>
              )}
            </div>

            <Separator />

            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Label htmlFor="settings-apollo">Apollo contacts</Label>
                {apolloConnected && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                    <Check className="size-3" />
                    Connected
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <PasswordInput
                  id="settings-apollo"
                  className="flex-1"
                  autoComplete="off"
                  value={apolloKey}
                  onChange={(e) => setApolloKey(e.target.value)}
                  placeholder={
                    apolloConnected
                      ? '•••••••• (key saved — type to replace)'
                      : 'Paste your Apollo API key'
                  }
                />
                <Button
                  variant="outline"
                  disabled={apolloSaving || !apolloKey.trim()}
                  onClick={saveApolloKey}
                >
                  {apolloSaving ? 'Saving…' : 'Save key'}
                </Button>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Import contacts from Apollo. Keys are stored encrypted on the server.
              </p>

              {apolloConnected && (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={apolloSyncing}
                    onClick={syncApollo}
                  >
                    {apolloSyncing ? 'Syncing…' : 'Sync contacts now'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    disabled={apolloSyncing}
                    onClick={disconnectApollo}
                  >
                    Disconnect
                  </Button>
                  {apolloLastSyncedAt && (
                    <span className="text-xs text-muted-foreground">
                      Last synced {new Date(apolloLastSyncedAt).toLocaleString()}
                    </span>
                  )}
                </div>
              )}

              {apolloError && (
                <div className="rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
                  {apolloError}
                </div>
              )}
            </div>

            <Separator />

            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 text-destructive">
                <AlertTriangle className="size-3.5" />
                Danger zone
              </Label>
              <p className="text-xs text-muted-foreground">
                Wiping deletes synced contacts and messages in this workspace. Type{' '}
                <code className="rounded bg-muted px-1 py-0.5 text-[11px]">WIPE</code> to enable.
              </p>
              <div className="flex items-center gap-2">
                <Input
                  value={wipeConfirm}
                  onChange={(e) => setWipeConfirm(e.target.value)}
                  placeholder="Type WIPE to enable"
                  className="font-mono"
                />
                <Button variant="destructive" disabled={!wipeArmed || wiping} onClick={wipe}>
                  {wiping ? 'Wiping…' : 'Wipe'}
                </Button>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Close
          </Button>
          <Button disabled={saving || loading || !label.trim()} onClick={save}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
