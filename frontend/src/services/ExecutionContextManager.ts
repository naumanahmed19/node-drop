/**
 * ExecutionContextManager
 *
 * Manages execution contexts with proper isolation between concurrent executions.
 * Ensures nodes only show as executing when they belong to the current active execution.
 *
 * Key Features:
 * - Tracks which nodes belong to which execution
 * - Maintains execution state (running nodes, completed, failed)
 * - Provides filtered queries based on current execution context
 * - Perfect isolation between concurrent trigger executions
 */

import { NodeExecutionStatus } from "@/types/execution";

export { NodeExecutionStatus };

export interface ExecutionContext {
  executionId: string;
  triggerNodeId: string;
  affectedNodeIds: Set<string>; // All nodes in this execution path
  runningNodes: Set<string>; // Currently executing nodes
  completedNodes: Set<string>; // Successfully completed nodes
  failedNodes: Set<string>; // Failed nodes
  queuedNodes: Set<string>; // Nodes waiting to execute
  status: "running" | "completed" | "failed" | "cancelled";
  startTime: number;
  endTime?: number;
}

interface NodeStatusInfo {
  status: NodeExecutionStatus;
  executionId: string | null;
  lastUpdated: number;
}

export class ExecutionContextManager {
  private executions: Map<string, ExecutionContext> = new Map();
  private currentExecutionId: string | null = null;
  private nodeToExecutions: Map<string, Set<string>> = new Map(); // Track which executions affect each node

  /**
   * Start a new execution context
   */
  startExecution(
    executionId: string,
    triggerNodeId: string,
    affectedNodes: string[]
  ): void {
    const context: ExecutionContext = {
      executionId,
      triggerNodeId,
      affectedNodeIds: new Set(affectedNodes),
      runningNodes: new Set(),
      completedNodes: new Set(),
      failedNodes: new Set(),
      queuedNodes: new Set(),
      status: "running",
      startTime: Date.now(),
    };

    this.executions.set(executionId, context);

    // Track node-to-execution mapping
    for (const nodeId of affectedNodes) {
      if (!this.nodeToExecutions.has(nodeId)) {
        this.nodeToExecutions.set(nodeId, new Set());
      }
      this.nodeToExecutions.get(nodeId)!.add(executionId);
    }
  }

  /**
   * Set the current active execution (for filtering)
   */
  setCurrentExecution(executionId: string | null): void {
    this.currentExecutionId = executionId;
  }

  /**
   * Replace a temporary execution ID with the real one
   * This is used when we start execution with a temp ID for immediate UI feedback,
   * then replace it with the real ID from the API response
   */
  replaceExecutionId(oldExecutionId: string, newExecutionId: string): void {
    const context = this.executions.get(oldExecutionId);
    if (!context) return;

    // Update execution ID in context
    context.executionId = newExecutionId;

    // Move to new key in executions map
    this.executions.delete(oldExecutionId);
    this.executions.set(newExecutionId, context);

    // Update node-to-execution mappings
    for (const nodeId of context.affectedNodeIds) {
      const executions = this.nodeToExecutions.get(nodeId);
      if (executions) {
        executions.delete(oldExecutionId);
        executions.add(newExecutionId);
      }
    }

    // Update current execution ID if it was the old one
    if (this.currentExecutionId === oldExecutionId) {
      this.currentExecutionId = newExecutionId;
    }
  }

  /**
   * Update node status in a specific execution
   * This is a convenience method that calls the appropriate set method
   */
  updateNodeStatus(
    nodeId: string,
    status: NodeExecutionStatus,
    executionId: string
  ): void {
    switch (status) {
      case NodeExecutionStatus.QUEUED:
        this.setNodeQueued(executionId, nodeId);
        break;
      case NodeExecutionStatus.RUNNING:
        this.setNodeRunning(executionId, nodeId);
        break;
      case NodeExecutionStatus.COMPLETED:
        this.setNodeCompleted(executionId, nodeId);
        break;
      case NodeExecutionStatus.FAILED:
        this.setNodeFailed(executionId, nodeId);
        break;
      case NodeExecutionStatus.IDLE:
        // Remove from all sets
        const context = this.executions.get(executionId);
        if (context) {
          context.runningNodes.delete(nodeId);
          context.queuedNodes.delete(nodeId);
          context.completedNodes.delete(nodeId);
          context.failedNodes.delete(nodeId);
        }
        break;
    }
  }

  /**
   * Get the current active execution context
   */
  getCurrentExecution(): ExecutionContext | null {
    if (!this.currentExecutionId) return null;
    return this.executions.get(this.currentExecutionId) || null;
  }

  /**
   * Get a specific execution context
   */
  getExecution(executionId: string): ExecutionContext | null {
    return this.executions.get(executionId) || null;
  }

