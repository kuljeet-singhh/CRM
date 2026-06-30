import type { ReportDatePreset, ReportDateRange } from '@/types/reports';

function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function rangeFromPreset(preset: ReportDatePreset): ReportDateRange {
  const to = new Date();
  const from = new Date();
  to.setUTCHours(23, 59, 59, 999);
  from.setUTCHours(0, 0, 0, 0);

  switch (preset) {
    case '7d':
      from.setUTCDate(from.getUTCDate() - 6);
      break;
    case '30d':
      from.setUTCDate(from.getUTCDate() - 29);
      break;
    case '90d':
      from.setUTCDate(from.getUTCDate() - 89);
      break;
    case 'quarter': {
      const month = from.getUTCMonth();
      const quarterStart = month - (month % 3);
      from.setUTCMonth(quarterStart, 1);
      break;
    }
  }

  return { from: toDateOnly(from), to: toDateOnly(to), preset };
}

export function reportQueryString(range: Pick<ReportDateRange, 'from' | 'to'>): string {
  return new URLSearchParams({ from: range.from, to: range.to }).toString();
}

export function formatChangePct(changePct: number | null): string {
  if (changePct === null) return '—';
  const sign = changePct > 0 ? '+' : '';
  return `${sign}${changePct}%`;
}

export function sourceLabel(source: string): string {
  if (source === 'apollo') return 'Apollo';
  if (source === 'linkedin_csv') return 'LinkedIn';
  if (source === 'ocr_card') return 'OCR';
  if (source === 'logged_email') return 'Email';
  if (source === 'manual') return 'Manual';
  return source;
}
