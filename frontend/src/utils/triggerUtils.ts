/**
 * Utility functions for working with trigger nodes in the frontend
 */

import { NodeType, WorkflowNode } from '../types/workflow'

/**
 * Check if a node type is a trigger
 * Uses nodeCategory (all trigger nodes should have this)
 */
export function isTriggerNodeType(nodeType: NodeType | undefined): boolean {
  if (!nodeType) return false
  
  // Check nodeCategory (all trigger nodes have this now)
  if (nodeType.nodeCategory === 'trigger') return true
  
  // Legacy fallback: check triggerType for older nodes
  return nodeType.triggerType !== undefined
}

/**
 * Check if a workflow node is a trigger using available node types
 */
export function isTriggerNode(node: WorkflowNode, nodeTypes: NodeType[]): boolean {
  const nodeType = nodeTypes.find(nt => nt.identifier === node.type)
  return isTriggerNodeType(nodeType)
}

/**
 * Get trigger type from a node
 */
export function getTriggerType(node: WorkflowNode, nodeTypes: NodeType[]): string | undefined {
  const nodeType = nodeTypes.find(nt => nt.identifier === node.type)
  return nodeType?.triggerType
}

/**
 * Get all trigger nodes from a workflow
 */
export function getTriggerNodes(nodes: WorkflowNode[], nodeTypes: NodeType[]): WorkflowNode[] {
  return nodes.filter(node => isTriggerNode(node, nodeTypes))
}

/**
 * Extract triggers from workflow nodes (for saving to backend)
 * Note: This is a simplified version that checks node type naming patterns
 * The backend will properly extract triggers using node definitions
 */
export function extractTriggersFromNodes(nodes: WorkflowNode[]): any[] {
  if (!Array.isArray(nodes)) {
    return []
  }

  // Simple extraction based on node type naming patterns
  // Backend will validate and enrich using actual node definitions
  return nodes
    .filter((node) => {
      // Check if node type includes 'trigger' in its identifier
      return node.type.toLowerCase().includes('trigger')
    })
    .map((node) => ({
      id: `trigger-${node.id}`,
      nodeId: node.id,
      active: !node.disabled,
      settings: {
        description: node.parameters?.description || `${node.name} trigger`,
        ...node.parameters,
      },
    }))
}
