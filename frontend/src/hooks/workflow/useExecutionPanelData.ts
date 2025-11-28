import { useMemo } from "react";

interface UseExecutionPanelDataParams {
  executionId?: string;
  getFlowStatus: (executionId: string) => any;
}

export function useExecutionPanelData({
  executionId,
  getFlowStatus,
}: UseExecutionPanelDataParams) {
  const flowExecutionStatus = useMemo(() => {
    return executionId ? getFlowStatus(executionId) : null;
  }, [executionId, getFlowStatus]);

  return {
    flowExecutionStatus,
  };
}
