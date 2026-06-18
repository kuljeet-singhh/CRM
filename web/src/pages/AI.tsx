import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Zap, 
  Plus, 
  Play,
  Pause,
  Settings,
  Brain,
  Users,
  Mail,
  Target,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  Search,
  Filter
} from "lucide-react"

const workflows = [
  {
    id: 1,
    name: "Lead Qualification Assistant",
    description: "Automatically scores and qualifies incoming leads based on company size, industry, and budget",
    category: "Lead Management",
    status: "active",
    triggers: 156,
    lastRun: "2 minutes ago",
    success: 94,
    icon: Target
  },
  {
    id: 2,
    name: "Follow-up Email Automation",
    description: "Sends personalized follow-up emails after demos and meetings with relevant content",
    category: "Communication",
    status: "active", 
    triggers: 89,
    lastRun: "15 minutes ago",
    success: 87,
    icon: Mail
  },
  {
    id: 3,
    name: "Deal Risk Analysis",
    description: "Analyzes deal health and predicts probability of closure based on engagement patterns",
    category: "Analytics",
    status: "paused",
    triggers: 234,
    lastRun: "1 hour ago",
    success: 91,
    icon: TrendingUp
  },
  {
    id: 4,
    name: "Contact Enrichment",
    description: "Automatically enriches contact profiles with social media and company data",
    category: "Data Management",
    status: "active",
    triggers: 67,
    lastRun: "5 minutes ago",
    success: 89,
    icon: Users
  },
  {
    id: 5,
    name: "Meeting Scheduler",
    description: "Intelligently schedules meetings based on all participants' availability and preferences",
    category: "Scheduling",
    status: "active",
    triggers: 45,
    lastRun: "30 minutes ago",
    success: 96,
    icon: Clock
  }
]

const aiInsights = [
  {
    title: "High-Value Lead Identified",
    description: "TechFlow Solutions shows strong buying signals. Recommended action: Schedule demo within 48 hours.",
    priority: "high",
    timestamp: "5 minutes ago",
    action: "Schedule Demo"
  },
  {
    title: "Deal at Risk",
    description: "GlobalCorp deal has been in negotiation stage for 45 days. Competitor activity detected.",
    priority: "medium",
    timestamp: "1 hour ago",
    action: "Review Terms"
  },
  {
    title: "Renewal Opportunity",
    description: "InnovateLabs contract expires in 30 days. High renewal probability based on usage patterns.",
    priority: "high",
    timestamp: "2 hours ago",
    action: "Send Proposal"
  },
  {
    title: "Contact Engagement Drop",
    description: "Sarah Johnson's email engagement has decreased 60% over the past 2 weeks.",
    priority: "low",
    timestamp: "3 hours ago",
    action: "Personalize Outreach"
  }
]

