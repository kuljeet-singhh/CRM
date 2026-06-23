import { describe, expect, it, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { signAccessToken } from '../auth/jwt.js';

const mocks = vi.hoisted(() => ({
  createGoogleCalendarEvent: vi.fn(),
  updateGoogleCalendarEvent: vi.fn(),
  cancelGoogleCalendarEvent: vi.fn(),
  createOutlookCalendarEvent: vi.fn(),
  updateOutlookCalendarEvent: vi.fn(),
  cancelOutlookCalendarEvent: vi.fn(),
  upsertGoogleCalendarEvent: vi.fn(),
  upsertOutlookCalendarEvent: vi.fn(),
  resolveUserMailProvider: vi.fn(),
  assertCalendarWriteScope: vi.fn(),
  assertUserCanWriteToCalendar: vi.fn(),
  loadWritableEvent: vi.fn(),
  linkContactToCalendarEvent: vi.fn(),
}));

vi.mock('./writeGoogle.js', () => ({
  createGoogleCalendarEvent: mocks.createGoogleCalendarEvent,
  updateGoogleCalendarEvent: mocks.updateGoogleCalendarEvent,
  cancelGoogleCalendarEvent: mocks.cancelGoogleCalendarEvent,
}));
vi.mock('./writeOutlook.js', () => ({
  createOutlookCalendarEvent: mocks.createOutlookCalendarEvent,
  updateOutlookCalendarEvent: mocks.updateOutlookCalendarEvent,
  cancelOutlookCalendarEvent: mocks.cancelOutlookCalendarEvent,
}));
vi.mock('./upsertGoogle.js', () => ({
  upsertGoogleCalendarEvent: mocks.upsertGoogleCalendarEvent,
}));
vi.mock('./upsertOutlook.js', () => ({
  upsertOutlookCalendarEvent: mocks.upsertOutlookCalendarEvent,
}));
vi.mock('./writeAuth.js', async (importOriginal) => {
  const mod = await importOriginal<typeof import('./writeAuth.js')>();
  return {
    ...mod,
    resolveUserMailProvider: mocks.resolveUserMailProvider,
    assertCalendarWriteScope: mocks.assertCalendarWriteScope,
    assertUserCanWriteToCalendar: mocks.assertUserCanWriteToCalendar,
    loadWritableEvent: mocks.loadWritableEvent,
  };
});
vi.mock('./linkContacts.js', () => ({
  linkContactToCalendarEvent: mocks.linkContactToCalendarEvent,
  linkCalendarEventContacts: vi.fn(),
}));

vi.mock('../db.js', () => ({
  prisma: {
    membership: { findFirst: vi.fn() },
    calendarEvent: { findFirst: vi.fn(), update: vi.fn() },
  },
}));

vi.mock('../env.js', () => ({
  env: {
    webOrigin: 'http://localhost:5173',
    jwtAccessSecret: 'test-access-secret-test-access!!',
    jwtRefreshSecret: 'test-refresh-secret-test-refresh',
    jwtAccessTtl: '15m',
    jwtRefreshTtl: '30d',
    isProd: false,
    encryptionKey: Buffer.alloc(32).toString('base64'),
    sessionSecret: 'test-secret',
    databaseUrl: 'postgresql://localhost/test',
    googleClientId: 'test',
    googleClientSecret: 'test',
    googleRedirectUri: 'http://localhost:3000/auth/google/callback',
    googleScopes: [],
    googleCalendarWriteScope: 'https://www.googleapis.com/auth/calendar.events',
    outlookCalendarWriteScope: 'Calendars.ReadWrite',
    microsoftClientId: '',
    microsoftClientSecret: '',
    microsoftRedirectUri: '',
    microsoftTenantId: 'common',
    microsoftScopes: [],
    outlookWebhookUrl: '',
    outlookWebhookClientState: '',
    cronSecret: '',
    gmailPubsubTopic: '',
    googleWebhookAudience: '',
    syncWorkerPollMs: 2000,
    syncWorkerBatchSize: 5,
    port: 3000,
    calendarSyncPastDays: 90,
    calendarSyncFutureDays: 365,
  },
  isMicrosoftConfigured: () => false,
  isOutlookPushEnabled: () => false,
}));

import { calendarRouter } from './routes.js';
import { prisma } from '../db.js';
import { WriteCalendarError } from './writeAuth.js';

const userId = 'user-1';
const workspaceId = 'ws-1';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/calendar', calendarRouter);
  return app;
}

function authHeader() {
  return { Authorization: `Bearer ${signAccessToken(userId)}` };
}

