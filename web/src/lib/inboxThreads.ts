import type { InboxMessage, InboxThread } from '@/types';

export function normalizeSubject(subject: string): string {
  const stripped = subject.replace(/^(re|fwd):\s*/gi, '').trim();
  return stripped.toLowerCase();
}

function buildConversationIdBySubject(messages: InboxMessage[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const m of messages) {
    if (!m.conversationId) continue;
    const normalized = normalizeSubject(m.subject);
    if (normalized && normalized !== '(no subject)') {
      map.set(normalized, m.conversationId);
    }
  }
  return map;
}

export function inboxThreadGroupKey(
  m: InboxMessage,
  conversationIdBySubject?: Map<string, string>
): string {
  if (m.gmailThreadId) return m.gmailThreadId;
  if (m.conversationId) return m.conversationId;
  const normalized = normalizeSubject(m.subject);
  if (normalized && normalized !== '(no subject)') {
    const linked = conversationIdBySubject?.get(normalized);
    if (linked) return linked;
    return `subject:${normalized}`;
  }
  return m.id;
}

export function groupMessagesIntoThreads(messages: InboxMessage[]): InboxThread[] {
  const conversationIdBySubject = buildConversationIdBySubject(messages);
  const map = new Map<string, InboxMessage[]>();

  for (const m of messages) {
    const key = inboxThreadGroupKey(m, conversationIdBySubject);
    const arr = map.get(key) ?? [];
    arr.push(m);
    map.set(key, arr);
  }

  return Array.from(map.entries())
    .map(([threadKey, msgs]) => {
      const sorted = [...msgs].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      const withConversation = sorted.find((m) => m.conversationId);
      const withGmailThread = sorted.find((m) => m.gmailThreadId);
      return {
        threadKey,
        gmailThreadId: withGmailThread?.gmailThreadId ?? sorted[0]?.gmailThreadId ?? null,
        conversationId: withConversation?.conversationId ?? sorted[0]?.conversationId ?? null,
        latest: sorted[0]!,
        messageCount: sorted.length,
      };
    })
    .sort(
      (a, b) =>
        new Date(b.latest.timestamp).getTime() - new Date(a.latest.timestamp).getTime()
    );
}
