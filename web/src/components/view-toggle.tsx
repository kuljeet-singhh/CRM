import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Grid, List } from "lucide-react"

interface ViewToggleProps {
  view: "list" | "card"
  onViewChange: (view: "list" | "card") => void
}

export function ViewToggle({ view, onViewChange }: ViewToggleProps) {
  return (
    <ToggleGroup 
      type="single" 
      value={view} 
      onValueChange={(value) => value && onViewChange(value as "list" | "card")}
      className="border rounded-lg"
    >
      <ToggleGroupItem value="list" aria-label="List view" size="sm">
        <List className="h-4 w-4" />
      </ToggleGroupItem>
      <ToggleGroupItem value="card" aria-label="Card view" size="sm">
        <Grid className="h-4 w-4" />
      </ToggleGroupItem>
    </ToggleGroup>
  )
}