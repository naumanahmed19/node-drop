import { ExecutionContextManager } from "@/services/ExecutionContextManager";
import {
  ExecutionEventData,
  executionWebSocket,
} from "@/services/ExecutionWebSocket";
import { ProgressTracker } from "@/services/ProgressTracker";
import { ValidationResult, workflowFileService } from "@/services/workflowFile";
import {
  // NodeExecutionState,
  ExecutionFlowStatus,
  ExecutionState,
  FlowExecutionState,
  NodeExecutionResult,
  NodeExecutionStatus,
  NodeVisualState,
  Workflow,
  WorkflowConnection,
  WorkflowEditorState,
  WorkflowExecutionResult,
  WorkflowHistoryEntry,
  WorkflowNode,
} from "@/types";
import {
  validateImportFile as validateImportFileUtil,
  validateTitle as validateTitleUtil,
} from "@/utils/errorHandling";
import { getAffectedNodes } from "@/utils/executionPathAnalyzer";
import {
  handleWorkflowError,
  validateWorkflow,
} from "@/utils/workflowErrorHandling";
import {
  ensureWorkflowMetadata,
  updateWorkflowTitle,
  validateMetadata,
} from "@/utils/workflowMetadata";
import { devtools } from "zustand/middleware";
import { createWithEqualityFn } from "zustand/traditional";

// Import execution types from central location
import type { ExecutionLogEntry } from "@/types/execution";

interface WorkflowStore extends WorkflowEditorState {
  // Title management state
  workflowTitle: string;
  isTitleDirty: boolean;
  titleValidationError: string | null;

  // Import/Export state
  isExporting: boolean;
  isImporting: boolean;
  importProgress: number;
  exportProgress: number;
  importError: string | null;
  exportError: string | null;

  // Execution state
  executionState: ExecutionState;
  lastExecutionResult: WorkflowExecutionResult | null;
  realTimeResults: Map<string, NodeExecutionResult>;
  persistentNodeResults: Map<string, NodeExecutionResult>; // Preserved results for node config dialog
  executionLogs: ExecutionLogEntry[];

  // Read-only mode (for viewing past executions)
  readOnly: boolean;

  // Flow execution state
  flowExecutionState: FlowExecutionState;
  progressTracker: ProgressTracker;
  executionManager: ExecutionContextManager; // NEW: Manages execution contexts with proper isolation
  executionStateVersion: number; // NEW: Version counter to trigger hook re-renders
  executionTimeouts: Map<string, NodeJS.Timeout>; // Track execution timeouts for safety

  // Node interaction state
  showPropertyPanel: boolean;
  propertyPanelNodeId: string | null;
  contextMenuVisible: boolean;
  contextMenuPosition: { x: number; y: number } | null;
  contextMenuNodeId: string | null;

  // Chat dialog state
  showChatDialog: boolean;
  chatDialogNodeId: string | null;

  // Template dialog state
  showTemplateDialog: boolean;

  // Template variable dialog state
  showTemplateVariableDialog: boolean;
  templateVariableDialogData: {
    nodeType: any;
    position: { x: number; y: number };
  } | null;

  // Actions
  setWorkflow: (workflow: Workflow | null) => void;
  updateWorkflow: (updates: Partial<Workflow>, skipHistory?: boolean) => void;
  addNode: (node: WorkflowNode) => void;
  addNodes: (nodes: WorkflowNode[]) => void;
  updateNode: (
    nodeId: string,
    updates: Partial<WorkflowNode>,
    skipHistory?: boolean
  ) => void;

  addConnection: (connection: WorkflowConnection) => void;
  addConnections: (connections: WorkflowConnection[]) => void;
  removeConnection: (connectionId: string) => void;
  setSelectedNode: (nodeId: string | null) => void;
  setLoading: (loading: boolean) => void;
  setDirty: (dirty: boolean) => void;

  // Title management actions
  updateTitle: (title: string) => void;
  saveTitle: () => void;
  setTitleDirty: (dirty: boolean) => void;
  validateTitle: (title: string) => { isValid: boolean; error: string | null };
  sanitizeTitle: (title: string) => string;

  // History management
  saveToHistory: (action: string) => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // Import/Export actions
  exportWorkflow: () => Promise<void>;
  importWorkflow: (file: File) => Promise<void>;
  validateImportFile: (file: File) => Promise<ValidationResult>;
  setImportProgress: (progress: number) => void;
  setExportProgress: (progress: number) => void;
  clearImportExportErrors: () => void;

  // Execution actions
  executeNode: (
    nodeId: string,
    inputData?: any,
    mode?: "single" | "workflow"
  ) => Promise<void>;
  stopExecution: () => Promise<void>;
  cancelExecution: (executionId?: string) => Promise<void>;
  pauseExecution: (executionId?: string) => Promise<void>;
  resumeExecution: (executionId?: string) => Promise<void>;
  setExecutionState: (state: Partial<ExecutionState>) => void;
  clearExecutionState: (preserveLogs?: boolean) => void;
  clearPersistentResults: () => void;
  clearNodeVisualStates: () => void; // ADDED: Explicit method to clear visual states
  setExecutionProgress: (progress: number) => void;
  setExecutionError: (error: string) => void;
  updateNodeExecutionResult: (
    nodeId: string,
    result: Partial<NodeExecutionResult>
  ) => void;
  addExecutionLog: (log: ExecutionLogEntry) => void;
  clearExecutionLogs: () => void;
  getNodeExecutionResult: (nodeId: string) => NodeExecutionResult | undefined;

  // Real-time execution updates
  subscribeToExecution: (executionId: string) => Promise<void>;
  unsubscribeFromExecution: (executionId: string) => Promise<void>;
  setupSocketListeners: () => void;
  cleanupSocketListeners: () => void;
  initializeRealTimeUpdates: () => void;
  handleExecutionEvent: (data: ExecutionEventData) => void;

  // Flow execution methods
  updateNodeExecutionState: (
    nodeId: string,
    status: NodeExecutionStatus,
    data?: any
  ) => void;
  getNodeVisualState: (nodeId: string) => NodeVisualState;
  getAllNodeVisualStates: () => Map<string, NodeVisualState>;
  getExecutionFlowStatus: (executionId: string) => ExecutionFlowStatus | null;
  initializeFlowExecution: (executionId: string, nodeIds: string[]) => void;
  resetFlowExecution: () => void;

  // Multiple execution management
  selectExecution: (executionId: string) => void;
  getActiveExecutions: () => Map<string, ExecutionFlowStatus>;
  removeCompletedExecution: (executionId: string) => void;
  cleanupOldExecutions: (maxAge?: number) => void;
  setCurrentExecutionId: (executionId: string | undefined) => void; // ADDED: Track current execution ID

  // Workflow activation
  toggleWorkflowActive: () => void;
  setWorkflowActive: (active: boolean) => void;

  // Node lock/unlock
  toggleNodeLock: (nodeId: string) => void;

  // Validation
  validateWorkflow: () => { isValid: boolean; errors: string[] };
  validateConnection: (sourceId: string, targetId: string) => boolean;

  // Helper functions
  gatherInputDataFromConnectedNodes: (nodeId: string) => any;

  // Execution mode control
  setExecutionMode: (enabled: boolean, executionId?: string) => void;
  setNodeExecutionResult: (
    nodeId: string,
    result: Partial<NodeExecutionResult>
  ) => void;

  // Node interaction actions
  setShowPropertyPanel: (show: boolean) => void;
  setPropertyPanelNode: (nodeId: string | null) => void;
  showContextMenu: (nodeId: string, position: { x: number; y: number }) => void;
  hideContextMenu: () => void;
  openNodeProperties: (nodeId: string) => void;
  closeNodeProperties: () => void;

  // Chat dialog actions
  openChatDialog: (nodeId: string) => void;
  closeChatDialog: () => void;

  // Template dialog actions
  openTemplateDialog: () => void;
  closeTemplateDialog: () => void;

  // Template variable dialog actions
  openTemplateVariableDialog: (nodeType: any, position: { x: number; y: number }) => void;
  closeTemplateVariableDialog: () => void;

  // Error handling
  handleError: (
    error: unknown,
    operation: string,
    showToast?: (
      type: "error" | "warning",
      title: string,
      options?: any
    ) => void
  ) => void;
  getWorkflowHealth: () => {
    score: number;
    issues: string[];
    suggestions: string[];
  };
}

const MAX_HISTORY_SIZE = 50;

/**
 * Helper function to serialize error for display
 * Converts error objects to properly formatted strings
 */
