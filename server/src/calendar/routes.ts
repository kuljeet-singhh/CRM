import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma } from '../db.js';
import { requireAuth, type AuthedRequest } from '../auth/middleware.js';
import { eventMatchesContactEmail, resolveContactEmail } from './contactFilter.js';

export const calendarRouter = Router();
calendarRouter.use(requireAuth);

function serializeEvent(event: {
  id: string;
  title: string | null;
  description: string | null;
  location: string | null;
  startsAt: Date;
  endsAt: Date;
  allDay: boolean;
  timezone: string | null;
  status: string | null;
  isCancelled: boolean;
  organizerEmail: string | null;
  attendees: unknown;
  htmlLink: string | null;
  webLink: string | null;
  provider: string;
}) {
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    location: event.location,
    startsAt: event.startsAt.toISOString(),
    endsAt: event.endsAt.toISOString(),
    allDay: event.allDay,
    timezone: event.timezone,
    status: event.status,
    isCancelled: event.isCancelled,
    organizerEmail: event.organizerEmail,
    attendees: event.attendees ?? [],
    htmlLink: event.htmlLink,
    webLink: event.webLink,
    provider: event.provider,
  };
}

calendarRouter.get('/events', async (req: AuthedRequest, res) => {
  const workspaceId = req.workspaceId!;
  const contactId = req.query.contactId as string | undefined;
  const from = req.query.from as string | undefined;
  const to = req.query.to as string | undefined;
  const limit = Math.min(parseInt(String(req.query.limit ?? '50'), 10) || 50, 200);
  const includeCancelled = req.query.includeCancelled === 'true';

  const where: Prisma.CalendarEventWhereInput = { workspaceId };

  if (!includeCancelled) {
    where.isCancelled = false;
  }

  if (from || to) {
    const startsAt: Prisma.DateTimeFilter = {};
    if (from) startsAt.gte = new Date(from);
    if (to) startsAt.lte = new Date(to);
    where.startsAt = startsAt;
  }

  let events = await prisma.calendarEvent.findMany({
    where,
    orderBy: { startsAt: 'asc' },
    take: contactId ? 500 : limit,
  });

  if (contactId) {
    const contactEmail = await resolveContactEmail(workspaceId, contactId);
    if (!contactEmail) {
      res.json({ events: [] });
      return;
    }
    events = events
      .filter((e) => eventMatchesContactEmail(e.organizerEmail, e.attendees, contactEmail))
      .slice(0, limit);
  }

  res.json({ events: events.map(serializeEvent) });
});

calendarRouter.get('/events/:id', async (req: AuthedRequest, res) => {
  const event = await prisma.calendarEvent.findFirst({
    where: { id: req.params.id, workspaceId: req.workspaceId! },
  });
  if (!event) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  res.json({ event: serializeEvent(event) });
});
