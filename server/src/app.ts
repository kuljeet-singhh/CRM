import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { authRouter } from './auth/routes.js';
import { gmailRouter } from './gmail/routes.js';
import { outlookRouter } from './outlook/routes.js';
import { contactsRouter } from './contacts/routes.js';
import { workspacesRouter } from './workspaces/routes.js';
import { settingsRouter } from './users/settings.js';
import { apolloRouter } from './apollo/routes.js';
import { messagesRouter } from './messages/routes.js';
import { gmailWebhookRouter } from './webhooks/gmailReceiver.js';
import { outlookWebhookRouter } from './webhooks/outlookReceiver.js';
import { devRouter } from './dev/routes.js';
import { cronRouter } from './cron/routes.js';
import { calendarRouter } from './calendar/routes.js';
import { reportsRouter } from './reports/routes.js';
import { eventsRouter } from './events/routes.js';
import { isMessageEventsEnabled } from './events/messageBus.js';
import { renewExpiredWatches, countWatchIssues } from './gmail/watchManager.js';
import { countOutlookSubscriptionIssues } from './outlook/subscriptionManager.js';
import { env, isOutlookPushEnabled } from './env.js';
import { prisma } from './db.js';
import { requireAuth, type AuthedRequest } from './auth/middleware.js';

export function createApp(): express.Application {
  const app = express();

  app.get('/api/health/live', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/', (_req, res) => {
    res.json({ ok: true, service: 'fly-crm-api', health: '/api/health/live' });
  });

  app.get('/api', (_req, res) => {
    res.json({ ok: true, service: 'fly-crm-api', health: '/api/health/live' });
  });

  app.use(
    cors({
      origin: env.webOrigin,
      credentials: true,
    })
  );
  app.use(express.json());
  app.use(cookieParser());

  app.use('/api/webhooks', gmailWebhookRouter);
  app.use('/api/webhooks', outlookWebhookRouter);
  app.use('/api/cron', cronRouter);

  app.use('/auth', authRouter);
  app.use('/api/gmail', gmailRouter);
  app.use('/api/outlook', outlookRouter);
  app.use('/api/workspaces', workspacesRouter);
  app.use('/api/contacts', contactsRouter);
  app.use('/api/settings', settingsRouter);
  app.use('/api/apollo', apolloRouter);
  app.use('/api/messages', messagesRouter);
  app.use('/api/calendar', calendarRouter);
  app.use('/api/reports', reportsRouter);
  app.use('/api/events', eventsRouter);

  if (!env.isProd) {
    app.use('/api/dev', devRouter);
  }

  app.get('/api/health', async (_req, res) => {
    try {
      const failedJobs = await prisma.syncJob.count({ where: { status: 'failed' } });
      const watchIssues = await countWatchIssues();
      const outlookSubIssues = await countOutlookSubscriptionIssues();
      res.json({
        ok: failedJobs === 0 && watchIssues === 0 && outlookSubIssues === 0,
        failedSyncJobs: failedJobs,
        usersWithWatchIssues: watchIssues,
        usersWithOutlookSubscriptionIssues: outlookSubIssues,
        gmailPushEnabled: Boolean(env.gmailPubsubTopic),
        outlookPushEnabled: isOutlookPushEnabled(),
        gmailWebhookPath: '/api/webhooks/gmail',
        outlookWebhookPath: '/api/webhooks/outlook',
        messageEventsEnabled: isMessageEventsEnabled(),
      });
    } catch (e) {
      console.error('[health]', e);
      res.status(503).json({ ok: false, dbError: true });
    }
  });

  app.get('/api/health/watch', async (_req, res) => {
    try {
      const usersWithExpiredOrMissingGmailWatch = await countWatchIssues();
      res.json({
        ok: usersWithExpiredOrMissingGmailWatch === 0,
        usersWithExpiredOrMissingGmailWatch,
        gmailPubsubTopicConfigured: Boolean(env.gmailPubsubTopic),
      });
    } catch (e) {
      console.error('[health/watch]', e);
      res.status(503).json({ ok: false, dbError: true, gmailPubsubTopicConfigured: Boolean(env.gmailPubsubTopic) });
    }
  });

  app.get('/api/health/outlook-sync', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const user = await prisma.user.findUnique({ where: { id: req.userId! } });
      res.json({
        ok:
          isOutlookPushEnabled() &&
          Boolean(user?.outlookSyncFolder) &&
          Boolean(user?.outlookSubscriptionId) &&
          Boolean(user?.outlookSubscriptionExpiry && user.outlookSubscriptionExpiry > new Date()),
        outlookSyncFolder: user?.outlookSyncFolder ?? null,
        outlookSubscriptionExpiry: user?.outlookSubscriptionExpiry?.toISOString() ?? null,
        outlookWebhookConfigured: isOutlookPushEnabled(),
      });
    } catch (e) {
      console.error('[health/outlook-sync]', e);
      res.status(503).json({ ok: false, dbError: true });
    }
  });

  app.get('/api/health/gmail-sync', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const user = await prisma.user.findUnique({ where: { id: req.userId! } });
      const crmLabelCount = await prisma.crmLabel.count({ where: { userId: req.userId! } });
      const pendingSyncJobs = await prisma.syncJob.count({
        where: { userId: req.userId!, status: 'pending' },
      });
      const failedSyncJobs = await prisma.syncJob.count({
        where: { userId: req.userId!, status: 'failed' },
      });

      res.json({
        ok:
          Boolean(env.gmailPubsubTopic) &&
          crmLabelCount > 0 &&
          Boolean(user?.gmailWatchExpiry && user.gmailWatchExpiry > new Date()),
        crmLabelCount,
        gmailWatchExpiry: user?.gmailWatchExpiry?.toISOString() ?? null,
        gmailPubsubTopicConfigured: Boolean(env.gmailPubsubTopic),
        pendingSyncJobs,
        failedSyncJobs,
      });
    } catch (e) {
      console.error('[health/gmail-sync]', e);
      res.status(503).json({ ok: false, dbError: true });
    }
  });

  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[error]', err);
    res.status(500).json({ error: 'internal_error' });
  });

  return app;
}