function serializeError(error: any): string | undefined {
  if (!error) return undefined;

  if (typeof error === "string") {
    return error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  // If it's an object, try to extract useful information
  if (typeof error === "object") {
    // Check for common error properties
    if (error.message) {
      return error.message;
    }

    // If the object has useful information, stringify it
    try {
      return JSON.stringify(error, null, 2);
    } catch (e) {
      return String(error);
    }
  }

  return String(error);
}

export const useWorkflowStore = createWithEqualityFn<WorkflowStore>()(
  devtools(
    (set, get) => ({
      // Initial state
      workflow: null,
      selectedNodeId: null,
      isLoading: false,
      isDirty: false,
      history: [],
      historyIndex: -1,

      // Title management state
      workflowTitle: "",
      isTitleDirty: false,
      titleValidationError: null,

      // Import/Export state
      isExporting: false,
      isImporting: false,
      importProgress: 0,
      exportProgress: 0,
      importError: null,
      exportError: null,

      // Execution state
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
      persistentNodeResults: new Map(),
      executionLogs: [],

      // Read-only mode state
      readOnly: false,

      // Flow execution state
      flowExecutionState: {
        activeExecutions: new Map(),
        nodeVisualStates: new Map(),
        executionHistory: [],
        realTimeUpdates: true,
        selectedExecution: undefined,
      },
      progressTracker: new ProgressTracker(),
      executionManager: new ExecutionContextManager(), // NEW: Initialize execution context manager
      executionStateVersion: 0, // NEW: Initialize version counter
      executionTimeouts: new Map(), // Initialize execution timeout tracking

      // Node interaction state
      showPropertyPanel: false,
      propertyPanelNodeId: null,
      contextMenuVisible: false,
      contextMenuPosition: null,
      contextMenuNodeId: null,

      // Chat dialog state
      showChatDialog: false,
      chatDialogNodeId: null,

      // Template dialog state
      showTemplateDialog: false,

      // Template variable dialog state
      showTemplateVariableDialog: false,
      templateVariableDialogData: null,

      // Actions
      setWorkflow: (workflow) => {
        let processedWorkflow = workflow;

        // Ensure workflow has proper metadata
        if (workflow) {
          processedWorkflow = ensureWorkflowMetadata(workflow);

          // Clean up invalid connections to trigger nodes
          // Triggers are starting points and should not have incoming connections
          if (processedWorkflow.connections && processedWorkflow.nodes) {
            const triggerTypes = [
              "manual-trigger",
              "webhook-trigger",
              "schedule-trigger",
              "workflow-called",
              "webhook",
            ];

            const triggerNodeIds = new Set(
              processedWorkflow.nodes
                .filter((node) => triggerTypes.includes(node.type))
                .map((node) => node.id)
            );

            // Remove any connections that target trigger nodes
            processedWorkflow.connections = processedWorkflow.connections.filter(
              (conn) => !triggerNodeIds.has(conn.targetNodeId)
            );
          }
        }

        const title =
          processedWorkflow?.metadata?.title || processedWorkflow?.name || "";
        set({
          workflow: processedWorkflow,
          isDirty: false,
          workflowTitle: title,
          isTitleDirty: false,
          titleValidationError: null,
          // Reset execution state when loading new workflow
          persistentNodeResults: new Map(),
          realTimeResults: new Map(),
          // Reset node interaction state when loading new workflow
          selectedNodeId: null,
          showPropertyPanel: false,
          propertyPanelNodeId: null,
          contextMenuVisible: false,
          contextMenuPosition: null,
          contextMenuNodeId: null,
          showChatDialog: false,
          chatDialogNodeId: null,
        });
        if (processedWorkflow) {
          get().saveToHistory("Load workflow");
        }
      },

      updateWorkflow: (updates, skipHistory = false) => {
        const current = get().workflow;
        if (!current) return;

        // Deep merge settings if provided
        const updated = {
          ...current,
          ...updates,
          settings: updates.settings
            ? { ...(current.settings || {}), ...updates.settings }
            : current.settings,
        };
        set({ workflow: updated, isDirty: true });
        
        // Save to history unless explicitly skipped
        if (!skipHistory) {
          get().saveToHistory('Update workflow');
        }
      },

      addNode: (node) => {
        const current = get().workflow;
        if (!current) return;

        const updated = {
          ...current,
          nodes: [...current.nodes, node],
        };
        set({ workflow: updated, isDirty: true });
        get().saveToHistory(`Add node: ${node.name}`);
      },

      addNodes: (nodes) => {
        const current = get().workflow;
        if (!current) return;

        const updated = {
          ...current,
          nodes: [...current.nodes, ...nodes],
        };
        set({ workflow: updated, isDirty: true });
        get().saveToHistory(`Add ${nodes.length} nodes`);
      },

      updateNode: (nodeId, updates, skipHistory = false) => {
        const current = get().workflow;
        if (!current) return;

        const updated = {
          ...current,
          nodes: current.nodes.map((node) =>
            node.id === nodeId ? { ...node, ...updates } : node
          ),
        };
        set({ workflow: updated, isDirty: true });

        if (!skipHistory) {
          get().saveToHistory(`Update node: ${nodeId}`);
        }
      },



      addConnection: (connection) => {
        const current = get().workflow;
        if (!current) return;

        // Validate connection before adding
        if (
          !get().validateConnection(
            connection.sourceNodeId,
            connection.targetNodeId
          )
        ) {
          return;
        }

        const updated = {
          ...current,
          connections: [...current.connections, connection],
        };
        set({ workflow: updated, isDirty: true });
        get().saveToHistory("Add connection");
      },

      addConnections: (connections) => {
        const current = get().workflow;
        if (!current) return;

        // Filter out invalid connections
        const validConnections = connections.filter(conn =>
          get().validateConnection(conn.sourceNodeId, conn.targetNodeId)
        );

        if (validConnections.length === 0) return;

        const updated = {
          ...current,
          connections: [...current.connections, ...validConnections],
        };
        set({ workflow: updated, isDirty: true });
        get().saveToHistory(`Add ${validConnections.length} connections`);
      },

      removeConnection: (connectionId) => {
        const current = get().workflow;
        if (!current) return;

        const updated = {
          ...current,
          connections: current.connections.filter(
            (conn) => conn.id !== connectionId
          ),
        };
        set({ workflow: updated, isDirty: true });
        get().saveToHistory("Remove connection");
      },

      setSelectedNode: (nodeId) => {
        set({ selectedNodeId: nodeId });
      },

      setLoading: (loading) => {
        set({ isLoading: loading });
      },

      setDirty: (dirty) => {
        set({ isDirty: dirty });
      },

      // Title management actions
      updateTitle: (title) => {
        const sanitized = get().sanitizeTitle(title);
        const validation = get().validateTitle(sanitized);

        set({
          workflowTitle: sanitized,
          isTitleDirty: true,
          titleValidationError: validation.error,
        });
      },

      saveTitle: () => {
        const { workflowTitle, workflow, titleValidationError } = get();

        if (!workflow || titleValidationError) {
          return;
        }

        // Update workflow title through metadata management
        const updated = updateWorkflowTitle(workflow, workflowTitle);
        set({
          workflow: updated,
          isDirty: true,
          isTitleDirty: false,
        });
        get().saveToHistory(`Update title: ${workflowTitle}`);
      },

      setTitleDirty: (dirty) => {
        set({ isTitleDirty: dirty });
      },

      validateTitle: (title) => {
        const validationErrors = validateTitleUtil(title);

        if (validationErrors.length > 0) {
          return { isValid: false, error: validationErrors[0].message };
        }

        return { isValid: true, error: null };
      },

      sanitizeTitle: (title) => {
        // Remove leading/trailing whitespace
        let sanitized = title.trim();

        // Replace multiple consecutive spaces with single space
        sanitized = sanitized.replace(/\s+/g, " ");

        // Remove or replace invalid characters
        sanitized = sanitized.replace(/[<>:"/\\|?*\x00-\x1f]/g, "");

        // Truncate if too long
        if (sanitized.length > 100) {
          sanitized = sanitized.substring(0, 100).trim();
        }

        return sanitized;
      },

      // History management
      saveToHistory: (action) => {
        const { workflow, history, historyIndex } = get();
        if (!workflow) return;

        const newEntry: WorkflowHistoryEntry = {
          workflow: JSON.parse(JSON.stringify(workflow)), // Deep clone
          timestamp: Date.now(),
          action,
        };

        // Remove any history after current index (when undoing then making new changes)
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(newEntry);

        // Limit history size
        if (newHistory.length > MAX_HISTORY_SIZE) {
          newHistory.shift();
        }

        set({
          history: newHistory,
          historyIndex: newHistory.length - 1,
        });
      },

      undo: () => {
        const { history, historyIndex } = get();
        if (historyIndex > 0) {
          const previousEntry = history[historyIndex - 1];
          set({
            workflow: JSON.parse(JSON.stringify(previousEntry.workflow)),
            historyIndex: historyIndex - 1,
            isDirty: true,
          });
        }
      },

      redo: () => {
        const { history, historyIndex } = get();
        if (historyIndex < history.length - 1) {
          const nextEntry = history[historyIndex + 1];
          set({
            workflow: JSON.parse(JSON.stringify(nextEntry.workflow)),
            historyIndex: historyIndex + 1,
            isDirty: true,
          });
        }
      },

      canUndo: () => {
        const { historyIndex } = get();
        return historyIndex > 0;
      },

      canRedo: () => {
        const { history, historyIndex } = get();
        return historyIndex < history.length - 1;
      },

      // Import/Export actions
      exportWorkflow: async () => {
        const { workflow } = get();
        if (!workflow) {
          console.error('❌ Export failed: No workflow loaded');
          set({ exportError: "No workflow to export" });
          return;
        }

        console.log('🚀 Starting export workflow...', { 
          workflowId: workflow.id, 
          workflowName: workflow.name,
          nodeCount: workflow.nodes?.length || 0,
          connectionCount: workflow.connections?.length || 0
        });

        set({
          isExporting: true,
          exportProgress: 0,
          exportError: null,
        });

        try {
          // Simulate progress for user feedback
          set({ exportProgress: 25 });

          // Validate workflow before export (but only check for critical errors)
          console.log('🔍 Validating workflow...');
          const validation = get().validateWorkflow();
          
          // Filter out metadata-only errors - we'll fix those during export
          const criticalErrors = validation.errors.filter(error => 
            !error.toLowerCase().includes('metadata') &&
            !error.toLowerCase().includes('title') &&
            !error.toLowerCase().includes('export version') &&
            !error.toLowerCase().includes('schema version')
          );
          
          if (criticalErrors.length > 0) {
            console.error('❌ Critical validation errors:', criticalErrors);
            throw new Error(
              `Cannot export workflow with errors: ${criticalErrors.join(", ")}`
            );
          }
          
          if (validation.errors.length > 0) {
            console.warn('⚠️ Non-critical validation warnings (will be fixed during export):', validation.errors);
          } else {
            console.log('✅ Validation passed');
          }

          set({ exportProgress: 50 });

          // Export using the file service (which will ensure metadata is complete)
          console.log('📤 Calling workflowFileService.exportWorkflow...');
          await workflowFileService.exportWorkflow(workflow);

          set({ exportProgress: 100 });
          console.log('✅ Export completed successfully');

          // Clear progress after a short delay
          setTimeout(() => {
            set({ exportProgress: 0, isExporting: false });
          }, 1000);
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown export error";
          console.error('❌ Export error:', errorMessage, error);
          set({
            exportError: errorMessage,
            isExporting: false,
            exportProgress: 0,
          });
          // Re-throw to propagate to UI
          throw error;
        }
      },

      importWorkflow: async (file: File) => {
        set({
          isImporting: true,
          importProgress: 0,
          importError: null,
        });

        try {
          // Validate file first
          set({ importProgress: 20 });
          const validation = await workflowFileService.validateWorkflowFile(
            file
          );

          if (!validation.isValid) {
            throw new Error(
              `Invalid workflow file: ${validation.errors.join(", ")}`
            );
          }

          // Show warnings if any (logged to execution logs)
          if (validation.warnings.length > 0) {
            get().addExecutionLog({
              timestamp: new Date().toISOString(),
              level: "warn",
              message: `Import warnings: ${validation.warnings.join(", ")}`,
            });
          }

          set({ importProgress: 50 });

          // Import the workflow
          const importedWorkflow = await workflowFileService.importWorkflow(
            file
          );

          set({ importProgress: 80 });

          // Check if current workflow has unsaved changes
          const { isDirty, isTitleDirty } = get();
          if (isDirty || isTitleDirty) {
            get().addExecutionLog({
              timestamp: new Date().toISOString(),
              level: "warn",
              message: "Importing workflow will overwrite unsaved changes",
            });
          }

          // Set the imported workflow
          get().setWorkflow(importedWorkflow);

          set({ importProgress: 100 });

          // Clear progress after a short delay
          setTimeout(() => {
            set({ importProgress: 0, isImporting: false });
          }, 1000);
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown import error";
          set({
            importError: errorMessage,
            isImporting: false,
            importProgress: 0,
          });
        }
      },

      validateImportFile: async (file: File) => {
        try {
          // First do basic file validation
          const basicValidation = validateImportFileUtil(file);
          if (basicValidation.length > 0) {
            return {
              isValid: false,
              errors: basicValidation.map((error) => error.message),
              warnings: [],
            };
          }

          // Then do content validation
          return await workflowFileService.validateWorkflowFile(file);
        } catch (error) {
          return {
            isValid: false,
            errors: [
              error instanceof Error
                ? error.message
                : "Unknown validation error",
            ],
            warnings: [],
          };
        }
      },

      setImportProgress: (progress: number) => {
        set({ importProgress: Math.max(0, Math.min(100, progress)) });
      },

      setExportProgress: (progress: number) => {
        set({ exportProgress: Math.max(0, Math.min(100, progress)) });
      },

      clearImportExportErrors: () => {
        set({
          importError: null,
          exportError: null,
        });
      },

      // Flow execution methods
      updateNodeExecutionState: (nodeId: string, status: NodeExecutionStatus, data?: any) => {
        const { progressTracker, executionState, flowExecutionState, executionManager } = get();
        const executionId = executionState.executionId || flowExecutionState.selectedExecution || "current";

        console.log(`[updateNodeExecutionState] Updating node ${nodeId} to ${status}`, {
          executionId,
          nodeId,
          status,
          currentExecutionId: executionState.executionId,
          selectedExecution: flowExecutionState.selectedExecution,
        });

        // Update execution context manager
        switch (status) {
          case NodeExecutionStatus.QUEUED:
            executionManager.setNodeQueued(executionId, nodeId);
            break;
          case NodeExecutionStatus.RUNNING:
            executionManager.setNodeRunning(executionId, nodeId);
            console.log(`[updateNodeExecutionState] Set node ${nodeId} to RUNNING in execution ${executionId}`);
            break;
          case NodeExecutionStatus.COMPLETED:
            executionManager.setNodeCompleted(executionId, nodeId);
            break;
          case NodeExecutionStatus.FAILED:
            executionManager.setNodeFailed(executionId, nodeId);
            console.log(`[updateNodeExecutionState] Set node ${nodeId} to FAILED in execution ${executionId}`);
            break;
        }

        // Verify the state was set
        const nodeStatus = executionManager.getNodeStatus(nodeId);
        console.log(`[updateNodeExecutionState] Verified node status:`, {
          nodeId,
          status: nodeStatus.status,
          executionId: nodeStatus.executionId,
          isExecutingInCurrent: executionManager.isNodeExecutingInCurrent(nodeId),
        });

        // Increment version to trigger re-renders (executionManager is mutated in place)
        set({ executionStateVersion: get().executionStateVersion + 1 });

        // Update ProgressTracker
        progressTracker.setCurrentExecution(executionId);
        progressTracker.updateNodeStatus(executionId, nodeId, status, data);

        const currentFlowState = get().flowExecutionState;
        currentFlowState.nodeVisualStates.set(nodeId, progressTracker.getNodeVisualState(nodeId));

        // Update execution status tracking
        const executionStatus = currentFlowState.activeExecutions.get(executionId);
        if (executionStatus) {
          if (status === NodeExecutionStatus.RUNNING) {
            if (!executionStatus.currentlyExecuting.includes(nodeId)) {
              executionStatus.currentlyExecuting.push(nodeId);
            }
          } else if ([NodeExecutionStatus.COMPLETED, NodeExecutionStatus.FAILED, NodeExecutionStatus.CANCELLED].includes(status)) {
            executionStatus.currentlyExecuting = executionStatus.currentlyExecuting.filter((id) => id !== nodeId);
            if (status === NodeExecutionStatus.COMPLETED && !executionStatus.completedNodes.includes(nodeId)) {
              executionStatus.completedNodes.push(nodeId);
            } else if (status === NodeExecutionStatus.FAILED && !executionStatus.failedNodes.includes(nodeId)) {
              executionStatus.failedNodes.push(nodeId);
            }
          }
          currentFlowState.activeExecutions.set(executionId, executionStatus);
        }

        set({ flowExecutionState: { ...currentFlowState } });
      },

      getNodeVisualState: (nodeId: string) => {
        const { executionManager } = get();
        const statusInfo = executionManager.getNodeStatus(nodeId);
        const isExecutingInCurrent = executionManager.isNodeExecutingInCurrent(nodeId);

        let animationState: "idle" | "pulsing" | "spinning" | "success" | "error" = "idle";
        if (isExecutingInCurrent) animationState = "spinning";
        else if (statusInfo.status === NodeExecutionStatus.COMPLETED) animationState = "success";
        else if (statusInfo.status === NodeExecutionStatus.FAILED) animationState = "error";

        return {
          nodeId,
          status: statusInfo.status,
          animationState,
          progress: 0,
          lastUpdated: statusInfo.lastUpdated,
          executionTime: undefined,
          errorMessage: statusInfo.status === NodeExecutionStatus.FAILED ? "Execution failed" : undefined,
        };
      },

      getAllNodeVisualStates: () => {
        return get().progressTracker.getAllNodeVisualStates();
      },

      getExecutionFlowStatus: (executionId: string) => {
        const { flowExecutionState } = get();
        return flowExecutionState.activeExecutions.get(executionId) || null;
      },

      initializeFlowExecution: (executionId: string, nodeIds: string[]) => {
        const { progressTracker, workflow } = get();

        if (!workflow) return;

        // Build dependency map from workflow connections
        const dependencies = new Map<string, string[]>();
        nodeIds.forEach((nodeId) => {
          const nodeDeps = workflow.connections
            .filter((conn) => conn.targetNodeId === nodeId)
            .map((conn) => conn.sourceNodeId);
          dependencies.set(nodeId, nodeDeps);
        });

        // ExecutionContextManager is already initialized in subscribeToExecution
        // No need to initialize again here
        console.log(`[initializeFlowExecution] Initializing progress tracker for execution ${executionId} with ${nodeIds.length} nodes`);

        // FIXED: Set this as the current execution context in ProgressTracker
        // This ensures that subsequent updates affect the correct execution's state
        progressTracker.setCurrentExecution(executionId);

        // Initialize progress tracker for this execution with execution ID
        progressTracker.initializeNodeStates(
          nodeIds,
          dependencies,
          executionId
        );

        // Create initial flow status
        const flowStatus = progressTracker.getExecutionFlowStatus(executionId);

        // Update flow execution state - support multiple concurrent executions
        const currentFlowState = get().flowExecutionState;
        currentFlowState.activeExecutions.set(executionId, flowStatus);

        // Set as selected execution if no current selection or if this is the first execution
        if (
          !currentFlowState.selectedExecution ||
          currentFlowState.activeExecutions.size === 1
        ) {
          currentFlowState.selectedExecution = executionId;
        }

        // Update node visual states for this execution
        currentFlowState.nodeVisualStates =
          progressTracker.getAllNodeVisualStates();

        set({ flowExecutionState: { ...currentFlowState } });

        // Log execution initialization
        get().addExecutionLog({
          timestamp: new Date().toISOString(),
          level: "info",
          message: `Initialized flow execution: ${executionId} with ${nodeIds.length} nodes`,
          data: {
            executionId,
            nodeCount: nodeIds.length,
            dependencies: Array.from(dependencies.entries()),
          },
        });
      },

      resetFlowExecution: () => {
        const { progressTracker } = get();
        progressTracker.reset();

        set({
          flowExecutionState: {
            activeExecutions: new Map(),
            nodeVisualStates: new Map(),
            executionHistory: [],
            realTimeUpdates: true,
            selectedExecution: undefined,
          },
        });
      },

      // Multiple execution management
      selectExecution: (executionId: string) => {
        const currentFlowState = get().flowExecutionState;
        if (!currentFlowState.activeExecutions.has(executionId)) return;

        currentFlowState.selectedExecution = executionId;
        get().progressTracker.setCurrentExecution(executionId);
        currentFlowState.nodeVisualStates = get().progressTracker.getAllNodeVisualStates();
        set({ flowExecutionState: { ...currentFlowState } });

        get().addExecutionLog({
          timestamp: new Date().toISOString(),
          level: "info",
          message: `Selected execution: ${executionId}`,
        });
      },

      getActiveExecutions: () => {
        return get().flowExecutionState.activeExecutions;
      },

      removeCompletedExecution: (executionId: string) => {
        const currentFlowState = get().flowExecutionState;
        const execution = currentFlowState.activeExecutions.get(executionId);

        if (
          execution &&
          (execution.overallStatus === "completed" ||
            execution.overallStatus === "failed" ||
            execution.overallStatus === "cancelled")
        ) {
          // Add to history before removing
          const historyEntry = {
            executionId,
            workflowId: get().workflow?.id || "",
            triggerType: "manual" as const,
            startTime: Date.now() - 300000, // Estimate 5 minutes ago
            endTime: Date.now(),
            status: execution.overallStatus,
            executedNodes: execution.completedNodes,
            executionPath: execution.executionPath,
            metrics: get().progressTracker.getExecutionMetrics(executionId),
          };

          currentFlowState.executionHistory.unshift(historyEntry);
          // Keep only last 50 executions
          if (currentFlowState.executionHistory.length > 50) {
            currentFlowState.executionHistory =
              currentFlowState.executionHistory.slice(0, 50);
          }

          // Remove from active executions
          currentFlowState.activeExecutions.delete(executionId);

          // FIXED: Clean up execution state from ProgressTracker
          get().progressTracker.clearExecution(executionId);

          // Update selected execution if this was the selected one
          if (currentFlowState.selectedExecution === executionId) {
            // Select the most recent active execution or none
            const remaining = Array.from(
              currentFlowState.activeExecutions.keys()
            );
            currentFlowState.selectedExecution =
              remaining.length > 0 ? remaining[0] : undefined;

            // Update current execution context to the new selected execution
            if (currentFlowState.selectedExecution) {
              get().progressTracker.setCurrentExecution(
                currentFlowState.selectedExecution
              );
            }
          }

          set({ flowExecutionState: { ...currentFlowState } });

          get().addExecutionLog({
            timestamp: new Date().toISOString(),
            level: "info",
            message: `Removed completed execution: ${executionId}`,
          });
        }
      },

      cleanupOldExecutions: (maxAge: number = 3600000) => {
        const currentFlowState = get().flowExecutionState;
        const now = Date.now();
        let cleaned = 0;

        for (const [executionId, execution] of currentFlowState.activeExecutions) {
          const isCompleted = ["completed", "failed", "cancelled"].includes(execution.overallStatus);
          if (isCompleted) {
            const estimatedStartTime = now - 300000;
            if (now - estimatedStartTime > maxAge) {
              get().removeCompletedExecution(executionId);
              cleaned++;
            }
          }
        }

        if (cleaned > 0) {
          get().addExecutionLog({
            timestamp: new Date().toISOString(),
            level: "info",
            message: `Cleaned up ${cleaned} old executions`,
          });
        }
      },

      setCurrentExecutionId: (executionId: string | undefined) => {
        get().setExecutionState({ executionId });
        if (executionId) {
          get().addExecutionLog({
            timestamp: new Date().toISOString(),
            level: "info",
            message: `Set current execution ID: ${executionId}`,
          });
        }
      },

      // Execution actions

      executeNode: async (
        nodeId: string,
        inputData?: any,
        mode: "single" | "workflow" = "single"
      ) => {
        const { workflow, executionState } = get();

        if (!workflow) {
          get().setExecutionError("No workflow to execute node from");
          return;
        }

        // Prevent execution during workflow execution
        if (executionState.status === "running") {
          get().addExecutionLog({
            timestamp: new Date().toISOString(),
            level: "warn",
            message: "Cannot execute individual node while workflow is running",
          });
          return;
        }

        // Find the node
        const node = workflow.nodes.find((n) => n.id === nodeId);
        if (!node) {
          get().setExecutionError(`Node not found: ${nodeId}`);
          return;
        }

        // If no input data provided, try to gather from connected input nodes
        let nodeInputData = inputData;
        if (!nodeInputData && mode === "single") {
          nodeInputData = get().gatherInputDataFromConnectedNodes(nodeId);
        }

        const startTime = Date.now();

        try {
          // Import execution service
          const { executionService } = await import("@/services/execution");

          // Set node execution state
          get().updateNodeExecutionResult(nodeId, {
            nodeId,
            nodeName: node.name,
            status: "success", // Will be updated based on result
            startTime,
            endTime: startTime,
            duration: 0,
            data: undefined,
            error: undefined,
          });

          get().addExecutionLog({
            timestamp: new Date().toISOString(),
            level: "info",
            nodeId,
            message: `Starting execution of node: ${node.name}`,
            data: { nodeId, nodeType: node.type },
          });

          // Execute based on mode
          if (mode === "workflow") {
            // For workflow mode, use the main workflow execution endpoint
            // This is essentially the same as executeWorkflow() but triggered from a specific node

            // Clear execution logs but DON'T clear realTimeResults
            // We keep previous execution results so multiple triggers can maintain their outputs
            get().clearExecutionLogs();

            // NOTE: We intentionally DON'T clear realTimeResults here anymore
            // This allows multiple triggers to maintain their execution outputs independently
            // Results will be updated/overwritten per node as new executions complete
            // set({ realTimeResults: new Map() }); // REMOVED - this was clearing all previous results

            // FIXED: Don't clear node visual states when starting a new execution
            // This preserves status icons from previous completed execution chains
            // get().clearNodeVisualStates(); // REMOVED - this was clearing all previous states

            // Set initial execution state - CRITICAL for UI feedback
            get().setExecutionState({
              status: "running",
              progress: 0,
              startTime,
              endTime: undefined,
              error: undefined,
              executionId: undefined, // Will be set when we get response
            });

            // CRITICAL FIX: Initialize execution context IMMEDIATELY with temporary ID
            // This ensures nodes show loading spinner right away, before API call completes
            const tempExecutionId = `temp_${Date.now()}`;
            const affectedNodes = getAffectedNodes(nodeId, workflow);
            const { executionManager } = get();

            // CRITICAL: Clear old completed executions to prevent cross-trigger contamination
            const allExecutions: string[] = Array.from((executionManager as any).executions.keys());
            allExecutions.forEach((execId) => {
              const exec = (executionManager as any).executions.get(execId);
              // Clear completed/failed/cancelled executions from ExecutionContextManager
              if (exec && (exec.status === 'completed' || exec.status === 'failed' || exec.status === 'cancelled')) {
                executionManager.clearExecution(execId);
                // Also clear from ProgressTracker
                get().progressTracker.clearExecution(execId);
              }
            });

            // CRITICAL: Clear ALL node visual states in flowExecutionState
            const currentFlowState = get().flowExecutionState;
            currentFlowState.nodeVisualStates.clear();
            set({ flowExecutionState: { ...currentFlowState } });

            // CRITICAL: Clear ALL node visual states before starting new execution
            // This prevents success/error states from previous trigger executions from persisting
            if (workflow?.nodes) {
              workflow.nodes.forEach((node: any) => {
                // Clear state for ALL nodes, not just ones outside this execution
                // Nodes in this execution will get their state set when execution starts
                get().progressTracker.updateNodeStatus(tempExecutionId, node.id, NodeExecutionStatus.IDLE, {});
              });
            }

            executionManager.startExecution(
              tempExecutionId,
              nodeId,
              affectedNodes
            );
            executionManager.setCurrentExecution(tempExecutionId);

            // Force state update to trigger re-render with cleared states
            set({ executionManager, executionStateVersion: get().executionStateVersion + 1 });

            // Mark trigger node as executing immediately
            executionManager.updateNodeStatus(
              nodeId,
              NodeExecutionStatus.RUNNING,
              tempExecutionId
            );

            // OPTIMIZATION: Trigger Zustand update to notify subscribers
            set({ executionManager, executionStateVersion: get().executionStateVersion + 1 });

            get().addExecutionLog({
              timestamp: new Date().toISOString(),
              level: "info",
              nodeId,
              message: `Starting workflow execution from trigger node: ${node.name}`,
              data: { nodeId, nodeType: node.type, mode },
            });

            try {
              // Prepare proper trigger data for workflow execution
              const triggerData = executionService.prepareTriggerData({
                triggeredBy: "user",
                workflowName: workflow.name,
                nodeCount: workflow.nodes.length,
                triggerNodeId: nodeId,
                triggerNodeType: node.type,
              });



              // Start the workflow execution via WebSocket (non-blocking)
              const { executionWebSocket } = await import("@/services/ExecutionWebSocket");

              // Ensure WebSocket is connected
              if (!executionWebSocket.isConnected()) {
                await executionWebSocket.connect();
              }

              // Start execution via WebSocket and get execution ID immediately
              const executionResponse = await new Promise<{ executionId: string }>((resolve, reject) => {
                executionWebSocket.getSocket()?.emit(
                  "start-workflow-execution",
                  {
                    workflowId: workflow.id,
                    triggerData,
                    triggerNodeId: nodeId,
                    workflowData: {
                      nodes: workflow.nodes,
                      connections: workflow.connections,
                      settings: workflow.settings,
                    },
                    options: {
                      timeout: 300000,
                      manual: true,
                      saveToDatabase: workflow.settings?.saveExecutionToDatabase !== false, // Pass workflow setting
                    },
                  },
                  (response: any) => {
                    if (response.success) {
                      resolve({ executionId: response.executionId });
                    } else {
                      reject(new Error(response.error || "Failed to start execution"));
                    }
                  }
                );

                // Timeout after 10 seconds
                setTimeout(() => reject(new Error("Execution start timeout")), 10000);
              });

              // CRITICAL: Update execution state with real execution ID IMMEDIATELY
              // This ensures UI tracking is tied to the correct execution
              get().setExecutionState({
                executionId: executionResponse.executionId,
              });

              // CRITICAL FIX: Replace temporary execution ID with real one
              // This maintains the loading state while transitioning to real execution tracking
              const { executionManager } = get();
              executionManager.replaceExecutionId(tempExecutionId, executionResponse.executionId);
              executionManager.setCurrentExecution(executionResponse.executionId);

              // OPTIMIZATION: Trigger Zustand update to notify subscribers
              set({ executionManager, executionStateVersion: get().executionStateVersion + 1 });

              // Set this as the current tracked execution to prevent conflicts
              get().setCurrentExecutionId(executionResponse.executionId);

              // Subscribe to real-time updates IMMEDIATELY
              await get().subscribeToExecution(executionResponse.executionId);

              // Listen for execution ID updates (in case backend sends a different ID)
              executionWebSocket.addEventListener(executionResponse.executionId, (data: any) => {
                if (data.type === "execution-id-updated") {
                  const newExecutionId = data.executionId;
                  get().executionManager.replaceExecutionId(executionResponse.executionId, newExecutionId);
                  get().setExecutionState({ executionId: newExecutionId });
                }
              });

              // Initialize flow execution tracking
              const nodeIds = workflow.nodes.map((node) => node.id);
              get().initializeFlowExecution(
                executionResponse.executionId,
                nodeIds
              );

              get().addExecutionLog({
                timestamp: new Date().toISOString(),
                level: "info",
                nodeId,
                message: `Workflow execution started: ${executionResponse.executionId}`,
                data: {
                  nodeId,
                  executionId: executionResponse.executionId,
                  mode: "workflow",
                },
              });



              // Wait for execution to complete via WebSocket events
              // WebSocket is the primary method now - no polling needed
              await new Promise<void>((resolve) => {
                const checkCompletion = () => {
                  const currentState = get().executionState;
                  if (
                    currentState.executionId === executionResponse.executionId &&
                    (currentState.status === "success" ||
                      currentState.status === "error" ||
                      currentState.status === "cancelled")
                  ) {
                    return true;
                  }
                  return false;
                };

                // Check immediately in case it already completed
                if (checkCompletion()) {
                  resolve();
                  return;
                }

                // Subscribe to state changes
                const unsubscribe = useWorkflowStore.subscribe(
                  (state) => {
                    if (
                      state.executionState.executionId === executionResponse.executionId &&
                      (state.executionState.status === "success" ||
                        state.executionState.status === "error" ||
                        state.executionState.status === "cancelled")
                    ) {
                      unsubscribe();
                      resolve();
                    }
                  }
                );

                // Timeout after 5 minutes
                setTimeout(() => {
                  unsubscribe();
                  resolve();
                }, 300000);
              });

              // WebSocket execution completed - node states are already set by WebSocket events
              // No need to fetch execution details since we have real-time updates
              const endTime = Date.now();
              const duration = endTime - startTime;

              // Get final execution status from current state
              const currentExecutionState = get().executionState;
              const finalStatus = currentExecutionState.status;
              const finalError = currentExecutionState.error;

              // Map execution status to workflow result status
              const resultStatus: "success" | "error" | "cancelled" =
                finalStatus === "success"
                  ? "success"
                  : finalStatus === "cancelled"
                    ? "cancelled"
                    : "error";

              get().addExecutionLog({
                timestamp: new Date().toISOString(),
                level:
                  finalStatus === "success"
                    ? "info"
                    : finalStatus === "error"
                      ? "error"
                      : "warn",
                nodeId,
                message: `Workflow execution ${finalStatus === "success"
                  ? "completed successfully"
                  : finalStatus === "error"
                    ? "failed"
                    : "completed"
                  } from trigger node: ${node.name}`,
                data: {
                  nodeId,
                  executionId: executionResponse.executionId,
                  status: finalStatus,
                  duration,
                  error: finalError,
                },
              });

              // Create execution result with all node results
              const executionResult: WorkflowExecutionResult = {
                executionId: executionResponse.executionId,
                workflowId: workflow.id,
                status: resultStatus,
                startTime,
                endTime,
                duration,
                nodeResults: Array.from(get().realTimeResults.values()),
                error: finalError,
                triggerNodeId: nodeId, // Track which node triggered this execution
              };

              // Set final execution state with lastExecutionResult
              set({
                executionState: {
                  status: finalStatus,
                  progress: 100,
                  startTime,
                  endTime,
                  error: finalError,
                  executionId: executionResponse.executionId,
                },
                lastExecutionResult: executionResult,
              });



              // Keep subscription active for a while to show execution events
              setTimeout(async () => {
                try {
                  await get().unsubscribeFromExecution(
                    executionResponse.executionId
                  );
                } catch (error) {
                  // Silently handle unsubscribe errors
                }
              }, 30000); // 30 seconds delay

              // FIXED: Don't auto-clear execution state after successful executions
              // Status icons should persist until the next execution starts
              // This allows users to see execution results without timing constraints

              // Clear execution state after a delay for successful executions
              // DISABLED: This was causing status icons to disappear after 3 seconds
              // if (finalStatus === "success") {
              //   setTimeout(() => {
              //     get().clearExecutionState(); // Preserves logs by default
              //   }, 3000);
              // }
            } catch (error) {
              const endTime = Date.now();
              const errorMessage =
                error instanceof Error ? error.message : "Unknown error";

              get().addExecutionLog({
                timestamp: new Date().toISOString(),
                level: "error",
                nodeId,
                message: `Workflow execution failed: ${errorMessage}`,
                data: {
                  nodeId,
                  error: errorMessage,
                  mode: "workflow",
                },
              });

              // Set error execution state
              set({
                executionState: {
                  status: "error",
                  progress: 0,
                  startTime,
                  endTime,
                  error: errorMessage,
                  executionId: get().executionState.executionId,
                },
              });

              // Keep subscription active even on error for a while
              const currentExecutionId = get().executionState.executionId;
              if (currentExecutionId) {
                setTimeout(async () => {
                  try {
                    await get().unsubscribeFromExecution(currentExecutionId);
                  } catch (error) {
                    // Silently handle unsubscribe errors
                  }
                }, 30000);
              }
            }
          } else {

            // Get node type definition to filter parameters
            const { workflowService } = await import("@/services/workflow");
            const { NodeValidator } = await import("@/utils/nodeValidation");

            let filteredParameters = node.parameters;
            let nodeTypeDefinition: any;
            try {
              const nodeTypes = await workflowService.getNodeTypes();
              nodeTypeDefinition = nodeTypes.find(
                (nt) => nt.identifier === node.type
              );

              if (nodeTypeDefinition && nodeTypeDefinition.properties) {
                // Validate required parameters before execution
                const validation = NodeValidator.validateNode(
                  node,
                  nodeTypeDefinition.properties
                );

                if (!validation.isValid) {
                  const errorMessage = NodeValidator.formatValidationMessage(
                    validation.errors
                  );
                  const detailedErrors = validation.errors
                    .map((e) => `- ${e.message}`)
                    .join("\n");

                  throw new Error(
                    `Cannot execute node: ${errorMessage}\n\n${detailedErrors}`
                  );
                }

                // Filter parameters to only include visible fields
                filteredParameters = NodeValidator.filterVisibleParameters(
                  node.parameters,
                  nodeTypeDefinition.properties
                );
              }
            } catch (error) {
              // Re-throw validation errors
              if (
                error instanceof Error &&
                error.message.includes("Cannot execute node")
              ) {
                throw error;
              }
              // Continue with unfiltered parameters if filtering fails
            }

            // For single mode, use the single node execution endpoint
            const result: any = await executionService.executeSingleNode({
              workflowId: workflow.id,
              nodeId,
              inputData: nodeInputData || { main: [[]] },
              parameters: filteredParameters,
              mode,
              // Pass current workflow data to avoid need for saving
              workflowData: {
                nodes: workflow.nodes,
                connections: workflow.connections,
                settings: workflow.settings,
              },
            });

            // Initialize execution context for single node execution
            const { executionManager } = get();
            executionManager.startExecution(result.executionId, nodeId, [
              nodeId,
            ]);
            executionManager.setCurrentExecution(result.executionId);
            executionManager.setNodeRunning(result.executionId, nodeId);
            set({ executionManager });

            // Update node execution result
            const endTime = Date.now();
            const startTime = endTime - (result.duration || 0);
            const isSuccess =
              result.status === "completed" && !result.hasFailures;

            // Get output data from the execution result (no database query needed for single node execution)
            let nodeOutputData: any = undefined;
            let nodeError: any = undefined;

            // Single node executions now return output data directly in the response
            if (result.nodeExecutions && result.nodeExecutions.length > 0) {
              const nodeExecution = result.nodeExecutions.find(
                (nodeExec: any) => nodeExec.nodeId === nodeId
              );

              if (nodeExecution) {
                // Use 'data' property to match the structure from external webhook triggers
                nodeOutputData = nodeExecution.data || nodeExecution.outputData; // Fallback for backward compatibility
                nodeError = serializeError(nodeExecution.error);
              }
            }

            get().updateNodeExecutionResult(nodeId, {
              nodeId,
              nodeName: node.name,
              status: isSuccess ? "success" : "error",
              startTime,
              endTime,
              duration: result.duration,
              data: nodeOutputData, // Now we have the actual output data
              error:
                nodeError ||
                (result.hasFailures ? "Node execution failed" : undefined),
            });

            // If node had pinned mock data and execution was successful, unpin the mock data
            if (node.mockData && node.mockDataPinned && isSuccess) {
              get().updateNode(nodeId, { mockDataPinned: false });

              get().addExecutionLog({
                timestamp: new Date().toISOString(),
                level: "info",
                nodeId,
                message: `Mock data unpinned for node: ${node.name} (execution successful)`,
              });
            }

            // Update node visual states for single node execution
            const visualStatus = isSuccess
              ? NodeExecutionStatus.COMPLETED
              : NodeExecutionStatus.FAILED;

            if (isSuccess) {
              executionManager.setNodeCompleted(result.executionId, nodeId);
              executionManager.completeExecution(result.executionId);
            } else {
              executionManager.setNodeFailed(result.executionId, nodeId);
              executionManager.completeExecution(result.executionId);
            }

            set({ executionManager });

            get().updateNodeExecutionState(nodeId, visualStatus, {
              progress: isSuccess ? 100 : undefined,
              error:
                nodeError ||
                (result.hasFailures ? "Node execution failed" : undefined),
              outputData: nodeOutputData, // Now we have the actual output data
              startTime,
              endTime,
            });

            get().addExecutionLog({
              timestamp: new Date().toISOString(),
              level: isSuccess ? "info" : "error",
              nodeId,
              message: `Node execution ${isSuccess ? "completed successfully" : "failed"
                }: ${node.name}`,
              data: {
                nodeId,
                status: result.status,
                duration: result.duration,
                hasFailures: result.hasFailures,
                executedNodes: result.executedNodes,
                failedNodes: result.failedNodes,
              },
            });

          }
        } catch (error) {
          const endTime = Date.now();
          const duration = endTime - startTime;
          const errorMessage =
            error instanceof Error ? error.message : "Unknown execution error";

          // Update node execution result with error
          get().updateNodeExecutionResult(nodeId, {
            nodeId,
            nodeName: node.name,
            status: "error",
            startTime,
            endTime,
            duration,
            data: undefined,
            error: errorMessage,
          });

          // CRITICAL: Update node visual states for failed single node execution
          // This ensures that failed icons persist after single node execution error
          get().updateNodeExecutionState(nodeId, NodeExecutionStatus.FAILED, {
            error: errorMessage,
            startTime,
            endTime,
          });

          get().addExecutionLog({
            timestamp: new Date().toISOString(),
            level: "error",
            nodeId,
            message: `Node execution failed: ${node.name} - ${errorMessage}`,
            data: { nodeId, error: errorMessage, duration },
          });
        }
      },

      stopExecution: async () => {
        const { executionState } = get();

        if (
          executionState.status !== "running" ||
          !executionState.executionId
        ) {
          get().addExecutionLog({
            timestamp: new Date().toISOString(),
            level: "warn",
            message: "No active execution to stop",
          });
          return;
        }

        get().addExecutionLog({
          timestamp: new Date().toISOString(),
          level: "info",
          message: `Attempting to cancel execution: ${executionState.executionId}`,
        });

        try {
          // Import execution service
          const { executionService } = await import("@/services/execution");

          // Cancel execution via API
          await executionService.cancelExecution(executionState.executionId);

          const endTime = Date.now();
          const startTime = executionState.startTime || endTime;

          get().addExecutionLog({
            timestamp: new Date().toISOString(),
            level: "info",
            message: "Execution cancellation request sent successfully",
          });

          // Get execution details to capture any partial results
          let nodeResults: NodeExecutionResult[] = [];
          try {
            const executionDetails = await executionService.getExecutionDetails(
              executionState.executionId
            );
            nodeResults = executionDetails.nodeExecutions.map((nodeExec) => {
              // Map backend node status to frontend node status
              let nodeStatus: NodeExecutionResult["status"] = "skipped";

              // Handle various success status values from backend
              const successStatuses = [
                "success",
                "completed",
                "SUCCESS",
                "COMPLETED",
              ];
              const errorStatuses = ["error", "failed", "ERROR", "FAILED"];

              if (successStatuses.includes(nodeExec.status)) {
                nodeStatus = "success";
              } else if (errorStatuses.includes(nodeExec.status)) {
                nodeStatus = "error";
              }

              const nodeResult: NodeExecutionResult = {
                nodeId: nodeExec.nodeId,
                nodeName:
                  get().workflow?.nodes.find((n) => n.id === nodeExec.nodeId)
                    ?.name || "Unknown",
                status: nodeStatus,
                startTime: nodeExec.startedAt
                  ? new Date(nodeExec.startedAt).getTime()
                  : startTime,
                endTime: nodeExec.finishedAt
                  ? new Date(nodeExec.finishedAt).getTime()
                  : endTime,
                duration:
                  nodeExec.finishedAt && nodeExec.startedAt
                    ? new Date(nodeExec.finishedAt).getTime() -
                    new Date(nodeExec.startedAt).getTime()
                    : 0,
                data: nodeExec.outputData,
                error: serializeError(nodeExec.error),
              };

              // Update real-time results
              get().updateNodeExecutionResult(nodeExec.nodeId, nodeResult);

              // CRITICAL: Update node visual states for cancelled execution results
              // This ensures that success/failed icons persist even after cancellation
              const visualStatus =
                nodeStatus === "success"
                  ? NodeExecutionStatus.COMPLETED
                  : nodeStatus === "error"
                    ? NodeExecutionStatus.FAILED
                    : NodeExecutionStatus.CANCELLED;

              get().updateNodeExecutionState(nodeExec.nodeId, visualStatus, {
                progress: nodeStatus === "success" ? 100 : undefined,
                error: serializeError(nodeExec.error),
                outputData: nodeExec.outputData,
                startTime: nodeExec.startedAt
                  ? new Date(nodeExec.startedAt).getTime()
                  : startTime,
                endTime: nodeExec.finishedAt
                  ? new Date(nodeExec.finishedAt).getTime()
                  : endTime,
              });

              return nodeResult;
            });
          } catch (detailsError) {
            get().addExecutionLog({
              timestamp: new Date().toISOString(),
              level: "warn",
              message:
                "Could not fetch final execution details after cancellation",
            });
            // Use real-time results as fallback
            nodeResults = Array.from(get().realTimeResults.values());
          }

          // Create cancelled execution result
          const executionResult: WorkflowExecutionResult = {
            executionId: executionState.executionId,
            workflowId: get().workflow?.id || "",
            status: "cancelled",
            startTime,
            endTime,
            duration: endTime - startTime,
            nodeResults,
            error: "Execution cancelled by user",
          };

          get().addExecutionLog({
            timestamp: new Date().toISOString(),
            level: "info",
            message: `Execution cancelled successfully. Duration: ${endTime - startTime
              }ms`,
            data: {
              executionId: executionState.executionId,
              duration: endTime - startTime,
              completedNodes: nodeResults.filter((n) => n.status === "success")
                .length,
              totalNodes: nodeResults.length,
            },
          });

          set({
            executionState: {
              status: "cancelled",
              progress: executionState.progress || 0,
              startTime,
              endTime,
              error: "Execution cancelled by user",
              executionId: executionState.executionId,
            },
            lastExecutionResult: executionResult,
          });

          // Save cancellation to history
          get().saveToHistory("Cancel workflow execution");

          // Keep subscription active for a while after cancellation to show final status
          // Unsubscribe after 10 seconds for cancelled executions
          setTimeout(async () => {
            try {
              if (executionState.executionId) {
                await get().unsubscribeFromExecution(
                  executionState.executionId
                );
              }
            } catch (error) {
              // Silently handle unsubscribe errors
            }
          }, 10000); // 10 seconds delay for cancellation
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Failed to stop execution";

          get().addExecutionLog({
            timestamp: new Date().toISOString(),
            level: "error",
            message: `Failed to cancel execution: ${errorMessage}`,
            data: { error: errorMessage },
          });

          get().setExecutionError(errorMessage);
        }
      },

      // Enhanced execution control methods
      cancelExecution: async (executionId?: string) => {
        const { executionState } = get();
        const targetExecutionId = executionId || executionState.executionId;

        if (!targetExecutionId) {
          get().addExecutionLog({
            timestamp: new Date().toISOString(),
            level: "warn",
            message: "No execution ID provided for cancellation",
          });
          return;
        }

        get().addExecutionLog({
          timestamp: new Date().toISOString(),
          level: "info",
          message: `Cancelling execution: ${targetExecutionId}`,
        });

        try {
          // Import execution service
          const { executionService } = await import("@/services/execution");

          // Cancel execution via API
          await executionService.cancelExecution(targetExecutionId);

          // Update flow execution state
          const currentFlowState = get().flowExecutionState;
          const flowStatus =
            currentFlowState.activeExecutions.get(targetExecutionId);
          if (flowStatus) {
            flowStatus.overallStatus = "cancelled";
            currentFlowState.activeExecutions.set(
              targetExecutionId,
              flowStatus
            );
            set({ flowExecutionState: { ...currentFlowState } });
          }

          // Update execution state if this is the current execution
          if (targetExecutionId === executionState.executionId) {
            get().setExecutionState({
              status: "cancelled",
              error: "Execution cancelled by user",
            });
          }

          get().addExecutionLog({
            timestamp: new Date().toISOString(),
            level: "info",
            message: `Execution ${targetExecutionId} cancelled successfully`,
          });
        } catch (error) {
          const errorMessage =
            error instanceof Error
              ? error.message
              : "Failed to cancel execution";

          get().addExecutionLog({
            timestamp: new Date().toISOString(),
            level: "error",
            message: `Failed to cancel execution ${targetExecutionId}: ${errorMessage}`,
            data: { error: errorMessage, executionId: targetExecutionId },
          });

          get().setExecutionError(errorMessage);
        }
      },

      pauseExecution: async (executionId?: string) => {
        const { executionState } = get();
        const targetExecutionId = executionId || executionState.executionId;

        if (!targetExecutionId) {
          get().addExecutionLog({
            timestamp: new Date().toISOString(),
            level: "warn",
            message: "No execution ID provided for pausing",
          });
          return;
        }

        get().addExecutionLog({
          timestamp: new Date().toISOString(),
          level: "info",
          message: `Pausing execution: ${targetExecutionId}`,
        });

        try {
          // Import execution service
          const { executionService } = await import("@/services/execution");

          // Call backend pause API
          await executionService.pauseExecution(targetExecutionId);

          // Update execution state
          if (executionState.executionId === targetExecutionId) {
            set({
              executionState: {
                ...executionState,
                status: "paused",
              },
            });
          }

          // Update flow execution state
          const currentFlowState = get().flowExecutionState;
          const flowStatus =
            currentFlowState.activeExecutions.get(targetExecutionId);
          if (flowStatus) {
            // Mark as paused in local state
            flowStatus.currentlyExecuting = []; // Clear currently executing nodes
            currentFlowState.activeExecutions.set(
              targetExecutionId,
              flowStatus
            );
            set({ flowExecutionState: { ...currentFlowState } });
          }

          get().addExecutionLog({
            timestamp: new Date().toISOString(),
            level: "info",
            message: `Execution ${targetExecutionId} paused successfully`,
          });
        } catch (error) {
          const errorMessage =
            error instanceof Error
              ? error.message
              : "Failed to pause execution";

          get().addExecutionLog({
            timestamp: new Date().toISOString(),
            level: "error",
            message: `Failed to pause execution ${targetExecutionId}: ${errorMessage}`,
            data: { error: errorMessage, executionId: targetExecutionId },
          });

          get().setExecutionError(errorMessage);
        }
      },

      resumeExecution: async (executionId?: string) => {
        const { executionState } = get();
        const targetExecutionId = executionId || executionState.executionId;

        if (!targetExecutionId) {
          get().addExecutionLog({
            timestamp: new Date().toISOString(),
            level: "warn",
            message: "No execution ID provided for resuming",
          });
          return;
        }

        get().addExecutionLog({
          timestamp: new Date().toISOString(),
          level: "info",
          message: `Resuming execution: ${targetExecutionId}`,
        });

        try {
          // Import execution service
          const { executionService } = await import("@/services/execution");

          // Call backend resume API
          await executionService.resumeExecution(targetExecutionId);

          // Update execution state
          if (executionState.executionId === targetExecutionId) {
            set({
              executionState: {
                ...executionState,
                status: "running",
              },
            });
          }

          // Update flow execution state
          const currentFlowState = get().flowExecutionState;
          const flowStatus =
            currentFlowState.activeExecutions.get(targetExecutionId);
          if (flowStatus) {
            // Mark as running again in local state
            flowStatus.overallStatus = "running";
            currentFlowState.activeExecutions.set(
              targetExecutionId,
              flowStatus
            );
            set({ flowExecutionState: { ...currentFlowState } });
          }

          get().addExecutionLog({
            timestamp: new Date().toISOString(),
            level: "info",
            message: `Execution ${targetExecutionId} resumed successfully`,
          });
        } catch (error) {
          const errorMessage =
            error instanceof Error
              ? error.message
              : "Failed to resume execution";

          get().addExecutionLog({
            timestamp: new Date().toISOString(),
            level: "error",
            message: `Failed to resume execution ${targetExecutionId}: ${errorMessage}`,
            data: { error: errorMessage, executionId: targetExecutionId },
          });

          get().setExecutionError(errorMessage);
        }
      },

      setExecutionState: (state: Partial<ExecutionState>) => {
        const currentState = get().executionState;
        set({
          executionState: { ...currentState, ...state },
        });
      },

      clearExecutionState: (preserveLogs = true) => {
        const currentLogs = preserveLogs ? get().executionLogs : [];

        // Before clearing realTimeResults, save them to persistentNodeResults
        // This preserves execution results for the node config dialog
        const currentRealTimeResults = get().realTimeResults;
        const currentPersistentResults = get().persistentNodeResults;

        // Merge current real-time results with existing persistent results
        // Real-time results take precedence (newer execution data)
        const updatedPersistentResults = new Map(currentPersistentResults);
        currentRealTimeResults.forEach((result, nodeId) => {
          updatedPersistentResults.set(nodeId, result);
        });

        set({
          readOnly: false, // Clear read-only mode
          executionState: {
            status: "idle",
            progress: 0,
            startTime: undefined,
            endTime: undefined,
            error: undefined,
            executionId: undefined,
          },
          realTimeResults: new Map(),
          persistentNodeResults: updatedPersistentResults,
          executionLogs: currentLogs, // Preserve logs by default
          // Note: Node visual states are not cleared here by design
          // They are only cleared when starting a new execution in executeWorkflow()
          // This ensures success/failed icons remain visible after unsubscribing
        });
      },

      clearPersistentResults: () => {
        set({ persistentNodeResults: new Map() });
      },

      clearNodeVisualStates: () => {
        // IMPROVED: Only clear node visual states when explicitly requested
        // This should only be called when starting a NEW execution ID
        // to ensure previous execution results don't interfere with new ones
        const currentExecutionId = get().executionState.executionId;
        const currentFlowState = get().flowExecutionState;

        // Only clear if we have visual states and they're from a different execution
        const hasVisualStates = currentFlowState.nodeVisualStates.size > 0;
        const selectedExecution = currentFlowState.selectedExecution;
        const isDifferentExecution =
          selectedExecution && selectedExecution !== currentExecutionId;

        if (hasVisualStates && (isDifferentExecution || !selectedExecution)) {
          set({
            flowExecutionState: {
              ...currentFlowState,
              nodeVisualStates: new Map(),
            },
          });

          get().addExecutionLog({
            timestamp: new Date().toISOString(),
            level: "info",
            message: `Cleared node visual states for new execution (previous: ${selectedExecution}, current: ${currentExecutionId})`,
          });
        } else {
          get().addExecutionLog({
            timestamp: new Date().toISOString(),
            level: "debug",
            message: `Skipped clearing node visual states - continuing same execution or no states to clear`,
          });
        }
      },

      setExecutionProgress: (progress: number) => {
        const clampedProgress = Math.max(0, Math.min(100, progress));
        get().setExecutionState({ progress: clampedProgress });
      },

      setExecutionError: (error: string) => {
        const endTime = Date.now();
        const startTime = get().executionState.startTime || endTime;
        const executionId = get().executionState.executionId;

        // Add error to execution logs
        get().addExecutionLog({
          timestamp: new Date().toISOString(),
          level: "error",
          message: error,
        });

        set({
          executionState: {
            status: "error",
            progress: 0,
            startTime,
            endTime,
            error,
            executionId: executionId,
          },
        });

        // CRITICAL: Complete the execution in ExecutionContextManager
        // This stops edge animations when execution fails
        if (executionId && get().executionManager) {
          get().executionManager.completeExecution(executionId);
        }
      },

      updateNodeExecutionResult: (
        nodeId: string,
        result: Partial<NodeExecutionResult>
      ) => {
        const currentResults = get().realTimeResults;
        const existingResult = currentResults.get(nodeId);

        const updatedResult: NodeExecutionResult = {
          nodeId,
          nodeName: result.nodeName || existingResult?.nodeName || "Unknown",
          status: result.status || existingResult?.status || "skipped", // Use "skipped" instead of "error" as default
          startTime:
            result.startTime || existingResult?.startTime || Date.now(),
          endTime: result.endTime || existingResult?.endTime || Date.now(),
          duration: result.duration || existingResult?.duration || 0,
          data: result.data !== undefined ? result.data : existingResult?.data,
          error:
            result.error !== undefined ? result.error : existingResult?.error,
        };

        const newResults = new Map(currentResults);
        newResults.set(nodeId, updatedResult);

        set({ realTimeResults: newResults });
      },

      addExecutionLog: (log: ExecutionLogEntry) => {
        const currentLogs = get().executionLogs;
        const newLogs = [...currentLogs, log];

        // Limit log size to prevent memory issues (keep last 1000 entries)
        if (newLogs.length > 1000) {
          newLogs.splice(0, newLogs.length - 1000);
        }

        set({ executionLogs: newLogs });
      },

      clearExecutionLogs: () => {
        // CRITICAL: This should ONLY be called when starting a new execution
        // Logs are preserved when unsubscribing from executions and after execution completion
        // This ensures the last execution's logs remain visible until a new execution starts
        set({ executionLogs: [] });
      },

      getNodeExecutionResult: (nodeId: string) => {
        // First check if the node has pinned mock data that should be used as output
        // This takes priority over any execution results when explicitly pinned
        const { workflow } = get();
        if (workflow) {
          const node = workflow.nodes.find((n) => n.id === nodeId);
          if (node && node.mockData && node.mockDataPinned) {
            // Return mock data as execution result with a neutral status
            return {
              nodeId,
              nodeName: node.name,
              status: "skipped" as const, // Use "skipped" to indicate this is mock data, not actual execution
              startTime: Date.now(),
              endTime: Date.now(),
              duration: 0,
              data: node.mockData,
              error: undefined,
            };
          }
        }

        // Then try to get from real-time results (active execution)
        const realTimeResult = get().realTimeResults.get(nodeId);
        if (realTimeResult) {
          return realTimeResult;
        }

        // Fall back to persistent results (previous executions)
        const persistentResult = get().persistentNodeResults.get(nodeId);
        if (persistentResult) {
          return persistentResult;
        }

        return undefined;
      },

      // Real-time execution updates
      subscribeToExecution: async (executionId: string) => {
        try {
          console.log('🔵 subscribeToExecution called for:', executionId);

          // Connect to WebSocket if not already connected
          if (!executionWebSocket.isConnected()) {
            console.log('🔵 Connecting to WebSocket...');
            await executionWebSocket.connect();
          }

          // CRITICAL: Initialize executionManager FIRST before any events arrive
          const { workflow, executionManager } = get();
          if (workflow) {
            const nodeIds = workflow.nodes.map((node) => node.id);
            // Find trigger node (first node with no incoming connections)
            const triggerNode = workflow.nodes.find(node => 
              !workflow.connections.some(conn => conn.targetNodeId === node.id)
            );
            const triggerNodeId = triggerNode?.id || nodeIds[0]; // Fallback to first node
            
            console.log(`🔵 Initializing executionManager for ${executionId} with ${nodeIds.length} nodes, trigger: ${triggerNodeId}`);
            executionManager.startExecution(executionId, triggerNodeId, nodeIds);
          }

          // CRITICAL: Add to activeExecutions BEFORE subscribing
          // This ensures isActiveExecution check passes when events arrive
          const currentFlowState = get().flowExecutionState;
          if (!currentFlowState.activeExecutions.has(executionId)) {
            console.log('🔵 Adding execution to activeExecutions:', executionId);
            currentFlowState.activeExecutions.set(executionId, {
              executionId,
              overallStatus: "running",
              progress: 0,
              nodeStates: new Map(),
              currentlyExecuting: [],
              completedNodes: [],
              failedNodes: [],
              queuedNodes: [],
              executionPath: [],
              activeEdges: new Set(), // NEW: Track active edges
              completedEdges: new Set(), // NEW: Track completed edges
            });
          }

          // CRITICAL: Add event listener BEFORE subscribing
          // This ensures we catch events that arrive immediately after subscription
          console.log('🔵 Adding event listener for:', executionId);
          executionWebSocket.addEventListener(
            executionId,
            (data: ExecutionEventData) => {
              console.log('🔵 Event listener triggered for:', data.type, data.executionId);
              get().handleExecutionEvent(data);
            }
          );

          // Subscribe to execution updates (this triggers backend to send events)
          console.log('🔵 Subscribing to execution:', executionId);
          await executionWebSocket.subscribeToExecution(executionId);

          // Safety timeout: If no updates received for 5 minutes, mark as failed
          // This prevents executions from being stuck in "running" state forever
          const timeoutId = setTimeout(() => {
            const execution = get().flowExecutionState.activeExecutions.get(executionId);
            if (execution && execution.overallStatus === "running") {
              console.warn(`⏱️ Execution ${executionId} timed out - no updates received for 5 minutes`);
              get().addExecutionLog({
                timestamp: new Date().toISOString(),
                level: "error",
                message: `Execution timed out - no updates received for 5 minutes. This may indicate a connection issue.`,
              });

              // Mark execution as failed
              get().handleExecutionEvent({
                executionId,
                type: "failed",
                error: { message: "Execution timed out - no updates received. Please check your connection and try again." },
                timestamp: Date.now(),
              } as ExecutionEventData);
            }

            // Clean up timeout
            get().executionTimeouts.delete(executionId);
          }, 300000); // 5 minutes

          // Store timeout for cleanup
          get().executionTimeouts.set(executionId, timeoutId);

          get().addExecutionLog({
            timestamp: new Date().toISOString(),
            level: "info",
            message: `Subscribed to real-time updates for execution: ${executionId}`,
          });
        } catch (error) {
          get().addExecutionLog({
            timestamp: new Date().toISOString(),
            level: "warn",
            message: "Failed to subscribe to real-time execution updates",
          });
        }
      },

      unsubscribeFromExecution: async (executionId: string) => {
        try {
          // Clear execution timeout if exists
          const timeoutId = get().executionTimeouts.get(executionId);
          if (timeoutId) {
            clearTimeout(timeoutId);
            get().executionTimeouts.delete(executionId);
          }

          await executionWebSocket.unsubscribeFromExecution(executionId);
          executionWebSocket.removeExecutionListeners(executionId);

          // Preserve current execution logs before any operations
          const currentLogs = get().executionLogs.slice(); // Create a copy

          // Preserve execution data before removing from active executions
          const currentFlowState = get().flowExecutionState;
          const executionData =
            currentFlowState.activeExecutions.get(executionId);

          // CRITICAL: Preserve node visual states by copying them before clearing the execution
          // This ensures success/failed icons remain visible until the next execution
          const preservedNodeStates = new Map(
            currentFlowState.nodeVisualStates
          );

          if (executionData) {
            // Move execution to history to preserve logs and state
            const historyEntry = {
              executionId,
              workflowId: get().workflow?.id || "",
              triggerType: "manual",
              startTime: Date.now(),
              endTime:
                executionData.overallStatus === "running"
                  ? undefined
                  : Date.now(),
              status: executionData.overallStatus,
              executedNodes: Array.from(executionData.nodeStates.keys()),
              executionPath: executionData.executionPath,
              metrics: {
                totalNodes: executionData.nodeStates.size,
                completedNodes: Array.from(
                  executionData.nodeStates.values()
                ).filter((n) => n.status === NodeExecutionStatus.COMPLETED)
                  .length,
                failedNodes: Array.from(
                  executionData.nodeStates.values()
                ).filter((n) => n.status === NodeExecutionStatus.FAILED).length,
                averageNodeDuration: 0,
                longestRunningNode: "",
                bottleneckNodes: [],
                parallelismUtilization: 0,
              },
            };
            currentFlowState.executionHistory.unshift(historyEntry);
          }

          // Remove from active executions but keep in history
          currentFlowState.activeExecutions.delete(executionId);

          // Only clear selected execution if it matches the unsubscribed one
          if (currentFlowState.selectedExecution === executionId) {
            currentFlowState.selectedExecution = undefined;
          }

          set({
            flowExecutionState: {
              ...currentFlowState,
              // CRITICAL: Keep the preserved node visual states to maintain success/failed icons
              nodeVisualStates: preservedNodeStates,
            },
            // Ensure logs are preserved after unsubscribing
            executionLogs: currentLogs,
          });

          get().addExecutionLog({
            timestamp: new Date().toISOString(),
            level: "info",
            message: `Unsubscribed from real-time updates for execution: ${executionId}. Logs and node states preserved until next execution.`,
          });
        } catch (error) {
          // Silently handle unsubscribe errors
        }
      },

      handleExecutionEvent: (data: ExecutionEventData) => {
        const { executionState, flowExecutionState } = get();
        const activeExecutions = flowExecutionState.activeExecutions;

        // Only process events for known executions
        const isActiveExecution = activeExecutions.has(data.executionId);
        const isRecentExecution = flowExecutionState.executionHistory.some(
          (entry) => entry.executionId === data.executionId
        );
        const isCurrentExecution = data.executionId === executionState.executionId;

        if (!isActiveExecution && !isRecentExecution && !isCurrentExecution) {
          return;
        }

        const timestamp = new Date(data.timestamp).getTime();
        const nodeName = data.data?.node?.name || data.nodeId;

        switch (data.type) {
          case "node-started":
            if (data.nodeId && data.executionId) {
              console.log('🔵 [Frontend] node-started event received:', {
                nodeId: data.nodeId,
                nodeName,
                nodeType: data.data?.nodeType,
                executionId: data.executionId,
                timestamp: data.timestamp,
              });
              
              get().progressTracker.setCurrentExecution(data.executionId);
              get().updateNodeExecutionState(data.nodeId, NodeExecutionStatus.RUNNING, {
                startTime: Date.now(),
                progress: 0,
              });
              
              console.log('✅ [Frontend] Updated node state to RUNNING for:', data.nodeId);
              
              get().addExecutionLog({
                timestamp: new Date().toISOString(),
                level: "info",
                nodeId: data.nodeId,
                message: `Starting execution of node: ${nodeName}`,
                data: data.data,
              });
            }
            break;

          case "node-completed":
            if (data.nodeId && data.executionId) {
              // Extract the actual output data from the node execution result
              // data.data contains the full node execution result: { nodeId, status, data, duration }
              // We need to extract just the 'data' property which contains the actual output
              const nodeExecutionResult = data.data;
              const actualOutputData = nodeExecutionResult?.data || nodeExecutionResult?.outputData || nodeExecutionResult;
              
              // Update node execution result for Results tab
              get().updateNodeExecutionResult(data.nodeId, {
                nodeId: data.nodeId,
                nodeName,
                status: "success",
                endTime: timestamp,
                data: actualOutputData,
                duration: nodeExecutionResult?.duration,
              });

              // Update node execution state for visual indicators
              get().updateNodeExecutionState(data.nodeId, NodeExecutionStatus.COMPLETED, {
                endTime: timestamp,
                progress: 100,
                outputData: actualOutputData,
              });

              // NEW: Update edge animation state
              const flowStatus = activeExecutions.get(data.executionId);
              const activeConnectionsData = data.data?.activeConnections || (data as any).activeConnections;

              if (flowStatus && activeConnectionsData) {
                const activeEdges = flowStatus.activeEdges || new Set();
                const completedEdges = flowStatus.completedEdges || new Set();

                // Move all currently active edges to completed before adding new ones
                activeEdges.forEach((edgeId) => {
                  completedEdges.add(edgeId);
                });
                activeEdges.clear();

                // Add new active edges (these will stay active until the next node completes)
                activeConnectionsData.forEach((conn: any) => {
                  activeEdges.add(conn.id);
                });

                // Create new Sets to ensure React detects the change
                flowStatus.activeEdges = new Set(activeEdges);
                flowStatus.completedEdges = new Set(completedEdges);

                // Update the map immediately to show new active edges
                activeExecutions.set(data.executionId, flowStatus);
                set({
                  flowExecutionState: {
                    ...get().flowExecutionState,
                    activeExecutions: new Map(activeExecutions),
                  },
                });
              }

              get().addExecutionLog({
                timestamp: new Date().toISOString(),
                level: "info",
                nodeId: data.nodeId,
                message: `Node execution completed: ${nodeName}`,
                data: data.data,
              });
            }
            break;

          case "node-failed":
            if (data.nodeId && data.executionId) {
              console.log('🔴 [Frontend] node-failed event received:', {
                nodeId: data.nodeId,
                nodeName,
                error: data.error,
                executionId: data.executionId,
                timestamp: data.timestamp,
              });
              
              get().updateNodeExecutionState(data.nodeId, NodeExecutionStatus.FAILED, {
                endTime: timestamp,
                error: data.error,
                errorMessage: data.error?.message || "Node execution failed",
              });
              
              console.log('✅ [Frontend] Updated node state to FAILED for:', data.nodeId);
              
              get().addExecutionLog({
                timestamp: new Date().toISOString(),
                level: "error",
                nodeId: data.nodeId,
                message: `Node execution failed: ${nodeName} - ${data.error?.message || "Unknown error"}`,
                data: data.data,
              });
            }
            break;

          case "node-status-update":
            if (data.nodeId && data.status) {
              get().progressTracker.setCurrentExecution(data.executionId);
              get().updateNodeExecutionState(data.nodeId, data.status, {
                progress: data.progress,
                error: data.error,
                inputData: data.data?.inputData,
                outputData: data.data?.outputData,
                startTime: data.data?.startTime,
                endTime: data.data?.endTime,
              });
              get().addExecutionLog({
                timestamp: new Date().toISOString(),
                level: data.status === NodeExecutionStatus.FAILED ? "error" : "info",
                nodeId: data.nodeId,
                message: `Node status changed to: ${data.status}`,
                data: data.data,
              });
            }
            break;

          case "execution-progress":
            if (data.progress !== undefined) {
              get().setExecutionProgress(data.progress);
              if (data.progress && typeof data.progress === "object") {
                const progress = data.progress as any;
                if (progress.currentNode) {
                  get().progressTracker.setCurrentExecution(data.executionId);

                  // Get the current execution context to find previously running nodes
                  const executionContext = get().executionManager.getExecution(data.executionId);

                  // Mark any previously running nodes as completed (except the current one)
                  if (executionContext) {
                    executionContext.runningNodes.forEach((runningNodeId) => {
                      if (runningNodeId !== progress.currentNode) {
                        get().updateNodeExecutionState(runningNodeId, NodeExecutionStatus.COMPLETED, {
                          endTime: Date.now(),
                        });
                      }
                    });
                  }

                  const progressPercentage = Math.round((progress.completedNodes / progress.totalNodes) * 100);
                  const elapsedTime = progress.startedAt ? Date.now() - new Date(progress.startedAt).getTime() : 0;
                  get().updateNodeExecutionState(progress.currentNode, NodeExecutionStatus.RUNNING, {
                    progress: progressPercentage,
                    startTime: elapsedTime,
                    duration: elapsedTime,
                  });
                }
              }
            }
            break;

          case "completed":
          case "execution-complete":
            // Clear execution timeout since execution completed
            const completedTimeoutId = get().executionTimeouts.get(data.executionId);
            if (completedTimeoutId) {
              clearTimeout(completedTimeoutId);
              get().executionTimeouts.delete(data.executionId);
            }

            const finalStatus = data.error ? "error" : "success";
            get().setExecutionState({
              status: finalStatus,
              progress: 100,
              endTime: Date.now(),
              error: data.error?.message,
            });

            // NEW: Move all active edges to completed when execution finishes
            if (data.executionId) {
              const flowStatus = activeExecutions.get(data.executionId);
              if (flowStatus) {
                const activeEdges = flowStatus.activeEdges || new Set();
                const completedEdges = flowStatus.completedEdges || new Set();

                // Move all active edges to completed
                activeEdges.forEach((edgeId) => {
                  completedEdges.add(edgeId);
                });
                activeEdges.clear();

                // Create new Sets to ensure React detects the change
                flowStatus.activeEdges = new Set(activeEdges);
                flowStatus.completedEdges = new Set(completedEdges);

                activeExecutions.set(data.executionId, flowStatus);
                set({
                  flowExecutionState: {
                    ...get().flowExecutionState,
                    activeExecutions: new Map(activeExecutions),
                  },
                });
              }
            }

            if (data.executionId && get().executionManager) {
              get().executionManager.completeExecution(data.executionId);
              set({
                executionManager: get().executionManager,
                executionStateVersion: get().executionStateVersion + 1,
              });
            }

            const currentFlowState = get().flowExecutionState;
            const flowStatus = currentFlowState.activeExecutions.get(data.executionId);
            if (flowStatus) {
              currentFlowState.executionHistory.unshift({
                executionId: data.executionId,
                workflowId: executionState.executionId || "",
                triggerType: "manual",
                startTime: executionState.startTime || Date.now(),
                endTime: Date.now(),
                status: finalStatus,
                executedNodes: flowStatus.completedNodes,
                executionPath: flowStatus.executionPath,
                metrics: get().progressTracker.getExecutionMetrics(data.executionId),
              });

              if (currentFlowState.executionHistory.length > 50) {
                currentFlowState.executionHistory = currentFlowState.executionHistory.slice(0, 50);
              }
              set({ flowExecutionState: { ...currentFlowState } });
            }
            break;

          case "execution-error":
          case "failed":
            // Clear execution timeout since execution failed
            const failedTimeoutId = get().executionTimeouts.get(data.executionId);
            if (failedTimeoutId) {
              clearTimeout(failedTimeoutId);
              get().executionTimeouts.delete(data.executionId);
            }

            // Mark execution as failed but DON'T change node states
            // Nodes keep their individual states (completed/failed)
            get().setExecutionState({
              status: "error",
              progress: 100,
              endTime: Date.now(),
              error: data.error?.message || "Execution failed",
            });

            if (data.executionId && get().executionManager) {
              // Mark execution as failed but preserve node states
              const context = get().executionManager.getExecution(data.executionId);
              if (context) {
                context.status = "failed";
                context.endTime = Date.now();
                // DON'T clear completed nodes - they stay green!
              }
              set({
                executionManager: get().executionManager,
                executionStateVersion: get().executionStateVersion + 1,
              });
            }

            get().setExecutionError(data.error?.message || "Execution failed");
            break;
        }
      },

      setupSocketListeners: () => {
        console.log('[WorkflowStore] setupSocketListeners called');
        
        const setupListeners = async () => {
          try {
            console.log('[WorkflowStore] Importing socketService...');
            const { socketService } = await import("@/services/socket");
            console.log('[WorkflowStore] socketService imported, registering listeners...');

            // Handle execution progress updates
            socketService.on("execution-progress", (progress: any) => {
              const { executionState } = get();

              // Only process progress for the current execution
              if (progress.executionId !== executionState.executionId) {
                return;
              }

              const progressPercentage =
                progress.totalNodes > 0
                  ? Math.round(
                    (progress.completedNodes / progress.totalNodes) * 100
                  )
                  : 0;

              // Map backend status to frontend status
              let frontendStatus: ExecutionState["status"] = "running";
              if (progress.status === "success") frontendStatus = "success";
              else if (progress.status === "error") frontendStatus = "error";
              else if (progress.status === "cancelled")
                frontendStatus = "cancelled";

              get().setExecutionState({
                progress: progressPercentage,
                status: frontendStatus,
              });

              get().addExecutionLog({
                timestamp: new Date().toISOString(),
                level: "info",
                message: `Real-time progress update: ${progress.completedNodes}/${progress.totalNodes} nodes completed`,
                data: {
                  completedNodes: progress.completedNodes,
                  totalNodes: progress.totalNodes,
                  failedNodes: progress.failedNodes,
                  currentNode: progress.currentNode,
                },
              });
            });

            // Handle execution logs
            socketService.on("execution-log", (logEntry: any) => {
              const { executionState } = get();

              // Only process logs for the current execution
              if (logEntry.executionId !== executionState.executionId) {
                return;
              }

              get().addExecutionLog({
                timestamp: new Date(logEntry.timestamp).toISOString(),
                level: logEntry.level,
                nodeId: logEntry.nodeId,
                message: logEntry.message,
                data: logEntry.data,
              });
            });

            // Handle execution events (for service nodes and regular nodes)
            console.log('[WorkflowStore] Registering execution-event listener');
            socketService.on("execution-event", (event: any) => {
              console.log('[WorkflowStore] Received execution-event:', event);
              
              const { executionState } = get();

              // Only process events for the current execution
              if (event.executionId !== executionState.executionId) {
                console.log('[WorkflowStore] Ignoring event - wrong execution ID:', {
                  eventExecutionId: event.executionId,
                  currentExecutionId: executionState.executionId,
                });
                return;
              }

              const nodeName =
                get().workflow?.nodes.find((n) => n.id === event.nodeId)
                  ?.name || "Unknown";

              console.log('[WorkflowStore] Processing execution-event:', {
                type: event.type,
                nodeId: event.nodeId,
                nodeName,
              });

              switch (event.type) {
                case "node-started":
                  // Update node execution result
                  get().updateNodeExecutionResult(event.nodeId, {
                    nodeId: event.nodeId,
                    nodeName,
                    startTime: new Date(event.timestamp).getTime(),
                  });

                  // Update flow execution state for visual indicators
                  get().updateNodeExecutionState(
                    event.nodeId,
                    NodeExecutionStatus.RUNNING,
                    {
                      startTime: new Date(event.timestamp).getTime(),
                      inputData: event.data?.inputData,
                    }
                  );

                  get().addExecutionLog({
                    timestamp: new Date(event.timestamp).toISOString(),
                    level: "info",
                    nodeId: event.nodeId,
                    message: `Node started: ${nodeName}`,
                    data: { nodeId: event.nodeId, nodeName },
                  });
                  break;

                case "node-completed":
                  // Update node execution result
                  get().updateNodeExecutionResult(event.nodeId, {
                    nodeId: event.nodeId,
                    nodeName,
                    status: "success",
                    endTime: new Date(event.timestamp).getTime(),
                    data: event.data?.outputData || event.data,
                    duration: event.data?.duration,
                  });

                  // Update flow execution state for visual indicators
                  get().updateNodeExecutionState(
                    event.nodeId,
                    NodeExecutionStatus.COMPLETED,
                    {
                      endTime: new Date(event.timestamp).getTime(),
                      outputData: event.data?.outputData || event.data,
                      duration: event.data?.duration,
                    }
                  );

                  get().addExecutionLog({
                    timestamp: new Date(event.timestamp).toISOString(),
                    level: "info",
                    nodeId: event.nodeId,
                    message: `Node completed: ${nodeName}`,
                    data: { nodeId: event.nodeId, nodeName },
                  });
                  break;

                case "node-failed":
                  // Update node execution result
                  get().updateNodeExecutionResult(event.nodeId, {
                    nodeId: event.nodeId,
                    nodeName,
                    status: "error",
                    endTime: new Date(event.timestamp).getTime(),
                    error: event.error,
                  });

                  // Update flow execution state for visual indicators
                  get().updateNodeExecutionState(
                    event.nodeId,
                    NodeExecutionStatus.FAILED,
                    {
                      endTime: new Date(event.timestamp).getTime(),
                      error: event.error,
                    }
                  );

                  get().addExecutionLog({
                    timestamp: new Date(event.timestamp).toISOString(),
                    level: "error",
                    nodeId: event.nodeId,
                    message: `Node failed: ${nodeName} - ${event.error}`,
                    data: { nodeId: event.nodeId, nodeName, error: event.error },
                  });
                  break;
              }
            });

            // Handle node execution events (enhanced for flow execution)
            socketService.on("node-execution-event", (nodeEvent: any) => {
              const { executionState } = get();

              // Only process events for the current execution
              if (nodeEvent.executionId !== executionState.executionId) {
                return;
              }

              const nodeName =
                get().workflow?.nodes.find((n) => n.id === nodeEvent.nodeId)
                  ?.name || "Unknown";

              switch (nodeEvent.type) {
                case "started":
                  // Update node execution result
                  get().updateNodeExecutionResult(nodeEvent.nodeId, {
                    nodeId: nodeEvent.nodeId,
                    nodeName,
                    // Don't set status to "error" - wait for completion event
                    startTime: new Date(nodeEvent.timestamp).getTime(),
                  });

                  // Update flow execution state for visual indicators
                  get().updateNodeExecutionState(
                    nodeEvent.nodeId,
                    NodeExecutionStatus.RUNNING,
                    {
                      startTime: new Date(nodeEvent.timestamp).getTime(),
                      inputData: nodeEvent.data?.inputData,
                    }
                  );

                  get().addExecutionLog({
                    timestamp: new Date(nodeEvent.timestamp).toISOString(),
                    level: "info",
                    nodeId: nodeEvent.nodeId,
                    message: `Node started: ${nodeName}`,
                    data: { nodeId: nodeEvent.nodeId, nodeName },
                  });
                  break;

                case "completed":
                  // Update node execution result
                  get().updateNodeExecutionResult(nodeEvent.nodeId, {
                    nodeId: nodeEvent.nodeId,
                    nodeName,
                    status: "success",
                    endTime: new Date(nodeEvent.timestamp).getTime(),
                    data: nodeEvent.data?.outputData || nodeEvent.data,
                    duration: nodeEvent.data?.duration,
                  });

                  // Update flow execution state for visual indicators
                  get().updateNodeExecutionState(
                    nodeEvent.nodeId,
                    NodeExecutionStatus.COMPLETED,
                    {
                      endTime: new Date(nodeEvent.timestamp).getTime(),
                      outputData: nodeEvent.data?.outputData || nodeEvent.data,
                      duration: nodeEvent.data?.duration,
                    }
                  );

                  get().addExecutionLog({
                    timestamp: new Date(nodeEvent.timestamp).toISOString(),
                    level: "info",
                    nodeId: nodeEvent.nodeId,
                    message: `Node completed: ${nodeName}`,
                    data: {
                      nodeId: nodeEvent.nodeId,
                      nodeName,
                      outputData: nodeEvent.data?.outputData || nodeEvent.data,
                    },
                  });
                  break;

                case "failed":
                  // Update node execution result
                  get().updateNodeExecutionResult(nodeEvent.nodeId, {
                    nodeId: nodeEvent.nodeId,
                    nodeName,
                    status: "error",
                    endTime: new Date(nodeEvent.timestamp).getTime(),
                    error: nodeEvent.error?.message || "Node execution failed",
                  });

                  // Update flow execution state for visual indicators
                  get().updateNodeExecutionState(
                    nodeEvent.nodeId,
                    NodeExecutionStatus.FAILED,
                    {
                      endTime: new Date(nodeEvent.timestamp).getTime(),
                      error: nodeEvent.error,
                      errorMessage:
                        nodeEvent.error?.message || "Node execution failed",
                    }
                  );

                  get().addExecutionLog({
                    timestamp: new Date(nodeEvent.timestamp).toISOString(),
                    level: "error",
                    nodeId: nodeEvent.nodeId,
                    message: `Node failed: ${nodeName} - ${nodeEvent.error?.message || "Unknown error"
                      }`,
                    data: {
                      nodeId: nodeEvent.nodeId,
                      nodeName,
                      error: nodeEvent.error,
                    },
                  });
                  break;
              }
            });

            // Handle socket connection events
            socketService.on("socket-connected", () => {
              get().addExecutionLog({
                timestamp: new Date().toISOString(),
                level: "info",
                message: "Real-time connection established",
              });
            });

            socketService.on("socket-disconnected", (data: any) => {
              get().addExecutionLog({
                timestamp: new Date().toISOString(),
                level: "warn",
                message: `Real-time connection lost: ${data.reason}`,
              });
            });

            socketService.on("socket-error", (data: any) => {
              get().addExecutionLog({
                timestamp: new Date().toISOString(),
                level: "error",
                message: `Real-time connection error: ${data.error}`,
              });
            });

            // Handle webhook test mode triggers
            socketService.on("webhook-test-triggered", async (data: any) => {
              const { workflow } = get();

              // Only process if this is the current workflow
              if (!workflow || workflow.id !== data.workflowId) {
                return;
              }

              // Auto-subscribe if ExecutionWebSocket is connected
              if (executionWebSocket.isConnected()) {
                // Initialize execution context so nodes can be tracked
                const { executionManager } = get();
                // FIXED: Only include nodes reachable from this trigger, not all workflow nodes
                const affectedNodes = workflow ? getAffectedNodes(data.triggerNodeId, workflow) : [];

                executionManager.startExecution(
                  data.executionId,
                  data.triggerNodeId,
                  affectedNodes
                );
                executionManager.setCurrentExecution(data.executionId);

                // Set execution state before subscribing
                get().setExecutionState({
                  executionId: data.executionId,
                  status: "running",
                  progress: 0,
                });

                // Subscribe to execution for real-time updates
                await get().subscribeToExecution(data.executionId);

                get().addExecutionLog({
                  timestamp: new Date().toISOString(),
                  level: "info",
                  message: `Webhook test triggered - watching execution`,
                  data: {
                    executionId: data.executionId,
                    webhookId: data.webhookId,
                    triggerNodeId: data.triggerNodeId,
                  },
                });
              }
            });
          } catch (error) {
            // Silently handle socket setup errors
          }
        };

        setupListeners();
      },

      cleanupSocketListeners: () => {
        const cleanup = async () => {
          try {
            const { socketService } = await import("@/services/socket");

            // Remove all event listeners
            socketService.off("execution-event", () => { });
            socketService.off("execution-progress", () => { });
            socketService.off("execution-log", () => { });
            socketService.off("node-execution-event", () => { });
            socketService.off("socket-connected", () => { });
            socketService.off("socket-disconnected", () => { });
            socketService.off("socket-error", () => { });
            socketService.off("webhook-test-triggered", () => { });
          } catch (error) {
            // Silently handle cleanup errors
          }
        };

        cleanup();
      },

      initializeRealTimeUpdates: () => {
        // Setup socket listeners for real-time updates
        get().setupSocketListeners();
      },

      // Workflow activation methods
      toggleWorkflowActive: () => {
        const { workflow } = get();
        if (!workflow) return;

        const newActiveState = !workflow.active;
        // Skip history in updateWorkflow since we save it explicitly below
        get().updateWorkflow({ active: newActiveState }, true);
        get().saveToHistory(
          `${newActiveState ? "Activate" : "Deactivate"} workflow`
        );

        get().addExecutionLog({
          timestamp: new Date().toISOString(),
          level: "info",
          message: `Workflow ${newActiveState ? "activated" : "deactivated"}`,
        });
      },

      setWorkflowActive: (active: boolean) => {
        const { workflow } = get();
        if (!workflow) return;

        if (workflow.active !== active) {
          // Skip history in updateWorkflow since we save it explicitly below
          get().updateWorkflow({ active }, true);
          get().saveToHistory(`${active ? "Activate" : "Deactivate"} workflow`);

          get().addExecutionLog({
            timestamp: new Date().toISOString(),
            level: "info",
            message: `Workflow ${active ? "activated" : "deactivated"}`,
          });
        }
      },

      // Node lock/unlock
      toggleNodeLock: (nodeId: string) => {
        const { workflow } = get();
        if (!workflow) return;

        const node = workflow.nodes.find((n) => n.id === nodeId);
        if (!node) return;

        const newLockedState = !node.locked;
        get().updateNode(nodeId, { locked: newLockedState });

        get().addExecutionLog({
          timestamp: new Date().toISOString(),
          level: "info",
          message: `Node "${node.name}" ${newLockedState ? "locked" : "unlocked"
            }`,
        });
      },

      // Validation
      validateWorkflow: () => {
        const { workflow } = get();
        const workflowErrors = validateWorkflow(workflow);
        const metadataErrors = workflow
          ? validateMetadata(workflow.metadata)
          : [];

        const allErrors = [...workflowErrors, ...metadataErrors];

        return {
          isValid: allErrors.length === 0,
          errors: allErrors.map((error) => error.message),
        };
      },

      validateConnection: (sourceId, targetId) => {
        const { workflow } = get();
        if (!workflow) return false;

        // Prevent self-connection
        if (sourceId === targetId) return false;

        // Prevent connections TO trigger nodes (triggers are starting points, they don't accept inputs)
        const targetNode = workflow.nodes.find((n) => n.id === targetId);
        if (targetNode) {
          const triggerTypes = [
            "manual-trigger",
            "webhook-trigger",
            "schedule-trigger",
            "workflow-called",
            "webhook",
          ];
          if (triggerTypes.includes(targetNode.type)) {
            return false;
          }
        }

        // Check if connection already exists
        const existingConnection = workflow.connections.find(
          (c) => c.sourceNodeId === sourceId && c.targetNodeId === targetId
        );
        if (existingConnection) return false;

        // Check for circular dependency
        const wouldCreateCircle = (
          currentId: string,
          targetId: string,
          visited = new Set<string>()
        ): boolean => {
          if (currentId === targetId) return true;
          if (visited.has(currentId)) return false;
          visited.add(currentId);

          const outgoing = workflow.connections.filter(
            (c) => c.sourceNodeId === currentId
          );
          return outgoing.some((conn) =>
            wouldCreateCircle(conn.targetNodeId, targetId, visited)
          );
        };

        return !wouldCreateCircle(targetId, sourceId);
      },

      // Helper function to gather input data from connected nodes
      gatherInputDataFromConnectedNodes: (nodeId: string) => {
        const { workflow } = get();
        if (!workflow) return { main: [[]] };

        // Find all connections where this node is the target
        const inputConnections = workflow.connections.filter(
          (conn) => conn.targetNodeId === nodeId
        );

        if (inputConnections.length === 0) {
          return { main: [[]] };
        }

        const inputData: any = { main: [] };

        for (const connection of inputConnections) {
          const sourceNodeId = connection.sourceNodeId;
          const sourceNodeResult = get().getNodeExecutionResult(sourceNodeId);

          if (
            sourceNodeResult &&
            sourceNodeResult.data &&
            (sourceNodeResult.status === "success" ||
              sourceNodeResult.status === "skipped")
          ) {
            let sourceData;
            if (sourceNodeResult.data.main) {
              sourceData = sourceNodeResult.data.main;
            } else if (
              Array.isArray(sourceNodeResult.data) &&
              sourceNodeResult.data[0] &&
              sourceNodeResult.data[0].main
            ) {
              sourceData = sourceNodeResult.data[0].main;
            } else if (sourceNodeResult.status === "skipped") {
              sourceData = [{ json: sourceNodeResult.data }];
            }

            if (Array.isArray(sourceData) && sourceData.length > 0) {
              for (const item of sourceData) {
                if (item && item.json !== undefined) {
                  if (Array.isArray(item.json)) {
                    for (const arrayItem of item.json) {
                      inputData.main.push({ json: arrayItem });
                    }
                  } else if (item.json.data !== undefined) {
                    if (Array.isArray(item.json.data)) {
                      for (const arrayItem of item.json.data) {
                        inputData.main.push({ json: arrayItem });
                      }
                    } else {
                      inputData.main.push({ json: item.json.data });
                    }
                  } else {
                    inputData.main.push({ json: item.json });
                  }
                }
              }
            }
          }
        }

        if (inputData.main.length === 0) {
          inputData.main.push([]);
        }

        return inputData;
      },

      // Node interaction actions
      setShowPropertyPanel: (show: boolean) => {
        set({ showPropertyPanel: show });
        if (!show) {
          set({ propertyPanelNodeId: null });
        }
      },

      setPropertyPanelNode: (nodeId: string | null) => {
        set({
          propertyPanelNodeId: nodeId,
          showPropertyPanel: nodeId !== null,
        });
      },

      // Execution mode control
      setExecutionMode: (enabled: boolean, executionId?: string) => {
        set({
          readOnly: enabled, // Set read-only mode when viewing past execution
          executionState: {
            ...get().executionState,
            executionId: enabled ? executionId : undefined,
          },
        });
      },

      setNodeExecutionResult: (
        nodeId: string,
        result: Partial<NodeExecutionResult>
      ) => {
        const { persistentNodeResults } = get();
        const newPersistentResults = new Map(persistentNodeResults);

        // Merge with existing result if present
        const existing = newPersistentResults.get(nodeId);
        newPersistentResults.set(nodeId, {
          ...existing,
          ...result,
        } as NodeExecutionResult);

        set({ persistentNodeResults: newPersistentResults });
      },

      showContextMenu: (nodeId: string, position: { x: number; y: number }) => {
        set({
          contextMenuVisible: true,
          contextMenuNodeId: nodeId,
          contextMenuPosition: position,
          selectedNodeId: nodeId,
        });
      },

      hideContextMenu: () => {
        set({
          contextMenuVisible: false,
          contextMenuNodeId: null,
          contextMenuPosition: null,
        });
      },

      openNodeProperties: (nodeId: string) => {
        set({
          propertyPanelNodeId: nodeId,
          showPropertyPanel: true,
          selectedNodeId: nodeId,
        });
        // Hide context menu if it's open
        get().hideContextMenu();
      },

      closeNodeProperties: () => {
        set({
          showPropertyPanel: false,
          propertyPanelNodeId: null,
        });
      },

      // Chat dialog actions
      openChatDialog: (nodeId: string) => {
        set({
          showChatDialog: true,
          chatDialogNodeId: nodeId,
        });
      },

      closeChatDialog: () => {
        set({
          showChatDialog: false,
          chatDialogNodeId: null,
        });
      },

      // Template dialog actions
      openTemplateDialog: () => {
        set({
          showTemplateDialog: true,
        });
      },

      closeTemplateDialog: () => {
        set({
          showTemplateDialog: false,
        });
      },

      // Template variable dialog actions
      openTemplateVariableDialog: (nodeType, position) => {
        set({
          showTemplateVariableDialog: true,
          templateVariableDialogData: { nodeType, position },
        });
      },

      closeTemplateVariableDialog: () => {
        set({
          showTemplateVariableDialog: false,
          templateVariableDialogData: null,
        });
      },

      // Error handling
      handleError: (error, operation, showToast) => {
        handleWorkflowError(error, operation, showToast);
      },

      getWorkflowHealth: () => {
        const { workflow } = get();
        const {
          getWorkflowHealthScore,
        } = require("@/utils/workflowErrorHandling");
        return getWorkflowHealthScore(workflow);
      },
    }),
    { name: "workflow-store" }
  )
);
