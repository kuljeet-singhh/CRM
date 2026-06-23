export type AuthProvider = 'gmail' | 'outlook' | 'credential';

export type MailProvider = 'gmail' | 'outlook';

export type ContactSource = 'manual' | 'logged_email' | 'apollo' | 'linkedin_csv' | 'ocr_card';

export interface Me {
  id: string;
  email: string;
  name: string | null;
  authProvider: AuthProvider;
  mailProvider: MailProvider | null;
  hasPassword: boolean;
  createdAt: string;
}

export interface InboxThread {
  threadKey: string;
  gmailThreadId: string | null;
  conversationId: string | null;
  latest: InboxMessage;
  messageCount: number;
}

export interface InboxMessage {
  id: string;
  subject: string;
  preview: string;
  from: string;
  email: string;
  company: string;
  timestamp: string;
  direction: 'sent' | 'received';
  gmailThreadId?: string | null;
  conversationId?: string | null;
  gmailMessageId?: string | null;
  contactId?: string | null;
  bodyText?: string | null;
  bodyHtml?: string | null;
  rfcMessageId?: string | null;
  contactCreatedFrom?: ContactSource | null;
}

export interface SyncResult {
  messagesAdded: number;
  messagesUpdated?: number;
  error?: string;
  notice?: 'delta_reset';
}

export interface ReplyContext {
  to: string;
  subject: string;
  body?: string;
  inReplyTo?: string;
  gmailThreadId?: string;
}

export interface UserCalendarSettings {
  id: string;
  calendarId: string;
  calendarName: string;
  isPrimary: boolean;
  syncEnabled: boolean;
  provider: MailProvider;
}

export interface UserCalendarInput {
  calendarId: string;
  calendarName: string;
  isPrimary: boolean;
  syncEnabled: boolean;
}

export interface CalendarListItem {
  id: string;
  name: string;
  isPrimary: boolean;
  accessRole?: string;
}

export interface CalendarListResponse {
  calendars: CalendarListItem[];
}

export interface UserSettings {
  name: string | null;
  email: string;
  provider: AuthProvider;
  syncSelector: string | null;
  gmailSyncLabel: string | null;
  outlookSyncFolder: string | null;
  timezone: string | null;
  calendarSyncEnabled?: boolean;
  calendarLastSyncedAt?: string | null;
  calendarWriteScopeOk?: boolean | null;
  userCalendars?: UserCalendarSettings[];
  watchWarning?: string;
  subscriptionWarning?: string;
}

export interface CalendarSyncConfig {
  enabled: boolean;
  pushEnabled: boolean;
  syncIntervalMs: number;
  lastSyncedAt: string | null;
}

export interface CalendarEventItem {
  id: string;
  title: string | null;
  description: string | null;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  location: string | null;
  organizerEmail: string | null;
  attendees: Array<{ email: string; name?: string; responseStatus?: string }>;
  htmlLink: string | null;
  webLink: string | null;
  isCancelled: boolean;
  provider: MailProvider;
  calendarId: string;
  createdFromCrm: boolean;
}

export interface CreateCalendarEventRequest {
  calendarId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  attendeeEmails: string[];
  location?: string;
  contactId?: string;
}

export interface UpdateCalendarEventRequest {
  title?: string;
  startsAt?: string;
  endsAt?: string;
  attendeeEmails?: string[];
  location?: string;
}

export interface CalendarEventResponse {
  event: CalendarEventItem;
}

export interface CalendarSyncResult {
  imported: number;
  updated: number;
  cancelled: number;
  syncTokenSaved?: boolean;
  error?: string;
}

export interface GmailSyncConfig {
  pushEnabled: boolean;
  mailSyncIntervalMs: number;
  uiRefreshIntervalMs: number;
}

export interface CrmContact {
  id: string;
  email: string | null;
  name: string | null;
  company?: string | null;
  title?: string | null;
  linkedinUrl?: string | null;
  createdFrom: ContactSource;
  emailCount: number;
  lastEmailAt: string | null;
}

export interface LinkedInImportResult {
  imported: number;
  created: number;
  updated: number;
  skippedNoIdentifier: number;
  skippedInvalidUrl: number;
}

export interface GmailSyncHealth {
  ok: boolean;
  crmLabelCount: number;
  gmailWatchExpiry: string | null;
  gmailPubsubTopicConfigured: boolean;
  pendingSyncJobs: number;
  failedSyncJobs: number;
}
