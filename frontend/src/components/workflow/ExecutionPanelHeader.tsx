import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useWorkflowOperations } from '@/hooks/workflow/useWorkflowOperations'
import { useReactFlowUIStore } from '@/stores'
import { ExecutionState } from '@/types'
import { CheckCircle, ChevronDown, ChevronUp, PanelRight } from 'lucide-react'

interface ExecutionPanelHeaderProps {
  executionState: ExecutionState
  isExpanded: boolean
  onToggle: () => void
}

export function ExecutionPanelHeader({ 
  executionState, 
  isExpanded, 
  onToggle
}: ExecutionPanelHeaderProps) {
  const { validateAndShowResult } = useWorkflowOperations()
  const { showRightSidebar, toggleRightSidebar } = useReactFlowUIStore()
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/30'
      case 'error': return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30'
      case 'cancelled': return 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-950/30'
      case 'running': return 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30'
      case 'skipped': return 'text-muted-foreground bg-muted'
      default: return 'text-muted-foreground bg-muted'
    }
  }

  return (
    <div className="flex items-center justify-between px-3 py-1.5 border-b border-border flex-shrink-0 bg-background">
      <div className="flex items-center space-x-3">
        <h3 className="font-medium text-sm text-foreground">Execution Panel</h3>
        {executionState.executionId && (
          <span className="text-xs text-muted-foreground">ID: {executionState.executionId}</span>
        )}
        <div className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(executionState.status)}`}>
          {executionState.status.toUpperCase()}
        </div>
        {executionState.progress !== undefined && (
          <div className="text-xs text-muted-foreground">
            {executionState.progress}%
          </div>
        )}
      </div>
      <div className="flex items-center space-x-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={validateAndShowResult}
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
            >
              <CheckCircle className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Validate workflow</p>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={toggleRightSidebar}
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
            >
              <PanelRight className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{showRightSidebar ? 'Hide sidebar' : 'Show sidebar'}</p>
          </TooltipContent>
        </Tooltip>
        <button
          onClick={onToggle}
          className="text-muted-foreground hover:text-foreground p-1 transition-colors"
          title={isExpanded ? "Minimize execution panel" : "Expand execution panel"}
        >
          {isExpanded ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </button>
      </div>
    </div>
  )
}
