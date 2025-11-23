import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { SidebarTrigger } from '@/components/ui/sidebar'
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger
} from '@/components/ui/tooltip'
import type { ExecutionDetails } from '@/services/execution'
import { useWorkflowStore } from '@/stores'
import {
    Activity,
    ArrowLeft,
    CheckCircle,
    Clock,
    Eye,
    Loader2,
    XCircle
} from 'lucide-react'
import { WorkflowBreadcrumb } from './WorkflowBreadcrumb'

interface ExecutionToolbarProps {
  execution: ExecutionDetails
  onBack: () => void
}

export function ExecutionToolbar({
  execution,
  onBack
}: ExecutionToolbarProps) {
  const { 
    workflow,
    workflowTitle: mainWorkflowTitle,
  } = useWorkflowStore()

  return (
    <TooltipProvider>
      <header className="flex items-center px-3 py-1.5 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border/40 shadow-sm min-h-[48px]">
        {/* Left section - Sidebar trigger, Back button and Breadcrumb */}
        <div className="flex items-center space-x-3 flex-1 min-w-0">
          {/* Sidebar Trigger */}
          <SidebarTrigger className="-ml-1 h-7 w-7" />

          {/* Back Button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={onBack}
                className="h-7 px-2.5 text-xs"
              >
                <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
                Back to Workflow
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Return to workflow editor</p>
            </TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="h-4" />

          {/* Workflow Breadcrumb - Read Only */}
          <div className="min-w-0 flex-1 overflow-hidden">
            <WorkflowBreadcrumb
              category={workflow?.category}
              title={mainWorkflowTitle}
              onCategoryChange={() => {}} // No-op in execution mode
              onTitleChange={() => {}} // No-op in execution mode
            />
          </div>
        </div>

        {/* Center section - Execution Info */}
        <div className="flex items-center justify-center space-x-3">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Viewing Execution</span>
            <Badge variant="outline">
              {execution.status === 'running' && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
              {execution.status === 'success' && <CheckCircle className="w-3 h-3 mr-1 text-green-600" />}
              {execution.status === 'error' && <XCircle className="w-3 h-3 mr-1 text-red-600" />}
              {execution.status}
            </Badge>
          </div>
        </div>

        {/* Right section - Execution Details */}
        <div className="flex items-center space-x-3 flex-1 justify-end">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            {/* Number of nodes executed */}
            {execution.nodeExecutions && execution.nodeExecutions.length > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5" />
                    <span className="text-xs">
                      {execution.nodeExecutions.length} node{execution.nodeExecutions.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Number of nodes executed</p>
                </TooltipContent>
              </Tooltip>
            )}

            {/* Execution start time */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  <span className="text-xs">
                    {new Date(execution.startedAt).toLocaleString()}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Execution started at</p>
              </TooltipContent>
            </Tooltip>
            
            {/* Execution duration */}
            {execution.finishedAt && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium">
                      {Math.round((new Date(execution.finishedAt).getTime() - new Date(execution.startedAt).getTime()) / 1000)}s
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Total execution duration</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
      </header>
    </TooltipProvider>
  )
}
