import type { LucideIcon } from 'lucide-react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatChangePct } from '@/lib/reports';
import type { KpiValue } from '@/types/reports';

interface ReportKpiCardProps {
  title: string;
  icon: LucideIcon;
  kpi?: KpiValue;
  loading?: boolean;
  description?: string;
  showChange?: boolean;
  onClick?: () => void;
}

export function ReportKpiCard({
  title,
  icon: Icon,
  kpi,
  loading,
  description = 'vs previous period',
  showChange = true,
  onClick,
}: ReportKpiCardProps) {
  const trend =
    kpi?.changePct === null || kpi?.changePct === undefined
      ? 'neutral'
      : kpi.changePct >= 0
        ? 'up'
        : 'down';

  return (
    <Card
      className={`bg-gradient-surface border-border/50 ${onClick ? 'cursor-pointer hover-glow transition-all' : ''}`}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-20" />
        ) : (
          <>
            <div className="text-2xl font-bold">{kpi?.value.toLocaleString() ?? '—'}</div>
            {showChange && kpi && (
              <p
                className={`text-xs flex items-center gap-1 ${
                  trend === 'up'
                    ? 'text-success'
                    : trend === 'down'
                      ? 'text-destructive'
                      : 'text-muted-foreground'
                }`}
              >
                {trend === 'up' && <ArrowUpRight className="h-3 w-3" />}
                {trend === 'down' && <ArrowDownRight className="h-3 w-3" />}
                {formatChangePct(kpi.changePct)} {description}
              </p>
            )}
            {!showChange && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
