import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DateRangePicker } from '@/components/reports/DateRangePicker';
import { ReportKpiCard } from '@/components/reports/ReportKpiCard';
import { ContactGrowthChart } from '@/components/reports/ContactGrowthChart';
import { EmailActivityChart } from '@/components/reports/EmailActivityChart';
import { ContactsBySourceChart } from '@/components/reports/ContactsBySourceChart';
import {
  downloadReportExport,
  useReportCalendar,
  useReportEmail,
  useReportEngagement,
  useReportSummary,
  useReportsDateRangeFromFilter,
} from '@/hooks/useReports';
import { useFormatters } from '@/lib/preferences';
import type { ExportFormat, ExportType, ReportDateRange } from '@/types/reports';
import {
  FileText,
  Download,
  BarChart3,
  PieChart,
  Calendar,
  Users,
  Mail,
  Activity,
  CalendarDays,
} from 'lucide-react';
import { ApiError } from '@/lib/api';

const VALID_TABS = ['overview', 'activity', 'contacts', 'export'] as const;
type ReportTab = (typeof VALID_TABS)[number];

export default function Reports() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filter = searchParams.get('filter');
  const tabParam = searchParams.get('tab');
  const filterRange = useReportsDateRangeFromFilter(filter);
  const [dateRange, setDateRange] = useState<ReportDateRange>(filterRange);
  const [exporting, setExporting] = useState<string | null>(null);
  const { formatRelativeTime } = useFormatters();

  const activeTab: ReportTab = useMemo(() => {
    if (tabParam && VALID_TABS.includes(tabParam as ReportTab)) {
      return tabParam as ReportTab;
    }
    if (filter === 'close-rate' || filter === 'revenue' || filter === 'contacts') {
      return 'overview';
    }
    return 'overview';
  }, [tabParam, filter]);

  useEffect(() => {
    if (filter) {
      setDateRange(filterRange);
    }
  }, [filter, filterRange]);

  const summaryQuery = useReportSummary(dateRange);
  const emailQuery = useReportEmail(dateRange);
  const calendarQuery = useReportCalendar(dateRange);
  const engagementQuery = useReportEngagement(dateRange, 10);

  const summary = summaryQuery.data;
  const loading = summaryQuery.isLoading;

  const handleTabChange = (value: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', value);
    setSearchParams(next, { replace: true });
  };

  const handleExport = async (type: ExportType, format: ExportFormat) => {
    const key = `${type}-${format}`;
    setExporting(key);
    try {
      await downloadReportExport(dateRange, type, format);
      toast.success('Report downloaded');
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Export failed';
      toast.error(message);
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Reports</h1>
          <p className="text-muted-foreground">
            Engagement metrics from contacts, email, and calendar
          </p>
        </div>
        <div className="flex items-center gap-3">
          <DateRangePicker value={dateRange} onChange={setDateRange} />
          <Button
            className="bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-accent"
            disabled={exporting === 'summary-csv'}
            onClick={() => handleExport('summary', 'csv')}
          >
            <FileText className="h-4 w-4 mr-2" />
            Generate Report
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 lg:w-[28rem]">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="contacts">Contacts</TabsTrigger>
          <TabsTrigger value="export">Export</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <ReportKpiCard
              title="Total Contacts"
              icon={Users}
              kpi={summary?.kpis.totalContacts}
              loading={loading}
              showChange={false}
              description="all time"
            />
            <ReportKpiCard
              title="New Contacts"
              icon={Users}
              kpi={summary?.kpis.newContacts}
              loading={loading}
            />
            <ReportKpiCard
              title="Emails Sent"
              icon={Mail}
              kpi={summary?.kpis.emailsSent}
              loading={loading}
            />
            <ReportKpiCard
              title="Emails Received"
              icon={Mail}
              kpi={summary?.kpis.emailsReceived}
              loading={loading}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-gradient-surface border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Contact Growth
                </CardTitle>
                <CardDescription>New contacts per day in selected period</CardDescription>
              </CardHeader>
              <CardContent>
                <ContactGrowthChart data={summary?.series.contactGrowth ?? []} />
              </CardContent>
            </Card>

            <Card className="bg-gradient-surface border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="h-5 w-5 text-primary" />
                  Contacts by Source
                </CardTitle>
                <CardDescription>All contacts in workspace</CardDescription>
              </CardHeader>
              <CardContent>
                <ContactsBySourceChart data={summary?.series.contactsBySource ?? []} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="activity" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <ReportKpiCard
              title="Emails Sent"
              icon={Mail}
              kpi={summary?.kpis.emailsSent}
              loading={loading}
            />
            <ReportKpiCard
              title="Emails Received"
              icon={Mail}
              kpi={summary?.kpis.emailsReceived}
              loading={loading}
            />
            <ReportKpiCard
              title="Meetings Scheduled"
              icon={CalendarDays}
              kpi={summary?.kpis.meetingsScheduled}
              loading={loading}
            />
            <ReportKpiCard
              title="CRM Meetings Created"
              icon={Calendar}
              kpi={summary?.kpis.crmMeetingsCreated}
              loading={loading}
            />
          </div>

          <Card className="bg-gradient-surface border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                Email Activity
              </CardTitle>
              <CardDescription>Sent vs received per day</CardDescription>
            </CardHeader>
            <CardContent>
              <EmailActivityChart
                data={emailQuery.data?.activity ?? summary?.series.emailActivity ?? []}
              />
            </CardContent>
          </Card>

          <Card className="bg-gradient-surface border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-primary" />
                Calendar Summary
              </CardTitle>
              <CardDescription>Meetings in selected period</CardDescription>
            </CardHeader>
            <CardContent>
              {calendarQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : calendarQuery.data ? (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {[
                    { label: 'Scheduled', value: calendarQuery.data.meetingsScheduled },
                    { label: 'Held', value: calendarQuery.data.meetingsHeld },
                    { label: 'Upcoming', value: calendarQuery.data.upcomingMeetings },
                    { label: 'CRM created', value: calendarQuery.data.crmCreated },
                    { label: 'Synced', value: calendarQuery.data.syncedFromProvider },
                  ].map((item) => (
                    <div key={item.label} className="p-4 rounded-lg bg-background/50 text-center">
                      <div className="text-2xl font-bold">{item.value}</div>
                      <div className="text-xs text-muted-foreground">{item.label}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No calendar data.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contacts" className="space-y-6">
          <Card className="bg-gradient-surface border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Top Engaged Contacts
              </CardTitle>
              <CardDescription>Most email activity in selected period</CardDescription>
            </CardHeader>
            <CardContent>
              {engagementQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : engagementQuery.data?.contacts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No email engagement in this period.</p>
              ) : (
                <div className="space-y-3">
                  {engagementQuery.data?.contacts.map((contact, index) => (
                    <div
                      key={contact.contactId}
                      className="flex items-center justify-between p-4 rounded-lg bg-background/50"
                    >
                      <div className="flex items-center gap-3">
                        <Badge variant="outline">{index + 1}</Badge>
                        <div>
                          <h4 className="font-medium">
                            {contact.name?.trim() || contact.email || 'Unknown'}
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            {contact.company || contact.email || '—'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right text-sm">
                        <div className="font-semibold">{contact.emailCount} emails</div>
                        {contact.lastEmailAt && (
                          <div className="text-muted-foreground">
                            {formatRelativeTime(contact.lastEmailAt)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-gradient-surface border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                Contact Growth
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ContactGrowthChart data={summary?.series.contactGrowth ?? []} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="export" className="space-y-6">
          <Card className="bg-gradient-surface border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5 text-primary" />
                Download Reports
              </CardTitle>
              <CardDescription>
                Export data for {dateRange.from} to {dateRange.to}. Sales pipeline reports
                will be available when the Pipeline module is added.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {(
                [
                  { type: 'summary' as const, label: 'Engagement summary', desc: 'KPIs and source breakdown' },
                  { type: 'contacts' as const, label: 'Contacts list', desc: 'Contacts created in period' },
                  { type: 'emails' as const, label: 'Email activity', desc: 'Daily sent/received counts' },
                ] as const
              ).map((item) => (
                <div
                  key={item.type}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg bg-background/50"
                >
                  <div>
                    <h4 className="font-medium">{item.label}</h4>
                    <p className="text-sm text-muted-foreground">{item.desc}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={exporting === `${item.type}-csv`}
                      onClick={() => handleExport(item.type, 'csv')}
                    >
                      <Download className="h-3 w-3 mr-1" />
                      CSV
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={exporting === `${item.type}-json`}
                      onClick={() => handleExport(item.type, 'json')}
                    >
                      JSON
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
