import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth, type AuthedRequest } from '../auth/middleware.js';
import { htmlToPlainText, looksLikeHtml } from '../outlook/body.js';

export const messagesRouter = Router();
messagesRouter.use(requireAuth);

function mapMessageToInboxItem(m: {
  id: string;
  subject: string | null;
  bodyText: string | null;
  bodyHtml: string | null;
  sentAt: Date | null;
  createdAt: Date;
  direction: string;
  gmailThreadId: string | null;
  conversationId: string | null;
  gmailMessageId: string | null;
  rfcMessageId: string | null;
  recipients: {
    role: string;
    contact: { id: string; email: string | null; name: string | null; createdFrom: string };
  }[];
}) {
  const fromRecipient = m.recipients.find((r) => r.role === 'from');
  const toRecipient = m.recipients.find((r) => r.role === 'to');
  const counterparty =
    m.direction === 'sent' ? toRecipient?.contact : fromRecipient?.contact;
  const contact = fromRecipient?.contact;
  let previewSource = m.bodyText ?? '';
  if (previewSource && !m.bodyHtml && looksLikeHtml(previewSource)) {
    previewSource = htmlToPlainText(previewSource);
  }
  const preview = previewSource.slice(0, 200);

  return {
    id: m.id,
    subject: m.subject ?? '(no subject)',
    preview,
    from: contact?.name ?? contact?.email ?? 'Unknown',
    email: contact?.email ?? '',
    company: contact?.name ?? contact?.email?.split('@')[1] ?? '',
    timestamp: m.sentAt?.toISOString() ?? m.createdAt.toISOString(),
    direction: m.direction,
    gmailThreadId: m.gmailThreadId,
    conversationId: m.conversationId,
    gmailMessageId: m.gmailMessageId,
    contactId: contact?.id,
    bodyText: m.bodyText,
    bodyHtml: m.bodyHtml,
    rfcMessageId: m.rfcMessageId,
    contactCreatedFrom: counterparty?.createdFrom ?? null,
  };
}

messagesRouter.get('/thread/:threadId', async (req: AuthedRequest, res) => {
  const threadId = req.params.threadId;
  if (!threadId) {
    res.status(400).json({ error: 'thread_id_required' });
    return;
  }

  const messages = await prisma.emailMessage.findMany({
    where: {
      workspaceId: req.workspaceId!,
      OR: [{ gmailThreadId: threadId }, { conversationId: threadId }],
    },
    include: {
      recipients: { include: { contact: true } },
    },
    orderBy: { sentAt: 'asc' },
  });

  res.json({
    threadId,
    messages: messages.map(mapMessageToInboxItem),
  });
});

messagesRouter.get('/', async (req: AuthedRequest, res) => {
  const search = (req.query.search as string)?.trim() ?? '';
  const limit = Math.min(parseInt(String(req.query.limit ?? '50'), 10) || 50, 100);
  const offset = parseInt(String(req.query.offset ?? '0'), 10) || 0;

  const messages = await prisma.emailMessage.findMany({
    where: {
      workspaceId: req.workspaceId!,
      ...(search
        ? {
            OR: [
              { subject: { contains: search, mode: 'insensitive' } },
              { bodyText: { contains: search, mode: 'insensitive' } },
              {
                recipients: {
                  some: {
                    contact: {
                      OR: [
                        { email: { contains: search, mode: 'insensitive' } },
                        { name: { contains: search, mode: 'insensitive' } },
                      ],
                    },
                  },
                },
              },
            ],
          }
        : {}),
    },
    include: {
      recipients: { include: { contact: true } },
    },
    orderBy: { sentAt: 'desc' },
    take: limit,
    skip: offset,
  });

  const items = messages.map(mapMessageToInboxItem);

  res.json({ messages: items, total: items.length });
});
