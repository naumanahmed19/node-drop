/**
 * Workflow validation utilities
 */

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

/**
 * Validate workflow structure and data
 */
export function validateWorkflow(workflowData: any): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Basic validation
  if (!workflowData.nodes || workflowData.nodes.length === 0) {
    errors.push("Workflow must contain at least one node");
    return { isValid: false, errors, warnings };
  }

  const nodeIds = new Set<string>(workflowData.nodes.map((node: any) => node.id));
  const nodeIdArray = Array.from(nodeIds);

  // Check for duplicate node IDs
  if (nodeIdArray.length !== workflowData.nodes.length) {
    errors.push("Workflow contains duplicate node IDs");
  }

  // Validate individual nodes
  validateNodes(workflowData.nodes, errors);

  // Validate node connections
  validateConnections(workflowData.connections, nodeIds, errors);

  // Check for circular dependencies
  if (detectCircularDependencies(workflowData.nodes, workflowData.connections || [])) {
    errors.push("Workflow contains circular dependencies");
  }

  // Check for orphaned nodes
  checkOrphanedNodes(workflowData.connections, nodeIdArray, warnings);

  // Validate triggers
  validateTriggers(workflowData.triggers, nodeIds, errors);

  // Validate workflow settings
  validateSettings(workflowData.settings, errors);

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate individual nodes
 */
function validateNodes(nodes: any[], errors: string[]): void {
  for (const node of nodes) {
    if (!node.id || typeof node.id !== "string") {
      errors.push("All nodes must have a valid ID");
    }
    if (!node.type || typeof node.type !== "string") {
      errors.push(`Node ${node.id} must have a valid type`);
    }
    // Allow empty names for group nodes, but require valid string type
    if (node.type === "group") {
      if (typeof node.name !== "string") {
        errors.push(`Node ${node.id} must have a valid name`);
      }
    } else {
      if (!node.name || typeof node.name !== "string") {
        errors.push(`Node ${node.id} must have a valid name`);
      }
    }
    // Validate optional description field
    if (node.description !== undefined && typeof node.description !== "string") {
      errors.push(`Node ${node.id} must have a valid description (string or undefined)`);
    }
    if (
      !node.position ||
      typeof node.position.x !== "number" ||
      typeof node.position.y !== "number"
    ) {
      errors.push(`Node ${node.id} must have valid position coordinates`);
    }
    if (!node.parameters || typeof node.parameters !== "object") {
      errors.push(`Node ${node.id} must have valid parameters object`);
    }
  }
}

/**
 * Validate node connections
 */
function validateConnections(connections: any[], nodeIds: Set<string>, errors: string[]): void {
  if (!connections || connections.length === 0) return;

  const connectionIds = new Set();
  
  for (const connection of connections) {
    // Check for duplicate connection IDs
    if (connectionIds.has(connection.id)) {
      errors.push(`Duplicate connection ID: ${connection.id}`);
    }
    connectionIds.add(connection.id);

    // Validate connection structure
    if (!connection.id || typeof connection.id !== "string") {
      errors.push("All connections must have a valid ID");
    }
    if (!connection.sourceNodeId || !nodeIds.has(connection.sourceNodeId)) {
      errors.push(`Invalid connection: source node ${connection.sourceNodeId} not found`);
    }
    if (!connection.targetNodeId || !nodeIds.has(connection.targetNodeId)) {
      errors.push(`Invalid connection: target node ${connection.targetNodeId} not found`);
    }
    if (!connection.sourceOutput || typeof connection.sourceOutput !== "string") {
      errors.push(`Connection ${connection.id} must have a valid source output`);
    }
    if (!connection.targetInput || typeof connection.targetInput !== "string") {
      errors.push(`Connection ${connection.id} must have a valid target input`);
    }

    // Check for self-connections
    if (connection.sourceNodeId === connection.targetNodeId) {
      errors.push(`Node ${connection.sourceNodeId} cannot connect to itself`);
    }
  }
}

/**
 * Check for orphaned nodes (nodes with no connections)
 */
function checkOrphanedNodes(connections: any[], nodeIdArray: string[], warnings: string[]): void {
  if (!connections || connections.length === 0) return;

  const connectedNodes = new Set();
  connections.forEach((conn: any) => {
    connectedNodes.add(conn.sourceNodeId);
    connectedNodes.add(conn.targetNodeId);
  });

  const orphanedNodes = nodeIdArray.filter((nodeId) => !connectedNodes.has(nodeId));
  if (orphanedNodes.length > 0) {
    warnings.push(`Orphaned nodes detected: ${orphanedNodes.join(", ")}`);
  }
}

/**
 * Validate triggers
 */
function validateTriggers(triggers: any[], nodeIds: Set<string>, errors: string[]): void {
  if (!triggers || triggers.length === 0) return;

  for (const trigger of triggers) {
    if (!trigger.id || typeof trigger.id !== "string") {
      errors.push("All triggers must have a valid ID");
    }
    if (!trigger.type || typeof trigger.type !== "string") {
      errors.push(`Trigger ${trigger.id} must have a valid type`);
    }
    if (!trigger.nodeId || !nodeIds.has(trigger.nodeId)) {
      errors.push(`Trigger ${trigger.id} references non-existent node ${trigger.nodeId}`);
    }
  }
}

/**
 * Validate workflow settings
 */
function validateSettings(settings: any, errors: string[]): void {
  if (!settings) return;

  if (settings.timezone && typeof settings.timezone !== "string") {
    errors.push("Workflow timezone must be a valid string");
  }
  if (
    settings.saveExecutionProgress !== undefined &&
    typeof settings.saveExecutionProgress !== "boolean"
  ) {
    errors.push("saveExecutionProgress must be a boolean");
  }
  if (
    settings.saveDataErrorExecution !== undefined &&
    !["all", "none"].includes(settings.saveDataErrorExecution)
  ) {
    errors.push('saveDataErrorExecution must be "all" or "none"');
  }
  if (
    settings.saveDataSuccessExecution !== undefined &&
    !["all", "none"].includes(settings.saveDataSuccessExecution)
  ) {
    errors.push('saveDataSuccessExecution must be "all" or "none"');
  }
}

/**
 * Detect circular dependencies in workflow graph
 */
function detectCircularDependencies(nodes: any[], connections: any[]): boolean {
  const graph = new Map<string, string[]>();
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  // Build adjacency list
  nodes.forEach((node) => graph.set(node.id, []));
  connections.forEach((conn) => {
    const sourceConnections = graph.get(conn.sourceNodeId) || [];
    sourceConnections.push(conn.targetNodeId);
    graph.set(conn.sourceNodeId, sourceConnections);
  });

  // DFS to detect cycles
  const hasCycle = (nodeId: string): boolean => {
    if (recursionStack.has(nodeId)) return true;
    if (visited.has(nodeId)) return false;

    visited.add(nodeId);
    recursionStack.add(nodeId);

    const neighbors = graph.get(nodeId) || [];
    for (const neighbor of neighbors) {
      if (hasCycle(neighbor)) return true;
    }

    recursionStack.delete(nodeId);
    return false;
  };

  // Check each node for cycles
  for (const node of nodes) {
    if (!visited.has(node.id) && hasCycle(node.id)) {
      return true;
    }
  }

  return false;
}
