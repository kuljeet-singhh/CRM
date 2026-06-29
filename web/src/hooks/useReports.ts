import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, ApiError, restoreSession } from '@/lib/api';
import { getAccessToken } from '@/lib/authStore';
import { reportQueryString } from '@/lib/reports';
import type {
  CalendarReport,
  ContactsReport,
  EmailReport,
  EngagementReport,
  ExportFormat,
  ExportType,
  ReportDateRange,
  ReportGranularity,
  ReportSummary,
} from '@/types/reports';

function reportsKey(
  segment: string,
  range: Pick<ReportDateRange, 'from' | 'to'>,
  extra?: string
) {
  return ['reports', segment, range.from, range.to, extra ?? ''] as const;
}

export function useReportSummary(range: ReportDateRange) {
  const qs = reportQueryString(range);
  return useQuery({
    queryKey: reportsKey('summary', range),
    queryFn: () => api<ReportSummary>(`/api/reports/summary?${qs}`),
    staleTime: 60_000,
  });
}

export function useReportContacts(range: ReportDateRange, granularity: ReportGranularity = 'day') {
  const qs = `${reportQueryString(range)}&granularity=${granularity}`;
  return useQuery({
    queryKey: reportsKey('contacts', range, granularity),
    queryFn: () => api<ContactsReport>(`/api/reports/contacts?${qs}`),
    staleTime: 60_000,
  });
}

export function useReportEmail(range: ReportDateRange, granularity: ReportGranularity = 'day') {
  const qs = `${reportQueryString(range)}&granularity=${granularity}`;
  return useQuery({
    queryKey: reportsKey('email', range, granularity),
    queryFn: () => api<EmailReport>(`/api/reports/email?${qs}`),
    staleTime: 60_000,
  });
}

export function useReportEngagement(range: ReportDateRange, limit = 10) {
  const qs = `${reportQueryString(range)}&limit=${limit}`;
  return useQuery({
    queryKey: reportsKey('engagement', range, String(limit)),
    queryFn: () => api<EngagementReport>(`/api/reports/engagement?${qs}`),
    staleTime: 60_000,
  });
}

export function useReportCalendar(range: ReportDateRange) {
  const qs = reportQueryString(range);
  return useQuery({
    queryKey: reportsKey('calendar', range),
    queryFn: () => api<CalendarReport>(`/api/reports/calendar?${qs}`),
    staleTime: 60_000,
  });
}

export async function downloadReportExport(
  range: Pick<ReportDateRange, 'from' | 'to'>,
  type: ExportType,
  format: ExportFormat
): Promise<void> {
  await restoreSession();
  const token = getAccessToken();
  const params = new URLSearchParams({
    from: range.from,
    to: range.to,
    type,
    format,
  });
  const res = await fetch(`/api/reports/export?${params}`, {
    credentials: 'include',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { error?: string };
      message = body.error ?? message;
    } catch {
      /* ignore */
    }
    throw new ApiError(message, undefined, res.status);
  }

  const disposition = res.headers.get('Content-Disposition') ?? '';
  const match = disposition.match(/filename="([^"]+)"/);
  const filename = match?.[1] ?? `flycrm-${type}-${range.from}_${range.to}.${format}`;

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function useReportsDateRangeFromFilter(filter: string | null): ReportDateRange {
  return useMemo(() => {
    const to = new Date();
    const from = new Date();
    to.setUTCHours(23, 59, 59, 999);
    from.setUTCHours(0, 0, 0, 0);

    if (filter === 'close-rate' || filter === 'revenue') {
      from.setUTCDate(from.getUTCDate() - 29);
      return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10), preset: '30d' };
    }

    from.setUTCDate(from.getUTCDate() - 29);
    return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10), preset: '30d' };
  }, [filter]);
}
