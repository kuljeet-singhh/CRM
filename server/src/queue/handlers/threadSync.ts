import { prisma } from '../../db.js';
import { getAuthorizedClient } from '../../auth/tokens.js';
import { importGmailThreadForCrm } from '../../gmail/import.js';
import { processGmailMessageForCrm } from '../../gmail/send.js';

export async function handleThreadSync(payload: {
  userId: string;
  workspaceId: string;
  messageId: string;
  labelId?: string;
}) {
  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user) throw new Error('user_not_found');

  const gmail = await getAuthorizedClient(payload.userId);
  const meta = await gmail.users.messages.get({
    userId: 'me',
    id: payload.messageId,
    format: 'minimal',
  });

  const threadId = meta.data.threadId;
  const labelId = payload.labelId;

  if (threadId && labelId) {
    return importGmailThreadForCrm({
      userId: payload.userId,
      workspaceId: payload.workspaceId,
      userEmail: user.email,
      threadId,
      labelId,
    });
  }

  await processGmailMessageForCrm({
    userId: payload.userId,
    workspaceId: payload.workspaceId,
    userEmail: user.email,
    messageId: payload.messageId,
    labelId,
  });
  return 1;
}
