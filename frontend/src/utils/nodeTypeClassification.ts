/**
 * Node type classification utilities for determining execution capabilities
 * and toolbar button visibility
 *
 * This module now uses data from the node types store/API instead of hardcoded registry.
 * The metadata comes directly from backend node definitions.
 */

import type {
  NodeExecutionCapability,
  NodeTypeMetadata,
} from "@/components/workflow/types";
import type { NodeType } from "@/types";

// Cache for node types data from store
let nodeTypesCache: NodeType[] = [];

/**
 * Initialize or update the node types cache
 * This should be called when the store loads node types
 */
export function updateNodeTypesCache(nodeTypes: NodeType[]): void {
  nodeTypesCache = nodeTypes;
}

/**
 * Get node type data from cache
 */
function getNodeTypeData(nodeType: string): NodeType | null {
  return (
    nodeTypesCache.find(
      (nt) =>
        nt.identifier === nodeType ||
        nt.name === nodeType ||
        nt.displayName === nodeType
    ) || null
  );
}

/**
 * Get node type metadata for a given node type
 * Now retrieves from cached node types data
 */
export function getNodeTypeMetadata(nodeType: string): NodeTypeMetadata | null {
  const nodeData = getNodeTypeData(nodeType);

  if (!nodeData) {
    return null;
  }

  return {
    type: nodeData.identifier,
    group: nodeData.group,
    executionCapability:
      nodeData.executionCapability || determineExecutionCapability(nodeData),
    canExecuteIndividually:
      nodeData.canExecuteIndividually ??
      determineCanExecuteIndividually(nodeData),
    canBeDisabled: nodeData.canBeDisabled ?? true,
  };
}

/**
 * Fallback: Determine execution capability from group if not provided by backend
 */
function determineExecutionCapability(
  nodeData: NodeType
): NodeExecutionCapability {
  const group = nodeData.group;

  if (group.includes("trigger")) {
    return "trigger";
  } else if (group.includes("condition")) {
    return "condition";
  } else if (group.includes("transform")) {
    return "transform";
  } else {
    return "action";
  }
}

/**
 * Fallback: Determine if node can execute individually
 */
function determineCanExecuteIndividually(nodeData: NodeType): boolean {
  return nodeData.group.includes("trigger");
}

/**
 * Check if a node can be executed individually
 */
export function canNodeExecuteIndividually(nodeType: string): boolean {
  const metadata = getNodeTypeMetadata(nodeType);
  return metadata?.canExecuteIndividually ?? false;
}

/**
 * Check if a node can be disabled
 */
export function canNodeBeDisabled(nodeType: string): boolean {
  const metadata = getNodeTypeMetadata(nodeType);
  return metadata?.canBeDisabled ?? true;
}

/**
 * Get the execution capability of a node
 */
export function getNodeExecutionCapability(
  nodeType: string
): NodeExecutionCapability | null {
  const metadata = getNodeTypeMetadata(nodeType);
  return metadata?.executionCapability ?? null;
}

/**
 * Check if a node is a trigger type
 */
export function isTriggerNode(nodeType: string): boolean {
  const metadata = getNodeTypeMetadata(nodeType);
  return metadata?.executionCapability === "trigger";
}

/**
 * Check if a node is an action type
 */
export function isActionNode(nodeType: string): boolean {
  const metadata = getNodeTypeMetadata(nodeType);
  return metadata?.executionCapability === "action";
}

/**
 * Check if a node is a transform type
 */
export function isTransformNode(nodeType: string): boolean {
  const metadata = getNodeTypeMetadata(nodeType);
  return metadata?.executionCapability === "transform";
}

/**
 * Check if a node is a condition type
 */
export function isConditionNode(nodeType: string): boolean {
  const metadata = getNodeTypeMetadata(nodeType);
  return metadata?.executionCapability === "condition";
}

/**
 * Get all registered node types from cache
 */
export function getAllNodeTypes(): string[] {
  return nodeTypesCache.map((nt) => nt.identifier);
}

/**
 * Register/update node type in cache (for extensibility)
 * Note: This modifies the cache, prefer using updateNodeTypesCache for bulk updates
 */
export function registerNodeType(
  nodeType: string,
  metadata: NodeTypeMetadata
): void {
  const existingIndex = nodeTypesCache.findIndex((nt) => nt.identifier === nodeType);

  const nodeData: NodeType = {
    identifier: metadata.type,
    displayName: metadata.type,
    name: metadata.type,
    group: metadata.group,
    version: 1,
    description: "",
    defaults: {},
    inputs: ["main"],
    outputs: ["main"],
    properties: [],
    executionCapability: metadata.executionCapability,
    canExecuteIndividually: metadata.canExecuteIndividually,
    canBeDisabled: metadata.canBeDisabled,
  };

  if (existingIndex >= 0) {
    nodeTypesCache[existingIndex] = nodeData;
  } else {
    nodeTypesCache.push(nodeData);
  }
}

/**
 * Check if execute button should be visible for a node
 * Execute button should be hidden for service/tool nodes
 */
export function shouldShowExecuteButton(nodeType: string): boolean {
  // First check if it's a service or tool node (not executable)
  const nodeData = getNodeTypeData(nodeType);
  if (nodeData) {
    const nodeCategory = (nodeData as any).nodeCategory;
    if (nodeCategory === 'service' || nodeCategory === 'tool') {
      return false;
    }
  }
  
  // Then check if it can execute individually
  return canNodeExecuteIndividually(nodeType);
}

/**
 * Check if disable toggle button should be visible for a node
 */
export function shouldShowDisableButton(nodeType: string): boolean {
  return canNodeBeDisabled(nodeType);
}
