export type AuthProvider = 'gmail' | 'outlook' | 'credential';

export type MailProvider = 'gmail' | 'outlook';

export type ContactSource = 'manual' | 'logged_email' | 'apollo' | 'linkedin_csv';

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

export interface UserSettings {
  name: string | null;
  email: string;
  provider: AuthProvider;
  syncSelector: string | null;
  gmailSyncLabel: string | null;
  outlookSyncFolder: string | null;
  timezone: string | null;
  watchWarning?: string;
  subscriptionWarning?: string;
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
