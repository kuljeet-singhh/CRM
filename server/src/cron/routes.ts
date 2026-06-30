import { Router, type Request, type Response, type NextFunction } from 'express';
import { env } from '../env.js';
import { renewExpiredWatches } from '../gmail/watchManager.js';
import { runDailyGmailSync } from '../gmail/dailySync.js';
import { renewAllOutlookSubscriptions } from '../outlook/subscriptionManager.js';
import { runDailyOutlookSync } from '../outlook/dailySync.js';
import {
  CRON_MAILBOX_SYNC_BUDGET_MS,
  runIncrementalMailboxSync,
} from './mailboxSync.js';
import { runDailyCalendarSync } from './calendarDailySync.js';

export const cronRouter = Router();

function requireCronSecret(req: Request, res: Response, next: NextFunction) {
  if (!env.cronSecret) {
    res.status(503).json({ error: 'cron_not_configured' });
    return;
  }
  const auth = req.headers.authorization;
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : '';
  if (token !== env.cronSecret) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  next();
}

cronRouter.use(requireCronSecret);

cronRouter.all('/sync-worker', async (_req, res) => {
  const mailbox = await runIncrementalMailboxSync({
    timeBudgetMs: CRON_MAILBOX_SYNC_BUDGET_MS,
  });
  res.json({ ok: true, ...mailbox });
});

cronRouter.all('/gmail-watch-renew', async (_req, res) => {
  const renewed = await renewExpiredWatches();
  res.json({ ok: true, renewed });
});

cronRouter.all('/gmail-daily-sync', async (_req, res) => {
  await runDailyGmailSync();
  res.json({ ok: true });
});

cronRouter.all('/outlook-renew', async (_req, res) => {
  const renewed = await renewAllOutlookSubscriptions();
  res.json({ ok: true, renewed });
});

cronRouter.all('/outlook-daily-sync', async (_req, res) => {
  await runDailyOutlookSync();
  res.json({ ok: true });
});

cronRouter.all('/calendar-daily-sync', async (_req, res) => {
  const result = await runDailyCalendarSync();
  res.json({ ok: true, ...result });
});
