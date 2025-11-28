import { ProgressTracker } from './ProgressTracker'
import { ExecutionWebSocket, ExecutionEventData } from './ExecutionWebSocket'
import { 
  NodeExecutionStatus, 
  ExecutionFlowStatus, 
  NodeVisualState,
  FlowExecutionState 
} from '@/types/execution'

/**
 * ExecutionStateManager integrates ProgressTracker with ExecutionWebSocket
 * to provide real-time node execution state management and broadcasting
 */
export class ExecutionStateManager {
  private progressTrackers: Map<string, ProgressTracker> = new Map()
  private webSocket: ExecutionWebSocket
  private activeExecutions: Map<string, ExecutionFlowStatus> = new Map()
  private listeners: Set<(state: FlowExecutionState) => void> = new Set()
  private subscriptions: Map<string, () => void> = new Map()

  constructor() {
    this.webSocket = new ExecutionWebSocket()
  }

  /**
   * Initialize the execution state manager
   */
  async initialize(): Promise<void> {
    await this.webSocket.connect()
  }

  /**
   * Start tracking an execution
   */
  async startExecution(
    executionId: string,
    nodeIds: string[],
    dependencies: Map<string, string[]>
  ): Promise<void> {
    // Create a dedicated progress tracker for this execution
    const progressTracker = new ProgressTracker()
    progressTracker.initializeNodeStates(nodeIds, dependencies)
    this.progressTrackers.set(executionId, progressTracker)

    // Subscribe to WebSocket updates for this execution
    await this.webSocket.subscribeToExecution(executionId)

    // Set up event listener for this execution
    const unsubscribe = this.webSocket.addEventListener(executionId, (data: ExecutionEventData) => {
      this.handleExecutionEvent(executionId, data)
    })

    this.subscriptions.set(executionId, unsubscribe)

    // Add to active executions
    const initialStatus = progressTracker.getExecutionFlowStatus(executionId)
    this.activeExecutions.set(executionId, initialStatus)

    // Notify listeners
    this.notifyStateChange()
  }

  /**
   * Stop tracking an execution
   */
  async stopExecution(executionId: string): Promise<void> {
    // Unsubscribe from WebSocket updates
    await this.webSocket.unsubscribeFromExecution(executionId)

    // Remove event listener
    const unsubscribe = this.subscriptions.get(executionId)
    if (unsubscribe) {
      unsubscribe()
      this.subscriptions.delete(executionId)
    }

    // Remove progress tracker
    this.progressTrackers.delete(executionId)

    // Remove from active executions
    this.activeExecutions.delete(executionId)

    // Notify listeners
    this.notifyStateChange()
  }

  /**
   * Update node status locally and broadcast via WebSocket
   */
  updateNodeStatus(
    executionId: string,
    nodeId: string,
    status: NodeExecutionStatus,
    data?: {
      progress?: number
      error?: any
      inputData?: any
      outputData?: any
      startTime?: number
      endTime?: number
    }
  ): void {
    const progressTracker = this.progressTrackers.get(executionId)
    if (!progressTracker) {
      console.warn(`No progress tracker found for execution ${executionId}`)
      return
    }

    // Update local progress tracker
    progressTracker.updateNodeStatus(executionId, nodeId, status, data)

    // Update active execution status
    const updatedStatus = progressTracker.getExecutionFlowStatus(executionId)
    this.activeExecutions.set(executionId, updatedStatus)

    // Notify listeners
    this.notifyStateChange()
  }

