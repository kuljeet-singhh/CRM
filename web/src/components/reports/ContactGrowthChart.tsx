import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';

const chartConfig = {
  count: { label: 'New contacts', color: 'hsl(var(--primary))' },
} satisfies ChartConfig;

interface ContactGrowthChartProps {
  data: { date: string; count: number }[];
}

export function ContactGrowthChart({ data }: ContactGrowthChartProps) {
  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-16">No contact data in this period.</p>
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
        <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}
