import { prisma } from '../db.js';
import { getAuthorizedClient } from '../auth/tokens.js';
import {
  collectHistoryMessageIds,
  importGmailMessageIdsForCrm,
  listLabeledMessageIds,
  mergeHistoryCollections,
  resolveInboxLabelId,
} from './import.js';

export type SyncUserGmailOptions = {
  labeledMessageLimit?: number;
};

export type SyncUserGmailResult = {
  messagesAdded: number;
  messagesUpdated: number;
  messagesRemoved: number;
  messagesLabeled: number;
  contactsTouched: number;
  historyId?: string;
  error?: 'no_sync_label' | 'label_not_found' | 'no_workspace';
};

async function removeLabeledMessages(workspaceId: string, gmailMessageIds: string[]): Promise<number> {
  const unique = [...new Set(gmailMessageIds)].filter(Boolean);
  if (unique.length === 0) return 0;

  const existing = await prisma.emailMessage.findMany({
    where: { workspaceId, gmailMessageId: { in: unique } },
    select: { id: true },
  });
  if (existing.length === 0) return 0;

  await prisma.emailMessageRecipient.deleteMany({
    where: { emailMessageId: { in: existing.map((e) => e.id) } },
  });
  await prisma.emailMessage.deleteMany({
    where: { id: { in: existing.map((e) => e.id) } },
  });
  return existing.length;
}

function isGmailNotFound(err: unknown): boolean {
  return (err as { code?: number })?.code === 404;
}

export async function syncUserGmail(
  userId: string,
  workspaceId?: string,
  options?: SyncUserGmailOptions
): Promise<SyncUserGmailResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { crmLabels: true },
  });

  if (!user?.gmailSyncLabel) {
    return {
      messagesAdded: 0,
      messagesUpdated: 0,
      messagesRemoved: 0,
      messagesLabeled: 0,
      contactsTouched: 0,
      error: 'no_sync_label',
    };
  }

  const crmLabel = user.crmLabels[0];
  if (!crmLabel) {
    return {
      messagesAdded: 0,
      messagesUpdated: 0,
      messagesRemoved: 0,
      messagesLabeled: 0,
      contactsTouched: 0,
      error: 'no_sync_label',
    };
  }

  let wsId = workspaceId;
  if (!wsId) {
    const membership = await prisma.membership.findFirst({ where: { userId } });
    if (!membership) {
      return {
        messagesAdded: 0,
        messagesUpdated: 0,
        messagesRemoved: 0,
        messagesLabeled: 0,
        contactsTouched: 0,
        error: 'no_workspace',
      };
    }
    wsId = membership.workspaceId;
  }

  const labelId = crmLabel.labelId;
  const gmail = await getAuthorizedClient(userId);

  try {
    const labelsRes = await gmail.users.labels.list({ userId: 'me' });
    const label = labelsRes.data.labels?.find((l) => l.id === labelId || l.name === user.gmailSyncLabel);
    if (!label?.id) {
      return {
        messagesAdded: 0,
        messagesUpdated: 0,
        messagesRemoved: 0,
        messagesLabeled: 0,
        contactsTouched: 0,
        error: 'label_not_found',
      };
    }

    const messageIdSet = new Set<string>();
    let removedIds: string[] = [];
    let newHistoryId = user.gmailLastHistoryId ?? undefined;

    if (user.gmailLastHistoryId) {
      const crmHistory = await collectHistoryMessageIds(gmail, user.gmailLastHistoryId, label.id);
      const inboxId = resolveInboxLabelId(labelsRes.data.labels ?? undefined);
      const historyParts = [crmHistory];
      if (inboxId && inboxId !== label.id) {
        historyParts.push(
          await collectHistoryMessageIds(gmail, user.gmailLastHistoryId, inboxId)
        );
      }
      const history = mergeHistoryCollections(...historyParts);
      for (const id of history.messageIds) messageIdSet.add(id);
      removedIds = history.removedMessageIds;
      if (history.historyId) newHistoryId = history.historyId;
    }

    const labeledLimit = options?.labeledMessageLimit ?? 100;
    for (const id of await listLabeledMessageIds(gmail, label.id, labeledLimit)) {
      messageIdSet.add(id);
    }

    const profile = await gmail.users.getProfile({ userId: 'me' });
    if (profile.data.historyId) newHistoryId = profile.data.historyId;

    const messagesRemoved = await removeLabeledMessages(wsId, removedIds);

    const contactsBefore = await prisma.contact.count({ where: { workspaceId: wsId } });

    const importResult = await importGmailMessageIdsForCrm({
      userId,
      workspaceId: wsId,
      userEmail: user.email,
      labelId: label.id,
      messageIds: [...messageIdSet],
      gmail,
    });

    const contactsAfter = await prisma.contact.count({ where: { workspaceId: wsId } });

    if (newHistoryId) {
      await prisma.user.update({
        where: { id: userId },
        data: { gmailLastHistoryId: newHistoryId },
      });
    }

    return {
      messagesAdded: importResult.messagesAdded,
      messagesUpdated: importResult.messagesUpdated,
      messagesRemoved,
      messagesLabeled: importResult.messagesLabeled,
      contactsTouched: Math.max(0, contactsAfter - contactsBefore),
      historyId: newHistoryId,
    };
  } catch (err) {
    if (isGmailNotFound(err)) {
      return {
        messagesAdded: 0,
        messagesUpdated: 0,
        messagesRemoved: 0,
        messagesLabeled: 0,
        contactsTouched: 0,
        error: 'label_not_found',
      };
    }
    throw err;
  }
}
