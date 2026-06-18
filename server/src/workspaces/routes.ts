import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth, type AuthedRequest } from '../auth/middleware.js';

export const workspacesRouter = Router();
workspacesRouter.use(requireAuth);

workspacesRouter.get('/me', async (req: AuthedRequest, res) => {
  const memberships = await prisma.membership.findMany({
    where: { userId: req.userId! },
    include: { workspace: true },
  });

  res.json({
    currentWorkspaceId: req.workspaceId,
    workspaces: memberships.map((m) => ({
      id: m.workspace.id,
      name: m.workspace.name,
      role: m.role,
    })),
  });
});
