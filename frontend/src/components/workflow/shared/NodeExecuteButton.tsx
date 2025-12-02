import { memo } from 'react'
import { CheckCircle, Loader2, Play, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface NodeExecuteButtonProps {
  onClick: () => void
  isExecuting?: boolean
  disabled?: boolean
  /** Execution status for showing badge */
  status?: 'success' | 'error' | 'running' | 'pending' | 'skipped' | null
  size?: 'sm' | 'default'
  variant?: 'ghost' | 'outline'
  showStatusBadge?: boolean
  className?: string
}

/**
 * Shared execute button for nodes
 * Used in QuickSettingsPanel and NodeConfigDialog
 */
export const NodeExecuteButton = memo(function NodeExecuteButton({
  onClick,
  isExecuting = false,
  disabled = false,
  status,
  size = 'default',
  variant = 'outline',
  showStatusBadge = false,
  className,
}: NodeExecuteButtonProps) {
  const isSmall = size === 'sm'
  const iconSize = isSmall ? 'h-3.5 w-3.5' : 'h-4 w-4'
  const buttonSize = isSmall ? 'h-6 w-6' : 'h-8 w-8'

  return (
    <div className="relative">
      <Button
        onClick={onClick}
        disabled={disabled || isExecuting}
        size="icon"
        variant={variant}
        className={cn(buttonSize, className)}
        title="Execute node"
      >
        {isExecuting ? (
          <Loader2 className={cn(iconSize, 'animate-spin')} />
        ) : (
          <Play className={iconSize} />
        )}
      </Button>
      
      {/* Status badge - positioned at top-right corner */}
      {showStatusBadge && status === 'success' && (
        <CheckCircle className="absolute -top-1 -right-1 w-3.5 h-3.5 text-green-600 bg-white rounded-full" />
      )}
      {showStatusBadge && status === 'error' && (
        <XCircle className="absolute -top-1 -right-1 w-3.5 h-3.5 text-red-600 bg-white rounded-full" />
      )}
    </div>
  )
})
