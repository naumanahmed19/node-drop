import { apiClient } from "./api";
import type {
  ExecutionRequest,
  ExecutionResponse,
  ExecutionProgress,
  ExecutionDetails,
  SingleNodeExecutionRequest,
  SingleNodeExecutionResult,
} from "@/types/execution";

// Re-export types for convenience
export type {
  ExecutionRequest,
  ExecutionResponse,
  ExecutionProgress,
  ExecutionDetails,
  SingleNodeExecutionRequest,
  SingleNodeExecutionResult,
};

export class ExecutionService {
  /**
   * Execute a workflow with optional trigger data
   */
  async executeWorkflow(request: ExecutionRequest): Promise<ExecutionResponse> {
    const response = await apiClient.post<ExecutionResponse>(
      "/executions",
      request
    );

    if (!response.success || !response.data) {
      throw new Error("Failed to start workflow execution");
    }

    return response.data;
  }

  /**
   * Get execution progress
   */
  async getExecutionProgress(executionId: string): Promise<ExecutionProgress> {
    const response = await apiClient.get<ExecutionProgress>(
      `/executions/${executionId}/progress`
    );

    if (!response.success || !response.data) {
      throw new Error("Failed to get execution progress");
    }

    return response.data;
  }

  /**
   * Get execution details
   */
  async getExecutionDetails(executionId: string): Promise<ExecutionDetails> {
    const response = await apiClient.get<ExecutionDetails>(
      `/executions/${executionId}`
    );

    if (!response.success || !response.data) {
      throw new Error("Failed to get execution details");
    }

    return response.data;
  }

  /**
   * Cancel a running execution
   */
  async cancelExecution(executionId: string): Promise<void> {
    const response = await apiClient.post(`/executions/${executionId}/cancel`);

    if (!response.success) {
      throw new Error("Failed to cancel execution");
    }
  }

  /**
   * Pause a running execution
   */
  async pauseExecution(executionId: string): Promise<void> {
    const response = await apiClient.post(
      `/flow-execution/${executionId}/pause`
    );

    if (!response.success) {
      throw new Error("Failed to pause execution");
    }
  }

  /**
   * Resume a paused execution
   */
  async resumeExecution(executionId: string): Promise<void> {
    const response = await apiClient.post(
      `/flow-execution/${executionId}/resume`
    );

    if (!response.success) {
      throw new Error("Failed to resume execution");
    }
  }

  /**
   * Poll execution progress until completion
   */
  async pollExecutionProgress(
    executionId: string,
    onProgress?: (progress: ExecutionProgress) => void,
    pollInterval: number = 1000
  ): Promise<ExecutionProgress> {
    return new Promise((resolve, reject) => {
      const poll = async () => {
        try {
          const progress = await this.getExecutionProgress(executionId);

          if (onProgress) {
            onProgress(progress);
          }

          // Check if execution is complete
          if (
            progress.status === "success" ||
            progress.status === "error" ||
            progress.status === "cancelled" ||
            progress.status === "partial"
          ) {
            resolve(progress);
            return;
          }

          // For paused executions, we poll at a slower rate to reduce server load
          const interval =
            progress.status === "paused" ? pollInterval * 3 : pollInterval;

          // Continue polling
          setTimeout(poll, interval);
        } catch (error) {
          reject(error);
        }
      };

      poll();
    });
  }

  /**
   * Execute a single node using the unified executions endpoint
   */
  async executeSingleNode(
    request: SingleNodeExecutionRequest
  ): Promise<SingleNodeExecutionResult> {
    const response = await apiClient.post<SingleNodeExecutionResult>(
      `/executions`,
      {
        workflowId: request.workflowId,
        nodeId: request.nodeId,
        inputData: request.inputData,
        parameters: request.parameters,
        mode: request.mode || "single", // Default to single mode
        workflowData: request.workflowData, // Pass workflow data if provided
      }
    );

    if (!response.success || !response.data) {
      // Extract detailed error information from response
      let errorMessage = "Failed to execute single node";
      let stackTrace: string | undefined;

      if (response.warnings && response.warnings.length > 0) {
        // Check for detailed error in warnings
        const nodeFailure = response.warnings.find(
          (w: any) => w.type === "NODE_FAILURES"
        );
        if (nodeFailure && nodeFailure.details) {
          errorMessage =
            nodeFailure.details.message || nodeFailure.message || errorMessage;
          stackTrace = nodeFailure.details.stack;
        }
      } else if (response.error) {
        // Check for error directly in response
        errorMessage =
          typeof response.error === "string"
            ? response.error
            : response.error.message || errorMessage;
        stackTrace = response.error.stack;
      }

      // Create detailed error message
      let fullErrorMessage = errorMessage;
      if (stackTrace && process.env.NODE_ENV === "development") {
        fullErrorMessage += "\n\nStack trace:\n" + stackTrace;
      }

      throw new Error(fullErrorMessage);
    }

    return response.data;
  }

  /**
   * List executions with optional filtering
   */
  async listExecutions(options?: {
    workflowId?: string;
    status?: string;
    page?: number;
    limit?: number;
    startedAfter?: string;
    startedBefore?: string;
  }): Promise<ExecutionDetails[]> {
    const params = new URLSearchParams();

    if (options?.workflowId) params.append("workflowId", options.workflowId);
    if (options?.status) params.append("status", options.status);
    if (options?.page) params.append("page", options.page.toString());
    if (options?.limit) params.append("limit", options.limit.toString());
    if (options?.startedAfter)
      params.append("startedAfter", options.startedAfter);
    if (options?.startedBefore)
      params.append("startedBefore", options.startedBefore);

    const queryString = params.toString();
    const url = queryString ? `/executions?${queryString}` : "/executions";

    const response = await apiClient.get<ExecutionDetails[]>(url);

    if (!response.success) {
      throw new Error("Failed to fetch executions");
    }

    return response.data || [];
  }

  /**
   * Prepare trigger data for manual trigger
   */
  prepareTriggerData(customData?: any): any {
    const triggerData = {
      timestamp: new Date().toISOString(),
      source: "manual",
      ...(customData || {}),
    };

    // Validate trigger data size (max 1MB)
    const dataSize = JSON.stringify(triggerData).length;
    if (dataSize > 1024 * 1024) {
      throw new Error(`Trigger data too large: ${dataSize} bytes (max 1MB)`);
    }

    return triggerData;
  }
}

export const executionService = new ExecutionService();
