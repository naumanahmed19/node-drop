/**
 * Utility functions for working with trigger nodes
 */

import { NodeDefinition } from "../types/node.types";

/**
 * Get the trigger type from a node definition
 */
export function getTriggerType(nodeDef: NodeDefinition | null | undefined): string | null {
  return nodeDef?.triggerType || null;
}

/**
 * Check if a node is a trigger node
 */
export function isTriggerNode(nodeDef: NodeDefinition | null | undefined): boolean {
  return getTriggerType(nodeDef) !== null;
}

/**
 * Get trigger type from node type identifier using node registry
 */
export function getTriggerTypeFromIdentifier(
  nodeIdentifier: string,
  nodeRegistry: any
): string | null {
  try {
    const nodeDef = nodeRegistry.getNode(nodeIdentifier);
    return getTriggerType(nodeDef);
  } catch (error) {
    return null;
  }
}

/**
 * Check if a node identifier is a trigger using node registry
 */
export function isTriggerNodeIdentifier(
  nodeIdentifier: string,
  nodeRegistry: any
): boolean {
  return getTriggerTypeFromIdentifier(nodeIdentifier, nodeRegistry) !== null;
}

/**
 * Extract triggers from workflow nodes using node registry
 */
export function extractTriggersFromNodes(
  nodes: any[],
  nodeRegistry: any
): any[] {
  if (!Array.isArray(nodes)) {
    return [];
  }

  return nodes
    .filter((node) => {
      const nodeDef = nodeRegistry.getNode(node.type);
      return nodeDef?.triggerType; // Only include nodes with triggerType defined
    })
    .map((node) => {
      const nodeDef = nodeRegistry.getNode(node.type);
      const triggerType = nodeDef.triggerType;
      
      return {
        id: `trigger-${node.id}`,
        type: triggerType,
        nodeId: node.id,
        active: !node.disabled, // Active if node is not disabled
        settings: {
          description: node.parameters?.description || `${triggerType} trigger`,
          ...node.parameters,
        },
      };
    });
}
