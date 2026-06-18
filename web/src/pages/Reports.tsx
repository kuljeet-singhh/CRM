import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  FileText, 
  Download, 
  TrendingUp, 
  TrendingDown,
  BarChart3,
  PieChart,
  Calendar,
  Target,
  Users,
  DollarSign,
  Activity,
  Filter
} from "lucide-react"

const salesMetrics = [
  { period: "This Month", revenue: "$486K", deals: 23, growth: "+12.5%", trend: "up" },
  { period: "Last Month", revenue: "$432K", deals: 19, growth: "+8.2%", trend: "up" },
  { period: "Q4 2023", revenue: "$1.2M", deals: 67, growth: "+15.3%", trend: "up" },
  { period: "Q3 2023", revenue: "$1.05M", deals: 61, growth: "-2.1%", trend: "down" }
]

const teamPerformance = [
  { name: "Sarah Wilson", deals: 12, revenue: "$450K", target: 85, conversion: 68 },
  { name: "Mike Johnson", deals: 8, revenue: "$320K", target: 75, conversion: 62 },
  { name: "Emily Chen", deals: 15, revenue: "$380K", target: 92, conversion: 71 },
  { name: "David Park", deals: 10, revenue: "$290K", target: 65, conversion: 59 }
]

const recentReports = [
  {
    id: 1,
    name: "Q4 Sales Performance",
    type: "Quarterly",
    generated: "2024-01-15",
    status: "Completed",
    size: "2.4 MB"
  },
  {
    id: 2,
    name: "Pipeline Analysis December",
    type: "Monthly",
    generated: "2024-01-01",
    status: "Completed",
    size: "1.8 MB"
  },
  {
    id: 3,
    name: "Team Performance Review",
    type: "Custom",
    generated: "2024-01-10",
    status: "Completed",
    size: "3.1 MB"
  },
  {
    id: 4,
    name: "Customer Acquisition Report",
    type: "Monthly",
    generated: "2024-01-08",
    status: "Completed",
    size: "1.5 MB"
  }
]

export default function Reports() {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Reports</h1>
          <p className="text-muted-foreground">Analyze your sales performance and trends</p>
        </div>
        <Button className="bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-accent">
          <FileText className="h-4 w-4 mr-2" />
          Generate Report
        </Button>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 lg:w-96">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="sales">Sales</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card className="bg-gradient-surface border-border/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">$1.8M</div>
                <p className="text-xs text-success flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  +12.5% from last quarter
                </p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-surface border-border/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Deals</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">147</div>
                <p className="text-xs text-muted-foreground">$2.4M pipeline value</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-surface border-border/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Win Rate</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">68%</div>
                <p className="text-xs text-success">+5% from last month</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-surface border-border/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">New Contacts</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">89</div>
                <p className="text-xs text-muted-foreground">This month</p>
              </CardContent>
            </Card>
          </div>

          {/* Chart Placeholder */}
          <Card className="bg-gradient-surface border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                Revenue Trend
              </CardTitle>
              <CardDescription>
                Monthly revenue performance over the last 12 months
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64 flex items-center justify-center bg-muted/20 rounded-lg">
                <div className="text-center">
                  <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">Chart visualization would appear here</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sales" className="space-y-6">
          {/* Sales Performance */}
          <Card className="bg-gradient-surface border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Sales Performance
              </CardTitle>
              <CardDescription>
                Detailed breakdown of sales metrics by period
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {salesMetrics.map((metric, index) => (
                  <div key={index} className="flex items-center justify-between p-4 rounded-lg bg-background/50">
                    <div>
                      <h4 className="font-medium">{metric.period}</h4>
                      <p className="text-sm text-muted-foreground">{metric.deals} deals closed</p>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-semibold">{metric.revenue}</div>
                      <div className={`text-sm flex items-center gap-1 ${
                        metric.trend === "up" ? "text-success" : "text-destructive"
                      }`}>
                        {metric.trend === "up" ? (
                          <TrendingUp className="h-3 w-3" />
                        ) : (
                          <TrendingDown className="h-3 w-3" />
                        )}
                        {metric.growth}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Pipeline Distribution */}
          <Card className="bg-gradient-surface border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="h-5 w-5 text-primary" />
                Pipeline Distribution
              </CardTitle>
              <CardDescription>
                Current deals by stage and value
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-48 flex items-center justify-center bg-muted/20 rounded-lg">
                <div className="text-center">
                  <PieChart className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">Pipeline chart would appear here</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="team" className="space-y-6">
          {/* Team Performance */}
          <Card className="bg-gradient-surface border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Team Performance
              </CardTitle>
              <CardDescription>
                Individual performance metrics and targets
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {teamPerformance.map((member, index) => (
                  <div key={index} className="p-4 rounded-lg bg-background/50">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="font-medium">{member.name}</h4>
                        <p className="text-sm text-muted-foreground">{member.deals} deals • {member.revenue}</p>
                      </div>
                      <Badge variant={member.target >= 80 ? "default" : "secondary"}>
                        {member.target}% of target
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Target Progress</span>
                        <span>{member.target}%</span>
                      </div>
                      <Progress value={member.target} className="h-2" />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Conversion Rate: {member.conversion}%</span>
                        <span>Target: 100%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          {/* Report History */}
          <Card className="bg-gradient-surface border-border/50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    Report History
                  </CardTitle>
                  <CardDescription>
                    Previously generated reports and analytics
                  </CardDescription>
                </div>
                <Button variant="outline" className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  Filter
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentReports.map((report) => (
                  <div key={report.id} className="flex items-center justify-between p-4 rounded-lg bg-background/50 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-gradient-primary flex items-center justify-center">
                        <FileText className="h-5 w-5 text-primary-foreground" />
                      </div>
                      <div>
                        <h4 className="font-medium">{report.name}</h4>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>{report.type}</span>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {report.generated}
                          </div>
                          <span>{report.size}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{report.status}</Badge>
                      <Button variant="outline" size="sm" className="flex items-center gap-1">
                        <Download className="h-3 w-3" />
                        Download
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}