import { useExecutionContext } from "@/hooks/useExecutionContext";
import { useWorkflowStore } from "@/stores/workflow";
import {
  createNodeExecutionError,
  logExecutionError,
} from "@/utils/errorHandling";
import { canProceedWithExecution } from "@/utils/workflowExecutionGuards";
import { useEffect, useState } from "react";
import type { NodeExecutionError } from "../types";

interface NodeExecutionState {
  isExecuting: boolean;
  hasError: boolean;
  hasSuccess: boolean;
  lastExecutionTime?: number;
  executionError?: NodeExecutionError;
}

export function useNodeExecution(nodeId: string, nodeType: string) {
  const executeNode = useWorkflowStore((state) => state.executeNode);
  const executionState = useWorkflowStore((state) => state.executionState);
  const getNodeVisualState = useWorkflowStore(
    (state) => state.getNodeVisualState
  );

  // NEW: Use ExecutionContext hook as primary source of truth
  const executionContext = useExecutionContext(nodeId);

  const [nodeExecutionState, setNodeExecutionState] =
    useState<NodeExecutionState>({
      isExecuting: false,
      hasError: false,
      hasSuccess: false,
    });

  // Get visual state for backward compatibility
  const nodeVisualState = getNodeVisualState(nodeId);

  // Update local state based on execution context (NEW: Single source of truth)
  useEffect(() => {
    // Use execution context as primary source
    const isExecuting = executionContext.isExecuting; // Already filtered by current execution!
    const hasError = executionContext.hasError;
    const hasSuccess = executionContext.hasSuccess;

    let executionError: NodeExecutionError | undefined;
    if (hasError && nodeVisualState?.errorMessage) {
      executionError = createNodeExecutionError(
        nodeVisualState.errorMessage,
        nodeId,
        nodeType
      );
      logExecutionError(
        nodeId,
        nodeType,
        executionError,
        nodeVisualState.errorMessage
      );
    }

    setNodeExecutionState({
      isExecuting,
      hasError,
      hasSuccess,
      lastExecutionTime: nodeVisualState?.executionTime,
      executionError,
    });
  }, [
    executionContext.isExecuting,
    executionContext.hasError,
    executionContext.hasSuccess,
    executionContext.status,
    nodeVisualState?.errorMessage,
    nodeVisualState?.executionTime,
    nodeId,
    nodeType,
  ]);

  const handleExecuteNode = async (nodeId: string, nodeType: string) => {
    // Perform all pre-execution checks (workflow running, unsaved changes, etc.)
    if (!canProceedWithExecution()) {
      return;
    }

    setNodeExecutionState((prev) => ({
      ...prev,
      isExecuting: true,
      hasError: false,
      hasSuccess: false,
      executionError: undefined,
    }));

    try {
      const triggerNodeTypes = [
        "manual-trigger",
        "webhook-trigger",
        "schedule-trigger",
        "workflow-called",
      ];
      const mode = triggerNodeTypes.includes(nodeType) ? "workflow" : "single";

      await executeNode(nodeId, undefined, mode);
    } catch (error) {
      console.error("Failed to execute node:", error);

      const executionError = createNodeExecutionError(error, nodeId, nodeType);
      logExecutionError(nodeId, nodeType, executionError, error);

      setNodeExecutionState((prev) => ({
        ...prev,
        isExecuting: false,
        hasError: true,
        executionError,
      }));
    }
  };

  const handleRetryNode = async (nodeId: string, nodeType: string) => {
    await handleExecuteNode(nodeId, nodeType);
  };

  return {
    nodeExecutionState,
    executionState,
    nodeVisualState,
    handleExecuteNode,
    handleRetryNode,
  };
}
