import { prisma } from '../db.js';
import { getAuthorizedClient } from '../auth/tokens.js';
import {
  collectHistoryMessageIds,
  importGmailMessageIdsForCrm,
  listLabeledMessageIds,
} from './import.js';

export type SyncUserGmailResult = {
  messagesAdded: number;
  messagesRemoved: number;
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

export async function syncUserGmail(userId: string, workspaceId?: string): Promise<SyncUserGmailResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { crmLabels: true },
  });

  if (!user?.gmailSyncLabel) {
    return { messagesAdded: 0, messagesRemoved: 0, contactsTouched: 0, error: 'no_sync_label' };
  }

  const crmLabel = user.crmLabels[0];
  if (!crmLabel) {
    return { messagesAdded: 0, messagesRemoved: 0, contactsTouched: 0, error: 'no_sync_label' };
  }

  let wsId = workspaceId;
  if (!wsId) {
    const membership = await prisma.membership.findFirst({ where: { userId } });
    if (!membership) {
      return { messagesAdded: 0, messagesRemoved: 0, contactsTouched: 0, error: 'no_workspace' };
    }
    wsId = membership.workspaceId;
  }

  const labelId = crmLabel.labelId;
  const gmail = await getAuthorizedClient(userId);

  const labelsRes = await gmail.users.labels.list({ userId: 'me' });
  const label = labelsRes.data.labels?.find((l) => l.id === labelId || l.name === user.gmailSyncLabel);
  if (!label?.id) {
    return { messagesAdded: 0, messagesRemoved: 0, contactsTouched: 0, error: 'label_not_found' };
  }

  const messageIdSet = new Set<string>();
  let removedIds: string[] = [];
  let newHistoryId = user.gmailLastHistoryId ?? undefined;
  let useFallbackList = !user.gmailLastHistoryId;

  if (user.gmailLastHistoryId) {
    const history = await collectHistoryMessageIds(gmail, user.gmailLastHistoryId, label.id);
    for (const id of history.messageIds) messageIdSet.add(id);
    removedIds = history.removedMessageIds;
    if (history.historyId) newHistoryId = history.historyId;
    if (history.historyNotFound) useFallbackList = true;
  }

  if (useFallbackList) {
    for (const id of await listLabeledMessageIds(gmail, label.id, 100)) {
      messageIdSet.add(id);
    }
  }

  const profile = await gmail.users.getProfile({ userId: 'me' });
  if (profile.data.historyId) newHistoryId = profile.data.historyId;

  const messagesRemoved = await removeLabeledMessages(wsId, removedIds);

  const contactsBefore = await prisma.contact.count({ where: { workspaceId: wsId } });

  const messagesAdded = await importGmailMessageIdsForCrm({
    userId,
    workspaceId: wsId,
    userEmail: user.email,
    labelId: label.id,
    messageIds: [...messageIdSet],
  });

  const contactsAfter = await prisma.contact.count({ where: { workspaceId: wsId } });

  if (newHistoryId) {
    await prisma.user.update({
      where: { id: userId },
      data: { gmailLastHistoryId: newHistoryId },
    });
  }

  return {
    messagesAdded,
    messagesRemoved,
    contactsTouched: Math.max(0, contactsAfter - contactsBefore),
    historyId: newHistoryId,
  };
}
