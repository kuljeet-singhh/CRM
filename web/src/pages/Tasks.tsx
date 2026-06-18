import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  CheckSquare, 
  Plus, 
  Calendar, 
  Clock,
  Users,
  Target,
  Search,
  Filter,
  MoreHorizontal
} from "lucide-react"

const tasks = [
  {
    id: 1,
    title: "Follow up with TechCorp on proposal",
    description: "Send detailed proposal review and next steps",
    dueDate: "2024-01-28",
    priority: "high",
    status: "pending",
    assignee: "You",
    company: "TechCorp Solutions",
    category: "Follow-up"
  },
  {
    id: 2,
    title: "Prepare quarterly sales report",
    description: "Compile Q4 performance metrics and insights",
    dueDate: "2024-01-30", 
    priority: "medium",
    status: "in-progress",
    assignee: "Sarah Wilson",
    company: "Internal",
    category: "Reporting"
  },
  {
    id: 3,
    title: "Schedule demo for Global Manufacturing",
    description: "Coordinate product demonstration with key stakeholders",
    dueDate: "2024-01-26",
    priority: "high",
    status: "pending",
    assignee: "Mike Johnson",
    company: "Global Manufacturing Inc",
    category: "Demo"
  },
  {
    id: 4,
    title: "Contract review with legal team",
    description: "Review terms and conditions for InnovateLabs agreement",
    dueDate: "2024-01-29",
    priority: "medium",
    status: "completed",
    assignee: "Legal Team",
    company: "InnovateLabs",
    category: "Legal"
  },
  {
    id: 5,
    title: "Update CRM contact information",
    description: "Sync latest contact details from FinanceFirst meeting",
    dueDate: "2024-01-27",
    priority: "low",
    status: "pending",
    assignee: "You",
    company: "FinanceFirst Corp",
    category: "Admin"
  }
]

export default function Tasks() {
  const [selectedTasks, setSelectedTasks] = useState<number[]>([])

  const toggleTask = (taskId: number) => {
    setSelectedTasks(prev => 
      prev.includes(taskId) 
        ? prev.filter(id => id !== taskId)
        : [...prev, taskId]
    )
  }

  const pendingTasks = tasks.filter(task => task.status === "pending")
  const inProgressTasks = tasks.filter(task => task.status === "in-progress")
  const completedTasks = tasks.filter(task => task.status === "completed")

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "destructive"
      case "medium": return "default"
      case "low": return "secondary"
      default: return "outline"
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "bg-success/10 text-success border-success/20"
      case "in-progress": return "bg-accent/10 text-accent border-accent/20"
      case "pending": return "bg-muted/10 text-muted-foreground border-border"
      default: return "bg-muted/10 text-muted-foreground border-border"
    }
  }

  const TaskCard = ({ task }: { task: typeof tasks[0] }) => (
    <Card className={`hover-glow transition-all duration-300 bg-gradient-surface border-border/50 ${getStatusColor(task.status)}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Checkbox 
            checked={selectedTasks.includes(task.id)}
            onCheckedChange={() => toggleTask(task.id)}
            className="mt-1"
          />
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-sm">{task.title}</h3>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <MoreHorizontal className="h-3 w-3" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">{task.description}</p>
            
            <div className="flex items-center gap-2">
              <Badge variant={getPriorityColor(task.priority)} className="text-xs">
                {task.priority}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {task.category}
              </Badge>
            </div>
            
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {task.dueDate}
                </div>
                <div className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {task.assignee}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Target className="h-3 w-3" />
                {task.company}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Tasks</h1>
          <p className="text-muted-foreground">Manage your daily activities and deadlines</p>
        </div>
        <Button className="bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-accent">
          <Plus className="h-4 w-4 mr-2" />
          Add Task
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-gradient-surface border-border/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
            <CheckSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tasks.length}</div>
            <p className="text-xs text-muted-foreground">Active assignments</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-surface border-border/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingTasks.length}</div>
            <p className="text-xs text-muted-foreground">Awaiting action</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-surface border-border/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inProgressTasks.length}</div>
            <p className="text-xs text-muted-foreground">Currently active</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-surface border-border/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckSquare className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedTasks.length}</div>
            <p className="text-xs text-success">Finished today</p>
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
                placeholder="Search tasks by title or company..." 
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

      {/* Tasks Tabs */}
      <Tabs defaultValue="all" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 lg:w-96">
          <TabsTrigger value="all">All ({tasks.length})</TabsTrigger>
          <TabsTrigger value="pending">Pending ({pendingTasks.length})</TabsTrigger>
          <TabsTrigger value="progress">In Progress ({inProgressTasks.length})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({completedTasks.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </TabsContent>

        <TabsContent value="pending" className="space-y-4">
          {pendingTasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </TabsContent>

        <TabsContent value="progress" className="space-y-4">
          {inProgressTasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </TabsContent>

        <TabsContent value="completed" className="space-y-4">
          {completedTasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </TabsContent>
      </Tabs>
    </div>
  )
}