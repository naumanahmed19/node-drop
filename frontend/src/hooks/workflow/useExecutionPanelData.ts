import { useMemo } from "react";
import { useWorkflowStore } from "@/stores";

interface UseExecutionPanelDataParams {
  executionId?: string;
}

export function useExecutionPanelData({
  executionId,
}: UseExecutionPanelDataParams) {
  // Subscribe directly to flowExecutionState to get updates when it changes
  const activeExecutions = useWorkflowStore(
    (state) => state.flowExecutionState.activeExecutions
  );
  
  const flowExecutionStatus = useMemo(() => {
    if (!executionId) return null;
    return activeExecutions.get(executionId) || null;
  }, [executionId, activeExecutions]);

  return {
    flowExecutionStatus,
  };
}
