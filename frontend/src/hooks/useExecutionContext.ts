/**
 * useExecutionContext Hook
 *
 * Provides filtered execution state for a node based on the current execution context.
 * This is the primary hook that ensures nodes only show as executing when they belong
 * to the current active execution.
 *
 * Key Features:
 * - Automatic filtering by current execution
 * - Single source of truth from ExecutionContextManager
 * - Prevents cross-trigger loading contamination
 * - Real-time updates via Zustand store
 * - Optimized to prevent unnecessary re-renders
 */

import { useMemo } from "react";
import { NodeExecutionStatus } from "../services/ExecutionContextManager";
import { useWorkflowStore } from "../stores/workflow";

export interface NodeExecutionContext {
  isExecuting: boolean; // Node is running in CURRENT execution
  isQueued: boolean; // Node is queued in CURRENT execution
  hasError: boolean; // Node failed in CURRENT execution
  hasSuccess: boolean; // Node completed successfully in CURRENT execution
  status: NodeExecutionStatus; // Current status
  executionId: string | null; // Which execution owns this node state
}

/**
 * Hook to get execution context for a specific node.
 * Returns filtered state based on current execution.
 *
 * OPTIMIZATION: Uses Zustand's shallow equality and useMemo to prevent
 * unnecessary re-renders. Only re-renders when THIS specific node's state changes.
 *
 * @param nodeId - The ID of the node to get execution context for
 * @returns NodeExecutionContext with filtered state
 */
export function useExecutionContext(nodeId: string): NodeExecutionContext {
  // OPTIMIZATION 1: Use stable selector with shallow comparison
  // This prevents re-renders when executionManager reference changes but content doesn't
  const executionManager = useWorkflowStore(
    (state) => state.executionManager,
    // Shallow equality - only re-render if manager instance changes
    (a, b) => a === b
  );

  // OPTIMIZATION 2: Subscribe only to relevant state using custom selector
  // This reads the node's state directly instead of subscribing to global version counter
  const nodeStateSnapshot = useWorkflowStore(
    (state) => {
      if (!state.executionManager) return null;

      // Read node state directly from execution manager
      const statusInfo = state.executionManager.getNodeStatus(nodeId);
      const isExecuting =
        state.executionManager.isNodeExecutingInCurrent(nodeId);

      // Return a stable object that only changes when THIS node's state changes
      // Include version to force re-evaluation when execution completes
      return {
        status: statusInfo.status,
        executionId: statusInfo.executionId,
        isExecuting,
        timestamp: statusInfo.lastUpdated,
        version: state.executionStateVersion, // Subscribe to version changes
      };
    },
    // Custom equality function - only re-render if THIS node's state actually changed
    (a, b) => {
      if (a === b) return true;
      if (!a || !b) return false;
      return (
        a.status === b.status &&
        a.executionId === b.executionId &&
        a.isExecuting === b.isExecuting &&
        a.version === b.version // Check version to catch execution completion
      );
    }
  );

  // OPTIMIZATION 3: Memoize the result object to prevent object recreation
  const executionContext = useMemo(() => {
    if (!executionManager || !nodeStateSnapshot) {
      // No execution manager - return idle state
      return {
        isExecuting: false,
        isQueued: false,
        hasError: false,
        hasSuccess: false,
        status: NodeExecutionStatus.IDLE,
        executionId: null,
      };
    }

    // Build context from snapshot
    return {
      isExecuting: nodeStateSnapshot.isExecuting,
      isQueued: nodeStateSnapshot.status === NodeExecutionStatus.QUEUED,
      hasError: nodeStateSnapshot.status === NodeExecutionStatus.FAILED,
      hasSuccess: nodeStateSnapshot.status === NodeExecutionStatus.COMPLETED,
      status: nodeStateSnapshot.status,
      executionId: nodeStateSnapshot.executionId,
    };
  }, [executionManager, nodeStateSnapshot]);

  return executionContext;
}

/**
 * Hook to check if ANY node in a list is executing
 * Useful for toolbar buttons that affect multiple nodes
 *
 * OPTIMIZATION: Uses stable selector with custom equality
 */
export function useAnyNodeExecuting(nodeIds: string[]): boolean {
  const executionManager = useWorkflowStore((state) => state.executionManager);

  // OPTIMIZATION: Use stable nodeIds array reference in selector
  const nodeIdsKey = nodeIds.join(",");

  return useMemo(() => {
    if (!executionManager || nodeIds.length === 0) return false;

    return nodeIds.some((nodeId) =>
      executionManager.isNodeExecutingInCurrent(nodeId)
    );
  }, [executionManager, nodeIdsKey]); // eslint-disable-line react-hooks/exhaustive-deps
}

/**
 * Hook to get the current execution ID
 *
 * OPTIMIZATION: Memoized and only updates when execution ID actually changes
 */
export function useCurrentExecutionId(): string | null {
  const currentExecutionId = useWorkflowStore(
    (state) => {
      if (!state.executionManager) return null;
      const currentExecution = state.executionManager.getCurrentExecution();
      return currentExecution?.executionId || null;
    },
    // Only re-render if execution ID actually changes
    (a, b) => a === b
  );

  return currentExecutionId;
}

/**
 * Hook to check if a specific execution is active
 *
 * OPTIMIZATION: Custom selector that only reads specific execution status
 */
export function useIsExecutionActive(executionId: string | null): boolean {
  return useWorkflowStore(
    (state) => {
      if (!state.executionManager || !executionId) return false;

      const execution = state.executionManager.getExecution(executionId);
      return execution?.status === "running";
    },
    // Only re-render if active status changes
    (a, b) => a === b
  );
}

/**
 * Hook to get all active executions
 *
 * OPTIMIZATION: Custom equality to only re-render when execution list actually changes
 */
export function useActiveExecutions() {
  return useWorkflowStore(
    (state) => {
      if (!state.executionManager) return [];
      return state.executionManager.getActiveExecutions();
    },
    // Custom equality - compare by execution IDs and statuses
    (a, b) => {
      if (a.length !== b.length) return false;
      return a.every((execA, i) => {
        const execB = b[i];
        return (
          execA.executionId === execB.executionId &&
          execA.status === execB.status
        );
      });
    }
  );
}

/**
 * Hook to check if workflow has any active executions
 *
 * OPTIMIZATION: Simple boolean check with stable selector
 */
export function useHasActiveExecution(): boolean {
  return useWorkflowStore(
    (state) => {
      if (!state.executionManager) return false;
      return state.executionManager.getActiveExecutions().length > 0;
    },
    // Only re-render if boolean value changes
    (a, b) => a === b
  );
}