describe('calendar write routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.membership.findFirst).mockResolvedValue({
      id: 'm1',
      userId,
      workspaceId,
      role: 'owner',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);
    mocks.resolveUserMailProvider.mockResolvedValue({
      provider: 'gmail',
      calendarProvider: 'gmail',
    });
    mocks.assertCalendarWriteScope.mockResolvedValue(undefined);
    mocks.assertUserCanWriteToCalendar.mockResolvedValue(undefined);
  });

  it('POST /events creates event', async () => {
    mocks.createGoogleCalendarEvent.mockResolvedValue({ id: 'g-ev-1', summary: 'Call' });
    mocks.upsertGoogleCalendarEvent.mockResolvedValue('imported');
    vi.mocked(prisma.calendarEvent.findFirst).mockResolvedValue({
      id: 'ev-1',
      workspaceId,
      provider: 'gmail',
      calendarId: 'primary',
      googleEventId: 'g-ev-1',
      outlookEventId: null,
      icalUid: null,
      title: 'Call',
      description: null,
      location: null,
      startsAt: new Date('2026-06-25T15:00:00.000Z'),
      endsAt: new Date('2026-06-25T15:30:00.000Z'),
      allDay: false,
      timezone: 'UTC',
      status: 'confirmed',
      isCancelled: false,
      organizerEmail: null,
      attendees: [],
      htmlLink: null,
      webLink: null,
      createdFromCrm: true,
      lastSyncedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    const res = await request(createApp())
      .post('/api/calendar/events')
      .set(authHeader())
      .send({
        calendarId: 'primary',
        title: 'Call',
        startsAt: '2026-06-25T15:00:00.000Z',
        endsAt: '2026-06-25T15:30:00.000Z',
        attendeeEmails: ['jane@example.com'],
      });

    expect(res.status).toBe(201);
    expect(res.body.event.id).toBe('ev-1');
    expect(res.body.event.createdFromCrm).toBe(true);
    expect(mocks.upsertGoogleCalendarEvent).toHaveBeenCalledWith(
      workspaceId,
      { id: 'g-ev-1', summary: 'Call' },
      'primary',
      { createdFromCrm: true }
    );
  });

  it('POST /events returns 403 on insufficient_scope', async () => {
    mocks.assertCalendarWriteScope.mockRejectedValue(new WriteCalendarError('insufficient_scope'));

    const res = await request(createApp())
      .post('/api/calendar/events')
      .set(authHeader())
      .send({
        calendarId: 'primary',
        title: 'Call',
        startsAt: '2026-06-25T15:00:00.000Z',
        endsAt: '2026-06-25T15:30:00.000Z',
        attendeeEmails: [],
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('insufficient_scope');
  });

  it('PATCH /events/:id updates event', async () => {
    const existing = {
      id: 'ev-1',
      workspaceId,
      calendarId: 'primary',
      googleEventId: 'g-ev-1',
      outlookEventId: null,
      startsAt: new Date('2026-06-25T15:00:00.000Z'),
      endsAt: new Date('2026-06-25T15:30:00.000Z'),
      title: 'Call',
      location: null,
      provider: 'gmail',
    };
    mocks.loadWritableEvent.mockResolvedValue(existing);
    mocks.updateGoogleCalendarEvent.mockResolvedValue({ id: 'g-ev-1', summary: 'Updated' });
    mocks.upsertGoogleCalendarEvent.mockResolvedValue('updated');
    vi.mocked(prisma.calendarEvent.findFirst).mockResolvedValue({
      ...existing,
      description: null,
      allDay: false,
      timezone: 'UTC',
      status: 'confirmed',
      isCancelled: false,
      organizerEmail: null,
      attendees: [],
      htmlLink: null,
      webLink: null,
      createdFromCrm: true,
      icalUid: null,
      lastSyncedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      title: 'Updated',
    } as never);

    const res = await request(createApp())
      .patch('/api/calendar/events/ev-1')
      .set(authHeader())
      .send({ title: 'Updated' });

    expect(res.status).toBe(200);
    expect(res.body.event.title).toBe('Updated');
  });

  it('DELETE /events/:id cancels event', async () => {
    mocks.loadWritableEvent.mockResolvedValue({
      id: 'ev-1',
      workspaceId,
      calendarId: 'primary',
      googleEventId: 'g-ev-1',
      outlookEventId: null,
    });
    vi.mocked(prisma.calendarEvent.update).mockResolvedValue({} as never);

    const res = await request(createApp())
      .delete('/api/calendar/events/ev-1')
      .set(authHeader());

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(mocks.cancelGoogleCalendarEvent).toHaveBeenCalledWith(userId, 'primary', 'g-ev-1');
    expect(prisma.calendarEvent.update).toHaveBeenCalled();
  });

  it('PATCH returns 404 for missing event', async () => {
    mocks.loadWritableEvent.mockRejectedValue(new WriteCalendarError('not_found'));

    const res = await request(createApp())
      .patch('/api/calendar/events/missing')
      .set(authHeader())
      .send({ title: 'X' });

    expect(res.status).toBe(404);
  });

  it('POST /events returns 400 on invalid_body', async () => {
    const res = await request(createApp())
      .post('/api/calendar/events')
      .set(authHeader())
      .send({
        calendarId: 'primary',
        title: '',
        startsAt: '2026-06-25T15:00:00.000Z',
        endsAt: '2026-06-25T15:30:00.000Z',
        attendeeEmails: [],
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_body');
  });

  it('POST /events returns 403 calendar_permission_denied', async () => {
    mocks.assertUserCanWriteToCalendar.mockRejectedValue(
      new WriteCalendarError('calendar_permission_denied')
    );

    const res = await request(createApp())
      .post('/api/calendar/events')
      .set(authHeader())
      .send({
        calendarId: 'primary',
        title: 'Call',
        startsAt: '2026-06-25T15:00:00.000Z',
        endsAt: '2026-06-25T15:30:00.000Z',
        attendeeEmails: [],
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('calendar_permission_denied');
  });

  it('DELETE /events/:id returns 403 on insufficient_scope', async () => {
    mocks.loadWritableEvent.mockResolvedValue({
      id: 'ev-1',
      workspaceId,
      calendarId: 'primary',
      googleEventId: 'g-ev-1',
      outlookEventId: null,
    });
    mocks.cancelGoogleCalendarEvent.mockRejectedValue(new WriteCalendarError('insufficient_scope'));

    const res = await request(createApp())
      .delete('/api/calendar/events/ev-1')
      .set(authHeader());

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('insufficient_scope');
  });
});
