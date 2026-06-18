import { useNavigate } from "react-router-dom"
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { ThemeToggle } from "@/components/theme-toggle"
import { FloatingQuickAdd } from "@/components/floating-quick-add"
import { Bell, Search, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/hooks/useAuth"

interface LayoutProps {
  children: React.ReactNode
}

export function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    navigate("/", { replace: true })
    await logout()
  }

  return (
    <SidebarProvider defaultOpen={false}>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        
        <main className="flex-1 flex flex-col">
          {/* Header */}
          <header className="h-16 border-b border-border/50 bg-gradient-surface flex items-center justify-between px-4 sm:px-6 shadow-card">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="h-8 w-8" />
              
              <div className="relative w-full max-w-96 hidden sm:block">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="app-header-search"
                  name="app-header-search"
                  type="search"
                  autoComplete="off"
                  readOnly
                  onFocus={(e) => e.currentTarget.removeAttribute("readonly")}
                  placeholder="Search contacts, companies, deals..."
                  className="pl-10 bg-background/50 border-border/50 focus:bg-background"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              {/* Mobile search button */}
              <Button variant="ghost" size="icon" className="sm:hidden hover-glow">
                <Search className="h-5 w-5" />
              </Button>

              {/* Notifications */}
              <Button variant="ghost" size="icon" className="relative hover-glow">
                <Bell className="h-5 w-5" />
                <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center bg-primary text-primary-foreground text-xs">
                  0
                </Badge>
              </Button>

              {/* Theme Toggle */}
              <ThemeToggle />

              {user && (
                <span className="hidden md:inline text-sm text-muted-foreground truncate max-w-[180px]">
                  {user.email}
                </span>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="hover-glow gap-2"
                onClick={handleLogout}
                title="Log out"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </div>
          </header>

          {/* Main Content */}
          <div className="flex-1 overflow-auto bg-background">
            {children}
          </div>
        </main>
        
        {/* Floating Quick Add Button */}
        <FloatingQuickAdd />
      </div>
    </SidebarProvider>
  )
}