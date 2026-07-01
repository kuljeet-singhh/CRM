import { describe, it, expect, vi, beforeEach } from 'vitest';

const { verifyIdToken } = vi.hoisted(() => ({
  verifyIdToken: vi.fn(),
}));

vi.mock('google-auth-library', () => ({
  OAuth2Client: vi.fn().mockImplementation(() => ({
    verifyIdToken,
  })),
}));

vi.mock('../../env.js', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../env.js')>();
  return {
    ...mod,
    env: {
      ...mod.env,
      isProd: true,
      googleWebhookAudience: 'https://crm-fly1.vercel.app/api/webhooks/gmail',
      gmailPubsubTopic: 'projects/test/topics/gmail',
    },
  };
});

import { getGoogleWebhookConfigWarning, verifyGmailPubSubPushAuth } from './auth.js';

describe('verifyGmailPubSubPushAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    verifyIdToken.mockResolvedValue({ getPayload: () => ({}) });
  });

  it('returns missing_bearer when Authorization header is absent', async () => {
    const result = await verifyGmailPubSubPushAuth(undefined);
    expect(result).toEqual({ ok: false, status: 401, reason: 'missing_bearer' });
    expect(verifyIdToken).not.toHaveBeenCalled();
  });

  it('verifies bearer token against configured audience', async () => {
    const result = await verifyGmailPubSubPushAuth('Bearer test-jwt');
    expect(result).toEqual({ ok: true });
    expect(verifyIdToken).toHaveBeenCalledWith({
      idToken: 'test-jwt',
      audience: 'https://crm-fly1.vercel.app/api/webhooks/gmail',
    });
  });

  it('returns invalid_token when JWT verification fails', async () => {
    verifyIdToken.mockRejectedValue(new Error('audience mismatch'));
    const result = await verifyGmailPubSubPushAuth('Bearer bad-jwt');
    expect(result).toEqual({ ok: false, status: 401, reason: 'invalid_token' });
  });
});

describe('getGoogleWebhookConfigWarning', () => {
  it('returns null when audience matches webhook URL suffix', () => {
    expect(getGoogleWebhookConfigWarning()).toBeNull();
  });
});
