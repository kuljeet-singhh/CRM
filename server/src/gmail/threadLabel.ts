import type { gmail_v1 } from 'googleapis';

/** Apply CRM label to every message in a Gmail thread that lacks it. */
export async function applyCrmLabelToThreadMessages(
  gmail: gmail_v1.Gmail,
  threadId: string,
  crmLabelId: string
): Promise<number> {
  const thread = await gmail.users.threads.get({
    userId: 'me',
    id: threadId,
    format: 'minimal',
  });

  let labeled = 0;
  for (const m of thread.data.messages ?? []) {
    if (!m.id) continue;
    if (m.labelIds?.includes(crmLabelId)) continue;
    await gmail.users.messages.modify({
      userId: 'me',
      id: m.id,
      requestBody: { addLabelIds: [crmLabelId] },
    });
    labeled++;
  }
  return labeled;
}
