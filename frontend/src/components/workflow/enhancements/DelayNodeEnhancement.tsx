import { DelayCountdown } from '../components/DelayCountdown'
import { NodeEnhancement } from './NodeEnhancementRegistry'

export const delayNodeEnhancement: NodeEnhancement = {
  nodeTypes: ['delay'],
  
  renderOverlay: (context) => {
    const { nodeId, parameters, isExecuting, executionResult } = context
    
    // Check if delay parameters are configured
    if (!parameters?.amount || !parameters?.timeUnit) {
      return null
    }

    // Calculate total milliseconds
    const totalMs = parameters.amount * (
      parameters.timeUnit === 'seconds' ? 1000 :
      parameters.timeUnit === 'minutes' ? 60000 :
      parameters.timeUnit === 'hours' ? 3600000 : 1000
    )

    // Use a key that changes on each execution to force re-mount
    // This ensures the timer resets properly between executions
    const key = `${nodeId}-${executionResult?.startTime || 'idle'}`

    return (
      <div key={key} className="absolute bottom-1 right-1 z-10">
        <DelayCountdown
          totalMs={totalMs}
          startTime={executionResult?.startTime}
          isRunning={isExecuting}
          timeUnit={parameters.timeUnit}
        />
      </div>
    )
  },
}
