import { Router } from 'express';
import { prisma } from '../db.js';
import { env } from '../env.js';
import { isMessageEventsEnabled } from '../events/messageBus.js';
import { requireAuth, type AuthedRequest } from '../auth/middleware.js';
import { getAuthorizedClient } from '../auth/tokens.js';
import { sendGmailMessage } from './send.js';
import { manualGmailSync } from './sync.js';
import { syncGmailThreadForUser } from './threadSync.js';
import { gmailCalendarRouter } from './calendar/routes.js';
import { listGoogleCalendars } from './calendar/list.js';

export const gmailRouter = Router();
gmailRouter.use(requireAuth);
gmailRouter.use('/calendar', gmailCalendarRouter);

const UI_REFRESH_FALLBACK_MS = 60_000;
const MAIL_SYNC_INTERVAL_MS = 86_400_000;
const MAIL_RECONCILE_INTERVAL_MS = 180_000;

gmailRouter.get('/sync-config', (_req: AuthedRequest, res) => {
  const eventsEnabled = isMessageEventsEnabled();
  res.json({
    pushEnabled: Boolean(env.gmailPubsubTopic),
    eventsEnabled,
    mailSyncIntervalMs: MAIL_SYNC_INTERVAL_MS,
    mailReconcileIntervalMs: MAIL_RECONCILE_INTERVAL_MS,
    uiRefreshIntervalMs: eventsEnabled ? 0 : UI_REFRESH_FALLBACK_MS,
  });
});

gmailRouter.get('/calendars', async (req: AuthedRequest, res) => {
  try {
    const result = await listGoogleCalendars(req.userId!);
    if ('error' in result) {
      res.status(403).json({ error: result.error });
      return;
    }
    res.json(result);
  } catch (err) {
    if ((err as Error).message === 'reauth_required') {
      res.status(401).json({ error: 'reauth_required' });
      return;
    }
    console.error('[gmail/calendars]', err);
    res.status(500).json({ error: 'list_failed' });
  }
});

gmailRouter.get('/profile', async (req: AuthedRequest, res) => {
  try {
    const gmail = await getAuthorizedClient(req.userId!);
    const profile = await gmail.users.getProfile({ userId: 'me' });
    res.json({
      email: profile.data.emailAddress,
      messagesTotal: profile.data.messagesTotal,
      threadsTotal: profile.data.threadsTotal,
    });
  } catch {
    res.status(401).json({ error: 'reauth_required' });
  }
});

gmailRouter.post('/send', async (req: AuthedRequest, res) => {
  const { to, cc, subject, body, inReplyTo, gmailThreadId } = req.body as {
    to?: string | string[];
    cc?: string | string[];
    subject?: string;
    body?: string;
    inReplyTo?: string;
    gmailThreadId?: string;
  };

  const toList = Array.isArray(to) ? to : to ? [to] : [];
  const ccList = Array.isArray(cc) ? cc : cc ? [cc] : [];

  if (!toList.length || !subject || !body) {
    res.status(400).json({ error: 'invalid_request' });
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      include: { crmLabels: true },
    });
    if (!user) {
      res.status(401).json({ error: 'reauth_required' });
      return;
    }

    const result = await sendGmailMessage({
      userId: req.userId!,
      workspaceId: req.workspaceId!,
      fromEmail: user.email,
      to: toList,
      cc: ccList.length ? ccList : undefined,
      subject,
      body,
      inReplyTo,
      gmailThreadId,
      crmLabelId: user.gmailSyncLabel ? (user.crmLabels[0]?.labelId ?? null) : null,
    });
    res.json(result);
  } catch (err) {
    if ((err as Error).message === 'reauth_required') {
      res.status(401).json({ error: 'reauth_required' });
      return;
    }
    console.error('[gmail/send]', err);
    res.status(500).json({ error: 'send_failed' });
  }
});

gmailRouter.post('/labels', async (req: AuthedRequest, res) => {
  const { name } = req.body as { name?: string };
  if (!name) {
    res.status(400).json({ error: 'invalid_request' });
    return;
  }

  try {
    const gmail = await getAuthorizedClient(req.userId!);
    const existing = await gmail.users.labels.list({ userId: 'me' });
    const found = existing.data.labels?.find((l) => l.name === name);
    if (found) {
      res.json({ id: found.id, name: found.name });
      return;
    }
    const created = await gmail.users.labels.create({
      userId: 'me',
      requestBody: {
        name,
        labelListVisibility: 'labelShow',
        messageListVisibility: 'show',
      },
    });
    res.json({ id: created.data.id, name: created.data.name });
  } catch {
    res.status(401).json({ error: 'reauth_required' });
  }
});

gmailRouter.post('/reset-sync', async (req: AuthedRequest, res) => {
  const { confirm } = req.body as { confirm?: string };
  if (confirm !== 'WIPE') {
    res.status(400).json({ error: 'confirm_required' });
    return;
  }

  const workspaceId = req.workspaceId!;
  const deletedEmails = await prisma.emailMessage.count({ where: { workspaceId } });
  const deletedContacts = await prisma.contact.count({ where: { workspaceId } });

  await prisma.emailMessageRecipient.deleteMany({
    where: { emailMessage: { workspaceId } },
  });
  await prisma.emailMessage.deleteMany({ where: { workspaceId } });
  await prisma.contact.deleteMany({ where: { workspaceId } });
  await prisma.user.update({
    where: { id: req.userId! },
    data: { gmailLastHistoryId: null },
  });

  res.json({ ok: true, deletedEmails, deletedContacts });
});

gmailRouter.post('/sync', async (req: AuthedRequest, res) => {
  try {
    const result = await manualGmailSync(req.userId!, req.workspaceId!);
    if (result.error === 'label_not_found') {
      res.status(400).json({ error: 'label_not_found' });
      return;
    }
    if (result.error === 'no_sync_label') {
      res.status(400).json({ error: 'no_sync_label' });
      return;
    }
    res.json(result);
  } catch (err) {
    if ((err as Error).message === 'reauth_required') {
      res.status(401).json({ error: 'reauth_required' });
      return;
    }
    console.error('[gmail/sync]', err);
    res.status(500).json({ error: 'sync_failed' });
  }
});

gmailRouter.post('/threads/:threadId/sync', async (req: AuthedRequest, res) => {
  const threadId = req.params.threadId;
  if (!threadId) {
    res.status(400).json({ error: 'thread_id_required' });
    return;
  }

  try {
    const result = await syncGmailThreadForUser(req.userId!, req.workspaceId!, threadId);
    if (result.error === 'no_sync_label') {
      res.status(400).json({ error: 'no_sync_label' });
      return;
    }
    res.json(result);
  } catch (err) {
    if ((err as Error).message === 'reauth_required') {
      res.status(401).json({ error: 'reauth_required' });
      return;
    }
    console.error('[gmail/thread-sync]', err);
    res.status(500).json({ error: 'thread_sync_failed' });
  }
});
