import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ReportDatePreset, ReportDateRange } from '@/types/reports';
import { rangeFromPreset } from '@/lib/reports';

const PRESETS: { value: ReportDatePreset; label: string }[] = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'quarter', label: 'This quarter' },
];

interface DateRangePickerProps {
  value: ReportDateRange;
  onChange: (range: ReportDateRange) => void;
}

export function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  return (
    <Select
      value={value.preset}
      onValueChange={(preset) => onChange(rangeFromPreset(preset as ReportDatePreset))}
    >
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Date range" />
      </SelectTrigger>
      <SelectContent>
        {PRESETS.map((p) => (
          <SelectItem key={p.value} value={p.value}>
            {p.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
