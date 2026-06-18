import { getOutlookAccessToken } from '../auth/tokens.js';
import { logEmailToCrm } from '../contacts/upsert.js';
import {
  upsertOutlookGraphMessage,
  type OutlookGraphMessage,
} from './conversation.js';
import { OUTLOOK_MESSAGE_SELECT } from './graph.js';

async function fetchRecentSentMessage(
  token: string,
  subject: string
): Promise<OutlookGraphMessage | null> {
  const url = new URL('https://graph.microsoft.com/v1.0/me/mailFolders/sentitems/messages');
  url.searchParams.set('$select', OUTLOOK_MESSAGE_SELECT);
  url.searchParams.set('$top', '10');
  url.searchParams.set('$orderby', 'sentDateTime desc');

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;

  const data = (await res.json()) as { value: OutlookGraphMessage[] };
  const normalized = subject.trim().toLowerCase();
  const sentWithinLastHour = (m: OutlookGraphMessage) => {
    const t = m.sentDateTime ? new Date(m.sentDateTime).getTime() : 0;
    return Date.now() - t < 60 * 60 * 1000;
  };

  return (
    data.value?.find(
      (m) =>
        sentWithinLastHour(m) &&
        (m.subject?.trim().toLowerCase() === normalized ||
          m.subject?.trim() === subject.trim())
    ) ?? null
  );
}

export async function sendOutlookMessage(params: {
  userId: string;
  workspaceId: string;
  fromEmail: string;
  to: string[];
  cc?: string[];
  subject: string;
  body: string;
}) {
  const token = await getOutlookAccessToken(params.userId);

  const message = {
    subject: params.subject,
    body: { contentType: 'Text', content: params.body },
    toRecipients: params.to.map((address) => ({ emailAddress: { address } })),
    ccRecipients: (params.cc ?? []).map((address) => ({ emailAddress: { address } })),
  };

  const res = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message, saveToSentItems: true }),
  });

  if (!res.ok) throw new Error('send_failed');

  const sentMsg = await fetchRecentSentMessage(token, params.subject);
  if (sentMsg?.id) {
    await upsertOutlookGraphMessage({
      workspaceId: params.workspaceId,
      userEmail: params.fromEmail,
      msg: {
        ...sentMsg,
        subject: sentMsg.subject ?? params.subject,
        body: sentMsg.body ?? { contentType: 'Text', content: params.body },
        from: sentMsg.from ?? {
          emailAddress: { address: params.fromEmail },
        },
      },
    });
    return { ok: true };
  }

  await logEmailToCrm({
    workspaceId: params.workspaceId,
    subject: params.subject,
    bodyText: params.body,
    direction: 'sent',
    sentAt: new Date(),
    participants: [
      { email: params.fromEmail, role: 'from' },
      ...params.to.map((e) => ({ email: e, role: 'to' as const })),
      ...(params.cc ?? []).map((e) => ({ email: e, role: 'cc' as const })),
    ],
  });

  return { ok: true };
}
