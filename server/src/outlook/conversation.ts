import { prisma } from '../db.js';
import { findOutlookOrphanMessage, logEmailToCrm } from '../contacts/upsert.js';
import { parseOutlookBody } from './body.js';
import {
  logGraphFailure,
  OUTLOOK_MESSAGE_SELECT,
  readGraphErrorBody,
} from './graph.js';

export type OutlookGraphMessage = {
  id: string;
  subject?: string;
  bodyPreview?: string;
  body?: { contentType?: string; content?: string };
  conversationId?: string;
  from?: { emailAddress?: { address?: string; name?: string } };
  toRecipients?: { emailAddress?: { address?: string; name?: string } }[];
  sentDateTime?: string;
  receivedDateTime?: string;
};

export type UpsertOutcome = 'added' | 'updated' | 'skipped';

export function outlookMessageDirection(
  fromEmail: string,
  userEmail: string
): 'sent' | 'received' {
  return fromEmail.toLowerCase().trim() === userEmail.toLowerCase().trim() ? 'sent' : 'received';
}

function escapeODataString(value: string): string {
  return value.replace(/'/g, "''");
}

export async function upsertOutlookGraphMessage(params: {
  workspaceId: string;
  userEmail: string;
  msg: OutlookGraphMessage;
}): Promise<UpsertOutcome> {
  const fromEmail = params.msg.from?.emailAddress?.address;
  if (!fromEmail || !params.msg.id) return 'skipped';

  const before = await prisma.emailMessage.findFirst({
    where: { workspaceId: params.workspaceId, outlookMessageId: params.msg.id },
  });

  const sentAt = new Date(
    params.msg.sentDateTime ?? params.msg.receivedDateTime ?? Date.now()
  );
  const direction = outlookMessageDirection(fromEmail, params.userEmail);

  const orphanBefore =
    !before &&
    (await findOutlookOrphanMessage({
      workspaceId: params.workspaceId,
      subject: params.msg.subject,
      direction,
      sentAt,
    }));

  const toList = (params.msg.toRecipients ?? [])
    .map((r) => r.emailAddress?.address)
    .filter(Boolean) as string[];

  const { bodyText, bodyHtml } = parseOutlookBody(params.msg.body, params.msg.bodyPreview);

  await logEmailToCrm({
    workspaceId: params.workspaceId,
    outlookMessageId: params.msg.id,
    conversationId: params.msg.conversationId,
    subject: params.msg.subject,
    bodyText,
    bodyHtml,
    direction,
    sentAt,
    participants: [
      { email: fromEmail, name: params.msg.from?.emailAddress?.name, role: 'from' },
      ...toList.map((e) => ({ email: e, role: 'to' as const })),
    ],
  });

  if (before || orphanBefore) return 'updated';
  return 'added';
}

function tallyOutcome(
  counts: { messagesAdded: number; messagesUpdated: number },
  outcome: UpsertOutcome
) {
  if (outcome === 'added') counts.messagesAdded++;
  else if (outcome === 'updated') counts.messagesUpdated++;
}

export async function listFolderMessages(
  token: string,
  folderId: string,
  maxMessages = 200
): Promise<OutlookGraphMessage[]> {
  const results: OutlookGraphMessage[] = [];
  let url: string | null =
    `https://graph.microsoft.com/v1.0/me/mailFolders/${folderId}/messages?$top=50&$select=${OUTLOOK_MESSAGE_SELECT}`;

  while (url && results.length < maxMessages) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      logGraphFailure('sync/folder-list', res.status, await readGraphErrorBody(res));
      throw new Error('sync_failed');
    }
    const data = (await res.json()) as {
      value: OutlookGraphMessage[];
      '@odata.nextLink'?: string;
    };
    results.push(...(data.value ?? []));
    url = data['@odata.nextLink'] ?? null;
  }

  return results.slice(0, maxMessages);
}

export async function upsertFolderMessages(params: {
  workspaceId: string;
  userEmail: string;
  messages: OutlookGraphMessage[];
}): Promise<{
  conversationIds: Set<string>;
  messagesAdded: number;
  messagesUpdated: number;
}> {
  const conversationIds = new Set<string>();
  const counts = { messagesAdded: 0, messagesUpdated: 0 };

  for (const msg of params.messages) {
    if (msg.conversationId) conversationIds.add(msg.conversationId);
    tallyOutcome(
      counts,
      await upsertOutlookGraphMessage({
        workspaceId: params.workspaceId,
        userEmail: params.userEmail,
        msg,
      })
    );
  }

  return { conversationIds, ...counts };
}

function conversationMessageTime(m: OutlookGraphMessage): number {
  const raw = m.sentDateTime ?? m.receivedDateTime;
  return raw ? new Date(raw).getTime() : 0;
}

