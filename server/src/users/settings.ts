import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth, type AuthedRequest } from '../auth/middleware.js';
import { getAuthorizedClient } from '../auth/tokens.js';
import { ensureGmailWatch } from '../gmail/watchManager.js';
import { runGmailSyncForUser } from '../gmail/syncRunner.js';
import { getOutlookAccessToken } from '../auth/tokens.js';
import { isMicrosoftConfigured } from '../env.js';
import { findFolderByDisplayName, listOutlookMailFolders } from '../outlook/folders.js';
import { ensureOutlookSubscription } from '../outlook/subscriptionManager.js';
import { runOutlookSyncForUser } from '../outlook/syncRunner.js';

export const settingsRouter = Router();
settingsRouter.use(requireAuth);

const IANA_TZ = /^[A-Za-z_]+\/[A-Za-z_]+$/;
const MAX_NAME_LENGTH = 100;

function settingsPayload(
  user: {
    name: string | null;
    email: string;
    authProvider: string;
    gmailSyncLabel: string | null;
    outlookSyncFolder: string | null;
    timezone: string | null;
  },
  extras?: { watchWarning?: string; subscriptionWarning?: string }
) {
  return {
    name: user.name,
    email: user.email,
    provider: user.authProvider,
    syncSelector:
      user.authProvider === 'gmail' ? user.gmailSyncLabel : user.outlookSyncFolder,
    gmailSyncLabel: user.gmailSyncLabel,
    outlookSyncFolder: user.outlookSyncFolder,
    timezone: user.timezone,
    ...extras,
  };
}

settingsRouter.get('/', async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId! } });
  if (!user) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }

  res.json(settingsPayload(user));
});

settingsRouter.put('/', async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId! } });
  if (!user) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }

  const { syncSelector, gmailSyncLabel, outlookSyncFolder, timezone, name } = req.body as {
    syncSelector?: string;
    gmailSyncLabel?: string;
    outlookSyncFolder?: string;
    timezone?: string;
    name?: string | null;
  };

  const data: Record<string, unknown> = {};
  let watchWarning: string | undefined;
  let subscriptionWarning: string | undefined;

  if (name !== undefined) {
    const trimmed = typeof name === 'string' ? name.trim() : '';
    if (trimmed.length > MAX_NAME_LENGTH) {
      res.status(400).json({ error: 'invalid_name' });
      return;
    }
    data.name = trimmed || null;
  }

  if (timezone !== undefined) {
    if (timezone && !IANA_TZ.test(timezone)) {
      res.status(400).json({ error: 'invalid_timezone' });
      return;
    }
    data.timezone = timezone || null;
  }

  if (user.authProvider === 'gmail') {
    const labelName = syncSelector ?? gmailSyncLabel;
    if (labelName !== undefined) {
      if (!labelName) {
        res.status(400).json({ error: 'label_required' });
        return;
      }

      try {
        const gmail = await getAuthorizedClient(req.userId!);
        const labelsRes = await gmail.users.labels.list({ userId: 'me' });
        const label = labelsRes.data.labels?.find((l) => l.name === labelName);
        if (!label?.id) {
          res.status(400).json({ error: 'label_not_found' });
          return;
        }

        const hadLabel = await prisma.crmLabel.findUnique({ where: { userId: req.userId! } });
        const labelChanged = !hadLabel || hadLabel.labelName !== labelName;

        await prisma.crmLabel.deleteMany({ where: { userId: req.userId! } });
        await prisma.crmLabel.create({
          data: {
            userId: req.userId!,
            workspaceId: req.workspaceId!,
            labelName,
            labelId: label.id,
          },
        });

        data.gmailSyncLabel = labelName;
        if (labelChanged) {
          data.gmailLastHistoryId = null;
        }

        const watchResult = await ensureGmailWatch(req.userId!);
        watchWarning = watchResult.warning;

        if (labelChanged) {
          void runGmailSyncForUser(req.userId!, 'settings');
        }
      } catch (err) {
        if ((err as Error).message === 'reauth_required') {
          res.status(401).json({ error: 'reauth_required' });
          return;
        }
        throw err;
      }
    }
  } else if (user.authProvider === 'outlook') {
    const folderName = syncSelector ?? outlookSyncFolder;
    if (folderName !== undefined) {
      if (!isMicrosoftConfigured()) {
        res.status(503).json({ error: 'microsoft_not_configured' });
        return;
      }
      try {
        const token = await getOutlookAccessToken(req.userId!);
        const folders = await listOutlookMailFolders(token);
        const folder = findFolderByDisplayName(folders, folderName);
        if (!folder) {
          res.status(400).json({ error: 'folder_not_found' });
          return;
        }

        const folderChanged = user.outlookSyncFolder !== folderName;
        data.outlookSyncFolder = folderName;
        data.outlookFolderId = folder.id;
        if (folderChanged) {
          data.outlookLastDeltaToken = null;
        }

        const subResult = await ensureOutlookSubscription(req.userId!);
        subscriptionWarning = subResult.warning;

        if (folderChanged) {
          void runOutlookSyncForUser(req.userId!, 'settings');
        }
      } catch (err) {
        if ((err as Error).message === 'reauth_required') {
          res.status(401).json({ error: 'reauth_required' });
          return;
        }
        throw err;
      }
    }
  }

  const updated = await prisma.user.update({
    where: { id: req.userId! },
    data,
  });

  res.json(settingsPayload(updated, { watchWarning, subscriptionWarning }));
});
