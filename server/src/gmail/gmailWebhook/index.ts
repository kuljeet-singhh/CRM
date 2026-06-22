import { Router } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { prisma } from '../../db.js';
import { env } from '../../env.js';
import { decodeGmailPushData } from './decode.js';
import { runGmailSyncForUser } from '../syncRunner.js';

export const gmailWebhookRouter = Router();

gmailWebhookRouter.post('/gmail', async (req, res) => {
  try {
    if (env.isProd && env.googleWebhookAudience) {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        res.status(401).end();
        return;
      }
      const client = new OAuth2Client();
      await client.verifyIdToken({
        idToken: authHeader.slice(7),
        audience: env.googleWebhookAudience,
      });
    }

    const message = req.body?.message;
    console.log('messageb webhook payload', message);
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
    if (!res.headersSent) res.status(200).end();
  }
});