function sortConversationMessages(messages: OutlookGraphMessage[]): OutlookGraphMessage[] {
  return [...messages].sort((a, b) => conversationMessageTime(a) - conversationMessageTime(b));
}

type ConversationDateField = 'receivedDateTime' | 'sentDateTime';

function conversationDateFilterUrl(
  messagesBaseUrl: string,
  conversationId: string,
  dateField: ConversationDateField
): string {
  const escaped = escapeODataString(conversationId);
  const url = new URL(messagesBaseUrl);
  url.searchParams.set(
    '$filter',
    `${dateField} ge 1900-01-01T00:00:00Z and conversationId eq '${escaped}'`
  );
  url.searchParams.set('$orderby', `${dateField} desc`);
  url.searchParams.set('$select', OUTLOOK_MESSAGE_SELECT);
  url.searchParams.set('$top', '50');
  return url.toString();
}

async function fetchByConversationDateFilter(
  token: string,
  messagesBaseUrl: string,
  dateField: ConversationDateField,
  conversationId: string,
  logTag: string
): Promise<OutlookGraphMessage[]> {
  const url = conversationDateFilterUrl(messagesBaseUrl, conversationId, dateField);
  return paginateGraphMessages(token, url, logTag);
}

function mergeConversationMessages(
  ...sources: OutlookGraphMessage[][]
): OutlookGraphMessage[] {
  const byId = new Map<string, OutlookGraphMessage>();
  for (const source of sources) {
    for (const msg of source) {
      if (msg.id) byId.set(msg.id, msg);
    }
  }
  return sortConversationMessages([...byId.values()]);
}

async function paginateGraphMessages(
  token: string,
  startUrl: string,
  logTag: string
): Promise<OutlookGraphMessage[]> {
  const results: OutlookGraphMessage[] = [];
  let url: string | null = startUrl;

  while (url && results.length < 100) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      logGraphFailure(logTag, res.status, await readGraphErrorBody(res));
      break;
    }
    const data = (await res.json()) as {
      value: OutlookGraphMessage[];
      '@odata.nextLink'?: string;
    };
    results.push(...(data.value ?? []));
    url = data['@odata.nextLink'] ?? null;
  }

  return results;
}

export async function fetchConversationMessages(
  token: string,
  conversationId: string,
  folderCache: OutlookGraphMessage[],
  folderId?: string
): Promise<OutlookGraphMessage[]> {
  const fromCache = folderCache.filter((m) => m.conversationId === conversationId);
  const globalBase = 'https://graph.microsoft.com/v1.0/me/messages';
  const sources: OutlookGraphMessage[][] = [fromCache];

  if (folderId) {
    const folderBase = `https://graph.microsoft.com/v1.0/me/mailFolders/${folderId}/messages`;
    sources.push(
      await fetchByConversationDateFilter(
        token,
        folderBase,
        'receivedDateTime',
        conversationId,
        'sync/conversation-folder-received'
      ),
      await fetchByConversationDateFilter(
        token,
        folderBase,
        'sentDateTime',
        conversationId,
        'sync/conversation-folder-sent'
      )
    );
  }

  sources.push(
    await fetchByConversationDateFilter(
      token,
      globalBase,
      'receivedDateTime',
      conversationId,
      'sync/conversation-received'
    ),
    await fetchByConversationDateFilter(
      token,
      globalBase,
      'sentDateTime',
      conversationId,
      'sync/conversation-sent'
    )
  );

  const merged = mergeConversationMessages(...sources);

  if (merged.length === 0) {
    console.log('[outlook/sync/conversation] no_messages', conversationId);
  } else {
    console.log(
      `[outlook/sync/conversation] merged ${merged.length} messages for`,
      conversationId
    );
  }

  return merged;
}

export async function importOutlookConversationForCrm(params: {
  token: string;
  workspaceId: string;
  userEmail: string;
  conversationId: string;
  folderId: string;
  folderCache: OutlookGraphMessage[];
}): Promise<{ messagesAdded: number; messagesUpdated: number }> {
  const messages = await fetchConversationMessages(
    params.token,
    params.conversationId,
    params.folderCache,
    params.folderId
  );

  const counts = { messagesAdded: 0, messagesUpdated: 0 };
  const seen = new Set<string>();

  for (const msg of messages) {
    if (!msg.id || seen.has(msg.id)) continue;
    seen.add(msg.id);
    tallyOutcome(
      counts,
      await upsertOutlookGraphMessage({
        workspaceId: params.workspaceId,
        userEmail: params.userEmail,
        msg,
      })
    );
  }

  return counts;
}
