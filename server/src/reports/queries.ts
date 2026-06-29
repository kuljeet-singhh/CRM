import type { ContactSource } from '@prisma/client';
import { prisma } from '../db.js';
import {
  bucketKey,
  fillDateBuckets,
  type ParsedDateRange,
} from './dateRange.js';
import type { ReportGranularity } from './types.js';

const EXPORT_CONTACT_LIMIT = 10_000;
const EXPORT_EMAIL_LIMIT = 10_000;

export async function countContacts(workspaceId: string, from?: Date, to?: Date): Promise<number> {
  return prisma.contact.count({
    where: {
      workspaceId,
      ...(from && to
        ? { createdAt: { gte: from, lte: to } }
        : {}),
    },
  });
}

export async function countTotalContacts(workspaceId: string): Promise<number> {
  return prisma.contact.count({ where: { workspaceId } });
}

export async function countEmails(
  workspaceId: string,
  direction: 'sent' | 'received',
  from: Date,
  to: Date
): Promise<number> {
  return prisma.emailMessage.count({
    where: {
      workspaceId,
      direction,
      sentAt: { gte: from, lte: to },
    },
  });
}

export async function countMeetings(
  workspaceId: string,
  from: Date,
  to: Date,
  options?: { createdFromCrm?: boolean; onlyUpcoming?: boolean }
): Promise<number> {
  const now = new Date();
  return prisma.calendarEvent.count({
    where: {
      workspaceId,
      isCancelled: false,
      startsAt: options?.onlyUpcoming
        ? { gte: now > from ? now : from, lte: to }
        : { gte: from, lte: to },
      ...(options?.createdFromCrm !== undefined
        ? { createdFromCrm: options.createdFromCrm }
        : {}),
    },
  });
}

export async function contactsBySource(workspaceId: string): Promise<
  { source: ContactSource; count: number }[]
> {
  const rows = await prisma.contact.groupBy({
    by: ['createdFrom'],
    where: { workspaceId },
    _count: { _all: true },
  });
  return rows.map((r) => ({ source: r.createdFrom, count: r._count._all }));
}

