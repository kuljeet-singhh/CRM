import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { UserFilter } from "@/components/user-filter"
import { ReportKpiCard } from "@/components/reports/ReportKpiCard"
import { useReportSummary } from "@/hooks/useReports"
import { rangeFromPreset } from "@/lib/reports"
import { 
  TrendingUp, 
  Users, 
  Clock,
  Plus,
  Mail,
  Phone,
  Calendar,
  Zap,
  Target,
  CalendarDays
} from "lucide-react"

const recentActivity = [
  {
    id: 1,
    type: "deal",
    title: "TechCorp deal moved to Proposal",
    description: "Deal value: $450K",
    time: "2 minutes ago",
    priority: "high",
    icon: Target,
    assignedTo: "Sammy"
  },
  {
    id: 2,
    type: "email",
    title: "Follow-up sent to Sarah Johnson",
    description: "Re: Staffing requirements Q1 2024",
    time: "15 minutes ago",
    priority: "medium",
    icon: Mail,
    assignedTo: "John"
  },
  {
    id: 3,
    type: "call",
    title: "Call scheduled with Microsoft",
    description: "Tomorrow at 2:00 PM",
    time: "1 hour ago",
    priority: "high",
    icon: Phone,
    assignedTo: "Tim"
  },
  {
    id: 4,
    type: "ai",
    title: "AI identified warm lead",
    description: "GlobalTech Inc. shows buying signals",
    time: "2 hours ago",
    priority: "medium",
    icon: Zap,
    assignedTo: "Sammy"
  },
  {
    id: 5,
    type: "deal",
    title: "New lead from website form",
    description: "Enterprise solution inquiry",
    time: "3 hours ago",
    priority: "medium",
    icon: Target,
    assignedTo: "John"
  },
  {
    id: 6,
    type: "email",
    title: "Proposal sent to GlobalCorp",
    description: "Custom integration package",
    time: "4 hours ago",
    priority: "high",
    icon: Mail,
    assignedTo: "Tim"
  }
]

const upcomingTasks = [
  {
    id: 1,
    title: "Proposal due for TechCorp",
    due: "Today, 5:00 PM",
    priority: "high",
    assignedTo: "Sammy"
  },
  {
    id: 2,
    title: "Follow up with Azure Solutions",
    due: "Tomorrow, 10:00 AM", 
    priority: "medium",
    assignedTo: "John"
  },
  {
    id: 3,
    title: "Quarterly review prep",
    due: "Friday, 2:00 PM",
    priority: "low",
    assignedTo: "Tim"
  },
  {
    id: 4,
    title: "Demo preparation for StartupXYZ",
    due: "Monday, 9:00 AM",
    priority: "high",
    assignedTo: "Sammy"
  },
  {
    id: 5,
    title: "Contract review meeting",
    due: "Tuesday, 3:00 PM",
    priority: "medium",
    assignedTo: "John"
  }
]

export function Dashboard() {
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const navigate = useNavigate()
  const dateRange = useMemo(() => rangeFromPreset('30d'), [])
  const summaryQuery = useReportSummary(dateRange)
  const summary = summaryQuery.data
  const loading = summaryQuery.isLoading

  const filteredActivity = selectedUsers.length === 0 
    ? recentActivity 
    : recentActivity.filter(activity => selectedUsers.includes(activity.assignedTo))

  const filteredTasks = selectedUsers.length === 0 
    ? upcomingTasks 
    : upcomingTasks.filter(task => selectedUsers.includes(task.assignedTo))

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Dashboard</h1>
          <p className="text-muted-foreground">Workspace engagement at a glance.</p>
        </div>
        <div className="flex items-center gap-3">
          <UserFilter 
            selectedUsers={selectedUsers}
            onUserSelectionChange={setSelectedUsers}
          />
          <Button className="bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-accent">
            <Plus className="h-4 w-4 mr-2" />
            Quick Add
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <ReportKpiCard
          title="Total Contacts"
          icon={Users}
          kpi={summary?.kpis.totalContacts}
          loading={loading}
          showChange={false}
          description="all time"
          onClick={() => navigate('/contacts')}
        />
        <ReportKpiCard
          title="New Contacts"
          icon={TrendingUp}
          kpi={summary?.kpis.newContacts}
          loading={loading}
          onClick={() => navigate('/reports?filter=contacts')}
        />
        <ReportKpiCard
          title="Emails Sent"
          icon={Mail}
          kpi={summary?.kpis.emailsSent}
          loading={loading}
          onClick={() => navigate('/reports?tab=activity')}
        />
        <ReportKpiCard
          title="Meetings"
          icon={CalendarDays}
          kpi={summary?.kpis.meetingsScheduled}
          loading={loading}
          onClick={() => navigate('/calendar')}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 bg-gradient-surface border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Recent Activity
            </CardTitle>
            <CardDescription>
              Latest updates from your workspace
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {filteredActivity.map((activity) => (
                <div 
                  key={activity.id} 
                  className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => {
                    if (activity.type === "deal") navigate("/pipeline")
                    else if (activity.type === "email") navigate("/email")
                    else if (activity.type === "call") navigate("/tasks")
                    else if (activity.type === "ai") navigate("/ai")
                  }}
                >
                  <div className={`p-2 rounded-lg ${
                    activity.priority === "high" ? "bg-primary/10" : 
                    activity.priority === "medium" ? "bg-accent/10" : "bg-muted"
                  }`}>
                    <activity.icon className={`h-4 w-4 ${
                      activity.priority === "high" ? "text-primary" :
                      activity.priority === "medium" ? "text-accent" : "text-muted-foreground"
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-sm">{activity.title}</p>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {activity.assignedTo}
                        </Badge>
                        <Badge variant={
                          activity.priority === "high" ? "default" : 
                          activity.priority === "medium" ? "secondary" : "outline"
                        } className="text-xs">
                          {activity.priority}
                        </Badge>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">{activity.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">{activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-surface border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-accent" />
              Upcoming Tasks
            </CardTitle>
            <CardDescription>
              Don't miss these important deadlines
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {filteredTasks.map((task) => (
                <div 
                  key={task.id} 
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => navigate("/tasks")}
                >
                  <div className={`w-2 h-2 rounded-full ${
                    task.priority === "high" ? "bg-primary" :
                    task.priority === "medium" ? "bg-accent" : "bg-muted-foreground"
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-sm">{task.title}</p>
                      <Badge variant="outline" className="text-xs">
                        {task.assignedTo}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{task.due}</p>
                  </div>
                </div>
              ))}
            </div>
            <Button 
              variant="outline" 
              className="w-full mt-4"
              onClick={() => navigate("/tasks")}
            >
              View All Tasks
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
