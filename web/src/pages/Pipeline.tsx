import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { UserFilter } from "@/components/user-filter"
import { 
  Target, 
  Plus, 
  TrendingUp, 
  Calendar, 
  DollarSign,
  Users,
  Clock,
  MoreHorizontal,
  ArrowRight
} from "lucide-react"

const pipelineStages = [
  { name: "Lead", count: 23, value: "$1.2M", color: "bg-blue-500" },
  { name: "Qualified", count: 15, value: "$980K", color: "bg-yellow-500" },
  { name: "Proposal", count: 8, value: "$650K", color: "bg-orange-500" },
  { name: "Negotiation", count: 5, value: "$420K", color: "bg-purple-500" },
  { name: "Closed Won", count: 12, value: "$1.8M", color: "bg-green-500" },
]

const deals = [
  {
    id: 1,
    title: "TechCorp Infrastructure Upgrade",
    company: "TechCorp Solutions",
    value: "$450,000",
    stage: "Negotiation",
    probability: 85,
    closeDate: "2024-02-15",
    contact: "Sarah Johnson",
    daysInStage: 12,
    priority: "high",
    assignedTo: "Sammy"
  },
  {
    id: 2,
    title: "Global Manufacturing ERP",
    company: "Global Manufacturing Inc",
    value: "$280,000",
    stage: "Proposal",
    probability: 65,
    closeDate: "2024-03-01",
    contact: "Emily Rodriguez",
    daysInStage: 8,
    priority: "medium",
    assignedTo: "John"
  },
  {
    id: 3,
    title: "InnovateLabs AI Platform",
    company: "InnovateLabs",
    value: "$125,000",
    stage: "Qualified",
    probability: 45,
    closeDate: "2024-03-15",
    contact: "Michael Chen",
    daysInStage: 15,
    priority: "medium",
    assignedTo: "Tim"
  },
  {
    id: 4,
    title: "FinanceFirst Security Suite",
    company: "FinanceFirst Corp",
    value: "$350,000",
    stage: "Proposal",
    probability: 70,
    closeDate: "2024-02-28",
    contact: "David Park",
    daysInStage: 5,
    priority: "high",
    assignedTo: "Sammy"
  },
  {
    id: 5,
    title: "StartupXYZ Growth Package",
    company: "StartupXYZ",
    value: "$95,000",
    stage: "Lead",
    probability: 30,
    closeDate: "2024-04-01",
    contact: "Lisa Wang",
    daysInStage: 3,
    priority: "medium",
    assignedTo: "John"
  },
  {
    id: 6,
    title: "MegaCorp Enterprise Solution",
    company: "MegaCorp Inc",
    value: "$750,000",
    stage: "Qualified",
    probability: 55,
    closeDate: "2024-05-15",
    contact: "Robert Thompson",
    daysInStage: 7,
    priority: "high",
    assignedTo: "Tim"
  }
]

export default function Pipeline() {
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const totalValue = pipelineStages.reduce((sum, stage) => sum + parseFloat(stage.value.replace('$', '').replace('M', '').replace('K', '') + (stage.value.includes('M') ? '000' : '')), 0)

  const filteredDeals = selectedUsers.length === 0 
    ? deals 
    : deals.filter(deal => selectedUsers.includes(deal.assignedTo))

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Sales Pipeline</h1>
          <p className="text-muted-foreground">Track and manage your sales opportunities</p>
        </div>
        <div className="flex items-center gap-3">
          <UserFilter 
            selectedUsers={selectedUsers}
            onUserSelectionChange={setSelectedUsers}
          />
          <Button className="bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-accent">
            <Plus className="h-4 w-4 mr-2" />
            Add Deal
          </Button>
        </div>
      </div>

      {/* Pipeline Overview */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {pipelineStages.map((stage, index) => (
          <Card key={stage.name} className="hover-glow transition-all duration-300 bg-gradient-surface border-border/50 relative overflow-hidden">
            <div className={`absolute top-0 left-0 right-0 h-1 ${stage.color}`} />
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stage.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold">{stage.count}</span>
                  <div className="text-right">
                    <div className="text-lg font-semibold">{stage.value}</div>
                  </div>
                </div>
                {index < pipelineStages.length - 1 && (
                  <div className="flex justify-center pt-2">
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pipeline Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-gradient-surface border-border/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pipeline Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalValue.toFixed(1)}M</div>
            <p className="text-xs text-success flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              +12.5% from last month
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-surface border-border/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Deal Size</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$312K</div>
            <p className="text-xs text-muted-foreground">Across all stages</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-surface border-border/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Win Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">68%</div>
            <p className="text-xs text-success">+5% from last quarter</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-surface border-border/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sales Cycle</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">45 days</div>
            <p className="text-xs text-muted-foreground">Average time to close</p>
          </CardContent>
        </Card>
      </div>

      {/* Active Deals */}
      <Card className="bg-gradient-surface border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Active Deals
          </CardTitle>
          <CardDescription>
            High-priority opportunities requiring attention
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredDeals.map((deal) => (
              <div key={deal.id} className="flex items-center gap-4 p-4 rounded-lg bg-background/50 hover:bg-muted/30 transition-colors">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h4 className="font-medium">{deal.title}</h4>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {deal.assignedTo}
                      </Badge>
                      <Badge variant={
                        deal.priority === "high" ? "default" : "secondary"
                      }>
                        {deal.priority}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-6 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      {deal.company}
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      Close: {deal.closeDate}
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {deal.daysInStage} days in {deal.stage}
                    </div>
                  </div>
                </div>
                
                <div className="text-right min-w-32">
                  <div className="font-semibold text-lg">{deal.value}</div>
                  <div className="text-sm text-muted-foreground">{deal.probability}% probability</div>
                </div>
                
                <div className="min-w-24">
                  <div className="text-sm font-medium mb-1">{deal.probability}%</div>
                  <Progress value={deal.probability} className="h-2" />
                </div>
                
                <Button variant="ghost" size="icon">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}