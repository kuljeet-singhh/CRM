import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { QuickAddModal } from "./quick-add-modal"

export function FloatingQuickAdd() {
  const [isModalOpen, setIsModalOpen] = useState(false)

  return (
    <>
      <Button
        onClick={() => setIsModalOpen(true)}
        size="lg"
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full bg-gradient-primary text-primary-foreground shadow-lg hover:shadow-xl hover:scale-110 transition-all duration-200 z-50"
      >
        <Plus className="h-6 w-6" />
      </Button>
      
      <QuickAddModal 
        open={isModalOpen} 
        onOpenChange={setIsModalOpen}
      />
    </>
  )
}