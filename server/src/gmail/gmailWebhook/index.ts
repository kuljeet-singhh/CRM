import { Router } from 'express';
import { prisma } from '../../db.js';
import { decodeGmailPushData } from './decode.js';
import { runGmailSyncForUser } from '../syncRunner.js';
import { verifyGmailPubSubPushAuth } from './auth.js';

export const gmailWebhookRouter = Router();

gmailWebhookRouter.post('/gmail', async (req, res) => {
  try {
    const auth = await verifyGmailPubSubPushAuth(req.headers.authorization);
    if (!auth.ok) {
      console.warn('[gmail-webhook] unauthorized', {
        reason: auth.reason,
        hint:
          auth.reason === 'missing_bearer'
            ? 'Enable OIDC authentication on the Pub/Sub push subscription'
            : 'Check GOOGLE_WEBHOOK_AUDIENCE matches Pub/Sub push audience exactly',
      });
      res.status(401).end();
      return;
    }

    const message = req.body?.message;
    if (!message?.data) {
      console.log('[gmail-webhook] no_payload');
      res.status(200).end();
      return;
    }

    let decoded;
    try {
      decoded = decodeGmailPushData(message.data);
    } catch {
      res.status(400).json({ error: 'invalid_payload' });
      return;
    }

    console.log('[gmail-webhook] notification', {
      emailAddress: decoded.emailAddress,
      historyId: decoded.historyId,
    });

    const user = await prisma.user.findFirst({
      where: { email: decoded.emailAddress, authProvider: 'gmail' },
    });
    if (!user) {
      console.log('[gmail-webhook] user_not_found', decoded.emailAddress);
      res.status(200).end();
      return;
    }

    if (!user.gmailSyncLabel) {
      console.log('[gmail-webhook] no_sync_label', decoded.emailAddress);
      res.status(200).end();
      return;
    }

    const crmLabel = await prisma.crmLabel.findUnique({ where: { userId: user.id } });
    if (!crmLabel) {
      console.log('[gmail-webhook] no_crm_labels', decoded.emailAddress);
      res.status(200).end();
      return;
    }

    await runGmailSyncForUser(user.id, 'webhook');
    res.status(200).end();
  } catch (err) {
    console.error('[gmail-webhook] processing_failed', err);
    if (!res.headersSent) res.status(500).end();
  }
});
