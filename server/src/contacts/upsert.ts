import type { Contact, ContactSource, EmailDirection, Prisma, RecipientRole } from '@prisma/client';
import { prisma } from '../db.js';
import type { LinkedInCsvRow } from './linkedinCsv.js';
import { normalizeLinkedInUrl } from './linkedinCsv.js';

const OUTLOOK_ORPHAN_MERGE_WINDOW_MS = 15 * 60 * 1000;

export async function findOutlookOrphanMessage(params: {
  workspaceId: string;
  subject?: string;
  direction: EmailDirection;
  sentAt?: Date;
}) {
  if (!params.subject || !params.sentAt) return null;

  const windowStart = new Date(params.sentAt.getTime() - OUTLOOK_ORPHAN_MERGE_WINDOW_MS);
  const windowEnd = new Date(params.sentAt.getTime() + OUTLOOK_ORPHAN_MERGE_WINDOW_MS);

  return prisma.emailMessage.findFirst({
    where: {
      workspaceId: params.workspaceId,
      outlookMessageId: null,
      direction: params.direction,
      subject: { equals: params.subject, mode: 'insensitive' },
      sentAt: { gte: windowStart, lte: windowEnd },
    },
    orderBy: { sentAt: 'desc' },
  });
}

async function deleteOutlookOrphanIfDuplicate(
  workspaceId: string,
  orphanId: string,
  keepId: string
) {
  if (orphanId === keepId) return;
  await prisma.emailMessageRecipient.deleteMany({ where: { emailMessageId: orphanId } });
  await prisma.emailMessage.delete({ where: { id: orphanId } });
}

export async function upsertContact(
  workspaceId: string,
  email: string,
  name?: string | null,
  createdFrom: ContactSource = 'logged_email'
) {
  const result = await upsertContactFromApollo(workspaceId, email, name ?? undefined, createdFrom);
  return result.contact;
}

export async function upsertContactFromApollo(
  workspaceId: string,
  email: string,
  name?: string,
  createdFrom: ContactSource = 'apollo'
): Promise<{ contact: Awaited<ReturnType<typeof prisma.contact.upsert>>; created: boolean }> {
  const normalized = email.toLowerCase().trim();
  const existing = await prisma.contact.findUnique({
    where: { workspaceId_email: { workspaceId, email: normalized } },
  });

  if (!existing) {
    const contact = await prisma.contact.create({
      data: {
        workspaceId,
        email: normalized,
        name: name ?? null,
        createdFrom,
      },
    });
    return { contact, created: true };
  }

  const updates: { name?: string } = {};
  if (name && !existing.name) {
    updates.name = name;
  }

  if (Object.keys(updates).length === 0) {
    return { contact: existing, created: false };
  }

  const contact = await prisma.contact.update({
    where: { id: existing.id },
    data: updates,
  });
  return { contact, created: false };
}

type LinkedInUpsertResult =
  | { skipped: 'no_identifier' | 'invalid_url' }
  | { skipped?: undefined; contact: Contact; created: boolean; updated: boolean };

function backfillContactFields(
  existing: Contact,
  data: {
    name?: string | null;
    email?: string | null;
    company?: string | null;
    title?: string | null;
    linkedinUrl?: string | null;
  }
): Prisma.ContactUpdateInput {
  const updates: Prisma.ContactUpdateInput = {};
  if (data.name && !existing.name) updates.name = data.name;
  if (data.email && !existing.email) updates.email = data.email;
  if (data.company && !existing.company) updates.company = data.company;
  if (data.title && !existing.title) updates.title = data.title;
  if (data.linkedinUrl && !existing.linkedinUrl) updates.linkedinUrl = data.linkedinUrl;
  return updates;
}

export async function upsertContactFromLinkedInCsv(
  workspaceId: string,
  row: LinkedInCsvRow
): Promise<LinkedInUpsertResult> {
  const email = row.email?.toLowerCase().trim() || null;
  const linkedinUrl = row.linkedinUrl ? normalizeLinkedInUrl(row.linkedinUrl) : null;

  if (!email && !linkedinUrl) {
    return { skipped: 'no_identifier' };
  }

  if (row.linkedinUrlRaw && !linkedinUrl) {
    return { skipped: 'invalid_url' };
  }

  let existing: Contact | null = null;
  if (email) {
    existing = await prisma.contact.findUnique({
      where: { workspaceId_email: { workspaceId, email } },
    });
  }
  if (!existing && linkedinUrl) {
    existing = await prisma.contact.findUnique({
      where: { workspaceId_linkedinUrl: { workspaceId, linkedinUrl } },
    });
  }

  const payload = {
    name: row.name || null,
    email,
    company: row.company,
    title: row.title,
    linkedinUrl,
  };

  if (!existing) {
    const contact = await prisma.contact.create({
      data: {
        workspaceId,
        email: payload.email,
        name: payload.name,
        company: payload.company,
        title: payload.title,
        linkedinUrl: payload.linkedinUrl,
        createdFrom: 'linkedin_csv',
      },
    });
    return { contact, created: true, updated: false };
  }

  const updates = backfillContactFields(existing, payload);
  if (Object.keys(updates).length === 0) {
    return { contact: existing, created: false, updated: false };
  }

  const contact = await prisma.contact.update({
    where: { id: existing.id },
    data: updates,
  });
  return { contact, created: false, updated: true };
}

