import type { gmail_v1 } from 'googleapis';
import { prisma } from '../db.js';
import { getAuthorizedClient } from '../auth/tokens.js';
import { processGmailMessageForCrm } from './send.js';
import { applyCrmLabelToThreadMessages } from './threadLabel.js';

export type ImportThreadResult = {
  messagesAdded: number;
  messagesUpdated: number;
  messagesLabeled: number;
};

export async function listLabeledMessageIds(
  gmail: gmail_v1.Gmail,
  labelId: string,
  maxResults = 100
): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;
  do {
    const list = await gmail.users.messages.list({
      userId: 'me',
      labelIds: [labelId],
      maxResults: Math.min(maxResults - ids.length, 100),
      pageToken,
    });
    for (const m of list.data.messages ?? []) {
      if (m.id) ids.push(m.id);
    }
    pageToken = list.data.nextPageToken ?? undefined;
  } while (pageToken && ids.length < maxResults);
  return ids;
}

export async function collectHistoryMessageIds(
  gmail: gmail_v1.Gmail,
  startHistoryId: string,
  labelId: string
): Promise<{ messageIds: string[]; removedMessageIds: string[]; historyId?: string; historyNotFound?: boolean }> {
  const messageIds: string[] = [];
  const removedMessageIds: string[] = [];
  let historyId: string | undefined;
  try {
    const history = await gmail.users.history.list({
      userId: 'me',
      startHistoryId,
      historyTypes: ['messageAdded', 'labelAdded', 'labelRemoved'],
      labelId,
    });
    historyId = history.data.historyId ?? undefined;
    for (const h of history.data.history ?? []) {
      for (const added of h.messagesAdded ?? []) {
        if (added.message?.id) messageIds.push(added.message.id);
      }
      for (const labeled of h.labelsAdded ?? []) {
        if (labeled.message?.id && labeled.labelIds?.includes(labelId)) {
          messageIds.push(labeled.message.id);
        }
      }
      for (const unlabeled of h.labelsRemoved ?? []) {
        if (unlabeled.message?.id && unlabeled.labelIds?.includes(labelId)) {
          removedMessageIds.push(unlabeled.message.id);
        }
      }
    }
  } catch (err: unknown) {
    if ((err as { code?: number })?.code === 404) {
      return { messageIds, removedMessageIds, historyNotFound: true };
    }
    throw err;
  }
  return { messageIds, removedMessageIds, historyId };
}

/** Import all messages in a Gmail thread when any message has the CRM label. */
export async function importGmailThreadForCrm(params: {
  userId: string;
  workspaceId: string;
  userEmail: string;
  threadId: string;
  labelId: string;
}): Promise<ImportThreadResult> {
  const gmail = await getAuthorizedClient(params.userId);
  const thread = await gmail.users.threads.get({
    userId: 'me',
    id: params.threadId,
    format: 'minimal',
  });

  const messages = thread.data.messages ?? [];
  const threadHasCrmLabel = messages.some((m) => m.labelIds?.includes(params.labelId));
  if (!threadHasCrmLabel) {
    return { messagesAdded: 0, messagesUpdated: 0, messagesLabeled: 0 };
  }

  let messagesAdded = 0;
  let messagesUpdated = 0;
  for (const m of messages) {
    if (!m.id) continue;
    const before = await prisma.emailMessage.findUnique({
      where: {
        workspaceId_gmailMessageId: {
          workspaceId: params.workspaceId,
          gmailMessageId: m.id,
        },
      },
    });
    const result = await processGmailMessageForCrm({
      userId: params.userId,
      workspaceId: params.workspaceId,
      userEmail: params.userEmail,
      messageId: m.id,
      skipLabelCheck: true,
    });
    if (result && !before) messagesAdded++;
    else if (result && before) messagesUpdated++;
  }

  const messagesLabeled = await applyCrmLabelToThreadMessages(
    gmail,
    params.threadId,
    params.labelId
  );

  return { messagesAdded, messagesUpdated, messagesLabeled };
}

export async function importGmailMessageIdsForCrm(params: {
  userId: string;
  workspaceId: string;
  userEmail: string;
  labelId: string;
  messageIds: string[];
}): Promise<ImportThreadResult> {
  const gmail = await getAuthorizedClient(params.userId);
  const threadsDone = new Set<string>();
  let messagesAdded = 0;
  let messagesUpdated = 0;
  let messagesLabeled = 0;

  for (const messageId of [...new Set(params.messageIds)]) {
    const meta = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'minimal',
    });
    const threadId = meta.data.threadId;

    if (threadId) {
      if (threadsDone.has(threadId)) continue;
      threadsDone.add(threadId);
      const threadResult = await importGmailThreadForCrm({
        userId: params.userId,
        workspaceId: params.workspaceId,
        userEmail: params.userEmail,
        threadId,
        labelId: params.labelId,
      });
      messagesAdded += threadResult.messagesAdded;
      messagesUpdated += threadResult.messagesUpdated;
      messagesLabeled += threadResult.messagesLabeled;
      continue;
    }

    const before = await prisma.emailMessage.findUnique({
      where: {
        workspaceId_gmailMessageId: {
          workspaceId: params.workspaceId,
          gmailMessageId: messageId,
        },
      },
    });
    const labelIds = meta.data.labelIds ?? [];
    const hasLabel = labelIds.includes(params.labelId);
    const result = await processGmailMessageForCrm({
      userId: params.userId,
      workspaceId: params.workspaceId,
      userEmail: params.userEmail,
      messageId,
      labelId: hasLabel ? undefined : params.labelId,
      skipLabelCheck: hasLabel,
    });
    if (result && !before) messagesAdded++;
    else if (result && before) messagesUpdated++;
  }

  return { messagesAdded, messagesUpdated, messagesLabeled };
}
