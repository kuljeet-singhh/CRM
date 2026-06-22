import { Router } from 'express';
import { prisma } from '../../db.js';
import { requireAuth, type AuthedRequest } from '../../auth/middleware.js';
import { resetGoogleCalendarSync, syncGoogleCalendar } from './sync.js';

export const gmailCalendarRouter = Router();
gmailCalendarRouter.use(requireAuth);

const CALENDAR_SYNC_INTERVAL_MS = 86_400_000;

gmailCalendarRouter.get('/sync-config', async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId! } });
  res.json({
    enabled: Boolean(user?.calendarSyncEnabled),
    pushEnabled: false,
    syncIntervalMs: CALENDAR_SYNC_INTERVAL_MS,
    lastSyncedAt: user?.googleCalendarLastSyncedAt?.toISOString() ?? null,
  });
});

gmailCalendarRouter.post('/sync', async (req: AuthedRequest, res) => {
  try {
    const result = await syncGoogleCalendar(req.userId!);
    if (result.error === 'insufficient_scope') {
      res.status(403).json({ error: 'insufficient_scope' });
      return;
    }
    if (result.error === 'calendar_sync_disabled') {
      res.status(400).json({ error: 'calendar_sync_disabled' });
      return;
    }
    res.json(result);
  } catch (err) {
    if ((err as Error).message === 'reauth_required') {
      res.status(401).json({ error: 'reauth_required' });
      return;
    }
    console.error('[gmail/calendar/sync]', err);
    res.status(500).json({ error: 'sync_failed' });
  }
});

gmailCalendarRouter.post('/reset-sync', async (req: AuthedRequest, res) => {
  const { confirm } = req.body as { confirm?: string };
  if (confirm !== 'WIPE') {
    res.status(400).json({ error: 'confirm_required' });
    return;
  }
  await resetGoogleCalendarSync(req.userId!, req.workspaceId!);
  res.json({ ok: true });
});
