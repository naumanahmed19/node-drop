/**
 * Workflow-specific error handling utilities
 * Extends the base error handling with workflow operation specific logic
 */

import { Workflow, WorkflowConnection, WorkflowNode } from "@/types/workflow";
import {
  ErrorCodes,
  createOperationError,
  extractErrorDetails,
  getRecoverySuggestions,
  getUserFriendlyErrorMessage,
  isRecoverableError,
  logError,
  validateTitle,
  type OperationError,
  type ValidationError,
} from "./errorHandling";

/**
 * Workflow-specific error codes
 */
export const WorkflowErrorCodes = {
  ...ErrorCodes,
  // Workflow validation errors
  WORKFLOW_EMPTY: "WORKFLOW_EMPTY",
  WORKFLOW_NO_NODES: "WORKFLOW_NO_NODES",
  WORKFLOW_ORPHANED_NODES: "WORKFLOW_ORPHANED_NODES",
  WORKFLOW_CIRCULAR_DEPENDENCY: "WORKFLOW_CIRCULAR_DEPENDENCY",
  WORKFLOW_INVALID_CONNECTIONS: "WORKFLOW_INVALID_CONNECTIONS",
  WORKFLOW_MISSING_START_NODE: "WORKFLOW_MISSING_START_NODE",

  // Node-specific errors
  NODE_INVALID_TYPE: "NODE_INVALID_TYPE",
  NODE_MISSING_REQUIRED_PARAMS: "NODE_MISSING_REQUIRED_PARAMS",
  NODE_INVALID_POSITION: "NODE_INVALID_POSITION",
  NODE_DUPLICATE_ID: "NODE_DUPLICATE_ID",

  // Connection-specific errors
  CONNECTION_INVALID_SOURCE: "CONNECTION_INVALID_SOURCE",
  CONNECTION_INVALID_TARGET: "CONNECTION_INVALID_TARGET",
  CONNECTION_SELF_REFERENCE: "CONNECTION_SELF_REFERENCE",
  CONNECTION_DUPLICATE: "CONNECTION_DUPLICATE",

  // Import/Export specific errors
  IMPORT_VERSION_MISMATCH: "IMPORT_VERSION_MISMATCH",
  IMPORT_CORRUPTED_DATA: "IMPORT_CORRUPTED_DATA",
  EXPORT_SERIALIZATION_FAILED: "EXPORT_SERIALIZATION_FAILED",

  // Execution specific errors
  EXECUTION_NODE_TIMEOUT: "EXECUTION_NODE_TIMEOUT",
  EXECUTION_RESOURCE_LIMIT: "EXECUTION_RESOURCE_LIMIT",
  EXECUTION_PERMISSION_ERROR: "EXECUTION_PERMISSION_ERROR",
} as const;

export type WorkflowErrorCode =
  (typeof WorkflowErrorCodes)[keyof typeof WorkflowErrorCodes];

/**
 * Validate a complete workflow
 */
export function validateWorkflow(workflow: Workflow | null): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!workflow) {
    errors.push({
      field: "workflow",
      message: "No workflow loaded",
      code: ErrorCodes.VALIDATION_ERROR,
    });
    return errors;
  }

  // Validate title
  const titleErrors = validateTitle(workflow.name);
  errors.push(
    ...titleErrors.map((error) => ({ ...error, field: "workflow.name" }))
  );

  // Validate nodes
  if (!workflow.nodes || workflow.nodes.length === 0) {
    errors.push({
      field: "workflow.nodes",
      message: "Workflow must contain at least one node",
      code: ErrorCodes.VALIDATION_ERROR,
    });
  } else {
    const nodeErrors = validateWorkflowNodes(workflow.nodes);
    errors.push(...nodeErrors);
  }

  // Validate connections
  if (workflow.connections) {
    const connectionErrors = validateWorkflowConnections(
      workflow.connections,
      workflow.nodes
    );
    errors.push(...connectionErrors);
  }

  // Check for orphaned nodes (only if there are multiple nodes)
  if (workflow.nodes.length > 1) {
    const orphanedNodes = findOrphanedNodes(
      workflow.nodes,
      workflow.connections
    );
    if (orphanedNodes.length > 0) {
      errors.push({
        field: "workflow.connections",
        message: `Orphaned nodes found: ${orphanedNodes
          .map((n) => n.name)
          .join(", ")}`,
        code: ErrorCodes.VALIDATION_ERROR,
      });
    }
  }

  // Check for circular dependencies
  if (hasCircularDependencies(workflow.nodes, workflow.connections)) {
    errors.push({
      field: "workflow.connections",
      message: "Circular dependency detected in workflow",
      code: ErrorCodes.VALIDATION_ERROR,
    });
  }

  return errors;
}

/**
 * Validate workflow nodes
 */
