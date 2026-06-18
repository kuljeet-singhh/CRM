import { syncUserGmail } from '../../gmail/syncUserGmail.js';

/** Legacy queue handler — delegates to unified sync. */
export async function handleLabelSync(payload: {
  userId: string;
  workspaceId: string;
  labelId: string;
  historyId?: string;
}) {
  const result = await syncUserGmail(payload.userId, payload.workspaceId);
  return { messagesAdded: result.messagesAdded, threadJobs: result.messagesAdded };
}
