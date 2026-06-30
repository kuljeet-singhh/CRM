import { describe, expect, it } from 'vitest';
import { summaryToCsv, contactsToCsv, emailsToCsv } from './export.js';
import type { ReportSummary } from './types.js';

const sampleSummary: ReportSummary = {
  period: {
    from: '2026-06-01',
    to: '2026-06-30',
    previousFrom: '2026-05-02',
    previousTo: '2026-05-31',
  },
  kpis: {
    totalContacts: { value: 100, changePct: null },
    newContacts: { value: 10, changePct: 25 },
    emailsSent: { value: 50, changePct: -10 },
    emailsReceived: { value: 40, changePct: 0 },
    meetingsScheduled: { value: 5, changePct: null },
    crmMeetingsCreated: { value: 2, changePct: 100 },
  },
  series: {
    contactGrowth: [],
    emailActivity: [],
    contactsBySource: [
      { source: 'apollo', count: 30 },
      { source: 'manual', count: 70 },
    ],
  },
};

describe('summaryToCsv', () => {
  it('includes header and KPI rows', () => {
    const csv = summaryToCsv(sampleSummary);
    expect(csv).toContain('metric,value,change_pct');
    expect(csv).toContain('new_contacts,10,25');
    expect(csv).toContain('apollo,30');
  });
});

describe('contactsToCsv', () => {
  it('escapes commas in names', () => {
    const csv = contactsToCsv([
      {
        name: 'Acme, Inc',
        email: 'a@b.com',
        company: null,
        title: null,
        createdFrom: 'manual',
        createdAt: new Date('2026-06-01'),
        emailCount: 3,
      },
    ]);
    expect(csv).toContain('"Acme, Inc"');
    expect(csv.split('\n')).toHaveLength(2);
  });
});

describe('emailsToCsv', () => {
  it('formats activity rows', () => {
    const csv = emailsToCsv({
      period: { from: '2026-06-01', to: '2026-06-02' },
      granularity: 'day',
      activity: [{ date: '2026-06-01', sent: 2, received: 3 }],
      totals: { sent: 2, received: 3 },
    });
    expect(csv).toBe('date,sent,received\n2026-06-01,2,3');
  });
});
