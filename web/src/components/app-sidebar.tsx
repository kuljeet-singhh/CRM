import { useState } from "react"
import { NavLink, useLocation } from "react-router-dom"
import {
  BarChart3,
  Users,
  Building2,
  Target,
  CheckSquare,
  Mail,
  CalendarDays,
  FileText,
  FileImage,
  Mic,
  Settings,
  Zap,
  PlusCircle
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { ImageToTextModal } from "@/components/ocr/ImageToTextModal"
import { VoiceToTextModal } from "@/components/speech/VoiceToTextModal"

const mainItems = [
  { title: "Dashboard", url: "/dashboard", icon: BarChart3 },
  { title: "Contacts", url: "/contacts", icon: Users },
  { title: "Companies", url: "/companies", icon: Building2 },
  { title: "Pipeline", url: "/pipeline", icon: Target },
  { title: "Tasks", url: "/tasks", icon: CheckSquare },
]

const toolsItems = [
  { title: "Message Center", url: "/email", icon: Mail },
  { title: "Calendar", url: "/calendar", icon: CalendarDays },
  { title: "Reports", url: "/reports", icon: FileText },
  { title: "AI Assistant", url: "/ai", icon: Zap },
]

const LOGO_SRC = "/lovable-uploads/0b9c7f97-1df2-4153-bbff-77746b7573aa.png"

export function AppSidebar() {
  const { state } = useSidebar()
  const location = useLocation()
  const currentPath = location.pathname
  const isCollapsed = state === "collapsed"
  const [imageToTextOpen, setImageToTextOpen] = useState(false)
  const [voiceToTextOpen, setVoiceToTextOpen] = useState(false)

  const isActive = (path: string) => currentPath === path
  const getNavClass = (path: string) =>
    isActive(path) 
      ? "bg-primary/10 text-primary border-r-2 border-primary font-medium" 
      : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"

  return (
    <>
      <Sidebar collapsible="icon">
      <SidebarContent className="bg-gradient-surface border-r border-border/50">
        {/* Logo/Brand */}
        <div
          className={
            isCollapsed
              ? "flex justify-center items-center p-2 border-b border-border/50"
              : "p-4 border-b border-border/50"
          }
        >
          {!isCollapsed ? (
            <div className="flex items-center gap-3">
              <img
                src={LOGO_SRC}
                alt="FlyCRM Logo"
                className="size-8 shrink-0 object-contain"
              />
              <div>
                <h2 className="font-bold text-lg gradient-text">FlyCRM</h2>
                <p className="text-xs text-muted-foreground">AI-Powered by WurkNow</p>
              </div>
            </div>
          ) : (
            <img
              src={LOGO_SRC}
              alt="FlyCRM Logo"
              className="size-8 shrink-0 object-contain"
            />
          )}
        </div>

        {/* Quick Actions */}
        {!isCollapsed && (
          <div className="p-4">
            <Button className="w-full bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-accent">
              <PlusCircle className="h-4 w-4 mr-2" />
              New Deal
            </Button>
          </div>
        )}

        {/* Main Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4">
            {isCollapsed ? "—" : "Main"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild className="h-10">
                    <NavLink 
                      to={item.url} 
                      end 
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 ${getNavClass(item.url)}`}
                    >
                      <item.icon className="h-5 w-5" />
                      {!isCollapsed && <span className="font-medium">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Tools */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4">
            {isCollapsed ? "⚡" : "Tools"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {toolsItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild className="h-10">
                    <NavLink 
                      to={item.url} 
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 ${getNavClass(item.url)}`}
                    >
                      <item.icon className="h-5 w-5" />
                      {!isCollapsed && <span className="font-medium">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              <SidebarMenuItem>
                <SidebarMenuButton
                  type="button"
                  title="Extract text"
                  className="h-10 flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                  onClick={() => setImageToTextOpen(true)}
                >
                  <FileImage className="h-5 w-5" />
                  {!isCollapsed && <span className="font-medium">Extract text</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  type="button"
                  title="Dictate text"
                  className="h-10 flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                  onClick={() => setVoiceToTextOpen(true)}
                >
                  <Mic className="h-5 w-5" />
                  {!isCollapsed && <span className="font-medium">Dictate text</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Settings */}
        <div className="mt-auto p-4 border-t border-border/50">
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="h-10">
              <NavLink 
                to="/settings" 
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 ${getNavClass("/settings")}`}
              >
                <Settings className="h-5 w-5" />
                {!isCollapsed && <span className="font-medium">Settings</span>}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </div>
      </SidebarContent>
      </Sidebar>
      <ImageToTextModal open={imageToTextOpen} onOpenChange={setImageToTextOpen} />
      <VoiceToTextModal open={voiceToTextOpen} onOpenChange={setVoiceToTextOpen} />
    </>
  )
}