import { ExecutionState } from '@/types'
import { Play } from 'lucide-react'

interface ProgressTabContentProps {
  executionState: ExecutionState
}

export function ProgressTabContent({ executionState }: ProgressTabContentProps) {
  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    return `${(ms / 60000).toFixed(1)}m`
  }

  // Show placeholder if no execution has started
  if (!executionState.startTime && executionState.status === 'idle') {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Play className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <h3 className="font-medium text-sm mb-2">No Execution Data</h3>
        <p className="text-xs text-muted-foreground max-w-[250px]">
          Execute the workflow to see progress information
        </p>
      </div>
    )
  }

  return (
    <div className="p-4 bg-background">
      {executionState.status === 'running' && (
        <div className="mb-4">
          <div className="flex justify-between text-sm text-muted-foreground mb-1">
            <span>Progress</span>
            <span>{executionState.progress || 0}%</span>
          </div>
          <div className="w-full bg-secondary rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all duration-300"
              style={{ width: `${executionState.progress || 0}%` }}
            />
          </div>
        </div>
      )}

      {executionState.startTime && (
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Started:</span>
            <div className="font-medium text-foreground">
              {new Date(executionState.startTime).toLocaleString()}
            </div>
          </div>
          {executionState.endTime && (
            <div>
              <span className="text-muted-foreground">Duration:</span>
              <div className="font-medium text-foreground">
                {formatDuration(new Date(executionState.endTime).getTime() - new Date(executionState.startTime).getTime())}
              </div>
            </div>
          )}
        </div>
      )}

      {executionState.status === 'error' && executionState.error && (
        <div className="mt-4 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded">
          <div className="text-red-800 dark:text-red-400 font-medium">Error</div>
          <div className="text-red-700 dark:text-red-300 text-sm mt-1">{executionState.error}</div>
        </div>
      )}
    </div>
  )
}
