import type { ContactSource } from '@/types';

export interface ReportPeriod {
  from: string;
  to: string;
  previousFrom: string;
  previousTo: string;
}

export interface KpiValue {
  value: number;
  changePct: number | null;
}

export interface ReportSummary {
  period: ReportPeriod;
  kpis: {
    totalContacts: KpiValue;
    newContacts: KpiValue;
    emailsSent: KpiValue;
    emailsReceived: KpiValue;
    meetingsScheduled: KpiValue;
    crmMeetingsCreated: KpiValue;
  };
  series: {
    contactGrowth: { date: string; count: number }[];
    emailActivity: { date: string; sent: number; received: number }[];
    contactsBySource: { source: ContactSource; count: number }[];
  };
}

export type ReportGranularity = 'day' | 'week' | 'month';

export interface ContactsReport {
  period: { from: string; to: string };
  granularity: ReportGranularity;
  growth: { date: string; count: number }[];
  bySource: { source: ContactSource; count: number }[];
  totalInPeriod: number;
}

export interface EmailReport {
  period: { from: string; to: string };
  granularity: ReportGranularity;
  activity: { date: string; sent: number; received: number }[];
  totals: { sent: number; received: number };
}

export interface EngagedContact {
  contactId: string;
  name: string | null;
  email: string | null;
  company: string | null;
  emailCount: number;
  lastEmailAt: string | null;
}

export interface EngagementReport {
  period: { from: string; to: string };
  contacts: EngagedContact[];
}

export interface CalendarReport {
  period: { from: string; to: string };
  meetingsScheduled: number;
  meetingsHeld: number;
  upcomingMeetings: number;
  crmCreated: number;
  syncedFromProvider: number;
}

export type ReportDatePreset = '7d' | '30d' | '90d' | 'quarter';

export type ExportType = 'summary' | 'contacts' | 'emails';
export type ExportFormat = 'csv' | 'json';

export interface ReportDateRange {
  from: string;
  to: string;
  preset: ReportDatePreset;
}
