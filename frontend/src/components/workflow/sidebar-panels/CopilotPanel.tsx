import { memo } from 'react'
import { Bot, Sparkles } from 'lucide-react'

export const CopilotPanel = memo(function CopilotPanel() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
      <div className="relative mb-4">
        <Bot className="h-12 w-12 opacity-50" />
        <Sparkles className="h-4 w-4 absolute -top-1 -right-1 text-yellow-500" />
      </div>
      <h3 className="text-sm font-medium mb-1">Copilot</h3>
      <p className="text-xs text-center opacity-70">
        AI-powered workflow assistance coming soon
      </p>
    </div>
  )
})
