import { v4 as uuidv4 } from "uuid";
import {
  FlowExecutionContext,
  FlowExecutionOptions,
  NodeExecutionState,
} from "./FlowExecutionEngine";

/**
 * TriggerExecutionContext extends ExecutionContext for isolated trigger execution
 * This allows multiple triggers to execute independently without interfering with each other
 */
export interface TriggerExecutionContext extends FlowExecutionContext {
  triggerId: string;
  triggerType: "webhook" | "schedule" | "manual" | "workflow-called" | "polling";
  affectedNodes: Set<string>;
  isolatedExecution: boolean;
  parentExecutionId?: string;
  childExecutions: string[];
  resourceLocks: Set<string>;
  priority: number;
}

export interface TriggerExecutionOptions extends FlowExecutionOptions {
  isolatedExecution?: boolean;
  priority?: number;
  parentExecutionId?: string;
  maxConcurrentTriggers?: number;
  triggerTimeout?: number;
}

/**
 * Factory class for creating TriggerExecutionContext instances
 */
export class TriggerExecutionContextFactory {
  /**
   * Create a new TriggerExecutionContext for isolated trigger execution
   */
  static createTriggerContext(
    triggerId: string,
    triggerType: "webhook" | "schedule" | "manual" | "workflow-called" | "polling",
    workflowId: string,
    userId: string,
    triggerNodeId: string,
    triggerData?: any,
    options: TriggerExecutionOptions = {}
  ): TriggerExecutionContext {
    const executionId = uuidv4();

    const baseOptions: FlowExecutionOptions = {
      timeout: options.triggerTimeout || 300000,
      maxRetries: 3,
      retryDelay: 1000,
      saveProgress: true,
      saveData: true,
      manual: ["manual", "workflow-called"].includes(triggerType),
      isolatedExecution: options.isolatedExecution !== false, // Default to true for triggers
      ...options,
    };

    const triggerContext: TriggerExecutionContext = {
      // Base FlowExecutionContext properties
      executionId,
      workflowId,
      userId,
      triggerNodeId,
      triggerData,
      executionOptions: baseOptions,
      nodeStates: new Map<string, NodeExecutionState>(),
      nodeOutputs: new Map<string, any>(), // Initialize node outputs map for $node expressions
      nodeIdToName: new Map<string, string>(), // Initialize nodeId -> nodeName map for $node["Name"] support
      executionPath: [],
      startTime: Date.now(),
      cancelled: false,
      paused: false,

      // TriggerExecutionContext specific properties
      triggerId,
      triggerType,
      affectedNodes: new Set<string>(),
      isolatedExecution: options.isolatedExecution !== false,
      parentExecutionId: options.parentExecutionId,
      childExecutions: [],
      resourceLocks: new Set<string>(),
      priority: options.priority || this.getDefaultPriority(triggerType),
    };

    return triggerContext;
  }

  /**
   * Get default priority based on trigger type
   */
  private static getDefaultPriority(triggerType: string): number {
    switch (triggerType) {
      case "manual":
        return 1; // Highest priority
      case "webhook":
        return 2; // Medium priority
      case "polling":
        return 2; // Medium priority (same as webhook)
      case "schedule":
        return 3; // Lowest priority
      default:
        return 2;
    }
  }

  /**
   * Clone a trigger context for retry or child execution
   */
  static cloneTriggerContext(
    original: TriggerExecutionContext,
    options: Partial<TriggerExecutionOptions> = {}
  ): TriggerExecutionContext {
    const newExecutionId = uuidv4();

    const cloned: TriggerExecutionContext = {
      ...original,
      executionId: newExecutionId,
      nodeStates: new Map(), // Fresh node states
      executionPath: [],
      startTime: Date.now(),
      cancelled: false,
      paused: false,
      affectedNodes: new Set(original.affectedNodes),
      childExecutions: [],
      resourceLocks: new Set(),
      parentExecutionId: original.executionId,
      ...options,
    };

    // Add this execution as a child of the original
    original.childExecutions.push(newExecutionId);

    return cloned;
  }
}

/**
 * Utility class for analyzing which nodes are affected by a trigger
 */
export class TriggerImpactAnalyzer {
  /**
   * Determine which nodes are affected by a specific trigger
   */
  static analyzeAffectedNodes(
    triggerNodeId: string,
    workflowNodes: any[],
    workflowConnections: any[]
  ): Set<string> {
    const affectedNodes = new Set<string>();
    const nodesToProcess = [triggerNodeId];
    const processed = new Set<string>();

    while (nodesToProcess.length > 0) {
      const currentNodeId = nodesToProcess.shift()!;

      if (processed.has(currentNodeId)) {
        continue;
      }

      processed.add(currentNodeId);
      affectedNodes.add(currentNodeId);

      // Find all downstream nodes
      const downstreamConnections = workflowConnections.filter(
        (conn) => conn.sourceNodeId === currentNodeId
      );

      for (const connection of downstreamConnections) {
        if (!processed.has(connection.targetNodeId)) {
          nodesToProcess.push(connection.targetNodeId);
        }
      }
    }

    return affectedNodes;
  }

