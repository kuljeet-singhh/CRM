import { useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  Users, 
  Building2, 
  Target, 
  CheckSquare,
  Plus
} from "lucide-react"

interface QuickAddModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function QuickAddModal({ open, onOpenChange }: QuickAddModalProps) {
  const navigate = useNavigate()

  const quickAddItems = [
    {
      title: "Contact",
      description: "Add a new contact to your CRM",
      icon: Users,
      action: () => {
        navigate("/contacts?action=add")
        onOpenChange(false)
      }
    },
    {
      title: "Company", 
      description: "Create a new company profile",
      icon: Building2,
      action: () => {
        navigate("/companies?action=add")
        onOpenChange(false)
      }
    },
    {
      title: "Deal",
      description: "Start tracking a new deal",
      icon: Target,
      action: () => {
        navigate("/pipeline?action=add")
        onOpenChange(false)
      }
    },
    {
      title: "Task",
      description: "Create a new task or reminder",
      icon: CheckSquare,
      action: () => {
        navigate("/tasks?action=add")
        onOpenChange(false)
      }
    }
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Quick Add
          </DialogTitle>
        </DialogHeader>
        
        <div className="grid grid-cols-2 gap-3 p-4">
          {quickAddItems.map((item) => (
            <Card 
              key={item.title}
              className="cursor-pointer hover:shadow-md hover:scale-105 transition-all duration-200 border-border/50"
              onClick={item.action}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <item.icon className="h-4 w-4 text-primary" />
                  {item.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <CardDescription className="text-xs">
                  {item.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}