export function validateWorkflowNodes(
  nodes: WorkflowNode[]
): ValidationError[] {
  const errors: ValidationError[] = [];
  const nodeIds = new Set<string>();

  nodes.forEach((node, index) => {
    const fieldPrefix = `workflow.nodes[${index}]`;

    // Check for duplicate IDs
    if (nodeIds.has(node.id)) {
      errors.push({
        field: `${fieldPrefix}.id`,
        message: `Duplicate node ID: ${node.id}`,
        code: ErrorCodes.VALIDATION_ERROR,
      });
    } else {
      nodeIds.add(node.id);
    }

    // Validate required fields
    if (!node.id) {
      errors.push({
        field: `${fieldPrefix}.id`,
        message: "Node ID is required",
        code: ErrorCodes.VALIDATION_ERROR,
      });
    }

    if (!node.type) {
      errors.push({
        field: `${fieldPrefix}.type`,
        message: "Node type is required",
        code: ErrorCodes.VALIDATION_ERROR,
      });
    }

    if (!node.name) {
      errors.push({
        field: `${fieldPrefix}.name`,
        message: "Node name is required",
        code: ErrorCodes.VALIDATION_ERROR,
      });
    }

    // Validate position
    if (
      !node.position ||
      typeof node.position.x !== "number" ||
      typeof node.position.y !== "number"
    ) {
      errors.push({
        field: `${fieldPrefix}.position`,
        message: "Node must have valid position coordinates",
        code: ErrorCodes.VALIDATION_ERROR,
      });
    }
  });

  return errors;
}

/**
 * Validate workflow connections
 */
export function validateWorkflowConnections(
  connections: WorkflowConnection[],
  nodes: WorkflowNode[]
): ValidationError[] {
  const errors: ValidationError[] = [];
  const nodeIds = new Set(nodes.map((n) => n.id));
  const connectionKeys = new Set<string>();

  connections.forEach((connection, index) => {
    const fieldPrefix = `workflow.connections[${index}]`;

    // Check for duplicate connections
    const connectionKey = `${connection.sourceNodeId}->${connection.targetNodeId}`;
    if (connectionKeys.has(connectionKey)) {
      errors.push({
        field: `${fieldPrefix}`,
        message: `Duplicate connection: ${connectionKey}`,
        code: ErrorCodes.VALIDATION_ERROR,
      });
    } else {
      connectionKeys.add(connectionKey);
    }

    // Validate source node exists
    if (!nodeIds.has(connection.sourceNodeId)) {
      errors.push({
        field: `${fieldPrefix}.sourceNodeId`,
        message: `Source node not found: ${connection.sourceNodeId}`,
        code: ErrorCodes.VALIDATION_ERROR,
      });
    }

    // Validate target node exists
    if (!nodeIds.has(connection.targetNodeId)) {
      errors.push({
        field: `${fieldPrefix}.targetNodeId`,
        message: `Target node not found: ${connection.targetNodeId}`,
        code: ErrorCodes.VALIDATION_ERROR,
      });
    }

    // Check for self-reference
    if (connection.sourceNodeId === connection.targetNodeId) {
      errors.push({
        field: `${fieldPrefix}`,
        message: "Node cannot connect to itself",
        code: ErrorCodes.VALIDATION_ERROR,
      });
    }
  });

  return errors;
}

/**
 * Find orphaned nodes (nodes with no connections)
 * Note: Group nodes are excluded as they are visual containers
 */
export function findOrphanedNodes(
  nodes: WorkflowNode[],
  connections: WorkflowConnection[]
): WorkflowNode[] {
  const connectedNodeIds = new Set([
    ...connections.map((c) => c.sourceNodeId),
    ...connections.map((c) => c.targetNodeId),
  ]);

  return nodes.filter(
    (node) => node.type !== "group" && !connectedNodeIds.has(node.id)
  );
}

/**
 * Check for circular dependencies in workflow
 */
export function hasCircularDependencies(
  nodes: WorkflowNode[],
  connections: WorkflowConnection[]
): boolean {
  const adjacencyList = new Map<string, string[]>();

  // Build adjacency list
  nodes.forEach((node) => {
    adjacencyList.set(node.id, []);
  });

  connections.forEach((connection) => {
    const targets = adjacencyList.get(connection.sourceNodeId) || [];
    targets.push(connection.targetNodeId);
    adjacencyList.set(connection.sourceNodeId, targets);
  });

  // DFS to detect cycles
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  const hasCycle = (nodeId: string): boolean => {
    if (recursionStack.has(nodeId)) return true;
    if (visited.has(nodeId)) return false;

    visited.add(nodeId);
    recursionStack.add(nodeId);

    const neighbors = adjacencyList.get(nodeId) || [];
    for (const neighbor of neighbors) {
      if (hasCycle(neighbor)) return true;
    }

    recursionStack.delete(nodeId);
    return false;
  };

  for (const nodeId of adjacencyList.keys()) {
    if (!visited.has(nodeId) && hasCycle(nodeId)) {
      return true;
    }
  }

  return false;
}

/**
 * Create workflow operation error with context
 */