export async function contactGrowthSeries(
  workspaceId: string,
  from: Date,
  to: Date,
  granularity: ReportGranularity
): Promise<{ date: string; count: number }[]> {
  const contacts = await prisma.contact.findMany({
    where: { workspaceId, createdAt: { gte: from, lte: to } },
    select: { createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  const buckets = fillDateBuckets(from, to, granularity);
  const counts = new Map(buckets.map((k) => [k, 0]));

  for (const c of contacts) {
    const key = bucketKey(c.createdAt, granularity);
    if (counts.has(key)) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  return buckets.map((date) => ({ date, count: counts.get(date) ?? 0 }));
}

export async function emailActivitySeries(
  workspaceId: string,
  from: Date,
  to: Date,
  granularity: ReportGranularity
): Promise<{ date: string; sent: number; received: number }[]> {
  const messages = await prisma.emailMessage.findMany({
    where: {
      workspaceId,
      sentAt: { gte: from, lte: to },
    },
    select: { sentAt: true, direction: true },
    take: EXPORT_EMAIL_LIMIT,
    orderBy: { sentAt: 'asc' },
  });

  const buckets = fillDateBuckets(from, to, granularity);
  const sent = new Map(buckets.map((k) => [k, 0]));
  const received = new Map(buckets.map((k) => [k, 0]));

  for (const m of messages) {
    if (!m.sentAt) continue;
    const key = bucketKey(m.sentAt, granularity);
    if (!sent.has(key)) continue;
    if (m.direction === 'sent') {
      sent.set(key, (sent.get(key) ?? 0) + 1);
    } else {
      received.set(key, (received.get(key) ?? 0) + 1);
    }
  }

  return buckets.map((date) => ({
    date,
    sent: sent.get(date) ?? 0,
    received: received.get(date) ?? 0,
  }));
}

export async function topEngagedContacts(
  workspaceId: string,
  from: Date,
  to: Date,
  limit: number
): Promise<
  {
    contactId: string;
    name: string | null;
    email: string | null;
    company: string | null;
    emailCount: number;
    lastEmailAt: Date | null;
  }[]
> {
  const recipients = await prisma.emailMessageRecipient.findMany({
    where: {
      contact: { workspaceId },
      emailMessage: { sentAt: { gte: from, lte: to } },
    },
    select: {
      contactId: true,
      contact: { select: { name: true, email: true, company: true } },
      emailMessage: { select: { sentAt: true } },
    },
    take: 50_000,
  });

  const byContact = new Map<
    string,
    {
      name: string | null;
      email: string | null;
      company: string | null;
      emailCount: number;
      lastEmailAt: Date | null;
    }
  >();

  for (const r of recipients) {
    const existing = byContact.get(r.contactId);
    const sentAt = r.emailMessage.sentAt;
    if (!existing) {
      byContact.set(r.contactId, {
        name: r.contact.name,
        email: r.contact.email,
        company: r.contact.company,
        emailCount: 1,
        lastEmailAt: sentAt,
      });
    } else {
      existing.emailCount += 1;
      if (sentAt && (!existing.lastEmailAt || sentAt > existing.lastEmailAt)) {
        existing.lastEmailAt = sentAt;
      }
    }
  }

  return [...byContact.entries()]
    .map(([contactId, data]) => ({ contactId, ...data }))
    .sort((a, b) => b.emailCount - a.emailCount)
    .slice(0, limit);
}

export async function exportContactsList(
  workspaceId: string,
  from: Date,
  to: Date
): Promise<
  {
    id: string;
    name: string | null;
    email: string | null;
    company: string | null;
    title: string | null;
    createdFrom: ContactSource;
    createdAt: Date;
    emailCount: number;
  }[]
> {
  const contacts = await prisma.contact.findMany({
    where: { workspaceId, createdAt: { gte: from, lte: to } },
    select: {
      id: true,
      name: true,
      email: true,
      company: true,
      title: true,
      createdFrom: true,
      createdAt: true,
      _count: { select: { recipients: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: EXPORT_CONTACT_LIMIT,
  });

  return contacts.map((c) => ({
    id: c.id,
    name: c.name,
    email: c.email,
    company: c.company,
    title: c.title,
    createdFrom: c.createdFrom,
    createdAt: c.createdAt,
    emailCount: c._count.recipients,
  }));
}

export async function fetchKpiCounts(
  workspaceId: string,
  range: ParsedDateRange
): Promise<{
  totalContacts: number;
  newContacts: number;
  prevNewContacts: number;
  emailsSent: number;
  emailsReceived: number;
  prevEmailsSent: number;
  prevEmailsReceived: number;
  meetingsScheduled: number;
  crmMeetingsCreated: number;
  prevMeetingsScheduled: number;
  prevCrmMeetingsCreated: number;
}> {
  const { from, to, previousFrom, previousTo } = range;

  const [
    totalContacts,
    newContacts,
    prevNewContacts,
    emailsSent,
    emailsReceived,
    prevEmailsSent,
    prevEmailsReceived,
    meetingsScheduled,
    crmMeetingsCreated,
    prevMeetingsScheduled,
    prevCrmMeetingsCreated,
  ] = await Promise.all([
    countTotalContacts(workspaceId),
    countContacts(workspaceId, from, to),
    countContacts(workspaceId, previousFrom, previousTo),
    countEmails(workspaceId, 'sent', from, to),
    countEmails(workspaceId, 'received', from, to),
    countEmails(workspaceId, 'sent', previousFrom, previousTo),
    countEmails(workspaceId, 'received', previousFrom, previousTo),
    countMeetings(workspaceId, from, to),
    countMeetings(workspaceId, from, to, { createdFromCrm: true }),
    countMeetings(workspaceId, previousFrom, previousTo),
    countMeetings(workspaceId, previousFrom, previousTo, { createdFromCrm: true }),
  ]);

  return {
    totalContacts,
    newContacts,
    prevNewContacts,
    emailsSent,
    emailsReceived,
    prevEmailsSent,
    prevEmailsReceived,
    meetingsScheduled,
    crmMeetingsCreated,
    prevMeetingsScheduled,
    prevCrmMeetingsCreated,
  };
}
