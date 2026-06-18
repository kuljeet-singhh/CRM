import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Filter, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"

export interface UserFilterProps {
  selectedUsers: string[]
  onUserSelectionChange: (users: string[]) => void
  showAllOption?: boolean
}

const salesPeople = ["Sammy", "John", "Tim"]

export function UserFilter({ selectedUsers, onUserSelectionChange, showAllOption = true }: UserFilterProps) {
  const handleUserToggle = (user: string) => {
    if (selectedUsers.includes(user)) {
      onUserSelectionChange(selectedUsers.filter(u => u !== user))
    } else {
      onUserSelectionChange([...selectedUsers, user])
    }
  }

  const handleSelectAll = () => {
    if (selectedUsers.length === salesPeople.length) {
      onUserSelectionChange([])
    } else {
      onUserSelectionChange(salesPeople)
    }
  }

  const getDisplayText = () => {
    if (selectedUsers.length === 0) return "All Users"
    if (selectedUsers.length === salesPeople.length) return "All Users"
    if (selectedUsers.length === 1) return selectedUsers[0]
    return `${selectedUsers.length} Users`
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          {getDisplayText()}
          {selectedUsers.length > 0 && selectedUsers.length < salesPeople.length && (
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
              {selectedUsers.length}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end">
        <DropdownMenuLabel>Filter by Sales Person</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {showAllOption && (
          <>
            <DropdownMenuCheckboxItem
              checked={selectedUsers.length === salesPeople.length || selectedUsers.length === 0}
              onCheckedChange={handleSelectAll}
            >
              All Users
            </DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
          </>
        )}
        
        {salesPeople.map((user) => (
          <DropdownMenuCheckboxItem
            key={user}
            checked={selectedUsers.includes(user)}
            onCheckedChange={() => handleUserToggle(user)}
          >
            {user}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}