  /**
   * Mark a node as queued for execution
   */
  setNodeQueued(executionId: string, nodeId: string): void {
    const context = this.executions.get(executionId);
    if (!context || !context.affectedNodeIds.has(nodeId)) return;

    context.queuedNodes.add(nodeId);
    context.runningNodes.delete(nodeId);
    context.completedNodes.delete(nodeId);
    context.failedNodes.delete(nodeId);
  }

  /**
   * Mark a node as running in a specific execution
   */
  setNodeRunning(executionId: string, nodeId: string): void {
    const context = this.executions.get(executionId);
    if (!context || !context.affectedNodeIds.has(nodeId)) return;

    context.runningNodes.add(nodeId);
    context.queuedNodes.delete(nodeId);
    context.completedNodes.delete(nodeId);
    context.failedNodes.delete(nodeId);
  }

  /**
   * Mark a node as completed in a specific execution
   */
  setNodeCompleted(executionId: string, nodeId: string): void {
    const context = this.executions.get(executionId);
    if (!context || !context.affectedNodeIds.has(nodeId)) return;

    context.completedNodes.add(nodeId);
    context.runningNodes.delete(nodeId);
    context.queuedNodes.delete(nodeId);
    context.failedNodes.delete(nodeId);
  }

  /**
   * Mark a node as failed in a specific execution
   */
  setNodeFailed(executionId: string, nodeId: string): void {
    const context = this.executions.get(executionId);
    if (!context || !context.affectedNodeIds.has(nodeId)) return;

    context.failedNodes.add(nodeId);
    context.runningNodes.delete(nodeId);
    context.queuedNodes.delete(nodeId);
    context.completedNodes.delete(nodeId);

    // Mark execution as failed if any node fails
    context.status = "failed";
  }

  /**
   * Complete an execution
   */
  completeExecution(executionId: string): void {
    const context = this.executions.get(executionId);
    if (!context) return;

    context.status = "completed";
    context.endTime = Date.now();

    // Clear all running nodes since execution is complete
    context.runningNodes.clear();
    context.queuedNodes.clear();

    // If this was the current execution, clear it
    if (this.currentExecutionId === executionId) {
      this.currentExecutionId = null;
    }
  }

  /**
   * Cancel an execution
   */
  cancelExecution(executionId: string): void {
    const context = this.executions.get(executionId);
    if (!context) return;

    context.status = "cancelled";
    context.endTime = Date.now();
    context.runningNodes.clear();
    context.queuedNodes.clear();

    if (this.currentExecutionId === executionId) {
      this.currentExecutionId = null;
    }
  }

  /**
   * Clear an execution from memory (cleanup)
   */
  clearExecution(executionId: string): void {
    const context = this.executions.get(executionId);
    if (!context) return;

    // Remove node-to-execution mappings
    for (const nodeId of context.affectedNodeIds) {
      const executions = this.nodeToExecutions.get(nodeId);
      if (executions) {
        executions.delete(executionId);
        if (executions.size === 0) {
          this.nodeToExecutions.delete(nodeId);
        }
      }
    }

    this.executions.delete(executionId);

    if (this.currentExecutionId === executionId) {
      this.currentExecutionId = null;
    }
  }

  /**
   * Check if a node belongs to a specific execution
   */
  isNodeInExecution(executionId: string, nodeId: string): boolean {
    const context = this.executions.get(executionId);
    if (!context) return false;
    return context.affectedNodeIds.has(nodeId);
  }

