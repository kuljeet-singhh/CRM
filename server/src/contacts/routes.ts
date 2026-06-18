import { ContactSource, type Contact } from '@prisma/client';
import express, { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth, type AuthedRequest } from '../auth/middleware.js';
import { importLinkedInCsv } from './linkedinImport.js';

export const contactsRouter = Router();
contactsRouter.use(requireAuth);

const CONTACT_SOURCES: ContactSource[] = ['manual', 'logged_email', 'apollo', 'linkedin_csv'];

function mapContactFields(c: Contact) {
  return {
    id: c.id,
    email: c.email,
    name: c.name,
    company: c.company,
    title: c.title,
    linkedinUrl: c.linkedinUrl,
    createdFrom: c.createdFrom,
  };
}

contactsRouter.post(
  '/import/linkedin-csv',
  express.text({ type: ['text/csv', 'text/plain', 'application/vnd.ms-excel', '*/*'], limit: '15mb' }),
  async (req: AuthedRequest, res) => {
    const csv = typeof req.body === 'string' ? req.body.trim() : '';
    if (!csv) {
      res.status(400).json({ error: 'missing_csv' });
      return;
    }

    try {
      const result = await importLinkedInCsv(req.workspaceId!, csv);
      res.json(result);
    } catch (err) {
      if (err instanceof Error && err.message === 'invalid_csv') {
        res.status(400).json({ error: 'invalid_csv' });
        return;
      }
      throw err;
    }
  }
);

contactsRouter.get('/', async (req: AuthedRequest, res) => {
  const search = (req.query.search as string)?.trim() ?? '';
  const createdFromRaw = (req.query.createdFrom as string)?.trim() ?? '';
  const createdFrom = CONTACT_SOURCES.includes(createdFromRaw as ContactSource)
    ? (createdFromRaw as ContactSource)
    : undefined;
  const limit = Math.min(parseInt(String(req.query.limit ?? '50'), 10) || 50, 200);
  const offset = parseInt(String(req.query.offset ?? '0'), 10) || 0;

  const contacts = await prisma.contact.findMany({
    where: {
      workspaceId: req.workspaceId!,
      ...(createdFrom ? { createdFrom } : {}),
      ...(search
        ? {
            OR: [
              { email: { contains: search, mode: 'insensitive' } },
              { name: { contains: search, mode: 'insensitive' } },
              { company: { contains: search, mode: 'insensitive' as const } },
              { title: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    },
    include: {
      _count: { select: { recipients: true } },
      recipients: {
        include: { emailMessage: true },
        orderBy: { emailMessage: { sentAt: 'desc' } },
        take: 1,
      },
    },
    take: limit,
    skip: offset,
  });

  const enriched = contacts.map((c) => ({
    ...mapContactFields(c),
    emailCount: c._count.recipients,
    lastEmailAt: c.recipients[0]?.emailMessage?.sentAt?.toISOString() ?? null,
  }));

  enriched.sort((a, b) => {
    const ta = a.lastEmailAt ? new Date(a.lastEmailAt).getTime() : 0;
    const tb = b.lastEmailAt ? new Date(b.lastEmailAt).getTime() : 0;
    return tb - ta;
  });

  res.json({ contacts: enriched });
});

contactsRouter.get('/:id', async (req: AuthedRequest, res) => {
  const contact = await prisma.contact.findFirst({
    where: { id: req.params.id, workspaceId: req.workspaceId! },
  });
  if (!contact) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  res.json({ contact: mapContactFields(contact) });
});

contactsRouter.get('/:id/emails', async (req: AuthedRequest, res) => {
  const limit = Math.min(parseInt(String(req.query.limit ?? '50'), 10) || 50, 100);
  const offset = parseInt(String(req.query.offset ?? '0'), 10) || 0;

  const messages = await prisma.emailMessage.findMany({
    where: {
      workspaceId: req.workspaceId!,
      recipients: { some: { contactId: req.params.id } },
    },
    include: { recipients: { include: { contact: true } } },
    orderBy: { sentAt: 'desc' },
    take: limit,
    skip: offset,
  });

  res.json({ emails: messages });
});

contactsRouter.get('/:id/threads', async (req: AuthedRequest, res) => {
  const messages = await prisma.emailMessage.findMany({
    where: {
      workspaceId: req.workspaceId!,
      recipients: { some: { contactId: req.params.id } },
    },
    include: { recipients: { include: { contact: true } } },
    orderBy: { sentAt: 'asc' },
  });

  const threadMap = new Map<string, typeof messages>();
  for (const m of messages) {
    const key = m.gmailThreadId ?? m.id;
    const arr = threadMap.get(key) ?? [];
    arr.push(m);
    threadMap.set(key, arr);
  }

  const threads = Array.from(threadMap.entries()).map(([threadId, msgs]) => ({
    threadId,
    messages: msgs.map((m) => ({
      id: m.id,
      subject: m.subject,
      bodyText: m.bodyText,
      bodyHtml: m.bodyHtml,
      direction: m.direction,
      sentAt: m.sentAt?.toISOString(),
      gmailMessageId: m.gmailMessageId,
      gmailThreadId: m.gmailThreadId,
      recipients: m.recipients.map((r) => ({
        role: r.role,
        contact: { id: r.contact.id, email: r.contact.email, name: r.contact.name },
      })),
      attachments: m.attachments,
    })),
  }));

  res.json({ threads });
});
