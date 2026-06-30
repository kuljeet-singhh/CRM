import { Bar, BarChart, CartesianGrid, Legend, XAxis, YAxis } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';

const chartConfig = {
  sent: { label: 'Sent', color: 'hsl(var(--primary))' },
  received: { label: 'Received', color: 'hsl(var(--accent))' },
} satisfies ChartConfig;

interface EmailActivityChartProps {
  data: { date: string; sent: number; received: number }[];
}

export function EmailActivityChart({ data }: EmailActivityChartProps) {
  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-16">No email activity in this period.</p>
    );
  }

  return (
    <ChartContainer config={chartConfig} className="h-64 w-full">
      <BarChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={(v: string) => v.slice(5)}
        />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Legend />
        <Bar dataKey="sent" fill="var(--color-sent)" radius={[4, 4, 0, 0]} />
        <Bar dataKey="received" fill="var(--color-received)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}