  /**
   * Handle incoming WebSocket execution events
   */
  private handleExecutionEvent(executionId: string, data: ExecutionEventData): void {
    const progressTracker = this.progressTrackers.get(executionId)
    if (!progressTracker) {
      console.warn(`No progress tracker found for execution ${executionId}`)
      return
    }

    switch (data.type) {
      case 'node-status-update':
        if (data.nodeId && data.status) {
          progressTracker.updateNodeStatus(
            executionId,
            data.nodeId,
            data.status,
            {
              progress: data.progress,
              error: data.error,
              inputData: data.data?.inputData,
              outputData: data.data?.outputData,
              startTime: data.data?.startTime,
              endTime: data.data?.endTime
            }
          )

          // Update active execution status
          const updatedStatus = progressTracker.getExecutionFlowStatus(executionId)
          this.activeExecutions.set(executionId, updatedStatus)
        }
        break

      case 'execution-progress':
        if (data.data) {
          // Update overall execution status from server
          const currentStatus = this.activeExecutions.get(executionId)
          if (currentStatus) {
            const updatedStatus: ExecutionFlowStatus = {
              ...currentStatus,
              overallStatus: data.data.overallStatus || currentStatus.overallStatus,
              progress: data.progress || currentStatus.progress,
              currentlyExecuting: data.data.currentlyExecuting || currentStatus.currentlyExecuting,
              completedNodes: data.data.completedNodes || currentStatus.completedNodes,
              failedNodes: data.data.failedNodes || currentStatus.failedNodes,
              queuedNodes: data.data.queuedNodes || currentStatus.queuedNodes,
              executionPath: data.data.executionPath || currentStatus.executionPath,
              estimatedTimeRemaining: data.data.estimatedTimeRemaining
            }
            this.activeExecutions.set(executionId, updatedStatus)
          }
        }
        break

      case 'node-started':
        if (data.nodeId) {
          this.updateNodeStatus(executionId, data.nodeId, NodeExecutionStatus.RUNNING, {
            startTime: typeof data.timestamp === 'number' ? data.timestamp : Date.now()
          })
        }
        break

      case 'node-completed':
        if (data.nodeId) {
          this.updateNodeStatus(executionId, data.nodeId, NodeExecutionStatus.COMPLETED, {
            endTime: typeof data.timestamp === 'number' ? data.timestamp : Date.now(),
            outputData: data.data
          })
        }
        break

      case 'node-failed':
        if (data.nodeId) {
          this.updateNodeStatus(executionId, data.nodeId, NodeExecutionStatus.FAILED, {
            endTime: typeof data.timestamp === 'number' ? data.timestamp : Date.now(),
            error: data.error
          })
        }
        break

      case 'completed':
        const completedStatus = this.activeExecutions.get(executionId)
        if (completedStatus) {
          this.activeExecutions.set(executionId, {
            ...completedStatus,
            overallStatus: 'completed'
          })
        }
        break

      case 'failed':
        const failedStatus = this.activeExecutions.get(executionId)
        if (failedStatus) {
          this.activeExecutions.set(executionId, {
            ...failedStatus,
            overallStatus: 'failed'
          })
        }
        break

      case 'cancelled':
        const cancelledStatus = this.activeExecutions.get(executionId)
        if (cancelledStatus) {
          this.activeExecutions.set(executionId, {
            ...cancelledStatus,
            overallStatus: 'cancelled'
          })
        }
        break
    }

    // Notify listeners of state change
    this.notifyStateChange()
  }

  /**
   * Get current execution flow status
   */
  getExecutionFlowStatus(executionId: string): ExecutionFlowStatus | undefined {
    return this.activeExecutions.get(executionId)
  }

  /**
   * Get node visual state for UI rendering
   */
  getNodeVisualState(nodeId: string, executionId?: string): NodeVisualState {
    // If executionId is provided, use that specific tracker
    if (executionId) {
      const progressTracker = this.progressTrackers.get(executionId)
      if (progressTracker) {
        return progressTracker.getNodeVisualState(nodeId)
      }
    }

    // Otherwise, find the node in any active execution
    for (const [, progressTracker] of this.progressTrackers) {
      const visualState = progressTracker.getNodeVisualState(nodeId)
      if (visualState.status !== NodeExecutionStatus.IDLE) {
        return visualState
      }
    }

    // Return default idle state if not found
    return {
      nodeId,
      status: NodeExecutionStatus.IDLE,
      progress: 0,
      animationState: 'idle',
      lastUpdated: Date.now()
    }
  }

  /**
   * Get all node visual states
   */
  getAllNodeVisualStates(): Map<string, NodeVisualState> {
    const allVisualStates = new Map<string, NodeVisualState>()
    
    // Combine visual states from all active executions
    for (const [, progressTracker] of this.progressTrackers) {
      const executionVisualStates = progressTracker.getAllNodeVisualStates()
      for (const [nodeId, visualState] of executionVisualStates) {
        allVisualStates.set(nodeId, visualState)
      }
    }
    
    return allVisualStates
  }

  /**
   * Get current flow execution state
   */
  getFlowExecutionState(): FlowExecutionState {
    return {
      activeExecutions: new Map(this.activeExecutions),
      nodeVisualStates: this.getAllNodeVisualStates(),
      executionHistory: [], // TODO: Implement execution history
      realTimeUpdates: this.webSocket.isConnected(),
      selectedExecution: this.activeExecutions.size > 0 ? 
        Array.from(this.activeExecutions.keys())[0] : undefined
    }
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: (state: FlowExecutionState) => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /**
   * Reset all state
   */
  reset(): void {
    // Clear all subscriptions
    for (const [executionId, unsubscribe] of this.subscriptions) {
      unsubscribe()
      this.webSocket.unsubscribeFromExecution(executionId).catch(console.error)
    }
    this.subscriptions.clear()

    // Clear state
    this.activeExecutions.clear()
    this.progressTrackers.clear()
    this.listeners.clear()
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect(): void {
    this.reset()
    this.webSocket.disconnect()
  }

  /**
   * Check if WebSocket is connected
   */
  isConnected(): boolean {
    return this.webSocket.isConnected()
  }

  /**
   * Notify all listeners of state changes
   */
  private notifyStateChange(): void {
    const state = this.getFlowExecutionState()
    this.listeners.forEach(listener => {
      try {
        listener(state)
      } catch (error) {
        console.error('Error in execution state listener:', error)
      }
    })
  }
}

// Create singleton instance
export const executionStateManager = new ExecutionStateManager()
