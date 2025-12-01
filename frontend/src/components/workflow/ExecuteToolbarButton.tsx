import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { AlertCircle, CheckCircle, Loader2, Play, RotateCcw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { ExecuteToolbarButtonProps } from './types'

export function ExecuteToolbarButton({
  nodeId,
  nodeType,
  isExecuting,
  canExecute,
  hasError = false,
  hasSuccess = false,
  executionError,
  onExecute,
  onRetry,
  className
}: ExecuteToolbarButtonProps) {
  // Local state for success feedback timing
  const [showSuccess, setShowSuccess] = useState(false)
  // Local state for retry countdown
  const [retryCountdown, setRetryCountdown] = useState(0)
  // Ref for live region announcements
  const liveRegionRef = useRef<HTMLDivElement>(null)

  // Handle success state display timing
  useEffect(() => {
    if (hasSuccess && !isExecuting) {
      setShowSuccess(true)
      const timer = setTimeout(() => {
        setShowSuccess(false)
      }, 2000) // Show success for 2 seconds
      return () => clearTimeout(timer)
    } else {
      setShowSuccess(false)
    }
  }, [hasSuccess, isExecuting])

  // Handle retry countdown for retryable errors
  useEffect(() => {
    if (executionError?.isRetryable && executionError.retryAfter) {
      const retryAfterMs = executionError.retryAfter
      const startTime = Date.now()
      
      const updateCountdown = () => {
        const elapsed = Date.now() - startTime
        const remaining = Math.max(0, Math.ceil((retryAfterMs - elapsed) / 1000))
        setRetryCountdown(remaining)
        
        if (remaining > 0) {
          setTimeout(updateCountdown, 1000)
        }
      }
      
      updateCountdown()
    } else {
      setRetryCountdown(0)
    }
  }, [executionError])

  // Announce state changes to screen readers
  useEffect(() => {
    if (liveRegionRef.current) {
      if (isExecuting) {
        liveRegionRef.current.textContent = `Executing ${nodeType}`
      } else if (showSuccess) {
        liveRegionRef.current.textContent = `${nodeType} executed successfully`
      } else if (hasError && executionError) {
        liveRegionRef.current.textContent = `${nodeType} execution failed: ${executionError.userFriendlyMessage}`
      } else {
        liveRegionRef.current.textContent = ''
      }
    }
  }, [isExecuting, showSuccess, hasError, executionError, nodeType])

  const handleClick = (event: React.MouseEvent) => {
    event.stopPropagation()
    
    // If there's an error and retry is available, use retry handler
    if (hasError && executionError?.isRetryable && onRetry && retryCountdown === 0) {
      onRetry(nodeId)
    } else if (canExecute && !isExecuting && !hasError) {
      // Only execute if there's no error or if error is cleared
      onExecute(nodeId)
    }
    // For non-retryable errors, do nothing
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    // Handle activation keys
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      event.stopPropagation()
      
      // If there's an error and retry is available, use retry handler
      if (hasError && executionError?.isRetryable && onRetry && retryCountdown === 0) {
        onRetry(nodeId)
      } else if (canExecute && !isExecuting && !hasError) {
        // Only execute if there's no error or if error is cleared
        onExecute(nodeId)
      }
      // For non-retryable errors, do nothing
    }
    // Allow Tab navigation without stopping propagation
    else if (event.key === 'Tab') {
      // Let the default tab behavior work
      return
    }
    // Stop other keys from propagating to prevent interference
    else {
      event.stopPropagation()
    }
  }

  const getIcon = () => {
    if (showSuccess) {
      return <CheckCircle className="w-3 h-3" />
    }
    if (hasError) {
      // Show retry icon for retryable errors, alert for non-retryable
      if (executionError?.isRetryable && retryCountdown === 0) {
        return <RotateCcw className="w-3 h-3" />
      }
      return <AlertCircle className="w-3 h-3" />
    }
    if (isExecuting) {
      return <Loader2 className="w-3 h-3 animate-spin" />
    }
    return <Play className="w-3 h-3" />
  }

  const getAriaLabel = () => {
    if (showSuccess) {
      return `${nodeType} execution completed successfully`
    }
    if (hasError && executionError) {
      if (executionError.isRetryable) {
        if (retryCountdown > 0) {
          return `${nodeType} execution failed - retry available in ${retryCountdown} seconds`
        }
        return `${nodeType} execution failed - press Enter or Space to retry`
      }
      return `${nodeType} execution failed - ${executionError.userFriendlyMessage}`
    }
    if (isExecuting) {
      return `Executing ${nodeType}...`
    }
    if (!canExecute) {
      return `Cannot execute ${nodeType} - workflow is running or node is disabled`
    }
    return `Execute ${nodeType} - press Enter or Space to activate`
  }

  const getTooltip = () => {
    if (showSuccess) {
      return 'Execution completed successfully'
    }
    if (hasError && executionError) {
      if (executionError.isRetryable) {
        if (retryCountdown > 0) {
          return `Execution failed - retry available in ${retryCountdown}s`
        }
        return `Execution failed - click to retry\n${executionError.userFriendlyMessage}`
      }
      return `Execution failed\n${executionError.userFriendlyMessage}`
    }
    if (isExecuting) {
      return 'Executing...'
    }
    if (!canExecute) {
      return 'Cannot execute - workflow is running or node is disabled'
    }
    return `Execute ${nodeType}`
  }

  const getAriaDescription = () => {
    if (isExecuting) {
      return 'Node is currently executing. Please wait for completion.'
    }
    if (hasError && executionError) {
      if (executionError.isRetryable) {
        if (retryCountdown > 0) {
          return `Previous execution failed with a ${executionError.type} error. Retry will be available in ${retryCountdown} seconds.`
        }
        return `Previous execution failed with a ${executionError.type} error. You can retry by activating this button.`
      }
      return `Previous execution failed with a ${executionError.type} error. This error is not retryable.`
    }
    if (!canExecute) {
      return 'Execution is currently disabled. This may be because the workflow is running or the node is disabled.'
    }
    return 'Executes this node individually for testing purposes.'
  }

  const getButtonStyles = () => {
    const baseClasses = []
    
    if (showSuccess) {
      baseClasses.push('success')
    } else if (hasError) {
      if (executionError?.isRetryable && retryCountdown === 0) {
        baseClasses.push('error-retryable')
      } else {
        baseClasses.push('error')
      }
    } else if (isExecuting) {
      baseClasses.push('executing')
    }
    
    return baseClasses.join(' ')
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          'h-6 w-6 relative',
          showSuccess && 'text-green-600 hover:text-green-700 hover:bg-green-100',
          hasError && !executionError?.isRetryable && 'text-red-600 hover:text-red-700 hover:bg-red-100',
          hasError && executionError?.isRetryable && retryCountdown === 0 && 'text-amber-600 hover:text-amber-700 hover:bg-amber-100',
          hasError && executionError?.isRetryable && retryCountdown > 0 && 'text-red-600',
          isExecuting && 'text-blue-600',
          className
        )}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        disabled={!canExecute || isExecuting || (hasError && executionError?.isRetryable && retryCountdown > 0)}
        aria-label={getAriaLabel()}
        aria-describedby={`execute-button-desc-${nodeId}`}
        aria-pressed={isExecuting ? 'true' : 'false'}
        title={getTooltip()}
      >
        {getIcon()}
        {/* Show countdown for retryable errors */}
        {hasError && executionError?.isRetryable && retryCountdown > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-3.5 h-3.5 text-[10px] flex items-center justify-center font-bold" aria-hidden="true">
            {retryCountdown}
          </span>
        )}
      </Button>
      
      {/* Hidden description for screen readers */}
      <div
        id={`execute-button-desc-${nodeId}`}
        className="sr-only"
        aria-hidden="true"
      >
        {getAriaDescription()}
      </div>
      
      {/* Live region for state announcements */}
      <div
        ref={liveRegionRef}
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      />
    </>
  )
}
