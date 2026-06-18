import { prisma } from '../db.js';

export async function ensurePersonalWorkspace(userId: string, userName?: string | null) {
  const existing = await prisma.membership.findFirst({
    where: { userId },
    include: { workspace: true },
  });
  if (existing) return existing.workspace;

  const workspace = await prisma.workspace.create({
    data: {
      name: userName ? `${userName}'s Workspace` : 'My Workspace',
      memberships: {
        create: { userId, role: 'owner' },
      },
    },
  });
  return workspace;
}
