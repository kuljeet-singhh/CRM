import { OAuth2Client } from 'google-auth-library';
import { env } from '../../env.js';

export type GmailPubSubAuthFailureReason = 'missing_bearer' | 'invalid_token';

export type GmailPubSubAuthResult =
  | { ok: true }
  | { ok: false; status: 401; reason: GmailPubSubAuthFailureReason };

export async function verifyGmailPubSubPushAuth(
  authorization: string | undefined
): Promise<GmailPubSubAuthResult> {
  if (!env.isProd || !env.googleWebhookAudience) {
    return { ok: true };
  }

  if (!authorization?.startsWith('Bearer ')) {
    return { ok: false, status: 401, reason: 'missing_bearer' };
  }

  try {
    const client = new OAuth2Client();
    await client.verifyIdToken({
      idToken: authorization.slice(7),
      audience: env.googleWebhookAudience,
    });
    return { ok: true };
  } catch (err) {
    console.error('[gmail-webhook] invalid_token', {
      audience: env.googleWebhookAudience,
      message: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, status: 401, reason: 'invalid_token' };
  }
}

export function getGoogleWebhookConfigWarning(): string | null {
  if (!env.isProd || !env.gmailPubsubTopic) return null;

  if (!env.googleWebhookAudience) {
    return (
      'GMAIL_PUBSUB_TOPIC is set but GOOGLE_WEBHOOK_AUDIENCE is empty — ' +
      'webhook accepts unauthenticated POSTs in production'
    );
  }

  const expectedSuffix = '/api/webhooks/gmail';
  if (!env.googleWebhookAudience.endsWith(expectedSuffix)) {
    return (
      `GOOGLE_WEBHOOK_AUDIENCE must end with ${expectedSuffix} ` +
      `(current: ${env.googleWebhookAudience})`
    );
  }

  return null;
}
