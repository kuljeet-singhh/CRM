import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth, type AuthedRequest } from '../auth/middleware.js';
import { getOutlookAccessToken } from '../auth/tokens.js';
import { isOutlookPushEnabled } from '../env.js';
import { sendOutlookMessage } from './send.js';
import { manualOutlookSync } from './sync.js';
import { outlookCalendarRouter } from './calendar/routes.js';
import { listOutlookCalendars } from './calendar/list.js';

export const outlookRouter = Router();
outlookRouter.use(requireAuth);
outlookRouter.use('/calendar', outlookCalendarRouter);

const UI_REFRESH_INTERVAL_MS = 15_000;
const MAIL_SYNC_INTERVAL_MS = 86_400_000;

outlookRouter.get('/sync-config', (_req: AuthedRequest, res) => {
  res.json({
    pushEnabled: isOutlookPushEnabled(),
    mailSyncIntervalMs: MAIL_SYNC_INTERVAL_MS,
    uiRefreshIntervalMs: UI_REFRESH_INTERVAL_MS,
  });
});

outlookRouter.get('/calendars', async (req: AuthedRequest, res) => {
  try {
    const result = await listOutlookCalendars(req.userId!);
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
    console.error('[outlook/calendars]', err);
    res.status(500).json({ error: 'list_failed' });
  }
});

outlookRouter.get('/profile', async (req: AuthedRequest, res) => {
  try {
    const token = await getOutlookAccessToken(req.userId!);
    const meRes = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!meRes.ok) {
      res.status(401).json({ error: 'reauth_required' });
      return;
    }
    const profile = await meRes.json();
    res.json(profile);
  } catch {
    res.status(401).json({ error: 'reauth_required' });
  }
});

outlookRouter.post('/send', async (req: AuthedRequest, res) => {
  const { to, cc, subject, body } = req.body as {
    to?: string | string[];
    cc?: string | string[];
    subject?: string;
    body?: string;
  };

  const toList = Array.isArray(to) ? to : to ? [to] : [];
  const ccList = Array.isArray(cc) ? cc : cc ? [cc] : [];

  if (!toList.length || !subject || !body) {
    res.status(400).json({ error: 'invalid_request' });
    return;
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId! } });
    if (!user) {
      res.status(401).json({ error: 'reauth_required' });
      return;
    }

    const result = await sendOutlookMessage({
      userId: req.userId!,
      workspaceId: req.workspaceId!,
      fromEmail: user.email,
      to: toList,
      cc: ccList.length ? ccList : undefined,
      subject,
      body,
    });
    res.json(result);
  } catch (err) {
    if ((err as Error).message === 'reauth_required') {
      res.status(401).json({ error: 'reauth_required' });
      return;
    }
    res.status(500).json({ error: 'send_failed' });
  }
});

outlookRouter.post('/folders', async (req: AuthedRequest, res) => {
  const { name } = req.body as { name?: string };
  if (!name) {
    res.status(400).json({ error: 'invalid_request' });
    return;
  }

  try {
    const token = await getOutlookAccessToken(req.userId!);
    const resFolder = await fetch('https://graph.microsoft.com/v1.0/me/mailFolders', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ displayName: name }),
    });
    if (!resFolder.ok) {
      res.status(500).json({ error: 'folder_create_failed' });
      return;
    }
    const folder = await resFolder.json();
    res.json({ id: folder.id, name: folder.displayName });
  } catch {
    res.status(401).json({ error: 'reauth_required' });
  }
});

outlookRouter.post('/reset-delta', async (req: AuthedRequest, res) => {
  await prisma.user.update({
    where: { id: req.userId! },
    data: { outlookLastDeltaToken: null },
  });
  res.json({ ok: true });
});

outlookRouter.post('/reset-sync', async (req: AuthedRequest, res) => {
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
    data: { outlookLastDeltaToken: null },
  });

  res.json({ ok: true, deletedEmails, deletedContacts });
});

outlookRouter.post('/sync', async (req: AuthedRequest, res) => {
  try {
    const result = await manualOutlookSync(req.userId!, req.workspaceId!);
    res.json(result);
  } catch (err) {
    const message = (err as Error).message;
    console.error('[outlook/sync]', err);
    if (message === 'reauth_required') {
      res.status(401).json({ error: 'reauth_required' });
      return;
    }
    res.status(500).json({ error: 'sync_failed' });
  }
});