export default function AI() {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold gradient-text">AI Assistant</h1>
          <p className="text-muted-foreground">Intelligent automation and insights for your sales process</p>
        </div>
        <Button className="bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-accent">
          <Plus className="h-4 w-4 mr-2" />
          Create Workflow
        </Button>
      </div>

      <Tabs defaultValue="workflows" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 lg:w-96">
          <TabsTrigger value="workflows">Workflows</TabsTrigger>
          <TabsTrigger value="insights">AI Insights</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="workflows" className="space-y-6">
          {/* Workflow Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card className="bg-gradient-surface border-border/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Workflows</CardTitle>
                <Zap className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{workflows.filter(w => w.status === 'active').length}</div>
                <p className="text-xs text-muted-foreground">Running automations</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-surface border-border/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Triggers</CardTitle>
                <Brain className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{workflows.reduce((sum, w) => sum + w.triggers, 0)}</div>
                <p className="text-xs text-success">+23% this week</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-surface border-border/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">91%</div>
                <p className="text-xs text-muted-foreground">Average across all workflows</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-surface border-border/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Time Saved</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">156h</div>
                <p className="text-xs text-muted-foreground">This month</p>
              </CardContent>
            </Card>
          </div>

          {/* Search and Filters */}
          <Card className="bg-gradient-surface border-border/50">
            <CardContent className="p-4">
              <div className="flex gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search workflows by name or category..." 
                    className="pl-10 bg-background/50"
                  />
                </div>
                <Button variant="outline" className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  Filter
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Workflows List */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {workflows.map((workflow) => (
              <Card key={workflow.id} className="hover-glow transition-all duration-300 bg-gradient-surface border-border/50">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`h-12 w-12 rounded-lg ${workflow.status === 'active' ? 'bg-gradient-primary' : 'bg-muted'} flex items-center justify-center`}>
                        <workflow.icon className={`h-6 w-6 ${workflow.status === 'active' ? 'text-primary-foreground' : 'text-muted-foreground'}`} />
                      </div>
                      <div>
                        <h3 className="font-semibold">{workflow.name}</h3>
                        <Badge variant={workflow.status === 'active' ? 'default' : 'secondary'} className="mt-1">
                          {workflow.status}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        {workflow.status === 'active' ? (
                          <Pause className="h-4 w-4" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Settings className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">{workflow.description}</p>
                  
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-lg font-semibold">{workflow.triggers}</div>
                      <div className="text-xs text-muted-foreground">Triggers</div>
                    </div>
                    <div>
                      <div className="text-lg font-semibold">{workflow.success}%</div>
                      <div className="text-xs text-muted-foreground">Success</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Last run</div>
                      <div className="text-sm font-medium">{workflow.lastRun}</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between pt-2 border-t border-border/30">
                    <Badge variant="outline">{workflow.category}</Badge>
                    <Button variant="outline" size="sm">
                      View Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="insights" className="space-y-6">
          {/* AI Insights */}
          <Card className="bg-gradient-surface border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-primary" />
                AI-Generated Insights
              </CardTitle>
              <CardDescription>
                Intelligent recommendations and alerts based on your data
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {aiInsights.map((insight, index) => (
                  <div key={index} className="flex items-start gap-4 p-4 rounded-lg bg-background/50 hover:bg-muted/30 transition-colors">
                    <div className={`p-2 rounded-lg ${
                      insight.priority === "high" ? "bg-primary/10" : 
                      insight.priority === "medium" ? "bg-accent/10" : "bg-muted"
                    }`}>
                      {insight.priority === "high" ? (
                        <AlertCircle className="h-5 w-5 text-primary" />
                      ) : insight.priority === "medium" ? (
                        <TrendingUp className="h-5 w-5 text-accent" />
                      ) : (
                        <Brain className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">{insight.title}</h4>
                        <Badge variant={
                          insight.priority === "high" ? "destructive" : 
                          insight.priority === "medium" ? "default" : "secondary"
                        }>
                          {insight.priority}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">{insight.description}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">{insight.timestamp}</span>
                        <Button size="sm" variant="outline">
                          {insight.action}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="bg-gradient-surface border-border/50">
            <CardHeader>
              <CardTitle>AI-Powered Quick Actions</CardTitle>
              <CardDescription>
                Let AI help you with common sales tasks
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button variant="outline" className="h-16 flex flex-col items-center gap-2">
                  <Mail className="h-5 w-5" />
                  <span className="text-sm">Generate Follow-up Email</span>
                </Button>
                <Button variant="outline" className="h-16 flex flex-col items-center gap-2">
                  <Target className="h-5 w-5" />
                  <span className="text-sm">Qualify Lead</span>
                </Button>
                <Button variant="outline" className="h-16 flex flex-col items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  <span className="text-sm">Analyze Deal Risk</span>
                </Button>
                <Button variant="outline" className="h-16 flex flex-col items-center gap-2">
                  <Users className="h-5 w-5" />
                  <span className="text-sm">Enrich Contact</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          {/* AI Analytics */}
          <Card className="bg-gradient-surface border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                AI Performance Analytics
              </CardTitle>
              <CardDescription>
                Track the impact of AI automation on your sales process
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64 flex items-center justify-center bg-muted/20 rounded-lg">
                <div className="text-center">
                  <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">AI analytics dashboard would appear here</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Training Data */}
          <Card className="bg-gradient-surface border-border/50">
            <CardHeader>
              <CardTitle>Model Training & Data</CardTitle>
              <CardDescription>
                Improve AI accuracy by providing feedback and training data
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Feedback on Recent Predictions</label>
                <Textarea 
                  placeholder="Provide feedback on AI predictions to improve accuracy..." 
                  className="min-h-24"
                />
              </div>
              <Button className="bg-gradient-primary text-primary-foreground hover:opacity-90">
                Submit Feedback
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}