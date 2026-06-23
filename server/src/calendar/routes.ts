import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma } from '../db.js';
import { requireAuth, type AuthedRequest } from '../auth/middleware.js';
import { eventMatchesContactEmail, resolveContactEmail } from './contactFilter.js';
import { linkContactToCalendarEvent } from './linkContacts.js';
import {
  toCreateCalendarEventBody,
  toUpdateCalendarEventBody,
  validateCreateEventBody,
  validateUpdateEventBody,
} from './types.js';
import { upsertGoogleCalendarEvent } from './upsertGoogle.js';
import { upsertOutlookCalendarEvent } from './upsertOutlook.js';
import {
  assertCalendarWriteScope,
  assertUserCanWriteToCalendar,
  loadWritableEvent,
  resolveUserMailProvider,
  WriteCalendarError,
} from './writeAuth.js';
import {
  cancelGoogleCalendarEvent,
  createGoogleCalendarEvent,
  updateGoogleCalendarEvent,
} from './writeGoogle.js';
import {
  cancelOutlookCalendarEvent,
  createOutlookCalendarEvent,
  updateOutlookCalendarEvent,
} from './writeOutlook.js';

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
  calendarId: string;
  createdFromCrm: boolean;
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
    calendarId: event.calendarId,
    createdFromCrm: event.createdFromCrm,
  };
}

function writeErrorStatus(code: string): number {
  if (code === 'not_found') return 404;
  if (code === 'reauth_required') return 401;
  if (code === 'insufficient_scope' || code === 'calendar_permission_denied') return 403;
  return 400;
}

function handleWriteError(err: unknown, res: import('express').Response): boolean {
  if (err instanceof WriteCalendarError) {
    res.status(writeErrorStatus(err.code)).json({ error: err.code });
    return true;
  }
  if ((err as Error).message === 'reauth_required') {
    res.status(401).json({ error: 'reauth_required' });
    return true;
  }
  return false;
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

calendarRouter.post('/events', async (req: AuthedRequest, res) => {
  const validationError = validateCreateEventBody(req.body);
  if (validationError) {
    res.status(400).json({ error: validationError });
    return;
  }

  try {
    const body = toCreateCalendarEventBody(req.body);
    const { provider, calendarProvider } = await resolveUserMailProvider(req.userId!);
    await assertCalendarWriteScope(req.userId!, provider);
    await assertUserCanWriteToCalendar(req.userId!, calendarProvider, body.calendarId);

    const workspaceId = req.workspaceId!;
    let providerEventId: string | null = null;

    if (provider === 'gmail') {
      const googleEvent = await createGoogleCalendarEvent(req.userId!, body.calendarId, body);
      await upsertGoogleCalendarEvent(workspaceId, googleEvent, body.calendarId, {
        createdFromCrm: true,
      });
      providerEventId = googleEvent.id ?? null;
    } else {
      const outlookEvent = await createOutlookCalendarEvent(req.userId!, body.calendarId, body);
      await upsertOutlookCalendarEvent(workspaceId, outlookEvent, body.calendarId, {
        createdFromCrm: true,
      });
      providerEventId = outlookEvent.id;
    }

    const saved = await prisma.calendarEvent.findFirst({
      where:
        provider === 'gmail'
          ? { workspaceId, calendarId: body.calendarId, googleEventId: providerEventId! }
          : { workspaceId, calendarId: body.calendarId, outlookEventId: providerEventId! },
    });
    if (!saved) {
      res.status(500).json({ error: 'provider_error' });
      return;
    }

    if (body.contactId) {
      await linkContactToCalendarEvent(workspaceId, saved.id, body.contactId);
    }

    res.status(201).json({ event: serializeEvent(saved) });
  } catch (err) {
    if (handleWriteError(err, res)) return;
    throw err;
  }
});

calendarRouter.patch('/events/:id', async (req: AuthedRequest, res) => {
  const validationError = validateUpdateEventBody(req.body);
  if (validationError) {
    res.status(400).json({ error: validationError });
    return;
  }

  try {
    const body = toUpdateCalendarEventBody(req.body);
    const workspaceId = req.workspaceId!;
    const existing = await loadWritableEvent(workspaceId, req.params.id);
    const { provider } = await resolveUserMailProvider(req.userId!);
    await assertCalendarWriteScope(req.userId!, provider);

    const patchExisting = {
      startsAt: existing.startsAt,
      endsAt: existing.endsAt,
      title: existing.title,
      location: existing.location,
    };

    if (provider === 'gmail' && existing.googleEventId) {
      const googleEvent = await updateGoogleCalendarEvent(
        req.userId!,
        existing.calendarId,
        existing.googleEventId,
        body,
        patchExisting
      );
      await upsertGoogleCalendarEvent(workspaceId, googleEvent, existing.calendarId);
    } else if (provider === 'outlook' && existing.outlookEventId) {
      const outlookEvent = await updateOutlookCalendarEvent(
        req.userId!,
        existing.outlookEventId,
        body,
        patchExisting
      );
      await upsertOutlookCalendarEvent(workspaceId, outlookEvent, existing.calendarId);
    } else {
      res.status(400).json({ error: 'no_mail_provider' });
      return;
    }

    const saved = await prisma.calendarEvent.findFirst({
      where: { id: existing.id, workspaceId },
    });
    res.json({ event: serializeEvent(saved!) });
  } catch (err) {
    if (handleWriteError(err, res)) return;
    throw err;
  }
});

calendarRouter.delete('/events/:id', async (req: AuthedRequest, res) => {
  try {
    const workspaceId = req.workspaceId!;
    const existing = await loadWritableEvent(workspaceId, req.params.id);
    const { provider } = await resolveUserMailProvider(req.userId!);
    await assertCalendarWriteScope(req.userId!, provider);

    if (provider === 'gmail' && existing.googleEventId) {
      await cancelGoogleCalendarEvent(
        req.userId!,
        existing.calendarId,
        existing.googleEventId
      );
    } else if (provider === 'outlook' && existing.outlookEventId) {
      await cancelOutlookCalendarEvent(req.userId!, existing.outlookEventId);
    } else {
      res.status(400).json({ error: 'no_mail_provider' });
      return;
    }

    await prisma.calendarEvent.update({
      where: { id: existing.id },
      data: { isCancelled: true, lastSyncedAt: new Date() },
    });

    res.json({ ok: true });
  } catch (err) {
    if (handleWriteError(err, res)) return;
    throw err;
  }
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