type OcrUpsertResult =
  | { skipped: 'no_identifier' | 'invalid_url' }
  | { skipped?: undefined; contact: Contact; created: boolean; updated: boolean };

export async function upsertContactFromOcr(
  workspaceId: string,
  data: {
    name?: string | null;
    email?: string | null;
    company?: string | null;
    title?: string | null;
    linkedinUrl?: string | null;
  }
): Promise<OcrUpsertResult> {
  const email = data.email?.toLowerCase().trim() || null;
  const linkedinUrl = data.linkedinUrl ? normalizeLinkedInUrl(data.linkedinUrl) : null;

  if (!email && !linkedinUrl) {
    return { skipped: 'no_identifier' };
  }

  if (data.linkedinUrl?.trim() && !linkedinUrl) {
    return { skipped: 'invalid_url' };
  }

  let existing: Contact | null = null;
  if (email) {
    existing = await prisma.contact.findUnique({
      where: { workspaceId_email: { workspaceId, email } },
    });
  }
  if (!existing && linkedinUrl) {
    existing = await prisma.contact.findUnique({
      where: { workspaceId_linkedinUrl: { workspaceId, linkedinUrl } },
    });
  }

  const payload = {
    name: data.name || null,
    email,
    company: data.company || null,
    title: data.title || null,
    linkedinUrl,
  };

  if (!existing) {
    const contact = await prisma.contact.create({
      data: {
        workspaceId,
        email: payload.email,
        name: payload.name,
        company: payload.company,
        title: payload.title,
        linkedinUrl: payload.linkedinUrl,
        createdFrom: 'ocr_card',
      },
    });
    return { contact, created: true, updated: false };
  }

  const updates = backfillContactFields(existing, payload);
  if (Object.keys(updates).length === 0) {
    return { contact: existing, created: false, updated: false };
  }

  const contact = await prisma.contact.update({
    where: { id: existing.id },
    data: updates,
  });
  return { contact, created: false, updated: true };
}

export async function logEmailToCrm(params: {
  workspaceId: string;
  gmailMessageId?: string;
  gmailThreadId?: string;
  conversationId?: string;
  outlookMessageId?: string;
  rfcMessageId?: string;
  subject?: string;
  bodyText?: string;
  bodyHtml?: string;
  direction: EmailDirection;
  sentAt?: Date;
  participants: { email: string; name?: string; role: RecipientRole }[];
}) {
  const { workspaceId, participants, ...msgData } = params;

  if (msgData.gmailMessageId) {
    const existing = await prisma.emailMessage.findUnique({
      where: {
        workspaceId_gmailMessageId: { workspaceId, gmailMessageId: msgData.gmailMessageId },
      },
    });
    if (existing) return existing;
  }
  if (msgData.outlookMessageId) {
    const existing = await prisma.emailMessage.findFirst({
      where: { workspaceId, outlookMessageId: msgData.outlookMessageId },
    });
    if (existing) {
      const orphan = await findOutlookOrphanMessage({
        workspaceId,
        subject: msgData.subject,
        direction: msgData.direction,
        sentAt: msgData.sentAt,
      });
      if (orphan) {
        await deleteOutlookOrphanIfDuplicate(workspaceId, orphan.id, existing.id);
      }
      return prisma.emailMessage.update({
        where: { id: existing.id },
        data: {
          subject: msgData.subject,
          bodyText: msgData.bodyText,
          bodyHtml: msgData.bodyHtml,
          conversationId: msgData.conversationId,
          sentAt: msgData.sentAt,
          direction: msgData.direction,
        },
        include: { recipients: { include: { contact: true } } },
      });
    }

    const orphan = await findOutlookOrphanMessage({
      workspaceId,
      subject: msgData.subject,
      direction: msgData.direction,
      sentAt: msgData.sentAt,
    });
    if (orphan) {
      return prisma.emailMessage.update({
        where: { id: orphan.id },
        data: {
          outlookMessageId: msgData.outlookMessageId,
          subject: msgData.subject,
          bodyText: msgData.bodyText,
          bodyHtml: msgData.bodyHtml,
          conversationId: msgData.conversationId,
          sentAt: msgData.sentAt,
          direction: msgData.direction,
        },
        include: { recipients: { include: { contact: true } } },
      });
    }
  }

  const contacts = await Promise.all(
    participants.map((p) => upsertContact(workspaceId, p.email, p.name))
  );

  const message = await prisma.emailMessage.create({
    data: {
      workspaceId,
      ...msgData,
      recipients: {
        create: participants.map((p, i) => ({
          contactId: contacts[i]!.id,
          role: p.role,
        })),
      },
    },
    include: { recipients: { include: { contact: true } } },
  });

  return message;
}
