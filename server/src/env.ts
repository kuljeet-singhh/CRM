import './ensureDirectUrl.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: path.resolve(__dirname, '../../.env') });
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env: ${name}`);
  return v;
}

function optional(name: string, fallback = ''): string {
  return process.env[name] ?? fallback;
}

export const env = {
  port: parseInt(optional('PORT', '3000'), 10),
  webOrigin: optional('WEB_ORIGIN', 'http://localhost:5173'),
  isProd: process.env.NODE_ENV === 'production',
  sessionSecret: required('SESSION_SECRET'),
  jwtAccessSecret: optional('JWT_ACCESS_SECRET') || required('SESSION_SECRET'),
  jwtRefreshSecret: optional('JWT_REFRESH_SECRET') || required('SESSION_SECRET'),
  jwtAccessTtl: optional('JWT_ACCESS_TTL', '15m'),
  jwtRefreshTtl: optional('JWT_REFRESH_TTL', '30d'),
  databaseUrl: required('DATABASE_URL'),
  googleClientId: required('GOOGLE_CLIENT_ID'),
  googleClientSecret: required('GOOGLE_CLIENT_SECRET'),
  googleRedirectUri: required('GOOGLE_REDIRECT_URI'),
  googleScopes: required('GOOGLE_SCOPES').split(',').map((s) => s.trim()),
  encryptionKey: required('ENCRYPTION_KEY'),
  gmailPubsubTopic: optional('GMAIL_PUBSUB_TOPIC'),
  googleWebhookAudience: optional('GOOGLE_WEBHOOK_AUDIENCE'),
  syncWorkerPollMs: parseInt(optional('SYNC_WORKER_POLL_MS', '2000'), 10),
  syncWorkerBatchSize: parseInt(optional('SYNC_WORKER_BATCH_SIZE', '5'), 10),
  microsoftClientId: optional('MICROSOFT_CLIENT_ID'),
  microsoftClientSecret: optional('MICROSOFT_CLIENT_SECRET'),
  microsoftRedirectUri: optional('MICROSOFT_REDIRECT_URI'),
  microsoftTenantId: optional('MICROSOFT_TENANT_ID', 'common'),
  microsoftScopes: optional(
    'MICROSOFT_SCOPES',
    'openid profile email offline_access User.Read Mail.ReadWrite Mail.Send'
  ).split(' '),
  outlookWebhookUrl: optional('OUTLOOK_WEBHOOK_URL').replace(/\/$/, ''),
  outlookWebhookClientState: optional('OUTLOOK_WEBHOOK_CLIENT_STATE'),
  cronSecret: optional('CRON_SECRET'),
};

export function isMicrosoftConfigured(): boolean {
  return Boolean(env.microsoftClientId && env.microsoftClientSecret && env.microsoftRedirectUri);
}

export function isOutlookPushEnabled(): boolean {
  return Boolean(env.outlookWebhookUrl && env.outlookWebhookClientState);
}

export function outlookWebhookNotificationUrl(): string {
  return `${env.outlookWebhookUrl}/api/webhooks/outlook`;
}
