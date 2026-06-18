import * as React from "react"
import { Eye, EyeOff } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const PasswordInput = React.forwardRef<
  HTMLInputElement,
  Omit<React.ComponentProps<typeof Input>, "type">
>(({ className, disabled, ...props }, ref) => {
  const [showPassword, setShowPassword] = React.useState(false)

  return (
    <div className="relative w-full">
      <Input
        type={showPassword ? "text" : "password"}
        className={cn("pr-10", className)}
        disabled={disabled}
        ref={ref}
        {...props}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        disabled={disabled}
        aria-label={showPassword ? "Hide password" : "Show password"}
        aria-pressed={showPassword}
        onClick={() => setShowPassword((prev) => !prev)}
      >
        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </Button>
    </div>
  )
})
PasswordInput.displayName = "PasswordInput"

export { PasswordInput }
