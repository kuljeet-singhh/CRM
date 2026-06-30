import { prisma } from '../db.js';
import { publishMessagesChanged } from '../events/messageBus.js';
import { importGmailThreadForCrm } from './import.js';

export type GmailThreadSyncResult = {
  messagesAdded: number;
  messagesUpdated: number;
  messagesLabeled: number;
  error?: 'no_sync_label';
};

export async function syncGmailThreadForUser(
  userId: string,
  workspaceId: string,
  threadId: string
): Promise<GmailThreadSyncResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { crmLabels: true },
  });

  if (!user?.gmailSyncLabel) {
    return { messagesAdded: 0, messagesUpdated: 0, messagesLabeled: 0, error: 'no_sync_label' };
  }

  const crmLabel = user.crmLabels[0];
  if (!crmLabel) {
    return { messagesAdded: 0, messagesUpdated: 0, messagesLabeled: 0, error: 'no_sync_label' };
  }

  const result = await importGmailThreadForCrm({
    userId,
    workspaceId,
    userEmail: user.email,
    threadId,
    labelId: crmLabel.labelId,
  });

  if (
    result.messagesAdded > 0 ||
    result.messagesUpdated > 0 ||
    result.messagesLabeled > 0
  ) {
    await publishMessagesChanged(workspaceId, {
      added: result.messagesAdded,
      updated: result.messagesUpdated,
    });
  }

  return {
    messagesAdded: result.messagesAdded,
    messagesUpdated: result.messagesUpdated,
    messagesLabeled: result.messagesLabeled,
  };
}
