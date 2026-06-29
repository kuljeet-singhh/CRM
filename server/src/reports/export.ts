import type { ReportSummary, ExportType } from './types.js';
import type { EmailReport } from './types.js';

function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function summaryToCsv(summary: ReportSummary): string {
  const lines: string[] = [
    'metric,value,change_pct',
    `total_contacts,${summary.kpis.totalContacts.value},`,
    `new_contacts,${summary.kpis.newContacts.value},${summary.kpis.newContacts.changePct ?? ''}`,
    `emails_sent,${summary.kpis.emailsSent.value},${summary.kpis.emailsSent.changePct ?? ''}`,
    `emails_received,${summary.kpis.emailsReceived.value},${summary.kpis.emailsReceived.changePct ?? ''}`,
    `meetings_scheduled,${summary.kpis.meetingsScheduled.value},${summary.kpis.meetingsScheduled.changePct ?? ''}`,
    `crm_meetings_created,${summary.kpis.crmMeetingsCreated.value},${summary.kpis.crmMeetingsCreated.changePct ?? ''}`,
    '',
    'period_from,period_to',
    `${summary.period.from},${summary.period.to}`,
    '',
    'source,count',
    ...summary.series.contactsBySource.map(
      (r) => `${escapeCsv(r.source)},${r.count}`
    ),
  ];
  return lines.join('\n');
}

export function contactsToCsv(
  rows: {
    name: string | null;
    email: string | null;
    company: string | null;
    title: string | null;
    createdFrom: string;
    createdAt: Date;
    emailCount: number;
  }[]
): string {
  const header =
    'name,email,company,title,source,created_at,email_count';
  const body = rows.map((r) =>
    [
      escapeCsv(r.name ?? ''),
      escapeCsv(r.email ?? ''),
      escapeCsv(r.company ?? ''),
      escapeCsv(r.title ?? ''),
      escapeCsv(r.createdFrom),
      r.createdAt.toISOString(),
      r.emailCount,
    ].join(',')
  );
  return [header, ...body].join('\n');
}

export function emailsToCsv(report: EmailReport): string {
  const header = 'date,sent,received';
  const body = report.activity.map(
    (r) => `${r.date},${r.sent},${r.received}`
  );
  return [header, ...body].join('\n');
}

export function exportFilename(type: ExportType, format: string, from: string, to: string): string {
  return `flycrm-${type}-${from}_${to}.${format}`;
}
