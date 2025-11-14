export interface WorkflowNode {
  id: string;
  type: string;
  name: string;
  description?: string;
  parameters: Record<string, any>;
  position: { x: number; y: number };
  credentials?: string[];
  disabled: boolean;
  locked?: boolean;
  mockData?: any;
  mockDataPinned?: boolean;
  // Settings configuration
  settings?: NodeSettingsConfig;
  // Visual properties
  icon?: string;
  color?: string;
  // Group node properties
  parentId?: string;
  extent?: "parent" | [number, number, number, number];
  style?: {
    width?: number;
    height?: number;
    backgroundColor?: string;
    [key: string]: any;
  };
}

// Settings are stored as a flat object with key-value pairs
export type NodeSettingsConfig = Record<string, any>;

export interface NodeSetting {
  displayName: string;
  name: string;
  type: "string" | "number" | "boolean" | "options" | "json";
  default: any;
  description: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  hidden?: boolean;
  options?: Array<{ name: string; value: any; description?: string }>;
  displayOptions?: {
    show?: Record<string, any[]>;
    hide?: Record<string, any[]>;
  };
}

export interface WorkflowConnection {
  id: string;
  sourceNodeId: string;
  sourceOutput: string;
  targetNodeId: string;
  targetInput: string;
}

export interface WorkflowSettings {
  timezone?: string;
  saveDataErrorExecution?: "all" | "none";
  saveDataSuccessExecution?: "all" | "none";
  saveManualExecutions?: boolean;
  saveExecutionToDatabase?: boolean; // Skip saving executions to database (for high-traffic APIs)
  callerPolicy?: "workflowsFromSameOwner" | "workflowsFromAList" | "any";
}

export interface WorkflowMetadata {
  title: string;
  lastTitleUpdate: string;
  exportVersion: string;
  importSource?: string;
  createdBy?: string;
  lastModifiedBy?: string;
  version?: number;
  schemaVersion?: string;
  tags?: string[];
  customProperties?: Record<string, any>;
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  userId: string;
  nodes: WorkflowNode[];
  connections: WorkflowConnection[];
  settings: WorkflowSettings;
  active: boolean;
  tags?: string[];
  category?: string;
  isTemplate?: boolean;
  isPublic?: boolean;
  sharedWith?: WorkflowShare[];
  analytics?: WorkflowAnalytics;
  metadata?: WorkflowMetadata;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowShare {
  userId: string;
  userEmail: string;
  permission: "view" | "edit" | "admin";
  sharedAt: string;
}

export interface WorkflowAnalytics {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageExecutionTime: number;
  lastExecutedAt?: string;
  popularityScore: number;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  nodes: WorkflowNode[];
  connections: WorkflowConnection[];
  settings: WorkflowSettings;
  author: string;
  downloads: number;
  rating: number;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowFilters {
  search?: string;
  tags?: string[];
  category?: string;
  isTemplate?: boolean;
  isPublic?: boolean;
  sortBy?: "name" | "createdAt" | "updatedAt" | "popularity" | "executions";
  sortOrder?: "asc" | "desc";
  page?: number;
  limit?: number;
}

export interface WorkflowImportExport {
  workflow: Omit<Workflow, "id" | "userId" | "createdAt" | "updatedAt">;
  version: string;
  exportedAt: string;
  exportedBy: string;
}

export interface NodeType {
  type: string;
  displayName: string;
  name: string;
  group: string[];
  version: number;
  description: string;
  defaults: Record<string, any>;
  inputs: string[];
  outputs: string[];
  icon?: string;
  color?: string;
  outputComponent?: string; // Optional custom output component identifier
  properties: NodeProperty[];
  credentials?: CredentialDefinition[];
  credentialSelector?: {
    displayName: string;
    description?: string;
    placeholder?: string;
    allowedTypes: string[]; // Array of credential type names that can be selected
    required?: boolean;
  };
  active?: boolean; // Added for activation/deactivation functionality
  id?: string; // Optional database ID for custom nodes
  createdAt?: string; // Optional timestamp for custom nodes
  updatedAt?: string; // Optional timestamp for custom nodes
  // Execution metadata from backend
  executionCapability?: "trigger" | "action" | "transform" | "condition";
  canExecuteIndividually?: boolean;
  canBeDisabled?: boolean;
  // Custom settings specific to this node type (flat object)
  settings?: Record<string, NodeSetting>;
}

export interface CredentialDefinition {
  name: string;
  displayName: string;
  description?: string;
  required?: boolean;
}

export interface NodeProperty {
  displayName: string;
  name: string;
  type:
    | "string"
    | "number"
    | "boolean"
    | "options"
    | "multiOptions"
    | "json"
    | "dateTime"
    | "collection"
    | "credential" // New: Support for credential selector
    | "custom"; // New: Support for custom components
  required?: boolean;
  default?: any;
  description?: string;
  tooltip?: string; // Tooltip text shown as help icon next to label
  placeholder?: string;
  options?: Array<{ name: string; value: any }>;
  displayOptions?: {
    show?: Record<string, any[]>;
    hide?: Record<string, any[]>;
  };
  typeOptions?: {
    multipleValues?: boolean;
    multipleValueButtonText?: string;
  };
  // New: Custom component configuration
  component?: string; // Component identifier/name to be registered
  componentProps?: Record<string, any>; // Additional props to pass to custom component (e.g., nested fields for collection)
  // New: For credential type
  allowedTypes?: string[]; // Array of credential type names that can be selected
}

export interface WorkflowEditorState {
  workflow: Workflow | null;
  selectedNodeId: string | null;
  isLoading: boolean;
  isDirty: boolean;
  history: WorkflowHistoryEntry[];
  historyIndex: number;
}

export interface WorkflowHistoryEntry {
  workflow: Workflow;
  timestamp: number;
  action: string;
}

export interface NodePaletteCategory {
  name: string;
  nodes: NodeType[];
}

// React Flow specific types
export interface ReactFlowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: {
    label: string;
    nodeType: string;
    parameters: Record<string, any>;
    disabled: boolean;
  };
}

export interface ReactFlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

// Execution-related types
export interface ExecutionState {
  status: "idle" | "running" | "success" | "error" | "cancelled" | "paused";
  progress?: number;
  startTime?: number;
  endTime?: number;
  error?: string;
  executionId?: string;
}

export interface WorkflowExecutionResult {
  executionId: string;
  workflowId: string;
  status: "success" | "error" | "cancelled";
  startTime: number;
  endTime: number;
  duration: number;
  nodeResults: NodeExecutionResult[];
  error?: string;
  triggerNodeId?: string; // The node ID that triggered this execution
}

export interface NodeExecutionResult {
  nodeId: string;
  nodeName: string;
  status: "success" | "error" | "skipped";
  startTime: number;
  endTime: number;
  duration: number;
  data?: any;
  /** Error message or serialized error object as string */
  error?: string;
}

// Types for WorkflowTrigger node
export interface TriggerOption {
  id: string;
  type: "webhook" | "schedule" | "manual";
  nodeId: string;
  description?: string;
  settings?: Record<string, any>;
}

export interface WorkflowOption {
  id: string;
  name: string;
  description?: string;
  active: boolean;
  triggers: TriggerOption[];
}
