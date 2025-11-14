import { executionService } from "@/services/execution";
import { useWorkflowStore } from "@/stores/workflow";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the execution service
vi.mock("@/services/execution", () => ({
  executionService: {
    executeSingleNode: vi.fn(),
  },
}));

describe("WorkflowStore - executeNode", () => {
  beforeEach(() => {
    // Reset the store
    useWorkflowStore.setState({
      workflow: null,
      selectedNodeId: null,
      isLoading: false,
      isDirty: false,
      history: [],
      historyIndex: -1,
      workflowTitle: "",
      isTitleDirty: false,
      titleValidationError: null,
      isExporting: false,
      isImporting: false,
      importProgress: 0,
      exportProgress: 0,
      importError: null,
      exportError: null,
      executionState: {
        status: "idle",
        progress: 0,
        startTime: undefined,
        endTime: undefined,
        error: undefined,
        executionId: undefined,
      },
      lastExecutionResult: null,
      realTimeResults: new Map(),
      executionLogs: [],
      showPropertyPanel: false,
      propertyPanelNodeId: null,
      contextMenuVisible: false,
      contextMenuPosition: null,
      contextMenuNodeId: null,
    });

    // Clear all mocks
    vi.clearAllMocks();
  });

  it("should execute single node successfully", async () => {
    const mockWorkflow = {
      id: "workflow-1",
      name: "Test Workflow",
      description: "Test workflow description",
      userId: "user-1",
      nodes: [
        {
          id: "node-1",
          type: "manual-trigger",
          name: "Manual Trigger",
          parameters: {},
          position: { x: 100, y: 100 },
          credentials: [],
          disabled: false,
        },
      ],
      connections: [],
      settings: {},
      active: true,
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
    };

    const mockExecutionResult = {
      executionId: "exec-1",
      status: "completed" as const,
      executedNodes: ["node-1"],
      failedNodes: [],
      duration: 1000,
      hasFailures: false,
      // Single node executions now return output data directly (not saved to database)
      nodeExecutions: [{
        nodeId: "node-1",
        outputData: { main: [[{ json: { result: "success" } }]] },
        error: undefined,
      }],
    };

    // Mock the execution service
    vi.mocked(executionService.executeSingleNode).mockResolvedValue(
      mockExecutionResult
    );

    // Set up the store with a workflow
    useWorkflowStore.getState().setWorkflow(mockWorkflow);

    // Execute the node
    await useWorkflowStore.getState().executeNode("node-1");

    // Verify the execution service was called correctly
    expect(executionService.executeSingleNode).toHaveBeenCalledWith({
      workflowId: "workflow-1",
      nodeId: "node-1",
      inputData: { main: [[]] },
      parameters: {},
      mode: "single",
      workflowData: {
        nodes: mockWorkflow.nodes,
        connections: mockWorkflow.connections,
        settings: mockWorkflow.settings,
      },
    });

    // Verify the node execution result was updated
    const state = useWorkflowStore.getState();
    const nodeResult = state.getNodeExecutionResult("node-1");

    expect(nodeResult).toBeDefined();
    expect(nodeResult?.status).toBe("success");
    expect(nodeResult?.nodeId).toBe("node-1");
    expect(nodeResult?.nodeName).toBe("Manual Trigger");
  });

  it("should handle node execution error", async () => {
    const mockWorkflow = {
      id: "workflow-1",
      name: "Test Workflow",
      description: "Test workflow description",
      userId: "user-1",
      nodes: [
        {
          id: "node-1",
          type: "manual-trigger",
          name: "Manual Trigger",
          parameters: {},
          position: { x: 100, y: 100 },
          credentials: [],
          disabled: false,
        },
      ],
      connections: [],
      settings: {},
      active: true,
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
    };

    // Mock the execution service to throw an error
    vi.mocked(executionService.executeSingleNode).mockRejectedValue(
      new Error("Execution failed")
    );

    // Set up the store with a workflow
    useWorkflowStore.getState().setWorkflow(mockWorkflow);

    // Execute the node
    await useWorkflowStore.getState().executeNode("node-1");

    // Verify the node execution result shows error
    const state = useWorkflowStore.getState();
    const nodeResult = state.getNodeExecutionResult("node-1");

    expect(nodeResult).toBeDefined();
    expect(nodeResult?.status).toBe("error");
    expect(nodeResult?.error).toBe("Execution failed");
  });

  it("should not execute if no workflow is loaded", async () => {
    // Execute node without setting a workflow
    await useWorkflowStore.getState().executeNode("node-1");

    // Verify the execution service was not called
    expect(executionService.executeSingleNode).not.toHaveBeenCalled();
  });

  it("should not execute if node is not found", async () => {
    const mockWorkflow = {
      id: "workflow-1",
      name: "Test Workflow",
      description: "Test workflow description",
      userId: "user-1",
      nodes: [],
      connections: [],
      settings: {},
      active: true,
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
    };

    // Set up the store with a workflow that has no nodes
    useWorkflowStore.getState().setWorkflow(mockWorkflow);

    // Execute a non-existent node
    await useWorkflowStore.getState().executeNode("non-existent-node");

    // Verify the execution service was not called
    expect(executionService.executeSingleNode).not.toHaveBeenCalled();
  });

  it("should not execute during workflow execution", async () => {
    const mockWorkflow = {
      id: "workflow-1",
      name: "Test Workflow",
      description: "Test workflow description",
      userId: "user-1",
      nodes: [
        {
          id: "node-1",
          type: "manual-trigger",
          name: "Manual Trigger",
          parameters: {},
          position: { x: 100, y: 100 },
          credentials: [],
          disabled: false,
        },
      ],
      connections: [],
      settings: {},
      active: true,
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
    };

    // Set up the store with a workflow and set execution state to running
    useWorkflowStore.getState().setWorkflow(mockWorkflow);
    useWorkflowStore.getState().setExecutionState({ status: "running" });

    // Execute the node
    await useWorkflowStore.getState().executeNode("node-1");

    // Verify the execution service was not called
    expect(executionService.executeSingleNode).not.toHaveBeenCalled();
  });
});
