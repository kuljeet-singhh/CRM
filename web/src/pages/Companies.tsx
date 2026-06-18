import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Building2, 
  Search, 
  Filter, 
  Plus, 
  Users, 
  TrendingUp,
  MapPin,
  Calendar,
  FileText,
  CheckCircle,
  DollarSign,
  MoreHorizontal
} from "lucide-react"

const companies = [
  {
    id: 1,
    name: "TechCorp Solutions",
    industry: "Technology",
    size: "500-1000",
    location: "San Francisco, CA",
    status: "Active Client",
    contacts: 8,
    deals: 12,
    revenue: "$2.4M",
    lastActivity: "2 hours ago",
    description: "Leading cloud infrastructure provider"
  },
  {
    id: 2,
    name: "Global Manufacturing Inc",
    industry: "Manufacturing", 
    size: "1000+",
    location: "Chicago, IL",
    status: "Prospect",
    contacts: 3,
    deals: 2,
    revenue: "$850K",
    lastActivity: "1 day ago",
    description: "Industrial automation and equipment"
  },
  {
    id: 3,
    name: "InnovateLabs",
    industry: "Software",
    size: "50-200",
    location: "Seattle, WA", 
    status: "Active Client",
    contacts: 5,
    deals: 7,
    revenue: "$1.1M",
    lastActivity: "5 hours ago",
    description: "AI and machine learning solutions"
  },
  {
    id: 4,
    name: "FinanceFirst Corp",
    industry: "Finance",
    size: "200-500",
    location: "New York, NY",
    status: "Lead",
    contacts: 4,
    deals: 3,
    revenue: "$650K",
    lastActivity: "3 days ago",
    description: "Digital banking and fintech services"
  }
]

const executedContracts = [
  {
    id: 1,
    company: "TechCorp Solutions",
    contractType: "Software License",
    value: "$450,000",
    startDate: "2024-01-15",
    endDate: "2025-01-14",
    status: "Active",
    renewalDate: "2024-12-01"
  },
  {
    id: 2,
    company: "InnovateLabs", 
    contractType: "Support & Maintenance",
    value: "$125,000",
    startDate: "2024-03-01",
    endDate: "2025-02-28",
    status: "Active",
    renewalDate: "2025-01-01"
  },
  {
    id: 3,
    company: "Global Manufacturing Inc",
    contractType: "Consulting Services",
    value: "$280,000",
    startDate: "2023-11-01",
    endDate: "2024-10-31",
    status: "Completed",
    renewalDate: "2024-09-01"
  },
  {
    id: 4,
    company: "FinanceFirst Corp",
    contractType: "Implementation",
    value: "$350,000",
    startDate: "2024-02-15",
    endDate: "2024-08-14",
    status: "Active",
    renewalDate: "2024-07-01"
  }
]

export default function Companies() {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Companies</h1>
          <p className="text-muted-foreground">Manage your corporate accounts and contracts</p>
        </div>
        <Button className="bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-accent">
          <Plus className="h-4 w-4 mr-2" />
          Add Company
        </Button>
      </div>

      <Tabs defaultValue="companies" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 lg:w-96">
          <TabsTrigger value="companies">Companies</TabsTrigger>
          <TabsTrigger value="contracts">Executed Contracts</TabsTrigger>
        </TabsList>

        <TabsContent value="companies" className="space-y-6">
          {/* Search and Filters */}
          <Card className="bg-gradient-surface border-border/50">
            <CardContent className="p-4">
              <div className="flex gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search companies by name, industry, or location..." 
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

          {/* Companies Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {companies.map((company) => (
              <Card key={company.id} className="hover-glow transition-all duration-300 bg-gradient-surface border-border/50">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-lg bg-gradient-primary flex items-center justify-center">
                        <Building2 className="h-6 w-6 text-primary-foreground" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">{company.name}</h3>
                        <p className="text-sm text-muted-foreground">{company.description}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Industry:</span>
                        <span className="text-sm font-medium">{company.industry}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{company.size} employees</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{company.location}</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{company.revenue}</span>
                      </div>
                      <div className="text-sm">
                        <span className="text-muted-foreground">Contacts: </span>
                        <span className="font-medium">{company.contacts}</span>
                      </div>
                      <div className="text-sm">
                        <span className="text-muted-foreground">Deals: </span>
                        <span className="font-medium">{company.deals}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between pt-4 border-t border-border/30">
                    <Badge variant={
                      company.status === "Active Client" ? "default" : 
                      company.status === "Prospect" ? "secondary" : "outline"
                    }>
                      {company.status}
                    </Badge>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">{company.lastActivity}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="contracts" className="space-y-6">
          {/* Search and Filters for Contracts */}
          <Card className="bg-gradient-surface border-border/50">
            <CardContent className="p-4">
              <div className="flex gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search contracts by company or contract type..." 
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

          {/* Contracts Table */}
          <Card className="bg-gradient-surface border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Executed Contracts
              </CardTitle>
              <CardDescription>
                Active and completed contracts with your clients
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {executedContracts.map((contract) => (
                  <div key={contract.id} className="flex items-center justify-between p-4 rounded-lg bg-background/50 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-lg bg-gradient-primary flex items-center justify-center">
                        <FileText className="h-5 w-5 text-primary-foreground" />
                      </div>
                      <div>
                        <h4 className="font-medium">{contract.company}</h4>
                        <p className="text-sm text-muted-foreground">{contract.contractType}</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-4 gap-8 flex-1 max-w-2xl">
                      <div className="text-center">
                        <div className="flex items-center gap-1 justify-center">
                          <DollarSign className="h-4 w-4 text-success" />
                          <span className="font-semibold text-success">{contract.value}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">Contract Value</p>
                      </div>
                      
                      <div className="text-center">
                        <p className="font-medium">{contract.startDate}</p>
                        <p className="text-xs text-muted-foreground">Start Date</p>
                      </div>
                      
                      <div className="text-center">
                        <p className="font-medium">{contract.endDate}</p>
                        <p className="text-xs text-muted-foreground">End Date</p>
                      </div>
                      
                      <div className="text-center">
                        <Badge variant={contract.status === "Active" ? "default" : "secondary"} className="flex items-center gap-1">
                          {contract.status === "Active" ? <CheckCircle className="h-3 w-3" /> : null}
                          {contract.status}
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">Renewal: {contract.renewalDate}</p>
                      </div>
                    </div>
                    
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
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