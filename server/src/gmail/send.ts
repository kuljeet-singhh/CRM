import { prisma } from '../db.js';
import { getAuthorizedClient } from '../auth/tokens.js';
import { logEmailToCrm } from '../contacts/upsert.js';
import { buildMimeMessage, toBase64Url } from './mime.js';
import { parseAddressList, parseEmailAddress } from './parser.js';
import { extractBody } from './body.js';

export async function sendGmailMessage(params: {
  userId: string;
  workspaceId: string;
  fromEmail: string;
  to: string[];
  cc?: string[];
  subject: string;
  body: string;
  inReplyTo?: string;
  gmailThreadId?: string;
}) {
  const gmail = await getAuthorizedClient(params.userId);
  const user = await prisma.user.findUnique({ where: { id: params.userId } });

  const mime = buildMimeMessage({
    from: params.fromEmail,
    to: params.to,
    cc: params.cc,
    subject: params.subject,
    body: params.body,
    inReplyTo: params.inReplyTo,
    references: params.inReplyTo,
  });

  const sendRes = await gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      raw: toBase64Url(mime),
      threadId: params.gmailThreadId,
    },
  });

  const messageId = sendRes.data.id;
  if (!messageId) throw new Error('send_failed');

  const full = await gmail.users.messages.get({ userId: 'me', id: messageId, format: 'metadata' });
  const rfcId = full.data.payload?.headers?.find((h) => h.name?.toLowerCase() === 'message-id')?.value;

  if (user?.gmailSyncLabel) {
    const labels = await gmail.users.labels.list({ userId: 'me' });
    const label = labels.data.labels?.find((l) => l.name === user.gmailSyncLabel);
    if (label?.id) {
      await gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: { addLabelIds: [label.id] },
      });
    }
  }

  const participants = [
    { email: params.fromEmail, role: 'from' as const },
    ...params.to.map((e) => ({ email: e, role: 'to' as const })),
    ...(params.cc ?? []).map((e) => ({ email: e, role: 'cc' as const })),
  ];

  await logEmailToCrm({
    workspaceId: params.workspaceId,
    gmailMessageId: messageId,
    gmailThreadId: full.data.threadId ?? params.gmailThreadId,
    rfcMessageId: rfcId ?? undefined,
    subject: params.subject,
    bodyText: params.body,
    direction: 'sent',
    sentAt: new Date(),
    participants,
  });

  return { messageId, threadId: full.data.threadId, rfcMessageId: rfcId };
}

export async function processGmailMessageForCrm(params: {
  userId: string;
  workspaceId: string;
  userEmail: string;
  messageId: string;
  labelId?: string;
  /** When true, import even if CRM label is not on this message (e.g. thread expansion). */
  skipLabelCheck?: boolean;
}) {
  const gmail = await getAuthorizedClient(params.userId);
  const msg = await gmail.users.messages.get({
    userId: 'me',
    id: params.messageId,
    format: 'full',
  });

  const headers = msg.data.payload?.headers ?? [];
  const subject = headers.find((h) => h.name?.toLowerCase() === 'subject')?.value ?? '';
  const fromRaw = headers.find((h) => h.name?.toLowerCase() === 'from')?.value ?? '';
  const toRaw = headers.find((h) => h.name?.toLowerCase() === 'to')?.value ?? '';
  const ccRaw = headers.find((h) => h.name?.toLowerCase() === 'cc')?.value ?? '';
  const rfcId = headers.find((h) => h.name?.toLowerCase() === 'message-id')?.value;
  const dateStr = headers.find((h) => h.name?.toLowerCase() === 'date')?.value;

  const from = parseEmailAddress(fromRaw);
  const toList = parseAddressList(toRaw);
  const ccList = parseAddressList(ccRaw);
  const { text, html } = extractBody(msg.data.payload ?? undefined);

  const labelIds = msg.data.labelIds ?? [];
  const direction = labelIds.includes('SENT') ? 'sent' : 'received';

  const participants: { email: string; name?: string; role: 'from' | 'to' | 'cc' }[] = [
    { email: from.email, name: from.name, role: 'from' },
    ...toList.map((p) => ({ ...p, role: 'to' as const })),
    ...ccList.map((p) => ({ ...p, role: 'cc' as const })),
  ];

  if (params.labelId && !params.skipLabelCheck && !labelIds.includes(params.labelId)) {
    return null;
  }

  return logEmailToCrm({
    workspaceId: params.workspaceId,
    gmailMessageId: params.messageId,
    gmailThreadId: msg.data.threadId ?? undefined,
    rfcMessageId: rfcId ?? undefined,
    subject,
    bodyText: text,
    bodyHtml: html,
    direction,
    sentAt: dateStr ? new Date(dateStr) : new Date(parseInt(msg.data.internalDate ?? '0', 10)),
    participants,
  });
}