  /**
   * Check if two trigger contexts have overlapping affected nodes
   */
  static hasNodeOverlap(
    context1: TriggerExecutionContext,
    context2: TriggerExecutionContext
  ): boolean {
    for (const nodeId of context1.affectedNodes) {
      if (context2.affectedNodes.has(nodeId)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get the shared nodes between two trigger contexts
   */
  static getSharedNodes(
    context1: TriggerExecutionContext,
    context2: TriggerExecutionContext
  ): string[] {
    const sharedNodes: string[] = [];

    for (const nodeId of context1.affectedNodes) {
      if (context2.affectedNodes.has(nodeId)) {
        sharedNodes.push(nodeId);
      }
    }

    return sharedNodes;
  }

  /**
   * Calculate execution isolation score (0-1, where 1 is completely isolated)
   */
  static calculateIsolationScore(
    targetContext: TriggerExecutionContext,
    otherContexts: TriggerExecutionContext[]
  ): number {
    if (otherContexts.length === 0) {
      return 1.0; // Completely isolated
    }

    let totalOverlapNodes = 0;
    let totalNodes = targetContext.affectedNodes.size;

    for (const otherContext of otherContexts) {
      const sharedNodes = this.getSharedNodes(targetContext, otherContext);
      totalOverlapNodes += sharedNodes.length;
    }

    if (totalNodes === 0) {
      return 1.0;
    }

    return Math.max(0, 1 - totalOverlapNodes / totalNodes);
  }
}

/**
 * Resource management for trigger executions
 */
export class TriggerResourceManager {
  private resourceLocks: Map<string, Set<string>> = new Map(); // nodeId -> Set<executionId>
  private executionResources: Map<string, Set<string>> = new Map(); // executionId -> Set<nodeId>

  /**
   * Attempt to acquire locks for nodes in a trigger context
   */
  acquireNodeLocks(context: TriggerExecutionContext): boolean {
    const requiredNodes = Array.from(context.affectedNodes);
    const canAcquireAll = this.canAcquireAllLocks(
      requiredNodes,
      context.executionId
    );

    if (!canAcquireAll && context.isolatedExecution) {
      return false; // Cannot proceed with isolated execution
    }

    // Acquire locks for nodes that can be locked exclusively
    for (const nodeId of requiredNodes) {
      if (!this.resourceLocks.has(nodeId)) {
        this.resourceLocks.set(nodeId, new Set());
      }

      const nodeLocks = this.resourceLocks.get(nodeId)!;

      if (context.isolatedExecution && nodeLocks.size > 0) {
        continue; // Skip nodes that are already locked in isolated mode
      }

      nodeLocks.add(context.executionId);
      context.resourceLocks.add(nodeId);

      if (!this.executionResources.has(context.executionId)) {
        this.executionResources.set(context.executionId, new Set());
      }
      this.executionResources.get(context.executionId)!.add(nodeId);
    }

    return true;
  }

  /**
   * Release all locks held by an execution
   */
  releaseLocks(executionId: string): void {
    const lockedNodes = this.executionResources.get(executionId);
    if (!lockedNodes) {
      return;
    }

    for (const nodeId of lockedNodes) {
      const nodeLocks = this.resourceLocks.get(nodeId);
      if (nodeLocks) {
        nodeLocks.delete(executionId);
        if (nodeLocks.size === 0) {
          this.resourceLocks.delete(nodeId);
        }
      }
    }

    this.executionResources.delete(executionId);
  }

  /**
   * Check if all required locks can be acquired
   */
  private canAcquireAllLocks(nodeIds: string[], executionId: string): boolean {
    for (const nodeId of nodeIds) {
      const nodeLocks = this.resourceLocks.get(nodeId);
      if (nodeLocks && nodeLocks.size > 0 && !nodeLocks.has(executionId)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Get all executions that have locks on a specific node
   */
  getNodeExecutions(nodeId: string): string[] {
    const nodeLocks = this.resourceLocks.get(nodeId);
    return nodeLocks ? Array.from(nodeLocks) : [];
  }

  /**
   * Get all nodes locked by a specific execution
   */
  getExecutionNodes(executionId: string): string[] {
    const lockedNodes = this.executionResources.get(executionId);
    return lockedNodes ? Array.from(lockedNodes) : [];
  }

  /**
   * Get current resource utilization statistics
   */
  getResourceStats(): {
    totalLockedNodes: number;
    activeExecutions: number;
    nodeUtilization: Map<string, number>;
  } {
    const nodeUtilization = new Map<string, number>();

    for (const [nodeId, locks] of this.resourceLocks) {
      nodeUtilization.set(nodeId, locks.size);
    }

    return {
      totalLockedNodes: this.resourceLocks.size,
      activeExecutions: this.executionResources.size,
      nodeUtilization,
    };
  }
}
