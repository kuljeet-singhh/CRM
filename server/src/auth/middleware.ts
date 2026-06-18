import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../db.js';
import { getBearerUserId } from './requestAuth.js';

export interface AuthedRequest extends Request {
  userId?: string;
  workspaceId?: string;
}

export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const userId = getBearerUserId(req);
  if (!userId) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }

  const membership = await prisma.membership.findFirst({
    where: { userId },
    orderBy: { createdAt: 'asc' },
  });
  if (!membership) {
    res.status(403).json({ error: 'no_workspace' });
    return;
  }

  req.userId = userId;
  req.workspaceId = membership.workspaceId;
  next();
}
