import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@/components/ui/tooltip'
import { useWorkflowStore, useNodeTypes } from '@/stores'
import { WorkflowNode } from '@/types/workflow'
import { getTriggerNodes, getTriggerType } from '@/utils/triggerUtils'
import {
  ChevronDown,
  Clock,
  Globe,
  Hand,
  Loader2,
  Play,
  Zap
} from 'lucide-react'
import { useMemo, useState } from 'react'

interface WorkflowExecuteButtonProps {
  onExecute?: (triggerNodeId?: string) => void
  disabled?: boolean
  className?: string
}

// Map trigger types to icons (using triggerType values, not node identifiers)
const triggerIcons: Record<string, any> = {
  'manual': Hand,
  'webhook': Globe,
  'schedule': Clock,
  'polling': Clock,
  'workflow-called': Zap,
  default: Zap
}

// Map trigger types to display names (using triggerType values)
const triggerDisplayNames: Record<string, string> = {
  'manual': 'Manual Trigger',
  'webhook': 'Webhook Trigger', 
  'schedule': 'Schedule Trigger',
  'polling': 'Polling Trigger',
  'workflow-called': 'Called by Workflow',
  default: 'Trigger'
}

export function WorkflowExecuteButton({ 
  onExecute, 
  disabled = false,
  className = '' 
}: WorkflowExecuteButtonProps) {
  const { workflow, executionState } = useWorkflowStore()
  const { activeNodeTypes } = useNodeTypes()
  const [isExecuting, setIsExecuting] = useState(false)

  // Find all trigger nodes in the workflow using node definitions
  const triggerNodes = useMemo(() => {
    if (!workflow?.nodes || !activeNodeTypes.length) return []
    return getTriggerNodes(workflow.nodes, activeNodeTypes)
  }, [workflow?.nodes, activeNodeTypes])

  // Check if workflow is currently executing
  const isCurrentlyExecuting = executionState?.status === 'running' || isExecuting

  // Handle execution
  const handleExecute = async (triggerNodeId?: string) => {
    if (disabled || isCurrentlyExecuting || !onExecute) return
    
    try {
      setIsExecuting(true)
      await onExecute(triggerNodeId)
    } catch (error) {
      console.error('Failed to execute workflow:', error)
    } finally {
      setIsExecuting(false)
    }
  }

  // Get icon for trigger node
  const getTriggerIcon = (node: WorkflowNode) => {
    const triggerType = getTriggerType(node, activeNodeTypes)
    const IconComponent = triggerType ? (triggerIcons[triggerType] || triggerIcons.default) : triggerIcons.default
    return IconComponent
  }

  // Get display name for trigger node
  const getTriggerDisplayName = (node: WorkflowNode, nodeName: string) => {
    const triggerType = getTriggerType(node, activeNodeTypes)
    const displayName = triggerType ? (triggerDisplayNames[triggerType] || triggerDisplayNames.default) : triggerDisplayNames.default
    return `${nodeName} (${displayName})`
  }

  // No triggers - render disabled button
  if (triggerNodes.length === 0) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-block">
            <Button
              disabled={true}
              variant="outline"
              size="sm"
              className={`h-7 w-7 p-0 ${className}`}
            >
              <Play className="h-3.5 w-3.5 text-gray-400" />
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>Add a trigger node to execute workflow</p>
        </TooltipContent>
      </Tooltip>
    )
  }

  // Single trigger - render simple button
  if (triggerNodes.length === 1) {
    const trigger = triggerNodes[0]
    
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={() => handleExecute(trigger.id)}
            disabled={disabled || isCurrentlyExecuting}
            variant="outline"
            size="sm"
            className={`h-7 w-7 p-0 ${className}`}
          >
            {isCurrentlyExecuting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5 text-green-600" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Execute workflow from {getTriggerDisplayName(trigger, trigger.name)}</p>
        </TooltipContent>
      </Tooltip>
    )
  }

  // Multiple triggers - render dropdown
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              disabled={disabled || isCurrentlyExecuting}
              variant="outline"
              size="sm"
              className={`h-7 px-1.5 ${className}`}
            >
              {isCurrentlyExecuting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Play className="h-3.5 w-3.5 text-green-600" />
              )}
              <ChevronDown className="h-2.5 w-2.5 ml-0.5" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>
          <p>Execute workflow (multiple triggers available)</p>
        </TooltipContent>
      </Tooltip>
      
      <DropdownMenuContent align="end" className="w-56">
        {triggerNodes.map((trigger) => {
          const TriggerIcon = getTriggerIcon(trigger)
          
          return (
            <DropdownMenuItem
              key={trigger.id}
              onClick={() => handleExecute(trigger.id)}
              disabled={isCurrentlyExecuting}
              className="text-xs"
            >
              <TriggerIcon className="mr-2 h-3.5 w-3.5" />
              {getTriggerDisplayName(trigger, trigger.name)}
            </DropdownMenuItem>
          )
        })}
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem
          onClick={() => handleExecute()}
          disabled={isCurrentlyExecuting}
          className="text-xs font-medium"
        >
          <Play className="mr-2 h-3.5 w-3.5" />
          Execute from first trigger
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
