import { Cell, Pie, PieChart } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { sourceLabel } from '@/lib/reports';
import type { ContactSource } from '@/types';

const COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--accent))',
  'hsl(142 76% 36%)',
  'hsl(262 83% 58%)',
  'hsl(24 95% 53%)',
];

interface ContactsBySourceChartProps {
  data: { source: ContactSource; count: number }[];
}

export function ContactsBySourceChart({ data }: ContactsBySourceChartProps) {
  const chartData = data.map((d) => ({
    source: d.source,
    label: sourceLabel(d.source),
    count: d.count,
  }));

  const chartConfig = chartData.reduce((acc, row, i) => {
    acc[row.source] = { label: row.label, color: COLORS[i % COLORS.length] };
    return acc;
  }, {} as ChartConfig);

  if (chartData.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-16">No contacts yet.</p>
    );
  }

  return (
    <ChartContainer config={chartConfig} className="h-64 w-full">
      <PieChart>
        <ChartTooltip content={<ChartTooltipContent nameKey="label" />} />
        <Pie
          data={chartData}
          dataKey="count"
          nameKey="label"
          cx="50%"
          cy="50%"
          outerRadius={90}
          label={({ label, percent }) =>
            `${label} ${(percent * 100).toFixed(0)}%`
          }
        >
          {chartData.map((entry, index) => (
            <Cell key={entry.source} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
      </PieChart>
    </ChartContainer>
  );
}