export function createWorkflowError(
  _code: WorkflowErrorCode,
  message: string,
  workflowId?: string,
  nodeId?: string,
  details?: string
): OperationError {
  const context: Record<string, any> = {};

  if (workflowId) context.workflowId = workflowId;
  if (nodeId) context.nodeId = nodeId;

  return createOperationError(
    ErrorCodes.VALIDATION_ERROR,
    message,
    details,
    context,
    isRecoverableError({ code: ErrorCodes.VALIDATION_ERROR })
  );
}

/**
 * Handle workflow operation errors with appropriate user feedback
 */
export function handleWorkflowError(
  error: unknown,
  operation: string,
  showToast?: (type: "error" | "warning", title: string, options?: any) => void
): void {
  const details = extractErrorDetails(error);
  const userMessage = getUserFriendlyErrorMessage(error);
  const suggestions = getRecoverySuggestions(error);

  // Log error for debugging
  logError(error, { operation });

  // Show user feedback if toast function provided
  if (showToast) {
    const isWarning = [
      ErrorCodes.TITLE_EMPTY,
      ErrorCodes.TITLE_TOO_LONG,
      ErrorCodes.TITLE_INVALID_CHARS,
      ErrorCodes.FILE_TOO_LARGE,
      ErrorCodes.FILE_INVALID_EXTENSION,
      ErrorCodes.FILE_CORRUPTED,
      ErrorCodes.NETWORK_ERROR,
      ErrorCodes.TIMEOUT_ERROR,
      ErrorCodes.EXECUTION_FAILED,
      ErrorCodes.NODE_EXECUTION_FAILED,
      ErrorCodes.IMPORT_FAILED,
      ErrorCodes.EXPORT_FAILED,
      ErrorCodes.UNKNOWN_ERROR,
      ErrorCodes.VALIDATION_ERROR,
    ].includes(details.code);

    showToast(isWarning ? "warning" : "error", `${operation} failed`, {
      message: userMessage,
      duration: isWarning ? 6000 : 8000,
      actions:
        suggestions.length > 0
          ? [
              {
                label: "Show Help",
                onClick: () => {
                  // Could show a help dialog with suggestions
                  console.log("Recovery suggestions:", suggestions);
                },
              },
            ]
          : undefined,
    });
  }
}

/**
 * Validate workflow before execution
 */
export function validateWorkflowForExecution(workflow: Workflow | null): {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
} {
  const errors = validateWorkflow(workflow);
  const warnings: ValidationError[] = [];

  if (!workflow) {
    return { isValid: false, errors, warnings };
  }

  // Additional execution-specific validations
  const startNodes = workflow.nodes.filter(
    (node) => !workflow.connections.some((c) => c.targetNodeId === node.id)
  );

  if (startNodes.length === 0 && workflow.nodes.length > 0) {
    errors.push({
      field: "workflow",
      message: "Workflow has no start node (node with no incoming connections)",
      code: ErrorCodes.VALIDATION_ERROR,
    });
  }

  // Check for disabled nodes that might affect execution
  const disabledNodes = workflow.nodes.filter((node) => node.disabled);
  if (disabledNodes.length > 0) {
    warnings.push({
      field: "workflow.nodes",
      message: `${disabledNodes.length} node(s) are disabled and will be skipped during execution`,
      code: ErrorCodes.VALIDATION_ERROR,
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Get workflow health score (0-100)
 */
export function getWorkflowHealthScore(workflow: Workflow | null): {
  score: number;
  issues: string[];
  suggestions: string[];
} {
  if (!workflow) {
    return {
      score: 0,
      issues: ["No workflow loaded"],
      suggestions: ["Load a workflow to continue"],
    };
  }

  const validation = validateWorkflow(workflow);
  const issues: string[] = [];
  const suggestions: string[] = [];
  let score = 100;

  // Deduct points for errors
  validation.forEach((error) => {
    issues.push(error.message);

    switch (error.code) {
      case ErrorCodes.VALIDATION_ERROR:
        score -= 50;
        suggestions.push("Add nodes to your workflow");
        break;
      case ErrorCodes.VALIDATION_ERROR:
        score -= 20;
        suggestions.push("Connect all nodes or remove unused ones");
        break;
      case ErrorCodes.VALIDATION_ERROR:
        score -= 30;
        suggestions.push("Remove circular dependencies between nodes");
        break;
      default:
        score -= 10;
    }
  });

  // Additional health checks
  if (workflow.nodes.length === 1) {
    score -= 10;
    suggestions.push("Consider adding more nodes for a complete workflow");
  }

  const connectionRatio =
    workflow.connections.length / Math.max(workflow.nodes.length - 1, 1);
  if (connectionRatio < 0.5 && workflow.nodes.length > 2) {
    score -= 15;
    issues.push("Low connectivity between nodes");
    suggestions.push("Add more connections between nodes");
  }

  return {
    score: Math.max(0, score),
    issues,
    suggestions,
  };
}
