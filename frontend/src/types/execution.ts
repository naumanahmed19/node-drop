/**
 * Consolidated execution types - Single source of truth
 * All execution-related types should be defined here
 */

// ============================================================================
// ENUMS
// ============================================================================

export enum NodeExecutionStatus {
  IDLE = "idle",
  QUEUED = "queued",
  RUNNING = "running",
  COMPLETED = "completed",
  FAILED = "failed",
  CANCELLED = "cancelled",
  SKIPPED = "skipped",
}

// ============================================================================
// NODE EXECUTION TYPES
// ============================================================================

export interface NodeExecutionState {
  nodeId: string;
  status: NodeExecutionStatus;
  startTime?: number;
  endTime?: number;
  duration?: number;
  progress?: number;
  error?: ExecutionError;
  inputData?: any;
  outputData?: any;
  dependencies: string[];
  dependents: string[];
}

export interface NodeVisualState {
  nodeId: string;
  status: NodeExecutionStatus;
  progress: number;
  animationState: "idle" | "pulsing" | "spinning" | "success" | "error";
  lastUpdated: number;
  executionTime?: number;
  errorMessage?: string;
}

export interface NodeExecutionError {
  type: 'timeout' | 'network' | 'validation' | 'security' | 'server' | 'unknown';
  message: string;
  userFriendlyMessage: string;
  isRetryable: boolean;
  retryAfter?: number;
  timestamp: number;
  details?: any;
}

// ============================================================================
// ERROR TYPES
// ============================================================================

export interface ExecutionError {
  message: string;
  code?: string;
  details?: any;
  stack?: string;
  nodeId?: string;
  timestamp: number | string; // Support both number and string for compatibility
}

// ============================================================================
// EXECUTION PROGRESS & STATUS
// ============================================================================

export interface ExecutionProgress {
  executionId: string;
  totalNodes: number;
  completedNodes: number;
  failedNodes: number;
  currentNode?: string;
  status: "running" | "success" | "error" | "cancelled" | "paused" | "partial";
  startedAt: string | Date; // Support both for compatibility
  finishedAt?: string | Date;
  error?: ExecutionError;
}

export interface ExecutionFlowStatus {
  executionId: string;
  overallStatus: "running" | "completed" | "failed" | "cancelled";
  progress: number;
  nodeStates: Map<string, NodeExecutionState>;
  currentlyExecuting: string[];
  completedNodes: string[];
  failedNodes: string[];
  queuedNodes: string[];
  executionPath: string[];
  activeEdges?: Set<string>; // NEW: Edges currently being traversed
  completedEdges?: Set<string>; // NEW: Edges that have been traversed
  estimatedTimeRemaining?: number;
}

// ============================================================================
// EXECUTION REQUESTS & RESPONSES
// ============================================================================

export interface ExecutionRequest {
  workflowId: string;
  triggerData?: any;
  triggerNodeId?: string;
  workflowData?: {
    nodes?: any[];
    connections?: any[];
    settings?: any;
  };
  options?: {
    timeout?: number;
    priority?: "low" | "normal" | "high";
    manual?: boolean;
  };
}

export interface ExecutionResponse {
  executionId: string;
  status?: "completed" | "failed" | "cancelled" | "partial";
  executedNodes?: string[];
  failedNodes?: string[];
  duration?: number;
  hasFailures?: boolean;
}

export interface SingleNodeExecutionRequest {
  workflowId: string;
  nodeId: string;
  inputData?: any;
  parameters?: Record<string, any>;
  mode?: "single" | "workflow";
  workflowData?: {
    nodes?: any[];
    connections?: any[];
    settings?: any;
  };
}

export type SingleNodeExecutionResult = ExecutionResponse;

// ============================================================================
// EXECUTION DETAILS
// ============================================================================

export interface ExecutionDetails {
  id: string;
  workflowId: string;
  status: "running" | "success" | "error" | "cancelled" | "paused" | "partial";
  startedAt: string;
  finishedAt?: string;
  triggerData: any;
  error?: any;
  workflowSnapshot?: {
    nodes: any[];
    connections: any[];
    settings?: any;
  };
  nodeExecutions: Array<{
    id: string;
    nodeId: string;
    status: "running" | "success" | "error";
    startedAt: string;
    finishedAt?: string;
    inputData?: any;
    outputData?: any;
    error?: any;
  }>;
}

// ============================================================================
// EXECUTION EVENTS (Socket.io)
// ============================================================================

export interface ExecutionEvent {
  executionId: string;
  type: 'started' | 'node-started' | 'node-completed' | 'node-failed' | 'completed' | 'failed' | 'cancelled';
  nodeId?: string;
  data?: any;
  error?: ExecutionError;
  timestamp: Date | string;
}

export interface NodeExecutionEvent {
  executionId: string;
  nodeId: string;
  type: 'started' | 'completed' | 'failed';
  data?: any;
  timestamp: string;
}

export interface ExecutionLogEntry {
  executionId?: string; // Optional - some logs are not tied to a specific execution
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  nodeId?: string;
  data?: any;
  timestamp: Date | string;
}

// ============================================================================
// EXECUTION METRICS & HISTORY
// ============================================================================

export interface ExecutionMetrics {
  totalNodes: number;
  completedNodes: number;
  failedNodes: number;
  averageNodeDuration: number;
  longestRunningNode: string;
  bottleneckNodes: string[];
  parallelismUtilization: number;
}

export interface ExecutionHistoryEntry {
  executionId: string;
  workflowId: string;
  triggerType: string;
  startTime: number;
  endTime?: number;
  status: string;
  executedNodes: string[];
  executionPath: string[];
  metrics: ExecutionMetrics;
}

// ============================================================================
// FLOW EXECUTION STATE
// ============================================================================

export interface FlowExecutionState {
  activeExecutions: Map<string, ExecutionFlowStatus>;
  nodeVisualStates: Map<string, NodeVisualState>;
  executionHistory: ExecutionHistoryEntry[];
  realTimeUpdates: boolean;
  selectedExecution?: string;
}