  /**
   * Check if a node is executing in ANY active execution
   */
  isNodeExecuting(nodeId: string): boolean {
    const executions = this.nodeToExecutions.get(nodeId);
    if (!executions) return false;

    for (const executionId of executions) {
      const context = this.executions.get(executionId);
      if (
        context &&
        context.status === "running" &&
        context.runningNodes.has(nodeId)
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if a node is executing in the CURRENT execution (KEY METHOD)
   * This is the primary filtering method that prevents cross-trigger contamination
   */
  isNodeExecutingInCurrent(nodeId: string): boolean {
    if (!this.currentExecutionId) return false;

    const context = this.executions.get(this.currentExecutionId);
    if (!context) return false;

    // Only return true if:
    // 1. Node belongs to this execution
    // 2. Node is in the running set
    // 3. Execution is still active
    return (
      context.affectedNodeIds.has(nodeId) &&
      context.runningNodes.has(nodeId) &&
      context.status === "running"
    );
  }

  /**
   * Get the status of a node in a specific execution
   */
  getNodeStatusInExecution(
    nodeId: string,
    executionId: string
  ): NodeExecutionStatus {
    const context = this.executions.get(executionId);
    if (!context || !context.affectedNodeIds.has(nodeId)) {
      return NodeExecutionStatus.IDLE;
    }

    if (context.runningNodes.has(nodeId)) return NodeExecutionStatus.RUNNING;
    if (context.completedNodes.has(nodeId))
      return NodeExecutionStatus.COMPLETED;
    if (context.failedNodes.has(nodeId)) return NodeExecutionStatus.FAILED;
    if (context.queuedNodes.has(nodeId)) return NodeExecutionStatus.QUEUED;

    return NodeExecutionStatus.IDLE;
  }

  /**
   * Get the status of a node in the current execution (filtered)
   */
  getNodeStatus(nodeId: string): NodeStatusInfo {
    // CRITICAL FIX: Always use current execution if it exists
    // Don't fall back to old executions - this causes cross-trigger contamination
    if (this.currentExecutionId) {
      const context = this.executions.get(this.currentExecutionId);
      if (context && context.affectedNodeIds.has(nodeId)) {
        // Node belongs to current execution, return its status
        return {
          status: this.getNodeStatusInExecution(nodeId, this.currentExecutionId),
          executionId: this.currentExecutionId,
          lastUpdated: Date.now(),
        };
      } else {
        // Node doesn't belong to current execution, return IDLE
        // This prevents showing error states from previous executions
        return {
          status: NodeExecutionStatus.IDLE,
          executionId: null,
          lastUpdated: Date.now(),
        };
      }
    }

    // No current execution - check for most recent execution (running OR just completed)
    const executions = this.nodeToExecutions.get(nodeId);
    if (!executions) {
      return {
        status: NodeExecutionStatus.IDLE,
        executionId: null,
        lastUpdated: Date.now(),
      };
    }

    // Find the most recent execution that contains this node
    let mostRecentExecution: { executionId: string; context: ExecutionContext } | null = null;
    
    for (const executionId of executions) {
      const context = this.executions.get(executionId);
      if (!context) continue;

      // Prioritize running executions
      if (context.status === "running") {
        return {
          status: this.getNodeStatusInExecution(nodeId, executionId),
          executionId,
          lastUpdated: Date.now(),
        };
      }

      // Track most recent execution (including completed/failed)
      if (!mostRecentExecution || context.startTime > mostRecentExecution.context.startTime) {
        mostRecentExecution = { executionId, context };
      }
    }

    // Return status from most recent execution if it just completed
    // But only if the node was actually in that execution's affected nodes
    if (mostRecentExecution && mostRecentExecution.context.affectedNodeIds.has(nodeId)) {
      const nodeStatus = this.getNodeStatusInExecution(nodeId, mostRecentExecution.executionId);
      // Only return non-idle status (completed/failed)
      if (nodeStatus !== NodeExecutionStatus.IDLE) {
        return {
          status: nodeStatus,
          executionId: mostRecentExecution.executionId,
          lastUpdated: Date.now(),
        };
      }
    }

    // No relevant execution found
    return {
      status: NodeExecutionStatus.IDLE,
      executionId: null,
      lastUpdated: Date.now(),
    };
  }

  /**
   * Get all executions affecting a node
   */
  getNodeExecutions(nodeId: string): string[] {
    const executions = this.nodeToExecutions.get(nodeId);
    return executions ? Array.from(executions) : [];
  }

  /**
   * Get the current execution ID for a node (if any)
   */
  getExecutionForNode(nodeId: string): string | null {
    if (this.currentExecutionId) {
      const context = this.executions.get(this.currentExecutionId);
      if (context && context.affectedNodeIds.has(nodeId)) {
        return this.currentExecutionId;
      }
    }

    // Find first active execution containing this node
    const executions = this.nodeToExecutions.get(nodeId);
    if (!executions) return null;

    for (const executionId of executions) {
      const context = this.executions.get(executionId);
      if (context && context.status === "running") {
        return executionId;
      }
    }

    return null;
  }

  /**
   * Get all active executions
   */
  getActiveExecutions(): ExecutionContext[] {
    return Array.from(this.executions.values()).filter(
      (ctx) => ctx.status === "running"
    );
  }

  /**
   * Clear all completed/failed executions (cleanup)
   */
  clearInactiveExecutions(): void {
    const toDelete: string[] = [];

    for (const [executionId, context] of this.executions) {
      if (context.status !== "running") {
        toDelete.push(executionId);
      }
    }

    for (const executionId of toDelete) {
      this.clearExecution(executionId);
    }
  }

  /**
   * Get debug information
   */
  getDebugInfo(): {
    totalExecutions: number;
    activeExecutions: number;
    currentExecutionId: string | null;
    nodeToExecutionMappings: number;
  } {
    return {
      totalExecutions: this.executions.size,
      activeExecutions: this.getActiveExecutions().length,
      currentExecutionId: this.currentExecutionId,
      nodeToExecutionMappings: this.nodeToExecutions.size,
    };
  }
}

// Singleton instance
export const executionContextManager = new ExecutionContextManager();
