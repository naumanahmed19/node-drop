import { memo, useState } from 'react'
import { AlertCircle } from 'lucide-react'
import { NodeIconRenderer } from '@/components/common/NodeIconRenderer'
import { Input } from '@/components/ui/input'
import { NodeExecuteButton } from './NodeExecuteButton'
import { NodeType } from '@/types'
import { cn } from '@/lib/utils'

interface NodeHeaderProps {
  nodeType: NodeType
  nodeName: string
  onNameChange?: (name: string) => void
  onExecute?: () => void
  isExecuting?: boolean
  executionDisabled?: boolean
  executionStatus?: 'success' | 'error' | 'running' | 'pending' | 'skipped' | null
  nameError?: string | null
  readOnly?: boolean
  size?: 'sm' | 'default'
  showExecuteButton?: boolean
  /** Additional actions to render after the execute button */
  actions?: React.ReactNode
}

/**
 * Shared node header component with icon, editable title, and execute button
 * Used by QuickSettingsPanel and NodeConfigDialog's MiddleColumn
 */
export const NodeHeader = memo(function NodeHeader({
  nodeType,
  nodeName,
  onNameChange,
  onExecute,
  isExecuting = false,
  executionDisabled = false,
  executionStatus,
  nameError,
  readOnly = false,
  size = 'default',
  showExecuteButton = true,
  actions,
}: NodeHeaderProps) {
  const [isEditingName, setIsEditingName] = useState(false)

  const isSmall = size === 'sm'
  const iconSize = isSmall ? 'sm' : 'lg'
  const padding = isSmall ? 'px-3 py-2' : 'p-4'
  const height = isSmall ? '' : 'h-[72px]'
  const textSize = isSmall ? 'text-sm' : 'text-sm'
  const gap = isSmall ? 'gap-2' : 'space-x-3'

  return (
    <div className={cn('flex-shrink-0 border-b bg-muted/30 dark:bg-muted/20 flex items-center', padding, height)}>
      <div className="flex items-center justify-between w-full">
        <div className={cn('flex items-center flex-1 min-w-0', gap)}>
          <NodeIconRenderer
            icon={nodeType.icon}
            nodeType={nodeType.identifier}
            nodeGroup={nodeType.group}
            displayName={nodeType.displayName}
            backgroundColor={nodeType.color}
            size={iconSize}
            className={isSmall ? 'rounded' : 'rounded-lg'}
          />
          <div className="flex-1 min-w-0">
            {isEditingName && !readOnly && onNameChange ? (
              <Input
                value={nodeName}
                onChange={(e) => onNameChange(e.target.value)}
                onBlur={() => setIsEditingName(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setIsEditingName(false)
                  }
                }}
                className={cn(
                  'font-semibold border-none bg-transparent p-0 h-auto focus-visible:ring-0',
                  textSize,
                  nameError ? 'text-red-600' : ''
                )}
                placeholder="Node name..."
                autoFocus
              />
            ) : (
              <div
                onClick={() => !readOnly && onNameChange && setIsEditingName(true)}
                className={cn(
                  'font-semibold px-1 py-0.5 rounded transition-colors truncate',
                  textSize,
                  !readOnly && onNameChange ? 'cursor-pointer hover:bg-muted' : ''
                )}
              >
                {nodeName || nodeType.displayName}
              </div>
            )}
            {nameError && (
              <div className="flex items-center space-x-1 mt-1 text-xs text-red-600">
                <AlertCircle className="w-3 h-3" />
                <span className="text-xs">{nameError}</span>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {showExecuteButton && !readOnly && onExecute && (
            <NodeExecuteButton
              onClick={onExecute}
              isExecuting={isExecuting}
              disabled={executionDisabled}
              status={executionStatus}
              size={size}
              showStatusBadge
            />
          )}
          {actions}
        </div>
      </div>
    </div>
  )
})
