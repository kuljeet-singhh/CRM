import { toIsoDate, percentChange, type ParsedDateRange } from './dateRange.js';
import {
  contactsBySource,
  contactGrowthSeries,
  countMeetings,
  emailActivitySeries,
  exportContactsList,
  fetchKpiCounts,
  topEngagedContacts,
} from './queries.js';
import type {
  CalendarReport,
  ContactsReport,
  EmailReport,
  EngagementReport,
  ReportGranularity,
  ReportSummary,
} from './types.js';

function kpi(value: number, previous: number) {
  return { value, changePct: percentChange(value, previous) };
}

export async function buildReportSummary(
  workspaceId: string,
  range: ParsedDateRange
): Promise<ReportSummary> {
  const { from, to, previousFrom, previousTo } = range;

  const [counts, growth, emailActivity, bySource] = await Promise.all([
    fetchKpiCounts(workspaceId, range),
    contactGrowthSeries(workspaceId, from, to, 'day'),
    emailActivitySeries(workspaceId, from, to, 'day'),
    contactsBySource(workspaceId),
  ]);

  return {
    period: {
      from: toIsoDate(from),
      to: toIsoDate(to),
      previousFrom: toIsoDate(previousFrom),
      previousTo: toIsoDate(previousTo),
    },
    kpis: {
      totalContacts: { value: counts.totalContacts, changePct: null },
      newContacts: kpi(counts.newContacts, counts.prevNewContacts),
      emailsSent: kpi(counts.emailsSent, counts.prevEmailsSent),
      emailsReceived: kpi(counts.emailsReceived, counts.prevEmailsReceived),
      meetingsScheduled: kpi(counts.meetingsScheduled, counts.prevMeetingsScheduled),
      crmMeetingsCreated: kpi(counts.crmMeetingsCreated, counts.prevCrmMeetingsCreated),
    },
    series: {
      contactGrowth: growth,
      emailActivity,
      contactsBySource: bySource,
    },
  };
}

export async function buildContactsReport(
  workspaceId: string,
  from: Date,
  to: Date,
  granularity: ReportGranularity
): Promise<ContactsReport> {
  const [growth, bySource, totalInPeriod] = await Promise.all([
    contactGrowthSeries(workspaceId, from, to, granularity),
    contactsBySource(workspaceId),
    fetchKpiCounts(workspaceId, {
      from,
      to,
      previousFrom: from,
      previousTo: from,
    }).then((c) => c.newContacts),
  ]);

  return {
    period: { from: toIsoDate(from), to: toIsoDate(to) },
    granularity,
    growth,
    bySource,
    totalInPeriod,
  };
}

export async function buildEmailReport(
  workspaceId: string,
  from: Date,
  to: Date,
  granularity: ReportGranularity
): Promise<EmailReport> {
  const activity = await emailActivitySeries(workspaceId, from, to, granularity);
  const totals = activity.reduce(
    (acc, row) => ({
      sent: acc.sent + row.sent,
      received: acc.received + row.received,
    }),
    { sent: 0, received: 0 }
  );

  return {
    period: { from: toIsoDate(from), to: toIsoDate(to) },
    granularity,
    activity,
    totals,
  };
}

export async function buildEngagementReport(
  workspaceId: string,
  from: Date,
  to: Date,
  limit: number
): Promise<EngagementReport> {
  const contacts = await topEngagedContacts(workspaceId, from, to, limit);
  return {
    period: { from: toIsoDate(from), to: toIsoDate(to) },
    contacts: contacts.map((c) => ({
      contactId: c.contactId,
      name: c.name,
      email: c.email,
      company: c.company,
      emailCount: c.emailCount,
      lastEmailAt: c.lastEmailAt?.toISOString() ?? null,
    })),
  };
}

export async function buildCalendarReport(
  workspaceId: string,
  from: Date,
  to: Date
): Promise<CalendarReport> {
  const now = new Date();
  const [meetingsScheduled, crmCreated, syncedFromProvider, upcomingMeetings] =
    await Promise.all([
      countMeetings(workspaceId, from, to),
      countMeetings(workspaceId, from, to, { createdFromCrm: true }),
      countMeetings(workspaceId, from, to, { createdFromCrm: false }),
      countMeetings(workspaceId, from, to, { onlyUpcoming: true }),
    ]);

  const meetingsHeld = await countMeetings(
    workspaceId,
    from,
    now < to ? now : to,
    undefined
  );

  return {
    period: { from: toIsoDate(from), to: toIsoDate(to) },
    meetingsScheduled,
    meetingsHeld,
    upcomingMeetings,
    crmCreated,
    syncedFromProvider,
  };
}

export { exportContactsList };
