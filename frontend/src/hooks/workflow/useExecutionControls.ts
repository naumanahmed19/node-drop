import { useWorkflowStore } from "@/stores";
import { useCallback, useEffect } from "react";

/**
 * Custom hook for execution controls
 * Handles workflow and node execution, real-time updates, and execution state management
 */
export function useExecutionControls() {
  // OPTIMIZATION: Use Zustand selectors to prevent unnecessary re-renders
  const workflow = useWorkflowStore((state) => state.workflow);
  const executionState = useWorkflowStore((state) => state.executionState);
  const lastExecutionResult = useWorkflowStore(
    (state) => state.lastExecutionResult
  );
  const realTimeResults = useWorkflowStore((state) => state.realTimeResults);
  const executionLogs = useWorkflowStore((state) => state.executionLogs);
  const getNodeExecutionResult = useWorkflowStore(
    (state) => state.getNodeExecutionResult
  );
  const initializeRealTimeUpdates = useWorkflowStore(
    (state) => state.initializeRealTimeUpdates
  );
  const executeNode = useWorkflowStore((state) => state.executeNode);
  const stopExecution = useWorkflowStore((state) => state.stopExecution);
  const clearExecutionLogs = useWorkflowStore(
    (state) => state.clearExecutionLogs
  );
  const getExecutionFlowStatus = useWorkflowStore(
    (state) => state.getExecutionFlowStatus
  );

  // Initialize real-time updates on component mount
  useEffect(() => {
    initializeRealTimeUpdates();
  }, [initializeRealTimeUpdates]);

  // Execute node with specific mode
  const handleExecuteNode = useCallback(
    async (
      nodeId: string,
      inputData?: any,
      mode: "single" | "workflow" = "single"
    ) => {
      await executeNode(nodeId, inputData, mode);
    },
    [executeNode]
  );

  // Execute workflow from trigger node
  const handleExecuteWorkflow = useCallback(
    async (triggerNodeId: string) => {
      await executeNode(triggerNodeId, undefined, "workflow");
    },
    [executeNode]
  );

  // Stop current execution
  const handleStopExecution = useCallback(async () => {
    await stopExecution();
  }, [stopExecution]);

  // Clear execution logs
  const handleClearLogs = useCallback(() => {
    clearExecutionLogs();
  }, [clearExecutionLogs]);

  // Get node execution result
  const getNodeResult = useCallback(
    (nodeId: string) => {
      return getNodeExecutionResult(nodeId);
    },
    [getNodeExecutionResult]
  );

  // Get execution flow status
  const getFlowStatus = useCallback(
    (executionId: string) => {
      return getExecutionFlowStatus(executionId);
    },
    [getExecutionFlowStatus]
  );

  return {
    // Execution methods
    executeNode: handleExecuteNode,
    executeWorkflow: handleExecuteWorkflow,
    stopExecution: handleStopExecution,
    clearLogs: handleClearLogs,

    // Getters
    getNodeResult,
    getFlowStatus,

    // State
    executionState,
    lastExecutionResult,
    realTimeResults,
    executionLogs,

    // Derived state
    isExecuting: executionState.status === "running",
    canExecute: Boolean(workflow && workflow.nodes.length > 0),
    hasExecutionLogs: executionLogs.length > 0,
  };
}
