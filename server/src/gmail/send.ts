import type { gmail_v1 } from 'googleapis';
import { getAuthorizedClient } from '../auth/tokens.js';
import { logEmailToCrm } from '../contacts/upsert.js';
import { buildMimeMessage, toBase64Url } from './mime.js';
import { parseAddressList, parseEmailAddress } from './parser.js';
import { extractBody } from './body.js';

function headerValue(
  headers: gmail_v1.Schema$MessagePartHeader[] | undefined,
  name: string
): string {
  return headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? '';
}

export async function processGmailMessagePayload(params: {
  workspaceId: string;
  message: gmail_v1.Schema$Message;
  labelId?: string;
  skipLabelCheck?: boolean;
}) {
  const msg = params.message;
  if (!msg.id) return null;

  const headers = msg.payload?.headers ?? [];
  const subject = headerValue(headers, 'subject');
  const fromRaw = headerValue(headers, 'from');
  const toRaw = headerValue(headers, 'to');
  const ccRaw = headerValue(headers, 'cc');
  const rfcId = headerValue(headers, 'message-id') || undefined;
  const dateStr = headerValue(headers, 'date');

  const from = parseEmailAddress(fromRaw);
  const toList = parseAddressList(toRaw);
  const ccList = parseAddressList(ccRaw);
  const { text, html } = extractBody(msg.payload ?? undefined);

  const labelIds = msg.labelIds ?? [];
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
    gmailMessageId: msg.id,
    gmailThreadId: msg.threadId ?? undefined,
    rfcMessageId: rfcId,
    subject,
    bodyText: text,
    bodyHtml: html,
    direction,
    sentAt: dateStr ? new Date(dateStr) : new Date(parseInt(msg.internalDate ?? '0', 10)),
    participants,
  });
}

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
  crmLabelId?: string | null;
}) {
  const gmail = await getAuthorizedClient(params.userId);

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

  const full = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'metadata',
    metadataHeaders: ['Message-Id'],
  });
  const rfcId = full.data.payload?.headers?.find((h) => h.name?.toLowerCase() === 'message-id')?.value;

  if (params.crmLabelId) {
    await gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: { addLabelIds: [params.crmLabelId] },
    });
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
  skipLabelCheck?: boolean;
  gmail?: gmail_v1.Gmail;
}) {
  const gmail = params.gmail ?? (await getAuthorizedClient(params.userId));
  const msg = await gmail.users.messages.get({
    userId: 'me',
    id: params.messageId,
    format: 'full',
  });

  return processGmailMessagePayload({
    workspaceId: params.workspaceId,
    message: msg.data,
    labelId: params.labelId,
    skipLabelCheck: params.skipLabelCheck,
  });
}
