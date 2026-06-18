import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth, type AuthedRequest } from '../auth/middleware.js';
import { env } from '../env.js';

export const devRouter = Router();

devRouter.post('/gmail-webhook-simulate', requireAuth, async (req: AuthedRequest, res) => {
  if (env.isProd) {
    res.status(404).json({ error: 'not_found' });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: req.userId! } });
  if (!user || user.authProvider !== 'gmail') {
    res.status(400).json({ error: 'gmail_user_required' });
    return;
  }

  const { historyId } = req.body as { historyId?: string };
  const crmLabels = await prisma.crmLabel.findMany({ where: { userId: user.id } });

  if (crmLabels.length === 0) {
    res.status(400).json({ error: 'no_crm_labels' });
    return;
  }

  for (const label of crmLabels) {
    await prisma.syncJob.create({
      data: {
        userId: user.id,
        workspaceId: label.workspaceId,
        type: 'label_sync',
        status: 'pending',
        payload: {
          userId: user.id,
          workspaceId: label.workspaceId,
          labelId: label.labelId,
          historyId: historyId ?? '999999',
        },
      },
    });
  }

  const pendingJobs = await prisma.syncJob.count({
    where: { userId: user.id, status: 'pending' },
  });

  res.json({ email: user.email, pendingJobs });
});
